/**
 * Jobs Run Handlers
 */

import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import {
  getJobProgress,
  cancelJob as cancelJobCore,
  createChildLogger,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { jobSchemas } from '../schemas.js'
import { jobDefinitions } from '../definitions.js'
import { activeJobs } from '../state.js'
import { runJob } from '../executor.js'

const logger = createChildLogger('jobs-run')

export async function registerRunHandlers(fastify: FastifyInstance) {
  /**
   * POST /api/jobs/:name/run
   * Trigger a job to run manually
   */
  fastify.post<{ Params: { name: string } }>(
    '/api/jobs/:name/run',
    { preHandler: requireAdmin, schema: jobSchemas.runJob },
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
    { preHandler: requireAdmin, schema: jobSchemas.cancelJob },
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

      const cancelled = cancelJobCore(activeJobId)
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
}
