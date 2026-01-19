/**
 * Jobs Enrichment Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getIncompleteEnrichmentRun,
  clearInterruptedEnrichmentRun,
  createChildLogger,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { jobSchemas } from '../schemas.js'

const logger = createChildLogger('jobs-enrichment')

export async function registerEnrichmentHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/jobs/enrichment/status
   * Get enrichment run status - detects incomplete/interrupted runs
   */
  fastify.get(
    '/api/jobs/enrichment/status',
    { preHandler: requireAdmin, schema: jobSchemas.getEnrichmentStatus },
    async (_request, reply) => {
      try {
        const status = await getIncompleteEnrichmentRun()
        return reply.send(status)
      } catch (err) {
        logger.error({ err }, 'Failed to get enrichment status')
        return reply.status(500).send({ error: 'Failed to get enrichment status' })
      }
    }
  )

  /**
   * POST /api/jobs/enrichment/clear-interrupted
   * Clear/acknowledge an interrupted enrichment run
   */
  fastify.post(
    '/api/jobs/enrichment/clear-interrupted',
    { preHandler: requireAdmin, schema: jobSchemas.clearInterrupted },
    async (_request, reply) => {
      try {
        const cleared = await clearInterruptedEnrichmentRun()
        if (cleared) {
          logger.info('Cleared interrupted enrichment run')
          return reply.send({ message: 'Interrupted enrichment run cleared', cleared: true })
        } else {
          return reply.send({ message: 'No interrupted run to clear', cleared: false })
        }
      } catch (err) {
        logger.error({ err }, 'Failed to clear interrupted enrichment run')
        return reply.status(500).send({ error: 'Failed to clear interrupted enrichment run' })
      }
    }
  )
}
