import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { requireAdmin } from '../plugins/auth.js'
import {
  syncMovies,
  generateMissingEmbeddings,
  syncWatchHistoryForAllUsers,
  generateRecommendationsForAllUsers,
  clearAndRebuildAllRecommendations,
  processStrmForAllUsers,
  // Series imports
  syncSeries,
  generateMissingSeriesEmbeddings,
  syncSeriesWatchHistoryForAllUsers,
  generateSeriesRecommendationsForAllUsers,
  processSeriesStrmForAllUsers,
  // Common
  createChildLogger,
  getJobProgress,
  getAllJobProgress,
  subscribeToJob,
  subscribeToAllJobs,
  cancelJob,
  purgeMovieDatabase,
  getMovieDatabaseStats,
  getJobConfig,
  getAllJobConfigs,
  setJobConfig,
  formatSchedule,
  getValidJobNames,
  type JobProgress,
  type ScheduleType,
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
  // === Movie Jobs ===
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
    description: 'Sync movie watch history for all users',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-recommendations',
    description: 'Generate AI movie recommendations for users',
    cron: process.env.RECS_CRON || '0 4 * * *',
  },
  {
    name: 'rebuild-recommendations',
    description: 'Clear all movie recommendations and rebuild',
    cron: null,
  },
  {
    name: 'sync-strm',
    description: 'Create movie STRM files and user libraries',
    cron: process.env.PERMS_CRON || '0 5 * * *',
  },
  // === Series Jobs ===
  {
    name: 'sync-series',
    description: 'Sync TV series and episodes from media server',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-series-embeddings',
    description: 'Generate AI embeddings for TV series and episodes',
    cron: null,
  },
  {
    name: 'sync-series-watch-history',
    description: 'Sync TV series watch history for all users',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'generate-series-recommendations',
    description: 'Generate AI TV series recommendations for users',
    cron: process.env.RECS_CRON || '0 4 * * *',
  },
  {
    name: 'sync-series-strm',
    description: 'Create TV series STRM files and user libraries',
    cron: process.env.PERMS_CRON || '0 5 * * *',
  },
]

const jobsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/jobs
   * List all jobs with their status and schedule config
   */
  fastify.get('/api/jobs', { preHandler: requireAdmin }, async (_request, reply) => {
    // Get all job configs from database
    const jobConfigs = await getAllJobConfigs()
    const configMap = new Map(jobConfigs.map((c) => [c.jobName, c]))

    const jobs = await Promise.all(
      jobDefinitions.map(async (def) => {
        const activeJobId = activeJobs.get(def.name)
        const progress = activeJobId ? getJobProgress(activeJobId) : null
        const config = configMap.get(def.name) || (await getJobConfig(def.name))

        return {
          ...def,
          status: progress?.status === 'running' ? 'running' : 'idle',
          currentJobId: activeJobId,
          progress: progress
            ? {
                overallProgress: progress.overallProgress,
                currentStep: progress.currentStep,
                itemsProcessed: progress.itemsProcessed,
                itemsTotal: progress.itemsTotal,
              }
            : null,
          schedule: config
            ? {
                type: config.scheduleType,
                hour: config.scheduleHour,
                minute: config.scheduleMinute,
                dayOfWeek: config.scheduleDayOfWeek,
                intervalHours: config.scheduleIntervalHours,
                isEnabled: config.isEnabled,
                formatted: formatSchedule(config),
              }
            : null,
        }
      })
    )

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
   * POST /api/jobs/:name/cancel
   * Cancel a running job
   */
  fastify.post<{ Params: { name: string } }>(
    '/api/jobs/:name/cancel',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { name } = request.params

      const jobDef = jobDefinitions.find((j) => j.name === name)
      if (!jobDef) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const activeJobId = activeJobs.get(name)
      if (!activeJobId) {
        return reply.status(400).send({ error: 'No active job to cancel' })
      }

      const cancelled = cancelJob(activeJobId)
      if (!cancelled) {
        return reply.status(400).send({ error: 'Job is not running or already finished' })
      }

      // Clear the active job reference
      activeJobs.delete(name)

      logger.info({ job: name, jobId: activeJobId }, `Job cancelled: ${name}`)

      return reply.send({
        message: `Job ${name} cancelled`,
        jobId: activeJobId,
        status: 'cancelled',
      })
    }
  )

  /**
   * GET /api/jobs/:name/config
   * Get job schedule configuration
   */
  fastify.get<{ Params: { name: string } }>(
    '/api/jobs/:name/config',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { name } = request.params

      if (!getValidJobNames().includes(name)) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const config = await getJobConfig(name)
      if (!config) {
        return reply.status(404).send({ error: 'Job config not found' })
      }

      return reply.send({
        config: {
          jobName: config.jobName,
          scheduleType: config.scheduleType,
          scheduleHour: config.scheduleHour,
          scheduleMinute: config.scheduleMinute,
          scheduleDayOfWeek: config.scheduleDayOfWeek,
          scheduleIntervalHours: config.scheduleIntervalHours,
          isEnabled: config.isEnabled,
          formatted: formatSchedule(config),
        },
      })
    }
  )

  /**
   * PATCH /api/jobs/:name/config
   * Update job schedule configuration
   */
  fastify.patch<{
    Params: { name: string }
    Body: {
      scheduleType?: ScheduleType
      scheduleHour?: number | null
      scheduleMinute?: number | null
      scheduleDayOfWeek?: number | null
      scheduleIntervalHours?: number | null
      isEnabled?: boolean
    }
  }>(
    '/api/jobs/:name/config',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { name } = request.params
      const updates = request.body

      if (!getValidJobNames().includes(name)) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      // Validate schedule type
      if (updates.scheduleType && !['daily', 'weekly', 'interval', 'manual'].includes(updates.scheduleType)) {
        return reply.status(400).send({ error: 'Invalid schedule type. Must be: daily, weekly, interval, or manual' })
      }

      // Validate hour (0-23)
      if (updates.scheduleHour !== undefined && updates.scheduleHour !== null) {
        if (updates.scheduleHour < 0 || updates.scheduleHour > 23) {
          return reply.status(400).send({ error: 'Hour must be between 0 and 23' })
        }
      }

      // Validate minute (0-59)
      if (updates.scheduleMinute !== undefined && updates.scheduleMinute !== null) {
        if (updates.scheduleMinute < 0 || updates.scheduleMinute > 59) {
          return reply.status(400).send({ error: 'Minute must be between 0 and 59' })
        }
      }

      // Validate day of week (0-6)
      if (updates.scheduleDayOfWeek !== undefined && updates.scheduleDayOfWeek !== null) {
        if (updates.scheduleDayOfWeek < 0 || updates.scheduleDayOfWeek > 6) {
          return reply.status(400).send({ error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' })
        }
      }

      // Validate interval hours
      if (updates.scheduleIntervalHours !== undefined && updates.scheduleIntervalHours !== null) {
        if (![1, 2, 3, 4, 6, 8, 12].includes(updates.scheduleIntervalHours)) {
          return reply.status(400).send({ error: 'Interval hours must be one of: 1, 2, 3, 4, 6, 8, 12' })
        }
      }

      try {
        const config = await setJobConfig(name, updates)
        logger.info({ job: name, config: updates }, 'Job config updated')

        return reply.send({
          config: {
            jobName: config.jobName,
            scheduleType: config.scheduleType,
            scheduleHour: config.scheduleHour,
            scheduleMinute: config.scheduleMinute,
            scheduleDayOfWeek: config.scheduleDayOfWeek,
            scheduleIntervalHours: config.scheduleIntervalHours,
            isEnabled: config.isEnabled,
            formatted: formatSchedule(config),
          },
          message: 'Job configuration updated',
        })
      } catch (err) {
        logger.error({ err, job: name }, 'Failed to update job config')
        return reply.status(500).send({ error: 'Failed to update job configuration' })
      }
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

        // Close connection when job completes, fails, or is cancelled
        if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
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
      case 'sync-strm': {
        const result = await processStrmForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
        }, `✅ STRM processing complete`)
        break
      }
      // === Series Jobs ===
      case 'sync-series': {
        const result = await syncSeries(jobId)
        logger.info({
          job: name,
          jobId,
          seriesAdded: result.seriesAdded,
          seriesUpdated: result.seriesUpdated,
          episodesAdded: result.episodesAdded,
          episodesUpdated: result.episodesUpdated,
        }, `✅ Series sync complete`)
        break
      }
      case 'generate-series-embeddings': {
        const result = await generateMissingSeriesEmbeddings(jobId)
        logger.info({
          job: name,
          jobId,
          seriesGenerated: result.seriesGenerated,
          episodesGenerated: result.episodesGenerated,
          failed: result.failed,
        }, `✅ Series embeddings complete`)
        break
      }
      case 'sync-series-watch-history': {
        const result = await syncSeriesWatchHistoryForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
          totalItems: result.totalItems,
        }, `✅ Series watch history sync complete`)
        break
      }
      case 'generate-series-recommendations': {
        const result = await generateSeriesRecommendationsForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
        }, `✅ Series recommendations complete`)
        break
      }
      case 'sync-series-strm': {
        const result = await processSeriesStrmForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
        }, `✅ Series STRM processing complete`)
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
