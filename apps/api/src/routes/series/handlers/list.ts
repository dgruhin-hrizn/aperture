/**
 * Series List Handler
 * 
 * GET /api/series - List all series with pagination, filtering, and sorting
 */
import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth } from '../../../plugins/auth.js'
import { listSeriesSchema } from '../schemas.js'
import type { SeriesRow, SeriesListResponse, SeriesListQuerystring } from '../types.js'

export function registerListHandler(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: SeriesListQuerystring
    Reply: SeriesListResponse
  }>(
    '/api/series',
    {
      preHandler: requireAuth,
      schema: listSeriesSchema,
    },
    async (request, reply) => {
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
      const offset = (page - 1) * pageSize
      const { 
        search, genre, network, status, minRtScore, showAll, hasAwards,
        minYear, maxYear, contentRating, minSeasons, maxSeasons,
        minCommunityRating, minMetacritic,
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
          WHERE lc.provider_library_id = series.provider_library_id 
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

      if (network) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `network = $${paramIndex++}`
        params.push(network)
      }

      if (status) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        // Map user-friendly status names to database values
        const statusValue = status === 'Airing' ? 'Continuing' : status
        whereClause += `status = $${paramIndex++}`
        params.push(statusValue)
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

      // Seasons filter
      if (minSeasons) {
        const seasons = parseInt(minSeasons, 10)
        if (!isNaN(seasons)) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `total_seasons >= $${paramIndex++}`
          params.push(seasons)
        }
      }
      if (maxSeasons) {
        const seasons = parseInt(maxSeasons, 10)
        if (!isNaN(seasons)) {
          whereClause += whereClause ? ' AND ' : ' WHERE '
          whereClause += `total_seasons <= $${paramIndex++}`
          params.push(seasons)
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

      // Get total count
      const countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM series${whereClause}`,
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
        case 'rating':
          orderClause = `community_rating ${order} ${nullsPosition}, title ASC`
          break
        case 'rtScore':
          orderClause = `rt_critic_score ${order} ${nullsPosition}, title ASC`
          break
        case 'metacritic':
          orderClause = `metacritic_score ${order} ${nullsPosition}, title ASC`
          break
        case 'seasons':
          orderClause = `total_seasons ${order} ${nullsPosition}, title ASC`
          break
        case 'added':
          orderClause = `created_at ${order}, title ASC`
          break
        default:
          orderClause = `title ${order}`
      }

      // Get series
      params.push(pageSize, offset)
      const result = await query<SeriesRow>(
        `SELECT id, provider_item_id, title, original_title, year, end_year, genres, overview,
                community_rating, status, total_seasons, total_episodes, network,
                poster_url, backdrop_url, created_at, updated_at,
                rt_critic_score, awards_summary
         FROM series${whereClause}
         ORDER BY ${orderClause}
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params
      )

      return reply.send({
        series: result.rows,
        total,
        page,
        pageSize,
      })
    }
  )
}
