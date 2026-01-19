/**
 * Series Episodes Handler
 * 
 * GET /api/series/:id/episodes - Get all episodes for a series, grouped by season
 */
import type { FastifyInstance } from 'fastify'
import { query } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import { episodesSchema } from '../schemas.js'
import type { EpisodeRow } from '../types.js'

export function registerEpisodesHandler(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/api/series/:id/episodes',
    {
      preHandler: requireAuth,
      schema: episodesSchema,
    },
    async (request, reply) => {
      const { id } = request.params

      const result = await query<EpisodeRow>(
        `SELECT id, season_number, episode_number, title, overview, 
                premiere_date, runtime_minutes, community_rating, poster_url
         FROM episodes
         WHERE series_id = $1
         ORDER BY season_number ASC, episode_number ASC`,
        [id]
      )

      // Group by season
      const seasons: Record<number, EpisodeRow[]> = {}
      for (const ep of result.rows) {
        if (!seasons[ep.season_number]) {
          seasons[ep.season_number] = []
        }
        seasons[ep.season_number].push(ep)
      }

      return reply.send({
        episodes: result.rows,
        seasons,
        totalEpisodes: result.rows.length,
        seasonCount: Object.keys(seasons).length,
      })
    }
  )
}
