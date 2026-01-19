/**
 * Setup Jobs Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getJobProgress,
  getLastJobRuns,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'

export async function registerJobsHandlers(fastify: FastifyInstance) {
  /**
   * POST /api/setup/jobs/:name/run
   * Run a job during first-time setup.
   */
  fastify.post<{ Params: { name: string } }>(
    '/api/setup/jobs/:name/run',
    { schema: setupSchemas.runJob },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) {
        return reply.status(403).send({
          error: 'Setup is already complete. Use admin job endpoints instead.',
        })
      }

      const { name } = request.params

      const allowedJobs = [
        'sync-movies',
        'sync-series',
        'sync-movie-watch-history',
        'sync-series-watch-history',
        'generate-movie-embeddings',
        'generate-series-embeddings',
        'generate-movie-recommendations',
        'generate-series-recommendations',
        'sync-movie-libraries',
        'sync-series-libraries',
        'refresh-top-picks',
      ]

      if (!allowedJobs.includes(name)) {
        return reply.status(400).send({ error: `Job "${name}" is not allowed during setup` })
      }

      const res = await fastify.inject({
        method: 'POST',
        url: `/api/jobs/${name}/run`,
        headers: {
          'x-internal-request': 'true',
        },
      })

      return reply.status(res.statusCode).send(res.json())
    }
  )

  /**
   * GET /api/setup/jobs/progress/:jobId
   * Get job progress during initial setup.
   */
  fastify.get<{ Params: { jobId: string } }>(
    '/api/setup/jobs/progress/:jobId',
    { schema: setupSchemas.getJobProgress },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) {
        return reply.status(403).send({
          error: 'Setup is already complete. Use admin job endpoints instead.',
        })
      }

      const { jobId } = request.params
      const progress = getJobProgress(jobId)

      if (!progress) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      return reply.send(progress)
    }
  )

  /**
   * GET /api/setup/jobs/last-runs
   * Get the last run for each job type.
   */
  fastify.get(
    '/api/setup/jobs/last-runs',
    { schema: setupSchemas.getLastRuns },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) {
        return reply.status(403).send({
          error: 'Setup is already complete. Use admin job endpoints instead.',
        })
      }

      const lastRuns = await getLastJobRuns()
      
      const result: Record<string, {
        status: string
        completedAt: Date
        itemsProcessed: number
        itemsTotal: number
        error?: string
        result?: Record<string, unknown>
        logs?: Array<{ timestamp: Date; level: string; message: string }>
      }> = {}

      const setupJobs = [
        'sync-movies',
        'sync-series',
        'sync-movie-watch-history',
        'sync-series-watch-history',
        'generate-movie-embeddings',
        'generate-series-embeddings',
        'generate-movie-recommendations',
        'generate-series-recommendations',
        'sync-movie-libraries',
        'sync-series-libraries',
        'refresh-top-picks',
      ]

      for (const jobName of setupJobs) {
        const run = lastRuns.get(jobName)
        if (run) {
          const metadata = run.metadata as { logs?: Array<{ timestamp: Date; level: string; message: string }>; [key: string]: unknown } || {}
          const { logs, ...restMetadata } = metadata
          result[jobName] = {
            status: run.status,
            completedAt: run.completed_at,
            itemsProcessed: run.items_processed,
            itemsTotal: run.items_total,
            error: run.error_message || undefined,
            result: restMetadata,
            logs: logs,
          }
        }
      }

      return reply.send({ lastRuns: result })
    }
  )
}
