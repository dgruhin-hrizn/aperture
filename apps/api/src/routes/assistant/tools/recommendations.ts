/**
 * Recommendation tools
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query } from '../../../lib/db.js'
import type { ToolContext, MovieResult, SeriesResult, RecommendationResult } from '../types.js'

export function createRecommendationTools(ctx: ToolContext) {
  return {
    getMyRecommendations: tool({
      description: "Get the user's current AI-generated personalized recommendations.",
      parameters: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ type, limit = 10 }) => {
        const result: { movies?: RecommendationResult[]; series?: RecommendationResult[] } = {}

        if (type === 'movies' || type === 'both') {
          const movieRecs = await query<RecommendationResult>(
            `SELECT m.title, m.year, rc.selected_rank as rank, m.genres, m.overview
             FROM recommendation_candidates rc
             JOIN recommendation_runs rr ON rr.id = rc.run_id
             JOIN movies m ON m.id = rc.movie_id
             WHERE rr.user_id = $1 AND rr.status = 'completed' AND rr.media_type = 'movie'
             AND rc.is_selected = true
             ORDER BY rr.created_at DESC, rc.selected_rank ASC LIMIT $2`,
            [ctx.userId, limit]
          )
          result.movies = movieRecs.rows.map((r) => ({
            ...r,
            overview: r.overview?.substring(0, 150) + '...',
          }))
        }

        if (type === 'series' || type === 'both') {
          const seriesRecs = await query<RecommendationResult>(
            `SELECT s.title, s.year, rc.selected_rank as rank, s.genres, s.overview
             FROM recommendation_candidates rc
             JOIN recommendation_runs rr ON rr.id = rc.run_id
             JOIN series s ON s.id = rc.series_id
             WHERE rr.user_id = $1 AND rr.status = 'completed' AND rr.media_type = 'series'
             AND rc.is_selected = true
             ORDER BY rr.created_at DESC, rc.selected_rank ASC LIMIT $2`,
            [ctx.userId, limit]
          )
          result.series = seriesRecs.rows.map((r) => ({
            ...r,
            overview: r.overview?.substring(0, 150) + '...',
          }))
        }

        if (!result.movies?.length && !result.series?.length) {
          return { message: 'No recommendations generated yet.' }
        }
        return result
      },
    }),

    getTopRated: tool({
      description: 'Get the highest-rated content in the library.',
      parameters: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        genre: z.string().optional(),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ type, genre, limit = 10 }) => {
        const results: { movies?: MovieResult[]; series?: SeriesResult[] } = {}

        if (type === 'movies' || type === 'both') {
          let whereClause = 'WHERE community_rating IS NOT NULL'
          const params: unknown[] = []
          let paramIndex = 1

          if (genre) {
            whereClause += ` AND $${paramIndex} = ANY(genres)`
            params.push(genre)
            paramIndex++
          }
          params.push(limit)

          const movies = await query<MovieResult>(
            `SELECT id, title, year, genres, overview, community_rating
             FROM movies ${whereClause}
             ORDER BY community_rating DESC LIMIT $${paramIndex}`,
            params
          )
          results.movies = movies.rows
        }

        if (type === 'series' || type === 'both') {
          let whereClause = 'WHERE community_rating IS NOT NULL'
          const params: unknown[] = []
          let paramIndex = 1

          if (genre) {
            whereClause += ` AND $${paramIndex} = ANY(genres)`
            params.push(genre)
            paramIndex++
          }
          params.push(limit)

          const series = await query<SeriesResult>(
            `SELECT id, title, year, genres, network, overview, community_rating
             FROM series ${whereClause}
             ORDER BY community_rating DESC LIMIT $${paramIndex}`,
            params
          )
          results.series = series.rows
        }

        return results
      },
    }),

    getUnwatched: tool({
      description: 'Get content the user has NOT watched yet.',
      parameters: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        genre: z.string().optional(),
        minRating: z.number().optional(),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ type, genre, minRating, limit = 10 }) => {
        const results: { movies?: MovieResult[]; series?: SeriesResult[] } = {}

        if (type === 'movies' || type === 'both') {
          let whereClause = `WHERE m.id NOT IN (
            SELECT movie_id FROM watch_history WHERE user_id = $1 AND movie_id IS NOT NULL)`
          const params: unknown[] = [ctx.userId]
          let paramIndex = 2

          if (genre) {
            whereClause += ` AND $${paramIndex} = ANY(m.genres)`
            params.push(genre)
            paramIndex++
          }
          if (minRating) {
            whereClause += ` AND m.community_rating >= $${paramIndex}`
            params.push(minRating)
            paramIndex++
          }
          params.push(limit)

          const movies = await query<MovieResult>(
            `SELECT m.id, m.title, m.year, m.genres, m.overview, m.community_rating
             FROM movies m ${whereClause}
             ORDER BY m.community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )
          results.movies = movies.rows.map((m) => ({
            ...m,
            overview: m.overview?.substring(0, 150) + '...',
          }))
        }

        if (type === 'series' || type === 'both') {
          let whereClause = `WHERE s.id NOT IN (
            SELECT DISTINCT sea.series_id FROM watch_history wh
            JOIN episodes e ON e.id = wh.episode_id
            JOIN seasons sea ON sea.id = e.season_id WHERE wh.user_id = $1)`
          const params: unknown[] = [ctx.userId]
          let paramIndex = 2

          if (genre) {
            whereClause += ` AND $${paramIndex} = ANY(s.genres)`
            params.push(genre)
            paramIndex++
          }
          if (minRating) {
            whereClause += ` AND s.community_rating >= $${paramIndex}`
            params.push(minRating)
            paramIndex++
          }
          params.push(limit)

          const series = await query<SeriesResult>(
            `SELECT s.id, s.title, s.year, s.genres, s.network, s.overview, s.community_rating
             FROM series s ${whereClause}
             ORDER BY s.community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )
          results.series = series.rows.map((s) => ({
            ...s,
            overview: s.overview?.substring(0, 150) + '...',
          }))
        }

        return results
      },
    }),
  }
}

