/**
 * Recommendation tools
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query } from '../../../lib/db.js'
import type { ToolContext, MovieResult, SeriesResult } from '../types.js'

export function createRecommendationTools(ctx: ToolContext) {
  return {
    getMyRecommendations: tool({
      description: "Get the user's current AI-generated personalized recommendations.",
      parameters: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ type, limit = 10 }) => {
        const result: {
          movies?: {
            id: string
            title: string
            year: number | null
            rank: number
            genres: string[]
            posterUrl: string | null
            overview: string
          }[]
          series?: {
            id: string
            title: string
            year: number | null
            rank: number
            genres: string[]
            posterUrl: string | null
            overview: string
          }[]
        } = {}

        if (type === 'movies' || type === 'both') {
          const movieRecs = await query<{
            id: string
            title: string
            year: number | null
            rank: number
            genres: string[]
            overview: string | null
            poster_url: string | null
          }>(
            `SELECT m.id, m.title, m.year, rc.selected_rank as rank, m.genres, m.overview, m.poster_url
             FROM recommendation_candidates rc
             JOIN recommendation_runs rr ON rr.id = rc.run_id
             JOIN movies m ON m.id = rc.movie_id
             WHERE rr.user_id = $1 AND rr.status = 'completed' AND rr.media_type = 'movie'
             AND rc.is_selected = true
             ORDER BY rr.created_at DESC, rc.selected_rank ASC LIMIT $2`,
            [ctx.userId, limit]
          )
          result.movies = movieRecs.rows.map((r) => ({
            id: r.id,
            title: r.title,
            year: r.year,
            rank: r.rank,
            genres: r.genres,
            posterUrl: r.poster_url,
            overview: r.overview?.substring(0, 150) + '...',
          }))
        }

        if (type === 'series' || type === 'both') {
          const seriesRecs = await query<{
            id: string
            title: string
            year: number | null
            rank: number
            genres: string[]
            overview: string | null
            poster_url: string | null
          }>(
            `SELECT s.id, s.title, s.year, rc.selected_rank as rank, s.genres, s.overview, s.poster_url
             FROM recommendation_candidates rc
             JOIN recommendation_runs rr ON rr.id = rc.run_id
             JOIN series s ON s.id = rc.series_id
             WHERE rr.user_id = $1 AND rr.status = 'completed' AND rr.media_type = 'series'
             AND rc.is_selected = true
             ORDER BY rr.created_at DESC, rc.selected_rank ASC LIMIT $2`,
            [ctx.userId, limit]
          )
          result.series = seriesRecs.rows.map((r) => ({
            id: r.id,
            title: r.title,
            year: r.year,
            rank: r.rank,
            genres: r.genres,
            posterUrl: r.poster_url,
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
        const results: {
          movies?: {
            id: string
            title: string
            year: number | null
            genres: string[]
            rating: number | null
            posterUrl: string | null
            overview: string
          }[]
          series?: {
            id: string
            title: string
            year: number | null
            genres: string[]
            network: string | null
            rating: number | null
            posterUrl: string | null
            overview: string
          }[]
        } = {}

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
            `SELECT id, title, year, genres, overview, community_rating, poster_url
             FROM movies ${whereClause}
             ORDER BY community_rating DESC LIMIT $${paramIndex}`,
            params
          )
          results.movies = movies.rows.map((m) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            genres: m.genres,
            rating: m.community_rating,
            posterUrl: m.poster_url,
            overview: m.overview?.substring(0, 150) + '...',
          }))
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
            `SELECT id, title, year, genres, network, overview, community_rating, poster_url
             FROM series ${whereClause}
             ORDER BY community_rating DESC LIMIT $${paramIndex}`,
            params
          )
          results.series = series.rows.map((s) => ({
            id: s.id,
            title: s.title,
            year: s.year,
            genres: s.genres,
            network: s.network,
            rating: s.community_rating,
            posterUrl: s.poster_url,
            overview: s.overview?.substring(0, 150) + '...',
          }))
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
        const results: {
          movies?: {
            id: string
            title: string
            year: number | null
            genres: string[]
            rating: number | null
            posterUrl: string | null
            overview: string
          }[]
          series?: {
            id: string
            title: string
            year: number | null
            genres: string[]
            network: string | null
            rating: number | null
            posterUrl: string | null
            overview: string
          }[]
        } = {}

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
            `SELECT m.id, m.title, m.year, m.genres, m.overview, m.community_rating, m.poster_url
             FROM movies m ${whereClause}
             ORDER BY m.community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )
          results.movies = movies.rows.map((m) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            genres: m.genres,
            rating: m.community_rating,
            posterUrl: m.poster_url,
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
            `SELECT s.id, s.title, s.year, s.genres, s.network, s.overview, s.community_rating, s.poster_url
             FROM series s ${whereClause}
             ORDER BY s.community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )
          results.series = series.rows.map((s) => ({
            id: s.id,
            title: s.title,
            year: s.year,
            genres: s.genres,
            network: s.network,
            rating: s.community_rating,
            posterUrl: s.poster_url,
            overview: s.overview?.substring(0, 150) + '...',
          }))
        }

        return results
      },
    }),
  }
}
