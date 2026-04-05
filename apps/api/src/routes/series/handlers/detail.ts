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
        `SELECT s.id, s.provider_item_id, s.title, s.original_title, s.year, s.end_year, s.genres, s.overview,
                s.community_rating, s.critic_rating, s.content_rating, s.status, s.total_seasons, s.total_episodes,
                s.network, s.tagline, s.studios, s.directors, s.writers, s.actors,
                s.imdb_id, s.tmdb_id, s.tvdb_id, s.air_days, s.production_countries, s.awards,
                s.poster_url, s.backdrop_url, s.created_at, s.updated_at,
                s.keywords, s.rt_critic_score, s.rt_audience_score, s.rt_consensus, s.metacritic_score, s.awards_summary,
                s.languages, s.letterboxd_score, s.mdblist_score, s.streaming_providers,
                (SELECT ROUND(AVG(e.runtime_minutes))::int
                 FROM episodes e
                 WHERE e.series_id = s.id AND e.runtime_minutes IS NOT NULL) AS average_episode_runtime_minutes
         FROM series s WHERE s.id = $1`,
        [id]
      )

      if (!series) {
        return reply.status(404).send({ error: 'Series not found' } as never)
      }

      return reply.send(series)
    }
  )
}
