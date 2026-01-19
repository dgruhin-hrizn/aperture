/**
 * Jobs Routes
 *
 * Background job management endpoints.
 * All endpoints require admin authentication.
 */

import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import {
  getJobProgress,
  createChildLogger,
} from '@aperture/core'
import { setJobExecutor } from '../../lib/scheduler.js'
import { jobDefinitions } from './definitions.js'
import { activeJobs } from './state.js'
import { runJob } from './executor.js'
import {
  registerListHandlers,
  registerRunHandlers,
  registerConfigHandlers,
  registerProgressHandlers,
  registerHistoryHandlers,
  registerSchedulerHandlers,
  registerEnrichmentHandlers,
  registerPurgeHandlers,
} from './handlers/index.js'

const logger = createChildLogger('jobs-api')

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

  // Register all handler groups
  await registerListHandlers(fastify)
  await registerRunHandlers(fastify)
  await registerConfigHandlers(fastify)
  await registerProgressHandlers(fastify)
  await registerHistoryHandlers(fastify)
  await registerSchedulerHandlers(fastify)
  await registerEnrichmentHandlers(fastify)
  await registerPurgeHandlers(fastify)
}

export default jobsRoutes
