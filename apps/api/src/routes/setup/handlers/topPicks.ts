/**
 * Setup Top Picks Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getTopPicksConfig,
  updateTopPicksConfig,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'

export async function registerTopPicksHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/setup/top-picks-config
   */
  fastify.get(
    '/api/setup/top-picks-config',
    { schema: setupSchemas.getTopPicksConfig },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      return reply.send(await getTopPicksConfig())
    }
  )

  /**
   * POST /api/setup/top-picks-config
   */
  fastify.post<{ Body: Record<string, unknown> }>(
    '/api/setup/top-picks-config',
    { schema: setupSchemas.setTopPicksConfig },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      const updated = await updateTopPicksConfig(request.body as never)
      return reply.send(updated)
    }
  )
}
