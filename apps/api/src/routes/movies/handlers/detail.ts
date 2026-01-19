/**
 * Movie Detail Handler
 * 
 * GET /api/movies/:id - Get movie by ID with full metadata
 */
import type { FastifyInstance } from 'fastify'
import { queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import { getMovieSchema } from '../schemas.js'
import type { MovieDetailRow } from '../types.js'

export function registerDetailHandler(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string }; Reply: MovieDetailRow }>(
    '/api/movies/:id',
    {
      preHandler: requireAuth,
      schema: getMovieSchema,
    },
    async (request, reply) => {
      const { id } = request.params

      const movie = await queryOne<MovieDetailRow>(
        `SELECT id, provider_item_id, title, original_title, year, genres, overview,
                community_rating, runtime_minutes, poster_url, backdrop_url, created_at, updated_at,
                actors, directors, writers, cinematographers, composers, editors, studios,
                imdb_id, tmdb_id, keywords, collection_id, collection_name,
                rt_critic_score, rt_audience_score, rt_consensus, metacritic_score, awards_summary,
                languages, production_countries, letterboxd_score, mdblist_score, streaming_providers
         FROM movies WHERE id = $1`,
        [id]
      )

      if (!movie) {
        return reply.status(404).send({ error: 'Movie not found' } as never)
      }

      return reply.send(movie)
    }
  )
}
