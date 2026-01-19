/**
 * Series Watch Stats Handler
 * 
 * GET /api/series/:id/watch-stats - Get comprehensive watch statistics for a series
 */
import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import { watchStatsSchema } from '../schemas.js'

export function registerWatchStatsHandler(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/api/series/:id/watch-stats',
    {
      preHandler: requireAuth,
      schema: watchStatsSchema,
    },
    async (request, reply) => {
      const { id } = request.params

      // Get total episodes for calculating completion percentage
      const seriesInfo = await queryOne<{ total_episodes: number }>(
        `SELECT total_episodes FROM series WHERE id = $1`,
        [id]
      )
      const totalEpisodes = seriesInfo?.total_episodes || 0

      // Users currently watching this series
      const watchingCount = await queryOne<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id) as count FROM user_watching_series WHERE series_id = $1`,
        [id]
      )

      // Users who have watched episodes and their completion status
      const watchStats = await query<{
        user_id: string
        episodes_watched: string
        total_plays: string
        favorites_count: string
        first_watched: Date | null
        last_watched: Date | null
      }>(
        `SELECT 
          wh.user_id,
          COUNT(DISTINCT wh.episode_id) as episodes_watched,
          SUM(wh.play_count) as total_plays,
          COUNT(DISTINCT CASE WHEN wh.is_favorite THEN wh.episode_id END) as favorites_count,
          MIN(wh.last_played_at) as first_watched,
          MAX(wh.last_played_at) as last_watched
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.episode_id
         WHERE e.series_id = $1 AND wh.episode_id IS NOT NULL
         GROUP BY wh.user_id`,
        [id]
      )

      // Calculate completed viewers (watched all episodes)
      const completedViewers = totalEpisodes > 0
        ? watchStats.rows.filter(s => parseInt(s.episodes_watched, 10) >= totalEpisodes).length
        : 0

      // Get user ratings for this series
      const ratingStats = await queryOne<{
        avg_rating: string | null
        rating_count: string
      }>(
        `SELECT 
          AVG(rating)::numeric(3,1) as avg_rating,
          COUNT(*) as rating_count
         FROM user_ratings 
         WHERE series_id = $1`,
        [id]
      )

      // Calculate average progress (what % of the show users have watched on average)
      const avgProgress = totalEpisodes > 0 && watchStats.rows.length > 0
        ? Math.round(
            watchStats.rows.reduce((sum, s) => sum + parseInt(s.episodes_watched, 10), 0) /
            watchStats.rows.length /
            totalEpisodes *
            100
          )
        : 0

      // Get total user count for percentage calculation  
      const userCount = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM users`
      )
      const totalUsers = parseInt(userCount?.count || '1', 10)

      // Sum favorites across all users
      const totalFavorites = watchStats.rows.reduce(
        (sum, s) => sum + parseInt(s.favorites_count, 10), 0
      )

      return reply.send({
        currentlyWatching: parseInt(watchingCount?.count || '0', 10),
        totalViewers: watchStats.rows.length,
        completedViewers,
        totalEpisodes,
        totalEpisodePlays: watchStats.rows.reduce((sum, s) => sum + parseInt(s.total_plays, 10), 0),
        favoritedEpisodes: totalFavorites,
        firstWatched: watchStats.rows.length > 0 
          ? new Date(Math.min(...watchStats.rows.filter(s => s.first_watched).map(s => new Date(s.first_watched!).getTime())))
          : null,
        lastWatched: watchStats.rows.length > 0
          ? new Date(Math.max(...watchStats.rows.filter(s => s.last_watched).map(s => new Date(s.last_watched!).getTime())))
          : null,
        // User ratings
        averageUserRating: ratingStats?.avg_rating ? parseFloat(ratingStats.avg_rating) : null,
        totalRatings: parseInt(ratingStats?.rating_count || '0', 10),
        // Progress metrics
        averageProgress: avgProgress,
        watchPercentage: totalUsers > 0 ? Math.round((watchStats.rows.length / totalUsers) * 100) : 0,
        totalUsers,
      })
    }
  )
}
