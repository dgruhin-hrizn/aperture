/**
 * Jobs Scheduler Handlers
 */

import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '../../../plugins/auth.js'
import { getSchedulerStatus } from '../../../lib/scheduler.js'
import { jobSchemas } from '../schemas.js'

export async function registerSchedulerHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/jobs/scheduler/status
   * Get scheduler status (which jobs are scheduled)
   */
  fastify.get(
    '/api/jobs/scheduler/status',
    { preHandler: requireAdmin, schema: jobSchemas.getSchedulerStatus },
    async (_request, reply) => {
      const status = getSchedulerStatus()
      return reply.send(status)
    }
  )
}
