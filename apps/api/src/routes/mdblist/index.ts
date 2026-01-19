import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/auth.js'
import {
  getMDBListConfig,
  setMDBListConfig,
  testMDBListConnection,
  isMDBListConfigured,
  getTopLists,
  searchLists,
  getListInfo,
  getListItems,
  getListItemCounts,
  getMyLists,
  query,
  MDBLIST_SORT_OPTIONS,
} from '@aperture/core'
import {
  mdblistSchemas,
  getMDBListConfigSchema,
  updateMDBListConfigSchema,
  testMDBListSchema,
  getTopListsSchema,
  getMyListsSchema,
  searchListsSchema,
  getListInfoSchema,
  getListCountsSchema,
  getListItemsSchema,
  getLibraryMatchSchema,
  getSortOptionsSchema,
} from './schemas.js'

const mdblistRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(mdblistSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  // =========================================================================
  // Configuration Routes (Admin Only)
  // =========================================================================

  /**
   * GET /api/mdblist/config
   * Get MDBList configuration (without exposing the full API key)
   */
  fastify.get('/api/mdblist/config', { preHandler: requireAdmin, schema: getMDBListConfigSchema }, async (_request, reply) => {
    try {
      const config = await getMDBListConfig()
      const configured = await isMDBListConfigured()

      return reply.send({
        configured,
        enabled: config.enabled,
        hasApiKey: config.hasApiKey,
        apiKeyPreview: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : null,
        supporterTier: config.supporterTier,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get MDBList config')
      return reply.status(500).send({ error: 'Failed to get MDBList configuration' })
    }
  })

  /**
   * PATCH /api/mdblist/config
   * Update MDBList configuration
   */
  fastify.patch<{
    Body: {
      apiKey?: string
      enabled?: boolean
      supporterTier?: boolean
    }
  }>('/api/mdblist/config', { preHandler: requireAdmin, schema: updateMDBListConfigSchema }, async (request, reply) => {
    try {
      const { apiKey, enabled, supporterTier } = request.body

      await setMDBListConfig({
        apiKey,
        enabled,
        supporterTier,
      })

      const config = await getMDBListConfig()
      const configured = await isMDBListConfigured()

      return reply.send({
        configured,
        enabled: config.enabled,
        hasApiKey: config.hasApiKey,
        supporterTier: config.supporterTier,
        message: 'MDBList configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update MDBList config')
      return reply.status(500).send({ error: 'Failed to update MDBList configuration' })
    }
  })

  /**
   * POST /api/mdblist/test
   * Test MDBList API connection
   */
  fastify.post<{
    Body: {
      apiKey?: string
    }
  }>('/api/mdblist/test', { preHandler: requireAdmin, schema: testMDBListSchema }, async (request, reply) => {
    try {
      const { apiKey } = request.body
      const result = await testMDBListConnection(apiKey)

      if (result.success && result.userInfo) {
        return reply.send({
          success: true,
          userId: result.userInfo.user_id,
          username: result.userInfo.user_name,
          patronStatus: result.userInfo.patron_status,
          apiRequests: result.userInfo.api_requests,
          apiRequestsCount: result.userInfo.api_requests_count,
        })
      } else {
        return reply.send({
          success: false,
          error: result.error || 'Connection failed',
        })
      }
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test MDBList connection')
      return reply.status(500).send({ error: 'Failed to test connection' })
    }
  })

  // =========================================================================
  // Lists API Routes (Admin Only)
  // =========================================================================

  /**
   * GET /api/mdblist/lists/top
   * Get popular public lists (returns up to 100)
   */
  fastify.get<{
    Querystring: {
      mediatype?: 'movie' | 'show'
      limit?: string
    }
  }>('/api/mdblist/lists/top', { preHandler: requireAdmin, schema: getTopListsSchema }, async (request, reply) => {
    try {
      const configured = await isMDBListConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'MDBList is not configured' })
      }

      const { mediatype, limit } = request.query
      const lists = await getTopLists(mediatype)

      // Apply optional limit (default to all)
      const maxItems = limit ? parseInt(limit, 10) : lists.length
      const limitedLists = lists.slice(0, maxItems)

      return reply.send({ lists: limitedLists })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get top lists')
      return reply.status(500).send({ error: 'Failed to get top lists' })
    }
  })

  /**
   * GET /api/mdblist/lists/mine
   * Get user's own MDBList lists
   */
  fastify.get<{
    Querystring: {
      mediatype?: 'movie' | 'show'
    }
  }>('/api/mdblist/lists/mine', { preHandler: requireAdmin, schema: getMyListsSchema }, async (request, reply) => {
    try {
      const configured = await isMDBListConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'MDBList is not configured' })
      }

      const { mediatype } = request.query
      let lists = await getMyLists()

      // Filter by mediatype if specified
      if (mediatype && lists.length > 0) {
        lists = lists.filter((list) => list.mediatype === mediatype)
      }

      return reply.send({ lists })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get user lists')
      return reply.status(500).send({ error: 'Failed to get user lists' })
    }
  })

  /**
   * GET /api/mdblist/lists/search
   * Search public lists
   */
  fastify.get<{
    Querystring: {
      q: string
      mediatype?: 'movie' | 'show'
    }
  }>('/api/mdblist/lists/search', { preHandler: requireAdmin, schema: searchListsSchema }, async (request, reply) => {
    try {
      const configured = await isMDBListConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'MDBList is not configured' })
      }

      const { q, mediatype } = request.query
      if (!q) {
        return reply.status(400).send({ error: 'Search query is required' })
      }

      const lists = await searchLists(q, mediatype)

      return reply.send({ lists })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to search lists')
      return reply.status(500).send({ error: 'Failed to search lists' })
    }
  })

  /**
   * GET /api/mdblist/lists/:id
   * Get list info
   */
  fastify.get<{
    Params: {
      id: string
    }
  }>('/api/mdblist/lists/:id', { preHandler: requireAdmin, schema: getListInfoSchema }, async (request, reply) => {
    try {
      const configured = await isMDBListConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'MDBList is not configured' })
      }

      const listId = parseInt(request.params.id, 10)
      if (isNaN(listId)) {
        return reply.status(400).send({ error: 'Invalid list ID' })
      }

      const list = await getListInfo(listId)

      if (!list) {
        return reply.status(404).send({ error: 'List not found' })
      }

      return reply.send({ list })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get list info')
      return reply.status(500).send({ error: 'Failed to get list info' })
    }
  })

  /**
   * GET /api/mdblist/lists/:id/counts
   * Get item counts for a list (without fetching all items)
   */
  fastify.get<{
    Params: {
      id: string
    }
  }>('/api/mdblist/lists/:id/counts', { preHandler: requireAdmin, schema: getListCountsSchema }, async (request, reply) => {
    try {
      const configured = await isMDBListConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'MDBList is not configured' })
      }

      const listId = parseInt(request.params.id, 10)
      if (isNaN(listId)) {
        return reply.status(400).send({ error: 'Invalid list ID' })
      }

      const counts = await getListItemCounts(listId)

      if (!counts) {
        return reply.status(404).send({ error: 'Could not get list counts' })
      }

      return reply.send(counts)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get list item counts')
      return reply.status(500).send({ error: 'Failed to get list item counts' })
    }
  })

  /**
   * GET /api/mdblist/lists/:id/items
   * Get list items
   */
  fastify.get<{
    Params: {
      id: string
    }
    Querystring: {
      limit?: string
      offset?: string
    }
  }>('/api/mdblist/lists/:id/items', { preHandler: requireAdmin, schema: getListItemsSchema }, async (request, reply) => {
    try {
      const configured = await isMDBListConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'MDBList is not configured' })
      }

      const listId = parseInt(request.params.id, 10)
      if (isNaN(listId)) {
        return reply.status(400).send({ error: 'Invalid list ID' })
      }

      const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : undefined

      const items = await getListItems(listId, { limit, offset })

      return reply.send({ items })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get list items')
      return reply.status(500).send({ error: 'Failed to get list items' })
    }
  })

  /**
   * GET /api/mdblist/lists/:id/library-match
   * Get list items matched against local library
   */
  fastify.get<{
    Params: {
      id: string
    }
    Querystring: {
      mediatype?: 'movie' | 'show'
      sort?: string
    }
  }>('/api/mdblist/lists/:id/library-match', { preHandler: requireAdmin, schema: getLibraryMatchSchema }, async (request, reply) => {
    try {
      const configured = await isMDBListConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'MDBList is not configured' })
      }

      const listId = parseInt(request.params.id, 10)
      if (isNaN(listId)) {
        return reply.status(400).send({ error: 'Invalid list ID' })
      }

      const { mediatype, sort } = request.query

      // Fetch all list items (with optional sort)
      const items = await getListItems(listId, { limit: 10000, sort: sort || 'score' })

      if (items.length === 0) {
        return reply.send({
          total: 0,
          matched: 0,
          missing: [],
        })
      }

      // Filter by mediatype if specified
      const filteredItems = mediatype
        ? items.filter((item) => item.mediatype === mediatype)
        : items

      // Separate movies and shows
      const movieItems = filteredItems.filter((item) => item.mediatype === 'movie')
      const showItems = filteredItems.filter((item) => item.mediatype === 'show')

      // Get IDs for matching
      const movieTmdbIds = movieItems.filter((i) => i.tmdbid).map((i) => String(i.tmdbid))
      const movieImdbIds = movieItems.filter((i) => i.imdbid).map((i) => i.imdbid!)
      const showTmdbIds = showItems.filter((i) => i.tmdbid).map((i) => String(i.tmdbid))
      const showImdbIds = showItems.filter((i) => i.imdbid).map((i) => i.imdbid!)
      const showTvdbIds = showItems.filter((i) => i.tvdbid).map((i) => String(i.tvdbid))

      // Query local library for matches
      interface MatchRow {
        tmdb_id: string | null
        imdb_id: string | null
        tvdb_id?: string | null
      }

      const matchedMovieTmdbIds = new Set<string>()
      const matchedMovieImdbIds = new Set<string>()
      const matchedShowTmdbIds = new Set<string>()
      const matchedShowImdbIds = new Set<string>()
      const matchedShowTvdbIds = new Set<string>()

      // Match movies
      if (movieTmdbIds.length > 0 || movieImdbIds.length > 0) {
        const movieResult = await query<MatchRow>(
          `SELECT tmdb_id, imdb_id FROM movies
           WHERE tmdb_id = ANY($1) OR imdb_id = ANY($2)`,
          [movieTmdbIds, movieImdbIds]
        )
        for (const row of movieResult.rows) {
          if (row.tmdb_id) matchedMovieTmdbIds.add(row.tmdb_id)
          if (row.imdb_id) matchedMovieImdbIds.add(row.imdb_id)
        }
      }

      // Match shows
      if (showTmdbIds.length > 0 || showImdbIds.length > 0 || showTvdbIds.length > 0) {
        const showResult = await query<MatchRow>(
          `SELECT tmdb_id, imdb_id, tvdb_id FROM series
           WHERE tmdb_id = ANY($1) OR imdb_id = ANY($2) OR tvdb_id = ANY($3)`,
          [showTmdbIds, showImdbIds, showTvdbIds]
        )
        for (const row of showResult.rows) {
          if (row.tmdb_id) matchedShowTmdbIds.add(row.tmdb_id)
          if (row.imdb_id) matchedShowImdbIds.add(row.imdb_id)
          if (row.tvdb_id) matchedShowTvdbIds.add(row.tvdb_id)
        }
      }

      // Determine which items are matched and which are missing
      const matched: typeof filteredItems = []
      const missing: { title: string; year: number | null; tmdbid: number | undefined; imdbid: string | undefined; mediatype: string }[] = []

      for (const item of movieItems) {
        const isMatched =
          (item.tmdbid && matchedMovieTmdbIds.has(String(item.tmdbid))) ||
          (item.imdbid && matchedMovieImdbIds.has(item.imdbid))

        if (isMatched) {
          matched.push(item)
        } else {
          missing.push({
            title: item.title || 'Unknown',
            year: item.year || null,
            tmdbid: item.tmdbid,
            imdbid: item.imdbid,
            mediatype: 'movie',
          })
        }
      }

      for (const item of showItems) {
        const isMatched =
          (item.tmdbid && matchedShowTmdbIds.has(String(item.tmdbid))) ||
          (item.imdbid && matchedShowImdbIds.has(item.imdbid)) ||
          (item.tvdbid && matchedShowTvdbIds.has(String(item.tvdbid)))

        if (isMatched) {
          matched.push(item)
        } else {
          missing.push({
            title: item.title || 'Unknown',
            year: item.year || null,
            tmdbid: item.tmdbid,
            imdbid: item.imdbid,
            mediatype: 'show',
          })
        }
      }

      return reply.send({
        total: filteredItems.length,
        matched: matched.length,
        missing,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get library match')
      return reply.status(500).send({ error: 'Failed to get library match' })
    }
  })

  /**
   * GET /api/mdblist/sort-options
   * Get available sort options for MDBList items
   */
  fastify.get('/api/mdblist/sort-options', { preHandler: requireAdmin, schema: getSortOptionsSchema }, async (_request, reply) => {
    return reply.send({ options: MDBLIST_SORT_OPTIONS })
  })
}

export default mdblistRoutes
