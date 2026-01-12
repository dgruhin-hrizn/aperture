import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../plugins/auth.js'
import {
  getMDBListConfig,
  setMDBListConfig,
  testMDBListConnection,
  isMDBListConfigured,
  getTopLists,
  searchLists,
  getListInfo,
  getListItems,
  type MDBListConfig,
} from '@aperture/core'

const mdblistRoutes: FastifyPluginAsync = async (fastify) => {
  // =========================================================================
  // Configuration Routes (Admin Only)
  // =========================================================================

  /**
   * GET /api/mdblist/config
   * Get MDBList configuration (without exposing the full API key)
   */
  fastify.get('/api/mdblist/config', { preHandler: requireAdmin }, async (_request, reply) => {
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
  }>('/api/mdblist/config', { preHandler: requireAdmin }, async (request, reply) => {
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
  }>('/api/mdblist/test', { preHandler: requireAdmin }, async (request, reply) => {
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
   * Get popular public lists
   */
  fastify.get<{
    Querystring: {
      mediatype?: 'movie' | 'show'
    }
  }>('/api/mdblist/lists/top', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const configured = await isMDBListConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'MDBList is not configured' })
      }

      const { mediatype } = request.query
      const lists = await getTopLists(mediatype)

      return reply.send({ lists })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get top lists')
      return reply.status(500).send({ error: 'Failed to get top lists' })
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
  }>('/api/mdblist/lists/search', { preHandler: requireAdmin }, async (request, reply) => {
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
  }>('/api/mdblist/lists/:id', { preHandler: requireAdmin }, async (request, reply) => {
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
  }>('/api/mdblist/lists/:id/items', { preHandler: requireAdmin }, async (request, reply) => {
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
}

export default mdblistRoutes

