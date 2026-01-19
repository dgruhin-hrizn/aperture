/**
 * Series Detail Handler
 * 
 * GET /api/series/:id - Get series by ID with full metadata
 */
import type { FastifyInstance } from 'fastify'
import { queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import { getSeriesSchema } from '../schemas.js'
import type { SeriesDetailRow } from '../types.js'

export function registerDetailHandler(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string }; Reply: SeriesDetailRow }>(
    '/api/series/:id',
    {
      preHandler: requireAuth,
      schema: getSeriesSchema,
    },
    async (request, reply) => {
      const { id } = request.params

      const series = await queryOne<SeriesDetailRow>(
        `SELECT id, provider_item_id, title, original_title, year, end_year, genres, overview,
                community_rating, critic_rating, content_rating, status, total_seasons, total_episodes, 
                network, tagline, studios, directors, writers, actors,
                imdb_id, tmdb_id, tvdb_id, air_days, production_countries, awards,
                poster_url, backdrop_url, created_at, updated_at,
                keywords, rt_critic_score, rt_audience_score, rt_consensus, metacritic_score, awards_summary,
                languages, letterboxd_score, mdblist_score, streaming_providers
         FROM series WHERE id = $1`,
        [id]
      )

      if (!series) {
        return reply.status(404).send({ error: 'Series not found' } as never)
      }

      return reply.send(series)
    }
  )
}
