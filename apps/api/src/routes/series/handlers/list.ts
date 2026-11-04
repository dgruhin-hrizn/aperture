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

function parseCountryQuery(country: string | string[] | undefined): string[] {
  if (!country) return []
  const raw = Array.isArray(country) ? country : country.split(',')
  return [...new Set(raw.map((c) => c.trim()).filter(Boolean))]
}

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
        country, watchStatus, minWatchers, maxWatchers,
        sortBy = 'title', sortOrder = 'asc'
      } = request.query

      const userId = request.user!.id

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

      const countries = parseCountryQuery(country)
      if (countries.length > 0) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `production_countries && $${paramIndex++}::text[]`
        params.push(countries)
      }

      if (watchStatus === 'watched') {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `EXISTS (
          SELECT 1 FROM watch_history wh
          INNER JOIN episodes e ON e.id = wh.episode_id
          WHERE wh.user_id = $${paramIndex++} AND e.series_id = series.id AND wh.media_type = 'episode'
        )`
        params.push(userId)
      } else if (watchStatus === 'unwatched') {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `NOT EXISTS (
          SELECT 1 FROM watch_history wh
          INNER JOIN episodes e ON e.id = wh.episode_id
          WHERE wh.user_id = $${paramIndex++} AND e.series_id = series.id AND wh.media_type = 'episode'
        )`
        params.push(userId)
      }

      const minimumWatchers = Number.parseInt(minWatchers ?? '', 10)
      const maximumWatchers = Number.parseInt(maxWatchers ?? '', 10)
      const hasMinimumWatchers = Number.isFinite(minimumWatchers) && minimumWatchers > 0
      const hasMaximumWatchers = Number.isFinite(maximumWatchers) && maximumWatchers >= 0
      const watcherJoin = hasMinimumWatchers || hasMaximumWatchers
        ? ` LEFT JOIN (
          SELECT e.series_id AS item_id, COUNT(DISTINCT wh.user_id)::int AS watcher_count
          FROM watch_history wh JOIN episodes e ON e.id = wh.episode_id
          JOIN (SELECT id FROM series${whereClause}) matching ON matching.id = e.series_id
          GROUP BY e.series_id
        ) watchers ON watchers.item_id = series.id`
        : ''

      if (hasMinimumWatchers) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `COALESCE(watchers.watcher_count, 0) >= $${paramIndex++}`
        params.push(minimumWatchers)
      }
      if (hasMaximumWatchers) {
        whereClause += whereClause ? ' AND ' : ' WHERE '
        whereClause += `COALESCE(watchers.watcher_count, 0) <= $${paramIndex++}`
        params.push(maximumWatchers)
      }

      // Get total count
      const countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM series${watcherJoin}${whereClause}`,
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
         FROM series${watcherJoin}${whereClause}
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
