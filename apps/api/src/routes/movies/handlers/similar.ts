/**
 * Similar Movies Handler
 * 
 * GET /api/movies/:id/similar - Get similar movies based on embedding similarity
 */
import type { FastifyInstance } from 'fastify'
import { withViewerCatalog } from '@aperture/core/encore'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { getSimilarMovies } from '@aperture/core'
import { similarMoviesSchema } from '../schemas.js'

export function registerSimilarHandler(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/movies/:id/similar',
    {
      preHandler: requireAuth,
      schema: similarMoviesSchema,
    },
    async (request, reply) => {
      const { id } = request.params
      const limit = Math.min(parseInt(request.query.limit || '10', 10), 50)

      try {
        const result = await withViewerCatalog((request.user as SessionUser).id, () => getSimilarMovies(id, { limit, userId: (request.user as SessionUser).id }))
        
        // Transform to the expected response format
        const similar = result.connections.map((conn) => ({
          id: conn.item.id,
          title: conn.item.title,
          year: conn.item.year,
          poster_url: conn.item.poster_url,
          genres: conn.item.genres,
          similarity: conn.similarity,
          reasons: conn.reasons,
        }))

        return reply.send({ similar })
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('Movie not found:')) throw error
        // Preserve the empty response for an unknown source.
        return reply.send({ similar: [], message: 'No embedding found for this movie' })
      }
    }
  )
}
