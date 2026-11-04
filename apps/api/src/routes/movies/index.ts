/**
 * Movies Routes
 * 
 * Movie library and metadata endpoints.
 */
import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { query } from '../../lib/db.js'
import {
  registerListHandler,
  registerDetailHandler,
  registerSimilarHandler,
  registerWatchStatsHandler,
  registerFiltersHandlers,
  registerFranchisesHandler,
  registerTrailerHandler,
} from './handlers/index.js'
import { moviesComponentSchemas } from './schemas.js'

const moviesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register component schemas for $ref resolution
  for (const [name, schema] of Object.entries(moviesComponentSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  fastify.get<{ Querystring: { ids: string } }>('/api/movies/summaries', {
    preHandler: requireAuth,
    schema: { querystring: { type: 'object', required: ['ids'], properties: { ids: { type: 'string', maxLength: 3700 } } } },
  }, async (request, reply) => {
    const ids = [...new Set(request.query.ids.split(','))]
    if (!ids.length || ids.length > 100 || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return reply.code(400).send({ error: 'Provide up to 100 movie UUIDs' })
    const result = await query(
      `SELECT m.id, m.title, m.year, m.poster_url FROM movies m
       LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
       WHERE m.id = ANY($1::uuid[]) AND (NOT EXISTS (SELECT 1 FROM library_config WHERE collection_type = 'movies') OR lc.is_enabled = true OR m.provider_library_id IS NULL)
       ORDER BY array_position($1::uuid[], m.id)`, [ids]
    )
    return { movies: result.rows }
  })

  // Register all movie handlers
  registerListHandler(fastify)
  registerDetailHandler(fastify)
  registerSimilarHandler(fastify)
  registerWatchStatsHandler(fastify)
  registerFiltersHandlers(fastify)
  registerFranchisesHandler(fastify)
  registerTrailerHandler(fastify)
}

export default moviesRoutes
