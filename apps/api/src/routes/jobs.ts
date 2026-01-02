import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin } from '../plugins/auth.js'
import {
  syncMovies,
  generateMissingEmbeddings,
  syncWatchHistoryForAllUsers,
  generateRecommendationsForAllUsers,
  clearAndRebuildAllRecommendations,
  processStrmForAllUsers,
  createChildLogger,
  getJobProgress,
  getAllJobProgress,
  subscribeToJob,
  subscribeToAllJobs,
  purgeMovieDatabase,
  getMovieDatabaseStats,
  type JobProgress,
} from '@aperture/core'
import { randomUUID } from 'crypto'

const logger = createChildLogger('jobs-api')

interface JobInfo {
  name: string
  description: string
  cron: string | null
  lastRun: Date | null
  status: 'idle' | 'running' | 'failed'
  currentJobId?: string
}

// Track active job IDs per job type
const activeJobs: Map<string, string> = new Map()

const jobDefinitions: Omit<JobInfo, 'lastRun' | 'status' | 'currentJobId'>[] = [
  {
    name: 'sync-movies',
    description: 'Sync movies from media server',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-embeddings',
    description: 'Generate AI embeddings for movies',
    cron: null,
  },
  {
    name: 'sync-watch-history',
    description: 'Sync watch history for all users',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-recommendations',
    description: 'Generate AI recommendations for users',
    cron: process.env.RECS_CRON || '0 4 * * *',
  },
  {
    name: 'rebuild-recommendations',
    description: 'Clear all recommendations and rebuild from scratch',
    cron: null,
  },
  {
    name: 'update-permissions',
    description: 'Update STRM files and permissions',
    cron: process.env.PERMS_CRON || '0 5 * * *',
  },
]

const jobsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/jobs
   * List all jobs with their status
   */
  fastify.get('/api/jobs', { preHandler: requireAdmin }, async (_request, reply) => {
    const jobs = jobDefinitions.map((def) => {
      const activeJobId = activeJobs.get(def.name)
      const progress = activeJobId ? getJobProgress(activeJobId) : null

      return {
        ...def,
        status: progress?.status === 'running' ? 'running' : 'idle',
        currentJobId: activeJobId,
        progress: progress ? {
          overallProgress: progress.overallProgress,
          currentStep: progress.currentStep,
          itemsProcessed: progress.itemsProcessed,
          itemsTotal: progress.itemsTotal,
        } : null,
      }
    })

    return reply.send({ jobs })
  })

  /**
   * POST /api/jobs/:name/run
   * Trigger a job to run manually
   */
  fastify.post<{ Params: { name: string } }>(
    '/api/jobs/:name/run',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { name } = request.params

      const jobDef = jobDefinitions.find((j) => j.name === name)
      if (!jobDef) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      // Check if job is already running
      const existingJobId = activeJobs.get(name)
      if (existingJobId) {
        const progress = getJobProgress(existingJobId)
        if (progress?.status === 'running') {
          return reply.status(409).send({
            error: 'Job is already running',
            jobId: existingJobId,
          })
        }
      }

      // Create new job ID
      const jobId = randomUUID()
      activeJobs.set(name, jobId)

      logger.info({ job: name, jobId }, `Starting job: ${name}`)

      // Run job in background (don't await)
      runJob(name, jobId).catch((err) => {
        logger.error({ err, job: name, jobId }, 'Job failed')
      })

      return reply.send({
        message: `Job ${name} started`,
        jobId,
        status: 'running',
      })
    }
  )

  /**
   * GET /api/jobs/:name
   * Get job details
   */
  fastify.get<{ Params: { name: string } }>(
    '/api/jobs/:name',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { name } = request.params

      const jobDef = jobDefinitions.find((j) => j.name === name)
      if (!jobDef) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const activeJobId = activeJobs.get(name)
      const progress = activeJobId ? getJobProgress(activeJobId) : null

      return reply.send({
        ...jobDef,
        currentJobId: activeJobId,
        progress,
      })
    }
  )

  /**
   * GET /api/jobs/:jobId/progress
   * Get detailed progress for a specific job run
   */
  fastify.get<{ Params: { jobId: string } }>(
    '/api/jobs/progress/:jobId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { jobId } = request.params
      const progress = getJobProgress(jobId)

      if (!progress) {
        return reply.status(404).send({ error: 'Job not found or expired' })
      }

      return reply.send(progress)
    }
  )

  /**
   * GET /api/jobs/progress/stream/:jobId
   * Server-Sent Events stream for real-time job progress
   */
  fastify.get<{ Params: { jobId: string } }>(
    '/api/jobs/progress/stream/:jobId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { jobId } = request.params

      // Track if connection is still open
      let isConnectionOpen = true

      // Set up SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })

      // Safe write function that checks connection state
      const safeWrite = (data: string): boolean => {
        if (!isConnectionOpen) return false
        try {
          reply.raw.write(data)
          return true
        } catch {
          isConnectionOpen = false
          return false
        }
      }

      // Send initial progress
      const initialProgress = getJobProgress(jobId)
      if (initialProgress) {
        safeWrite(`data: ${JSON.stringify(initialProgress)}\n\n`)
      }

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        if (!safeWrite(': heartbeat\n\n')) {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Subscribe to updates
      const unsubscribe = subscribeToJob(jobId, (progress: JobProgress) => {
        if (!safeWrite(`data: ${JSON.stringify(progress)}\n\n`)) {
          unsubscribe()
          clearInterval(heartbeat)
          return
        }

        // Close connection when job completes
        if (progress.status === 'completed' || progress.status === 'failed') {
          setTimeout(() => {
            clearInterval(heartbeat)
            unsubscribe()
            isConnectionOpen = false
            try {
              reply.raw.end()
            } catch {
              // Connection already closed
            }
          }, 1000)
        }
      })

      // Clean up on client disconnect
      request.raw.on('close', () => {
        isConnectionOpen = false
        clearInterval(heartbeat)
        unsubscribe()
      })

      // Handle errors on the response stream
      reply.raw.on('error', (err) => {
        logger.debug({ err, jobId }, 'SSE stream error (client likely disconnected)')
        isConnectionOpen = false
        clearInterval(heartbeat)
        unsubscribe()
      })
    }
  )

  /**
   * GET /api/jobs/active
   * Get all active/running jobs
   */
  fastify.get('/api/jobs/active', { preHandler: requireAdmin }, async (_request, reply) => {
    const allProgress = getAllJobProgress()
    return reply.send({ jobs: allProgress })
  })

  // =========================================================================
  // Database Purge Routes
  // =========================================================================

  /**
   * GET /api/admin/purge/stats
   * Get current database stats before purge
   */
  fastify.get('/api/admin/purge/stats', { preHandler: requireAdmin }, getPurgeStats)

  /**
   * POST /api/admin/purge/movies
   * Purge all movie-related data (requires confirmation)
   */
  fastify.post<{ Body: { confirm: boolean } }>(
    '/api/admin/purge/movies',
    { preHandler: requireAdmin },
    executePurge
  )
}

// Job execution - calls actual implementations from @aperture/core
async function runJob(name: string, jobId: string): Promise<void> {
  const startTime = Date.now()

  try {
    logger.info({ job: name, jobId }, `🚀 Starting job: ${name}`)

    switch (name) {
      case 'sync-movies': {
        const result = await syncMovies(jobId)
        logger.info({
          job: name,
          jobId,
          added: result.added,
          updated: result.updated,
          total: result.total,
        }, `✅ Movie sync complete`)
        break
      }
      case 'generate-embeddings': {
        const result = await generateMissingEmbeddings(jobId)
        logger.info({
          job: name,
          jobId,
          generated: result.generated,
          failed: result.failed,
        }, `✅ Embeddings complete`)
        break
      }
      case 'sync-watch-history': {
        const result = await syncWatchHistoryForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
          totalItems: result.totalItems,
        }, `✅ Watch history sync complete`)
        break
      }
      case 'generate-recommendations': {
        const result = await generateRecommendationsForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
        }, `✅ Recommendations complete`)
        break
      }
      case 'rebuild-recommendations': {
        const result = await clearAndRebuildAllRecommendations(jobId)
        logger.info({
          job: name,
          jobId,
          cleared: result.cleared,
          success: result.success,
          failed: result.failed,
        }, `✅ Recommendations rebuilt`)
        break
      }
      case 'update-permissions': {
        const result = await processStrmForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
        }, `✅ STRM processing complete`)
        break
      }
      default:
        throw new Error(`Unknown job: ${name}`)
    }

    const duration = Date.now() - startTime
    logger.info({ job: name, jobId, duration }, `🏁 Job completed: ${name} (${duration}ms)`)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ job: name, jobId, err }, `❌ Job failed: ${name}`)
    throw err
  }
}

// =========================================================================
// Database Purge Endpoints
// =========================================================================

/**
 * GET /api/admin/purge/stats
 * Get current database stats before purge
 */
async function getPurgeStats(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const stats = await getMovieDatabaseStats()
    reply.send({ stats })
  } catch (err) {
    logger.error({ err }, 'Failed to get database stats')
    reply.status(500).send({ error: 'Failed to get database stats' })
  }
}

/**
 * POST /api/admin/purge/movies
 * Purge all movie-related data (requires confirmation)
 */
async function executePurge(
  request: FastifyRequest<{ Body: { confirm: boolean } }>,
  reply: FastifyReply
): Promise<void> {
  const { confirm } = request.body

  if (!confirm) {
    return reply.status(400).send({ 
      error: 'Purge requires confirmation. Send { confirm: true } to proceed.' 
    })
  }

  try {
    logger.warn('🗑️ Admin initiated movie database purge')
    const result = await purgeMovieDatabase()
    logger.info({ result }, '✅ Movie database purge complete')
    reply.send({ 
      success: true, 
      message: 'Movie database purged successfully',
      result 
    })
  } catch (err) {
    logger.error({ err }, 'Failed to purge movie database')
    reply.status(500).send({ error: 'Failed to purge movie database' })
  }
}

export default jobsRoutes
