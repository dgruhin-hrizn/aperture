import type { FastifyInstance } from 'fastify'
import { queryOne } from '../../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../../plugins/auth.js'
import { requireSelfOrAdmin } from './shared.js'

export function registerUserPreferencesHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/:id/preferences
   * Get user's preferences
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/preferences',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      const prefs = await queryOne(
        `SELECT * FROM user_preferences WHERE user_id = $1`,
        [id]
      )

      return reply.send({ preferences: prefs || null })
    }
  )

  /**
   * GET /api/users/:id/stats
   * Get user's stats (watched count, favorites, recommendations)
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/stats',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      // Get watched count (from enabled libraries only)
      const watchedResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND lc.is_enabled = true`,
        [id]
      )

      // Get favorites count (from enabled libraries only)
      const favoritesResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND wh.is_favorite = true AND lc.is_enabled = true`,
        [id]
      )

      // Get recommendations count from latest run
      const recsResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM recommendation_candidates rc
         JOIN recommendation_runs rr ON rr.id = rc.run_id
         JOIN movies m ON m.id = rc.movie_id
         LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE rr.user_id = $1 
           AND rc.is_selected = true
           AND rr.id = (SELECT id FROM recommendation_runs WHERE user_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1)
           AND (
             NOT EXISTS (SELECT 1 FROM library_config)
             OR lc.is_enabled = true
             OR m.provider_library_id IS NULL
           )`,
        [id]
      )

      return reply.send({
        watchedCount: parseInt(watchedResult?.count || '0', 10),
        favoritesCount: parseInt(favoritesResult?.count || '0', 10),
        recommendationsCount: parseInt(recsResult?.count || '0', 10),
      })
    }
  )
}
