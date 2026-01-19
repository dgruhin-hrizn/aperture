/**
 * Movie Watch Stats Handler
 * 
 * GET /api/movies/:id/watch-stats - Get comprehensive watch statistics for a movie
 */
import type { FastifyInstance } from 'fastify'
import { queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import { watchStatsSchema } from '../schemas.js'

export function registerWatchStatsHandler(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/api/movies/:id/watch-stats',
    {
      preHandler: requireAuth,
      schema: watchStatsSchema,
    },
    async (request, reply) => {
      const { id } = request.params

      // Get watch history stats
      const watchStats = await queryOne<{
        total_watchers: string
        total_plays: string
        favorites_count: string
        first_watched: Date | null
        last_watched: Date | null
      }>(
        `SELECT 
          COUNT(DISTINCT user_id) as total_watchers,
          COALESCE(SUM(play_count), 0) as total_plays,
          COUNT(DISTINCT CASE WHEN is_favorite THEN user_id END) as favorites_count,
          MIN(last_played_at) as first_watched,
          MAX(last_played_at) as last_watched
         FROM watch_history 
         WHERE movie_id = $1`,
        [id]
      )

      // Get user ratings stats
      const ratingStats = await queryOne<{
        avg_rating: string | null
        rating_count: string
        rating_distribution: string
      }>(
        `SELECT 
          AVG(rating)::numeric(3,1) as avg_rating,
          COUNT(*) as rating_count,
          json_object_agg(rating, count) as rating_distribution
         FROM (
           SELECT rating, COUNT(*) as count 
           FROM user_ratings 
           WHERE movie_id = $1 
           GROUP BY rating
         ) r`,
        [id]
      )

      // Get total user count for percentage calculation
      const userCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM users`
      )
      const totalUsers = parseInt(userCount?.count || '1', 10)
      const watchers = parseInt(watchStats?.total_watchers || '0', 10)

      return reply.send({
        totalWatchers: watchers,
        totalPlays: parseInt(watchStats?.total_plays || '0', 10),
        favoritesCount: parseInt(watchStats?.favorites_count || '0', 10),
        firstWatched: watchStats?.first_watched || null,
        lastWatched: watchStats?.last_watched || null,
        // User ratings
        averageUserRating: ratingStats?.avg_rating ? parseFloat(ratingStats.avg_rating) : null,
        totalRatings: parseInt(ratingStats?.rating_count || '0', 10),
        // Percentage of users who watched
        watchPercentage: totalUsers > 0 ? Math.round((watchers / totalUsers) * 100) : 0,
        totalUsers,
      })
    }
  )
}
