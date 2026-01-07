/**
 * Search and similarity tools
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query, queryOne } from '../../../lib/db.js'
import type { ToolContext, MovieResult, SeriesResult } from '../types.js'

export function createSearchTools(ctx: ToolContext) {
  return {
    searchContent: tool({
      description:
        'Search for movies and/or TV series by title, genre, year, or other criteria. PRIMARY search tool.',
      parameters: z.object({
        query: z
          .string()
          .optional()
          .describe('Search query - matches title, overview, cast, director'),
        genre: z.string().optional().describe('Filter by genre'),
        year: z.number().optional().describe('Filter by release year'),
        minRating: z.number().optional().describe('Minimum community rating (0-10)'),
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({
        query: searchQuery,
        genre,
        year,
        minRating,
        type = 'both',
        limit = 10,
      }) => {
        const results: { movies?: MovieResult[]; series?: SeriesResult[] } = {}
        const safeLimit = Math.min(limit, 20)

        if (type === 'movies' || type === 'both') {
          let whereClause = ''
          const params: unknown[] = []
          let paramIndex = 1

          if (searchQuery) {
            whereClause = `WHERE (title ILIKE $${paramIndex} OR overview ILIKE $${paramIndex})`
            params.push(`%${searchQuery}%`)
            paramIndex++
          }
          if (genre) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `$${paramIndex} = ANY(genres)`
            params.push(genre)
            paramIndex++
          }
          if (year) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `year = $${paramIndex}`
            params.push(year)
            paramIndex++
          }
          if (minRating) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `community_rating >= $${paramIndex}`
            params.push(minRating)
            paramIndex++
          }
          params.push(safeLimit)

          const movieResult = await query<MovieResult>(
            `SELECT id, title, year, genres, overview, community_rating, poster_url
             FROM movies ${whereClause}
             ORDER BY community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )
          results.movies = movieResult.rows.map((m) => ({
            ...m,
            overview:
              m.overview?.substring(0, 200) +
              (m.overview && m.overview.length > 200 ? '...' : ''),
          }))
        }

        if (type === 'series' || type === 'both') {
          let whereClause = ''
          const params: unknown[] = []
          let paramIndex = 1

          if (searchQuery) {
            whereClause = `WHERE (title ILIKE $${paramIndex} OR overview ILIKE $${paramIndex})`
            params.push(`%${searchQuery}%`)
            paramIndex++
          }
          if (genre) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `$${paramIndex} = ANY(genres)`
            params.push(genre)
            paramIndex++
          }
          if (year) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `year = $${paramIndex}`
            params.push(year)
            paramIndex++
          }
          if (minRating) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `community_rating >= $${paramIndex}`
            params.push(minRating)
            paramIndex++
          }
          params.push(safeLimit)

          const seriesResult = await query<SeriesResult>(
            `SELECT id, title, year, genres, network, overview, community_rating, poster_url
             FROM series ${whereClause}
             ORDER BY community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )
          results.series = seriesResult.rows.map((s) => ({
            ...s,
            overview:
              s.overview?.substring(0, 200) +
              (s.overview && s.overview.length > 200 ? '...' : ''),
          }))
        }

        const totalFound = (results.movies?.length || 0) + (results.series?.length || 0)
        if (totalFound === 0) {
          return { message: 'No results found. Try a different search term or browse by genre.' }
        }
        return results
      },
    }),

    findSimilarContent: tool({
      description:
        'Find movies and TV series similar to a given title using AI embeddings. Automatically searches both.',
      parameters: z.object({
        title: z.string().describe('The title to find similar content for'),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ title, limit = 5 }) => {
        const results: {
          foundAs?: string
          foundType?: string
          similarMovies?: Array<{
            title: string
            year: number | null
            genres: string[]
            rating: number | null
            overview: string | null
          }>
          similarSeries?: Array<{
            title: string
            year: number | null
            genres: string[]
            network: string | null
            rating: number | null
            overview: string | null
          }>
          error?: string
        } = {}

        // Try to find as movie
        const movie = await queryOne<{ id: string; title: string }>(
          `SELECT id, title FROM movies WHERE title ILIKE $1 LIMIT 1`,
          [`%${title}%`]
        )

        // Try to find as series
        const series = await queryOne<{ id: string; title: string }>(
          `SELECT id, title FROM series WHERE title ILIKE $1 LIMIT 1`,
          [`%${title}%`]
        )

        if (!movie && !series) {
          return { error: `"${title}" not found in your library.` }
        }

        if (movie) {
          results.foundAs = movie.title
          results.foundType = 'movie'

          const embedding = await queryOne<{ embedding: string }>(
            `SELECT embedding::text FROM embeddings WHERE movie_id = $1 AND model = $2`,
            [movie.id, ctx.embeddingModel]
          )

          if (embedding) {
            const similar = await query<MovieResult>(
              `SELECT m.id, m.title, m.year, m.genres, m.overview, m.community_rating
               FROM embeddings e JOIN movies m ON m.id = e.movie_id
               WHERE e.movie_id != $1 AND e.model = $2
               ORDER BY e.embedding <=> $3::halfvec LIMIT $4`,
              [movie.id, ctx.embeddingModel, embedding.embedding, limit]
            )
            results.similarMovies = similar.rows.map((m) => ({
              title: m.title,
              year: m.year,
              genres: m.genres,
              rating: m.community_rating,
              overview: m.overview?.substring(0, 150) + '...',
            }))
          }
        }

        if (series) {
          if (!results.foundAs) {
            results.foundAs = series.title
            results.foundType = 'series'
          }

          const embedding = await queryOne<{ embedding: string }>(
            `SELECT embedding::text FROM series_embeddings WHERE series_id = $1 AND model = $2`,
            [series.id, ctx.embeddingModel]
          )

          if (embedding) {
            const similar = await query<SeriesResult>(
              `SELECT s.id, s.title, s.year, s.genres, s.network, s.overview, s.community_rating
               FROM series_embeddings se JOIN series s ON s.id = se.series_id
               WHERE se.series_id != $1 AND se.model = $2
               ORDER BY se.embedding <=> $3::halfvec LIMIT $4`,
              [series.id, ctx.embeddingModel, embedding.embedding, limit]
            )
            results.similarSeries = similar.rows.map((s) => ({
              title: s.title,
              year: s.year,
              genres: s.genres,
              network: s.network,
              rating: s.community_rating,
              overview: s.overview?.substring(0, 150) + '...',
            }))
          }
        }

        return results
      },
    }),
  }
}

