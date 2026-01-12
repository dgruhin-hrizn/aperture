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
  // Top Picks
  refreshTopPicks,
  // Enrichment
  enrichMetadata,
  enrichStudioLogos,
  enrichMDBListMetadata,
  // Common
  createChildLogger,
  // Watching libraries
  processWatchingLibrariesForAllUsers,
  getJobProgress,
  getAllJobProgress,
  subscribeToJob,
  subscribeToAllJobs,
  cancelJob,
  failJob,
  purgeMovieDatabase,
  getMovieDatabaseStats,
  getJobConfig,
  getAllJobConfigs,
  setJobConfig,
  formatSchedule,
  getValidJobNames,
  getJobRunHistory,
  getLastJobRuns,
  // Backup
  createBackup,
  type JobProgress,
  type ScheduleType,
} from '@aperture/core'
import { randomUUID } from 'crypto'
import { setJobExecutor, refreshJobSchedule, getSchedulerStatus } from '../lib/scheduler.js'
import { syncAllTraktRatings } from './trakt.js'
import { refreshAssistantSuggestions } from './assistant/jobs/refreshSuggestions.js'

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
    name: 'generate-movie-embeddings',
    description: 'Generate AI embeddings for movies',
    cron: null,
  },
  {
    name: 'sync-movie-watch-history',
    description: 'Sync movie watch history for all users (delta - only new plays)',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'full-sync-movie-watch-history',
    description: 'Full resync of movie watch history for all users',
    cron: null,
  },
  {
    name: 'generate-movie-recommendations',
    description: 'Generate AI movie recommendations for users',
    cron: process.env.RECS_CRON || '0 4 * * *',
  },
  {
    name: 'rebuild-movie-recommendations',
    description: 'Clear all movie recommendations and rebuild',
    cron: null,
  },
  {
    name: 'sync-movie-libraries',
    description: 'Create AI recommendation movie libraries (STRM or symlinks)',
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
    description: 'Sync TV series watch history for all users (delta - only new plays)',
    cron: process.env.SYNC_CRON || '0 3 * * *',
  },
  {
    name: 'full-sync-series-watch-history',
    description: 'Full resync of TV series watch history for all users',
    cron: null,
  },
  {
    name: 'generate-series-recommendations',
    description: 'Generate AI TV series recommendations for users',
    cron: process.env.RECS_CRON || '0 4 * * *',
  },
  {
    name: 'sync-series-libraries',
    description: 'Create AI recommendation series libraries (STRM or symlinks)',
    cron: process.env.PERMS_CRON || '0 5 * * *',
  },
  // === Top Picks Job ===
  {
    name: 'refresh-top-picks',
    description: 'Refresh global Top Picks libraries based on popularity',
    cron: '0 6 * * *',
  },
  // === Trakt Sync Job ===
  {
    name: 'sync-trakt-ratings',
    description: 'Sync ratings from Trakt for all connected users',
    cron: '0 */6 * * *', // Every 6 hours
  },
  // === Watching Libraries Job ===
  {
    name: 'sync-watching-libraries',
    description: 'Sync "Shows You Watch" libraries for all users',
    cron: '0 */4 * * *', // Every 4 hours
  },
  // === Assistant Suggestions Job ===
  {
    name: 'refresh-assistant-suggestions',
    description: 'Refresh personalized assistant suggestions for all users',
    cron: '0 * * * *', // Every hour
  },
  // === Metadata Enrichment Job ===
  {
    name: 'enrich-metadata',
    description: 'Enrich movies and series with TMDb keywords, collections, and OMDb ratings',
    cron: null, // Manual by default
  },
  // === Studio Logo Enrichment Job ===
  {
    name: 'enrich-studio-logos',
    description: 'Fetch studio and network logos from TMDB',
    cron: '0 5 * * *', // Daily at 5 AM
  },
  // === MDBList Enrichment Job ===
  {
    name: 'enrich-mdblist',
    description: 'Enrich movies and series with MDBList ratings, streaming info, and keywords',
    cron: null, // Manual by default - uses daily API quota
  },
  // === Database Backup Job ===
  {
    name: 'backup-database',
    description: 'Create a full database backup',
    cron: '0 2 * * *', // Daily at 2 AM
  },
]

const jobsRoutes: FastifyPluginAsync = async (fastify) => {
  // Set up the job executor for the scheduler
  setJobExecutor(async (jobName: string) => {
    const jobDef = jobDefinitions.find((j) => j.name === jobName)
    if (!jobDef) {
      throw new Error(`Unknown job: ${jobName}`)
    }

    // Check if job is already running
    const existingJobId = activeJobs.get(jobName)
    if (existingJobId) {
      const progress = getJobProgress(existingJobId)
      if (progress?.status === 'running') {
        logger.info({ job: jobName }, 'Job already running, skipping scheduled run')
        return
      }
    }

    // Create new job ID and run
    const jobId = randomUUID()
    activeJobs.set(jobName, jobId)
    
    try {
      await runJob(jobName, jobId)
    } finally {
      activeJobs.delete(jobName)
    }
  })

  /**
   * GET /api/jobs
   * List all jobs with their status and schedule config
   */
  fastify.get('/api/jobs', { preHandler: requireAdmin }, async (_request, reply) => {
    // Get all job configs from database
    const jobConfigs = await getAllJobConfigs()
    const configMap = new Map(jobConfigs.map((c) => [c.jobName, c]))

    // Get last runs for all jobs
    const lastRunsMap = await getLastJobRuns()

    const jobs = await Promise.all(
      jobDefinitions.map(async (def) => {
        const activeJobId = activeJobs.get(def.name)
        const progress = activeJobId ? getJobProgress(activeJobId) : null
        const config = configMap.get(def.name) || (await getJobConfig(def.name))
        const lastRun = lastRunsMap.get(def.name)

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
          lastRun: lastRun
            ? {
                id: lastRun.id,
                status: lastRun.status,
                startedAt: lastRun.started_at,
                completedAt: lastRun.completed_at,
                durationMs: lastRun.duration_ms,
                itemsProcessed: lastRun.items_processed,
                itemsTotal: lastRun.items_total,
                errorMessage: lastRun.error_message,
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

        // Refresh the scheduler for this job
        try {
          await refreshJobSchedule(name)
        } catch (schedErr) {
          logger.error({ err: schedErr, job: name }, 'Failed to refresh job schedule')
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

  /**
   * GET /api/jobs/scheduler/status
   * Get scheduler status (which jobs are scheduled)
   */
  fastify.get('/api/jobs/scheduler/status', { preHandler: requireAdmin }, async (_request, reply) => {
    const status = getSchedulerStatus()
    return reply.send(status)
  })

  // =========================================================================
  // Job History Routes
  // =========================================================================

  /**
   * GET /api/jobs/history
   * Get job run history for all jobs
   */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/jobs/history',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50
      const history = await getJobRunHistory(undefined, limit)
      return reply.send({ history })
    }
  )

  /**
   * GET /api/jobs/:name/history
   * Get job run history for a specific job
   */
  fastify.get<{ Params: { name: string }; Querystring: { limit?: string } }>(
    '/api/jobs/:name/history',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { name } = request.params
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50

      const jobDef = jobDefinitions.find((j) => j.name === name)
      if (!jobDef) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const history = await getJobRunHistory(name, limit)
      return reply.send({ history })
    }
  )

  /**
   * GET /api/jobs/last-runs
   * Get the last run for each job type
   */
  fastify.get('/api/jobs/last-runs', { preHandler: requireAdmin }, async (_request, reply) => {
    const lastRuns = await getLastJobRuns()
    // Convert Map to object for JSON serialization
    const lastRunsObj: Record<string, unknown> = {}
    for (const [key, value] of lastRuns) {
      lastRunsObj[key] = value
    }
    return reply.send({ lastRuns: lastRunsObj })
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
      case 'generate-movie-embeddings': {
        const result = await generateMissingEmbeddings(jobId)
        logger.info({
          job: name,
          jobId,
          generated: result.generated,
          failed: result.failed,
        }, `✅ Movie embeddings complete`)
        break
      }
      case 'sync-movie-watch-history': {
        const result = await syncWatchHistoryForAllUsers(jobId, false) // Delta sync
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
          totalItems: result.totalItems,
        }, `✅ Movie watch history sync complete (delta)`)
        break
      }
      case 'full-sync-movie-watch-history': {
        const result = await syncWatchHistoryForAllUsers(jobId, true) // Full sync
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
          totalItems: result.totalItems,
        }, `✅ Movie watch history sync complete (full resync)`)
        break
      }
      case 'generate-movie-recommendations': {
        const result = await generateRecommendationsForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
        }, `✅ Movie recommendations complete`)
        break
      }
      case 'rebuild-movie-recommendations': {
        const result = await clearAndRebuildAllRecommendations(jobId)
        logger.info({
          job: name,
          jobId,
          cleared: result.cleared,
          success: result.success,
          failed: result.failed,
        }, `✅ Movie recommendations rebuilt`)
        break
      }
      case 'sync-movie-libraries': {
        const result = await processStrmForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
        }, `✅ Movie libraries sync complete`)
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
        const result = await syncSeriesWatchHistoryForAllUsers(jobId, false) // Delta sync
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
          totalItems: result.totalItems,
        }, `✅ Series watch history sync complete (delta)`)
        break
      }
      case 'full-sync-series-watch-history': {
        const result = await syncSeriesWatchHistoryForAllUsers(jobId, true) // Full sync
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
          totalItems: result.totalItems,
        }, `✅ Series watch history sync complete (full resync)`)
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
      case 'sync-series-libraries': {
        const result = await processSeriesStrmForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
        }, `✅ Series libraries sync complete`)
        break
      }
      // === Top Picks Job ===
      case 'refresh-top-picks': {
        const result = await refreshTopPicks(jobId)
        logger.info({
          job: name,
          jobId,
          moviesCount: result.moviesCount,
          seriesCount: result.seriesCount,
          usersUpdated: result.usersUpdated,
        }, `✅ Top Picks refresh complete`)
        break
      }
      // === Trakt Sync Job ===
      case 'sync-trakt-ratings': {
        const result = await syncAllTraktRatings(jobId)
        logger.info({
          job: name,
          jobId,
          usersProcessed: result.usersProcessed,
          ratingsImported: result.ratingsImported,
          errors: result.errors,
        }, `✅ Trakt ratings sync complete`)
        break
      }
      // === Watching Libraries Job ===
      case 'sync-watching-libraries': {
        const result = await processWatchingLibrariesForAllUsers(jobId)
        logger.info({
          job: name,
          jobId,
          success: result.success,
          failed: result.failed,
          users: result.users.length,
        }, `✅ Watching libraries sync complete`)
        break
      }
      // === Assistant Suggestions Job ===
      case 'refresh-assistant-suggestions': {
        const result = await refreshAssistantSuggestions(jobId)
        logger.info({
          job: name,
          jobId,
          usersProcessed: result.usersProcessed,
          errors: result.errors,
        }, `✅ Assistant suggestions refresh complete`)
        break
      }
      // === Metadata Enrichment Job ===
      case 'enrich-metadata': {
        const result = await enrichMetadata(jobId)
        logger.info({
          job: name,
          jobId,
          moviesEnriched: result.moviesEnriched,
          seriesEnriched: result.seriesEnriched,
          collectionsCreated: result.collectionsCreated,
        }, `✅ Metadata enrichment complete`)
        break
      }
      // === Studio Logo Enrichment Job ===
      case 'enrich-studio-logos': {
        const result = await enrichStudioLogos(jobId)
        logger.info({
          job: name,
          jobId,
          studiosEnriched: result.studiosEnriched,
          networksEnriched: result.networksEnriched,
          logosPushedToEmby: result.logosPushedToEmby,
        }, `✅ Studio logo enrichment complete`)
        break
      }
      // === MDBList Enrichment Job ===
      case 'enrich-mdblist': {
        const result = await enrichMDBListMetadata(jobId)
        logger.info({
          job: name,
          jobId,
          moviesEnriched: result.moviesEnriched,
          seriesEnriched: result.seriesEnriched,
        }, `✅ MDBList enrichment complete`)
        break
      }
      // === Database Backup Job ===
      case 'backup-database': {
        const result = await createBackup()
        if (!result.success) {
          throw new Error(result.error || 'Backup failed')
        }
        logger.info({
          job: name,
          jobId,
          filename: result.filename,
          sizeBytes: result.sizeBytes,
          duration: result.duration,
        }, `✅ Database backup complete`)
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
    // Record the failure in job progress tracking
    failJob(jobId, error)
    throw err
  } finally {
    // Clear the active job reference
    activeJobs.delete(name)
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
