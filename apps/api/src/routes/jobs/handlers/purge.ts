/**
 * Jobs Database Purge Handlers
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  purgeMovieDatabase,
  getMovieDatabaseStats,
  createChildLogger,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { jobSchemas } from '../schemas.js'

const logger = createChildLogger('jobs-purge')

export async function registerPurgeHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/admin/purge/stats
   * Get current database stats before purge
   */
  fastify.get(
    '/api/admin/purge/stats',
    { preHandler: requireAdmin, schema: jobSchemas.getPurgeStats },
    async (_request, reply) => {
      try {
        const stats = await getMovieDatabaseStats()
        return reply.send({ stats })
      } catch (err) {
        logger.error({ err }, 'Failed to get database stats')
        return reply.status(500).send({ error: 'Failed to get database stats' })
      }
    }
  )

  /**
   * POST /api/admin/purge/movies
   * Purge all movie-related data (requires confirmation)
   */
  fastify.post<{ Body: { confirm: boolean } }>(
    '/api/admin/purge/movies',
    { preHandler: requireAdmin, schema: jobSchemas.purgeMovies },
    async (request, reply) => {
      const { confirm } = request.body

      if (!confirm) {
        return reply.status(400).send({
          error: 'Purge requires confirmation. Send { confirm: true } to proceed.',
        })
      }

      try {
        logger.warn('🗑️ Admin initiated movie database purge')
        const result = await purgeMovieDatabase()
        logger.info({ result }, '✅ Movie database purge complete')
        return reply.send({
          success: true,
          message: 'Movie database purged successfully',
          result,
        })
      } catch (err) {
        logger.error({ err }, 'Failed to purge movie database')
        return reply.status(500).send({ error: 'Failed to purge movie database' })
      }
    }
  )
}
