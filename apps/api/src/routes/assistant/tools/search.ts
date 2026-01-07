/**
 * Search and similarity tools
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query, queryOne } from '../../../lib/db.js'
import { buildPlayLink } from '../helpers/mediaServer.js'
import type { ToolContext, MovieResult, SeriesResult } from '../types.js'

// Simplified result types for AI (no overview to avoid content filter)
export interface MovieSearchResult {
  id: string
  title: string
  year: number | null
  genres: string[]
  rating: number | null
  posterUrl: string | null
  detailLink: string
  playLink: string | null
}

export interface SeriesSearchResult {
  id: string
  title: string
  year: number | null
  genres: string[]
  network?: string | null
  rating: number | null
  posterUrl: string | null
  detailLink: string
  playLink: string | null
}

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
        const results: { movies?: MovieSearchResult[]; series?: SeriesSearchResult[] } = {}
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

          const movieResult = await query<MovieResult & { provider_item_id?: string }>(
            `SELECT id, title, year, genres, community_rating, poster_url, provider_item_id
             FROM movies ${whereClause}
             ORDER BY community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )
          // Don't include overview to avoid content filter issues
          results.movies = movieResult.rows.map((m) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            genres: m.genres,
            rating: m.community_rating,
            posterUrl: m.poster_url,
            detailLink: `/movies/${m.id}`,
            playLink: buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie'),
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

          const seriesResult = await query<SeriesResult & { provider_item_id?: string }>(
            `SELECT id, title, year, genres, network, community_rating, poster_url, provider_item_id
             FROM series ${whereClause}
             ORDER BY community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )
          // Don't include overview to avoid content filter issues
          results.series = seriesResult.rows.map((s) => ({
            id: s.id,
            title: s.title,
            year: s.year,
            genres: s.genres,
            network: s.network,
            rating: s.community_rating,
            posterUrl: s.poster_url,
            detailLink: `/series/${s.id}`,
            playLink: buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series'),
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
        try {
          const results: {
            foundAs?: string
            foundType?: string
            foundId?: string
            similarMovies?: Array<MovieSearchResult>
            similarSeries?: Array<SeriesSearchResult>
            error?: string
          } = {}

          // Try to find as movie - prefer ones that have embeddings
          const movie = await queryOne<{ id: string; title: string }>(
            `SELECT m.id, m.title FROM movies m
             LEFT JOIN embeddings e ON e.movie_id = m.id AND e.model = $2
             WHERE m.title ILIKE $1
             ORDER BY e.id IS NOT NULL DESC
             LIMIT 1`,
            [`%${title}%`, ctx.embeddingModel]
          )

          // Try to find as series - prefer ones that have embeddings
          const series = await queryOne<{ id: string; title: string }>(
            `SELECT s.id, s.title FROM series s
             LEFT JOIN series_embeddings se ON se.series_id = s.id AND se.model = $2
             WHERE s.title ILIKE $1
             ORDER BY se.id IS NOT NULL DESC
             LIMIT 1`,
            [`%${title}%`, ctx.embeddingModel]
          )

          if (!movie && !series) {
            return { error: `"${title}" not found in your library.` }
          }

          if (movie) {
            results.foundAs = movie.title
            results.foundType = 'movie'
            results.foundId = movie.id

            const embedding = await queryOne<{ embedding: string }>(
              `SELECT embedding::text FROM embeddings WHERE movie_id = $1 AND model = $2`,
              [movie.id, ctx.embeddingModel]
            )

            if (embedding) {
              const similar = await query<MovieResult & { provider_item_id?: string }>(
                `SELECT m.id, m.title, m.year, m.genres, m.community_rating, m.poster_url, m.provider_item_id
               FROM embeddings e JOIN movies m ON m.id = e.movie_id
               WHERE e.movie_id != $1 AND e.model = $2
               ORDER BY e.embedding <=> $3::halfvec LIMIT $4`,
                [movie.id, ctx.embeddingModel, embedding.embedding, limit]
              )
              // Don't include overview - let AI describe based on title/genres to avoid content filter
              results.similarMovies = similar.rows.map((m) => ({
                id: m.id,
                title: m.title,
                year: m.year,
                genres: m.genres,
                rating: m.community_rating,
                posterUrl: m.poster_url,
                detailLink: `/movies/${m.id}`,
                playLink: buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie'),
              }))
            }
          }

          if (series) {
            if (!results.foundAs) {
              results.foundAs = series.title
              results.foundType = 'series'
              results.foundId = series.id
            }

            const embedding = await queryOne<{ embedding: string }>(
              `SELECT embedding::text FROM series_embeddings WHERE series_id = $1 AND model = $2`,
              [series.id, ctx.embeddingModel]
            )

            if (embedding) {
              const similar = await query<SeriesResult & { provider_item_id?: string }>(
                `SELECT s.id, s.title, s.year, s.genres, s.network, s.community_rating, s.poster_url, s.provider_item_id
               FROM series_embeddings se JOIN series s ON s.id = se.series_id
               WHERE se.series_id != $1 AND se.model = $2
               ORDER BY se.embedding <=> $3::halfvec LIMIT $4`,
                [series.id, ctx.embeddingModel, embedding.embedding, limit]
              )
              // Don't include overview - let AI describe based on title/genres to avoid content filter
              results.similarSeries = similar.rows.map((s) => ({
                id: s.id,
                title: s.title,
                year: s.year,
                genres: s.genres,
                network: s.network,
                rating: s.community_rating,
                posterUrl: s.poster_url,
                detailLink: `/series/${s.id}`,
                playLink: buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series'),
              }))
            }
          }

          return results
        } catch (err) {
          console.error('[findSimilarContent] Error:', err)
          return {
            error: `Failed to find similar content: ${err instanceof Error ? err.message : 'Unknown error'}`,
          }
        }
      },
    }),
  }
}
