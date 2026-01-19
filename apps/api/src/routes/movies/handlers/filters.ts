/**
 * Movie Filters Handlers
 * 
 * Endpoints for filter options:
 * - GET /api/movies/genres
 * - GET /api/movies/keywords
 * - GET /api/movies/collections
 * - GET /api/movies/content-ratings
 * - GET /api/movies/resolutions
 * - GET /api/movies/filter-ranges
 */
import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import {
  genresSchema,
  keywordsSchema,
  collectionsSchema,
  contentRatingsSchema,
  resolutionsSchema,
  filterRangesSchema,
} from '../schemas.js'

export function registerFiltersHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/movies/genres
   * Get all unique genres
   */
  fastify.get(
    '/api/movies/genres',
    {
      preHandler: requireAuth,
      schema: genresSchema,
    },
    async (_request, reply) => {
      const result = await query<{ genre: string }>(
        `SELECT DISTINCT unnest(genres) as genre FROM movies ORDER BY genre`
      )

      return reply.send({ genres: result.rows.map((r) => r.genre) })
    }
  )

  /**
   * GET /api/movies/keywords
   * Get all unique keywords (from TMDb enrichment)
   */
  fastify.get(
    '/api/movies/keywords',
    {
      preHandler: requireAuth,
      schema: keywordsSchema,
    },
    async (_request, reply) => {
      const result = await query<{ keyword: string; count: string }>(
        `SELECT unnest(keywords) as keyword, COUNT(*) as count
         FROM movies WHERE keywords IS NOT NULL AND array_length(keywords, 1) > 0
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
   * GET /api/movies/collections
   * Get all collections/franchises
   */
  fastify.get(
    '/api/movies/collections',
    {
      preHandler: requireAuth,
      schema: collectionsSchema,
    },
    async (_request, reply) => {
      const result = await query<{ collection_name: string; count: string }>(
        `SELECT collection_name, COUNT(*) as count
         FROM movies 
         WHERE collection_name IS NOT NULL
         GROUP BY collection_name
         ORDER BY COUNT(*) DESC`
      )

      return reply.send({ 
        collections: result.rows.map((r) => ({ name: r.collection_name, count: parseInt(r.count, 10) })) 
      })
    }
  )

  /**
   * GET /api/movies/content-ratings
   * Get all unique content ratings with counts
   */
  fastify.get(
    '/api/movies/content-ratings',
    {
      preHandler: requireAuth,
      schema: contentRatingsSchema,
    },
    async (_request, reply) => {
      const result = await query<{ content_rating: string; count: string }>(
        `SELECT content_rating, COUNT(*) as count
         FROM movies 
         WHERE content_rating IS NOT NULL
         GROUP BY content_rating
         ORDER BY 
           CASE content_rating
             WHEN 'G' THEN 1
             WHEN 'PG' THEN 2
             WHEN 'PG-13' THEN 3
             WHEN 'R' THEN 4
             WHEN 'NC-17' THEN 5
             WHEN 'TV-G' THEN 6
             WHEN 'TV-PG' THEN 7
             WHEN 'TV-14' THEN 8
             WHEN 'TV-MA' THEN 9
             ELSE 10
           END`
      )

      return reply.send({ 
        contentRatings: result.rows.map((r) => ({ rating: r.content_rating, count: parseInt(r.count, 10) })) 
      })
    }
  )

  /**
   * GET /api/movies/resolutions
   * Get video resolution categories with counts
   */
  fastify.get(
    '/api/movies/resolutions',
    {
      preHandler: requireAuth,
      schema: resolutionsSchema,
    },
    async (_request, reply) => {
      const result = await query<{ category: string; count: string }>(
        `SELECT 
          CASE 
            WHEN video_resolution LIKE '3840%' OR video_resolution LIKE '2160%' OR video_resolution LIKE '%x2160' THEN '4K'
            WHEN video_resolution LIKE '1920x%' OR video_resolution LIKE '%x1080' THEN '1080p'
            WHEN video_resolution LIKE '1280x%' OR video_resolution LIKE '%x720' THEN '720p'
            ELSE 'SD'
          END as category,
          COUNT(*) as count
         FROM movies 
         WHERE video_resolution IS NOT NULL
         GROUP BY 1
         ORDER BY 
           CASE category
             WHEN '4K' THEN 1
             WHEN '1080p' THEN 2
             WHEN '720p' THEN 3
             WHEN 'SD' THEN 4
           END`
      )

      return reply.send({ 
        resolutions: result.rows.map((r) => ({ resolution: r.category, count: parseInt(r.count, 10) })) 
      })
    }
  )

  /**
   * GET /api/movies/filter-ranges
   * Get min/max values for range filters
   */
  fastify.get(
    '/api/movies/filter-ranges',
    {
      preHandler: requireAuth,
      schema: filterRangesSchema,
    },
    async (_request, reply) => {
      const result = await queryOne<{
        min_year: number
        max_year: number
        min_runtime: number
        max_runtime: number
        min_rating: number
        max_rating: number
      }>(
        `SELECT 
          MIN(year) as min_year,
          MAX(year) as max_year,
          MIN(runtime_minutes) as min_runtime,
          MAX(runtime_minutes) as max_runtime,
          MIN(community_rating) as min_rating,
          MAX(community_rating) as max_rating
         FROM movies 
         WHERE year IS NOT NULL`
      )

      return reply.send({
        year: { min: result?.min_year || 1900, max: result?.max_year || new Date().getFullYear() },
        runtime: { min: result?.min_runtime || 0, max: result?.max_runtime || 300 },
        rating: { min: result?.min_rating || 0, max: result?.max_rating || 10 }
      })
    }
  )
}
