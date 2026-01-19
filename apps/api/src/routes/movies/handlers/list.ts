/**
 * Movies List Handler
 * 
 * GET /api/movies - List all movies with pagination, filtering, and sorting
 */
import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import { listMoviesSchema } from '../schemas.js'
import type { MovieRow, MoviesListResponse, MoviesListQuerystring } from '../types.js'

export function registerListHandler(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: MoviesListQuerystring
    Reply: MoviesListResponse
  }>(
    '/api/movies',
    {
      preHandler: requireAuth,
      schema: listMoviesSchema,
    },
    async (request, reply) => {
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
      const offset = (page - 1) * pageSize
      const { 
        search, genre, collection, minRtScore, showAll, hasAwards,
        minYear, maxYear, contentRating, minRuntime, maxRuntime,
        minCommunityRating, minMetacritic, resolution,
        sortBy = 'title', sortOrder = 'asc'
      } = request.query

      // Check if library configs exist
      const configCheck = await queryOne<{ count: string }>(
        'SELECT COUNT(*) FROM library_config'
      )
      const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0
      const filterByLibrary = hasLibraryConfigs && showAll !== 'true'

      let whereClause = ''
      const params: unknown[] = []
      let paramIndex = 1

      // Filter by enabled libraries (unless showAll=true or no library configs exist)
      if (filterByLibrary) {
        whereClause = ` WHERE EXISTS (
          SELECT 1 FROM library_config lc 
          WHERE lc.provider_library_id = movies.provider_library_id 
          AND lc.is_enabled = true
        )`
      }

      if (search) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `title ILIKE $${paramIndex++}`
        params.push(`%${search}%`)
      }

      if (genre) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `$${paramIndex++} = ANY(genres)`
        params.push(genre)
      }

      if (collection) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `collection_name = $${paramIndex++}`
        params.push(collection)
      }

      if (minRtScore) {
        const rtScore = parseInt(minRtScore, 10)
        if (rtScore > 0) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `rt_critic_score >= $${paramIndex++}`
          params.push(rtScore)
        }
      }

      if (hasAwards === 'true') {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `awards_summary IS NOT NULL`
      }

      // Year range filter
      if (minYear) {
        const year = parseInt(minYear, 10)
        if (!isNaN(year)) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `year >= $${paramIndex++}`
          params.push(year)
        }
      }
      if (maxYear) {
        const year = parseInt(maxYear, 10)
        if (!isNaN(year)) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `year <= $${paramIndex++}`
          params.push(year)
        }
      }

      // Content rating filter (supports multiple values)
      if (contentRating) {
        const ratings = Array.isArray(contentRating) ? contentRating : [contentRating]
        if (ratings.length > 0) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `content_rating = ANY($${paramIndex++})`
          params.push(ratings)
        }
      }

      // Runtime filter
      if (minRuntime) {
        const runtime = parseInt(minRuntime, 10)
        if (!isNaN(runtime)) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `runtime_minutes >= $${paramIndex++}`
          params.push(runtime)
        }
      }
      if (maxRuntime) {
        const runtime = parseInt(maxRuntime, 10)
        if (!isNaN(runtime)) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `runtime_minutes <= $${paramIndex++}`
          params.push(runtime)
        }
      }

      // Community rating filter
      if (minCommunityRating) {
        const rating = parseFloat(minCommunityRating)
        if (!isNaN(rating)) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `community_rating >= $${paramIndex++}`
          params.push(rating)
        }
      }

      // Metacritic filter
      if (minMetacritic) {
        const score = parseInt(minMetacritic, 10)
        if (!isNaN(score)) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `metacritic_score >= $${paramIndex++}`
          params.push(score)
        }
      }

      // Resolution filter (4K, 1080p, 720p, SD)
      if (resolution) {
        const resolutions = Array.isArray(resolution) ? resolution : [resolution]
        if (resolutions.length > 0) {
          const resConditions: string[] = []
          for (const res of resolutions) {
            switch (res) {
              case '4K':
                resConditions.push(`(video_resolution LIKE '3840%' OR video_resolution LIKE '2160%')`)
                break
              case '1080p':
                resConditions.push(`video_resolution LIKE '1920x%' OR video_resolution LIKE '%x1080'`)
                break
              case '720p':
                resConditions.push(`video_resolution LIKE '1280x%' OR video_resolution LIKE '%x720'`)
                break
              case 'SD':
                resConditions.push(`(video_resolution LIKE '720x%' OR video_resolution LIKE '640x%' OR video_resolution LIKE '480x%')`)
                break
            }
          }
          if (resConditions.length > 0) {
            whereClause += whereClause ? ' AND ' : ' WHERE '
            whereClause += `(${resConditions.join(' OR ')})`
          }
        }
      }

      // Get total count
      const countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM movies${whereClause}`,
        params
      )
      const total = parseInt(countResult?.count || '0', 10)

      // Build ORDER BY clause
      let orderClause = ''
      const order = sortOrder === 'desc' ? 'DESC' : 'ASC'
      const nullsPosition = 'NULLS LAST'
      
      switch (sortBy) {
        case 'year':
          orderClause = `year ${order} ${nullsPosition}, title ASC`
          break
        case 'releaseDate':
          orderClause = `premiere_date ${order} ${nullsPosition}, title ASC`
          break
        case 'rating':
          orderClause = `community_rating ${order} ${nullsPosition}, title ASC`
          break
        case 'rtScore':
          orderClause = `rt_critic_score ${order} ${nullsPosition}, title ASC`
          break
        case 'metacritic':
          orderClause = `metacritic_score ${order} ${nullsPosition}, title ASC`
          break
        case 'runtime':
          orderClause = `runtime_minutes ${order} ${nullsPosition}, title ASC`
          break
        case 'added':
          orderClause = `created_at ${order}, title ASC`
          break
        default:
          orderClause = `title ${order}`
      }

      // Get movies
      params.push(pageSize, offset)
      const result = await query<MovieRow>(
        `SELECT id, provider_item_id, title, original_title, year, genres, overview,
                community_rating, runtime_minutes, poster_url, backdrop_url, created_at, updated_at,
                rt_critic_score, awards_summary
         FROM movies${whereClause}
         ORDER BY ${orderClause}
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params
      )

      return reply.send({
        movies: result.rows,
        total,
        page,
        pageSize,
      })
    }
  )
}
