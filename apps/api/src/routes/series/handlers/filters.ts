/**
 * Series Filters Handlers
 * 
 * Endpoints for filter options:
 * - GET /api/series/genres
 * - GET /api/series/networks
 * - GET /api/series/keywords
 * - GET /api/series/content-ratings
 * - GET /api/series/filter-ranges
 */
import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import {
  genresSchema,
  networksSchema,
  keywordsSchema,
  contentRatingsSchema,
  filterRangesSchema,
} from '../schemas.js'

export function registerFiltersHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/series/genres
   * Get all unique genres
   */
  fastify.get(
    '/api/series/genres',
    {
      preHandler: requireAuth,
      schema: genresSchema,
    },
    async (_request, reply) => {
      const result = await query<{ genre: string }>(
        `SELECT DISTINCT unnest(genres) as genre FROM series ORDER BY genre`
      )

      return reply.send({ genres: result.rows.map((r) => r.genre) })
    }
  )

  /**
   * GET /api/series/networks
   * Get all unique networks
   */
  fastify.get(
    '/api/series/networks',
    {
      preHandler: requireAuth,
      schema: networksSchema,
    },
    async (_request, reply) => {
      const result = await query<{ network: string }>(
        `SELECT DISTINCT network FROM series WHERE network IS NOT NULL ORDER BY network`
      )

      return reply.send({ networks: result.rows.map((r) => r.network) })
    }
  )

  /**
   * GET /api/series/keywords
   * Get all unique keywords (from TMDb enrichment)
   */
  fastify.get(
    '/api/series/keywords',
    {
      preHandler: requireAuth,
      schema: keywordsSchema,
    },
    async (_request, reply) => {
      const result = await query<{ keyword: string; count: string }>(
        `SELECT unnest(keywords) as keyword, COUNT(*) as count
         FROM series WHERE keywords IS NOT NULL AND array_length(keywords, 1) > 0
         GROUP BY unnest(keywords)
         HAVING COUNT(*) > 1
         ORDER BY COUNT(*) DESC
         LIMIT 100`
      )

      return reply.send({ 
        keywords: result.rows.map((r) => ({ name: r.keyword, count: parseInt(r.count, 10) })) 
      })
    }
  )

  /**
   * GET /api/series/content-ratings
   * Get all unique content ratings with counts
   */
  fastify.get(
    '/api/series/content-ratings',
    {
      preHandler: requireAuth,
      schema: contentRatingsSchema,
    },
    async (_request, reply) => {
      const result = await query<{ content_rating: string; count: string }>(
        `SELECT content_rating, COUNT(*) as count
         FROM series 
         WHERE content_rating IS NOT NULL
         GROUP BY content_rating
         ORDER BY 
           CASE content_rating
             WHEN 'TV-G' THEN 1
             WHEN 'TV-Y' THEN 2
             WHEN 'TV-Y7' THEN 3
             WHEN 'TV-PG' THEN 4
             WHEN 'TV-14' THEN 5
             WHEN 'TV-MA' THEN 6
             WHEN 'G' THEN 7
             WHEN 'PG' THEN 8
             WHEN 'PG-13' THEN 9
             WHEN 'R' THEN 10
             ELSE 11
           END`
      )

      return reply.send({ 
        contentRatings: result.rows.map((r) => ({ rating: r.content_rating, count: parseInt(r.count, 10) })) 
      })
    }
  )

  /**
   * GET /api/series/filter-ranges
   * Get min/max values for range filters
   */
  fastify.get(
    '/api/series/filter-ranges',
    {
      preHandler: requireAuth,
      schema: filterRangesSchema,
    },
    async (_request, reply) => {
      const result = await queryOne<{
        min_year: number
        max_year: number
        min_seasons: number
        max_seasons: number
        min_rating: number
        max_rating: number
      }>(
        `SELECT 
          MIN(year) as min_year,
          MAX(year) as max_year,
          MIN(total_seasons) as min_seasons,
          MAX(total_seasons) as max_seasons,
          MIN(community_rating) as min_rating,
          MAX(community_rating) as max_rating
         FROM series 
         WHERE year IS NOT NULL`
      )

      return reply.send({
        year: { min: result?.min_year || 1950, max: result?.max_year || new Date().getFullYear() },
        seasons: { min: result?.min_seasons || 1, max: result?.max_seasons || 30 },
        rating: { min: result?.min_rating || 0, max: result?.max_rating || 10 }
      })
    }
  )
}
