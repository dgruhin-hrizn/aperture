import type { FastifyInstance } from 'fastify'
import { getTasteSynopsis, getSeriesTasteSynopsis } from '@aperture/core'
import { requireAuth, type SessionUser } from '../../../../plugins/auth.js'
import { requireSelfOrAdmin, streamSseGenerator } from './shared.js'

export function registerTasteProfileHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/:id/taste-profile
   * Get user's AI-generated taste synopsis
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/taste-profile',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      try {
        const profile = await getTasteSynopsis(id)
        return reply.send(profile)
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get taste profile')
        return reply.status(500).send({ error: 'Failed to generate taste profile' })
      }
    }
  )

  /**
   * POST /api/users/:id/taste-profile/regenerate
   * Force regenerate user's taste synopsis (streaming)
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/taste-profile/regenerate',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      const { streamTasteSynopsis } = await import('@aperture/core')
      await streamSseGenerator(fastify, reply, id, streamTasteSynopsis(id), {
        errorLogMessage: 'Failed to regenerate taste profile',
        errorResponseMessage: 'Failed to regenerate taste profile',
      })
    }
  )

  /**
   * GET /api/users/:id/series-taste-profile
   * Get user's AI-generated series taste synopsis
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/series-taste-profile',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      try {
        const profile = await getSeriesTasteSynopsis(id)
        return reply.send(profile)
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get series taste profile')
        return reply.status(500).send({ error: 'Failed to generate series taste profile' })
      }
    }
  )

  /**
   * POST /api/users/:id/series-taste-profile/regenerate
   * Force regenerate user's series taste synopsis (streaming)
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/series-taste-profile/regenerate',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      const { streamSeriesTasteSynopsis } = await import('@aperture/core')
      await streamSseGenerator(fastify, reply, id, streamSeriesTasteSynopsis(id), {
        errorLogMessage: 'Failed to regenerate series taste profile',
        errorResponseMessage: 'Failed to regenerate series taste profile',
      })
    }
  )
}
