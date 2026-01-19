/**
 * Jobs History Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getJobRunHistory,
  getLastJobRuns,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { jobSchemas } from '../schemas.js'
import { jobDefinitions } from '../definitions.js'

export async function registerHistoryHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/jobs/history
   * Get job run history for all jobs
   */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/api/jobs/history',
    { preHandler: requireAdmin, schema: jobSchemas.getJobHistory },
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
    { preHandler: requireAdmin, schema: jobSchemas.getJobHistoryByName },
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
  fastify.get(
    '/api/jobs/last-runs',
    { preHandler: requireAdmin, schema: jobSchemas.getLastRuns },
    async (_request, reply) => {
      const lastRuns = await getLastJobRuns()
      // Convert Map to object for JSON serialization
      const lastRunsObj: Record<string, unknown> = {}
      for (const [key, value] of lastRuns) {
        lastRunsObj[key] = value
      }
      return reply.send({ lastRuns: lastRunsObj })
    }
  )
}
