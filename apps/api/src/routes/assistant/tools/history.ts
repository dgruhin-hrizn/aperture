/**
 * Watch history and ratings tools
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query } from '../../../lib/db.js'
import type { ToolContext } from '../types.js'

export function createHistoryTools(ctx: ToolContext) {
  return {
    getWatchHistory: tool({
      description: 'Get the user\'s watch history. Use for "what have I watched", "my history".',
      parameters: z.object({
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        limit: z.number().optional().default(20),
      }),
      execute: async ({ type = 'both', limit = 20 }) => {
        const results: {
          movies?: Array<{
            id: string
            title: string
            year: number | null
            posterUrl: string | null
            lastWatched: Date
            playCount: number
          }>
          series?: Array<{
            id: string
            title: string
            year: number | null
            posterUrl: string | null
            episodesWatched: number
            lastWatched: Date
          }>
        } = {}

        if (type === 'movies' || type === 'both') {
          const movieHistory = await query<{
            id: string
            title: string
            year: number | null
            poster_url: string | null
            last_played_at: Date
            play_count: number
          }>(
            `SELECT m.id, m.title, m.year, m.poster_url, wh.last_played_at, wh.play_count
             FROM watch_history wh JOIN movies m ON m.id = wh.movie_id
             WHERE wh.user_id = $1 AND wh.movie_id IS NOT NULL
             ORDER BY wh.last_played_at DESC LIMIT $2`,
            [ctx.userId, limit]
          )
          results.movies = movieHistory.rows.map((m) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            posterUrl: m.poster_url,
            lastWatched: m.last_played_at,
            playCount: m.play_count,
          }))
        }

        if (type === 'series' || type === 'both') {
          const seriesHistory = await query<{
            id: string
            title: string
            year: number | null
            poster_url: string | null
            episodes_watched: string
            last_watched: Date
          }>(
            `SELECT s.id, s.title, s.year, s.poster_url, COUNT(DISTINCT wh.episode_id) as episodes_watched,
             MAX(wh.last_played_at) as last_watched
             FROM watch_history wh JOIN episodes e ON e.id = wh.episode_id
             JOIN seasons sea ON sea.id = e.season_id JOIN series s ON s.id = sea.series_id
             WHERE wh.user_id = $1 AND wh.episode_id IS NOT NULL
             GROUP BY s.id, s.title, s.year, s.poster_url ORDER BY last_watched DESC LIMIT $2`,
            [ctx.userId, limit]
          )
          results.series = seriesHistory.rows.map((s) => ({
            id: s.id,
            title: s.title,
            year: s.year,
            posterUrl: s.poster_url,
            episodesWatched: parseInt(s.episodes_watched),
            lastWatched: s.last_watched,
          }))
        }

        return results
      },
    }),

    getUserRatings: tool({
      description: 'Get the user\'s ratings. Use for "what have I rated", "my ratings".',
      parameters: z.object({
        minRating: z.number().optional().describe('Minimum rating (1-10)'),
        maxRating: z.number().optional().describe('Maximum rating (1-10)'),
        limit: z.number().optional().default(20),
      }),
      execute: async ({ minRating, maxRating, limit = 20 }) => {
        let whereClause = 'WHERE ur.user_id = $1'
        const params: unknown[] = [ctx.userId]
        let paramIndex = 2

        if (minRating !== undefined) {
          whereClause += ` AND ur.rating >= $${paramIndex++}`
          params.push(minRating)
        }
        if (maxRating !== undefined) {
          whereClause += ` AND ur.rating <= $${paramIndex++}`
          params.push(maxRating)
        }
        params.push(limit)

        const movieRatings = await query<{
          id: string
          title: string
          year: number | null
          poster_url: string | null
          rating: number
          rated_at: Date
        }>(
          `SELECT m.id, m.title, m.year, m.poster_url, ur.rating, ur.updated_at as rated_at
           FROM user_ratings ur JOIN movies m ON m.id = ur.movie_id
           ${whereClause} AND ur.movie_id IS NOT NULL
           ORDER BY ur.rating DESC, ur.updated_at DESC LIMIT $${paramIndex}`,
          params
        )

        const seriesRatings = await query<{
          id: string
          title: string
          year: number | null
          poster_url: string | null
          rating: number
          rated_at: Date
        }>(
          `SELECT s.id, s.title, s.year, s.poster_url, ur.rating, ur.updated_at as rated_at
           FROM user_ratings ur JOIN series s ON s.id = ur.series_id
           ${whereClause} AND ur.series_id IS NOT NULL
           ORDER BY ur.rating DESC, ur.updated_at DESC LIMIT $${paramIndex}`,
          params
        )

        return {
          movies: movieRatings.rows.map((r) => ({
            id: r.id,
            title: r.title,
            year: r.year,
            posterUrl: r.poster_url,
            rating: r.rating,
            ratedAt: r.rated_at,
          })),
          series: seriesRatings.rows.map((r) => ({
            id: r.id,
            title: r.title,
            year: r.year,
            posterUrl: r.poster_url,
            rating: r.rating,
            ratedAt: r.rated_at,
          })),
        }
      },
    }),
  }
}
