import type { FastifyPluginAsync } from 'fastify'
import { requireAuth, requireAdmin, type SessionUser } from '../plugins/auth.js'
import { queryOne } from '../lib/db.js'
import {
  getJellyseerrConfig,
  setJellyseerrConfig,
  isJellyseerrConfigured,
  testJellyseerrConnection,
  getJellyseerrMediaStatus,
  getJellyseerrTVDetails,
  batchGetJellyseerrMediaStatus,
  createJellyseerrRequest,
  getJellyseerrRequestStatus,
  createDiscoveryRequest,
  updateDiscoveryRequestStatus,
  getDiscoveryRequests,
  hasExistingRequest,
  type JellyseerrConfig,
} from '@aperture/core'

type MediaType = 'movie' | 'tv'

const jellyseerrRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/jellyseerr/config
   * Get Jellyseerr configuration (admin only)
   */
  fastify.get(
    '/api/jellyseerr/config',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const config = await getJellyseerrConfig()
      
      return reply.send({
        configured: config !== null,
        enabled: config?.enabled ?? false,
        url: config?.url ?? '',
        // Don't expose the full API key
        hasApiKey: !!config?.apiKey,
      })
    }
  )

  /**
   * PUT /api/jellyseerr/config
   * Update Jellyseerr configuration (admin only)
   */
  fastify.put<{
    Body: {
      url?: string
      apiKey?: string
      enabled?: boolean
    }
  }>(
    '/api/jellyseerr/config',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { url, apiKey, enabled } = request.body

      await setJellyseerrConfig({
        url,
        apiKey,
        enabled,
      })

      return reply.send({
        message: 'Jellyseerr configuration updated',
        configured: !!(url && apiKey),
        enabled: enabled ?? false,
      })
    }
  )

  /**
   * POST /api/jellyseerr/test
   * Test Jellyseerr connection (admin only)
   */
  fastify.post<{
    Body?: {
      url?: string
      apiKey?: string
    }
  }>(
    '/api/jellyseerr/test',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { url, apiKey } = request.body || {}

      // If credentials provided, test those. Otherwise test saved config
      const testConfig = url && apiKey
        ? { url, apiKey, enabled: true }
        : undefined

      const result = await testJellyseerrConnection(testConfig)

      return reply.send(result)
    }
  )

  /**
   * GET /api/jellyseerr/status/:mediaType/:tmdbId
   * Get media status from Jellyseerr
   */
  fastify.get<{
    Params: { mediaType: string; tmdbId: string }
  }>(
    '/api/jellyseerr/status/:mediaType/:tmdbId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { mediaType, tmdbId } = request.params

      // Validate media type
      if (mediaType !== 'movie' && mediaType !== 'tv') {
        return reply.status(400).send({ error: 'Invalid media type' })
      }

      // Check if Jellyseerr is configured
      if (!await isJellyseerrConfigured()) {
        return reply.status(503).send({
          error: 'Jellyseerr not configured',
          message: 'Content requests are not available',
        })
      }

      // Check if user can make requests
      const user = await queryOne<{ discover_request_enabled: boolean }>(
        `SELECT discover_request_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      const canRequest = user?.discover_request_enabled ?? false

      // Get status from Jellyseerr
      const status = await getJellyseerrMediaStatus(parseInt(tmdbId, 10), mediaType as 'movie' | 'tv')

      if (!status) {
        return reply.send({
          jellyseerrStatus: null,
          canRequest,
        })
      }

      // Check for existing Aperture request
      const existingRequest = await hasExistingRequest(
        currentUser.id,
        parseInt(tmdbId, 10),
        mediaType === 'movie' ? 'movie' : 'series'
      )

      return reply.send({
        jellyseerrStatus: status,
        apertureRequest: existingRequest,
        canRequest,
      })
    }
  )

  /**
   * GET /api/jellyseerr/tv/:tmdbId
   * Get TV show details with season information for the season selection modal
   */
  fastify.get<{
    Params: { tmdbId: string }
  }>(
    '/api/jellyseerr/tv/:tmdbId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { tmdbId } = request.params

      // Check if Jellyseerr is configured
      if (!await isJellyseerrConfigured()) {
        return reply.status(503).send({
          error: 'Jellyseerr not configured',
          message: 'Content requests are not available',
        })
      }

      // Fetch TV details from Jellyseerr
      const tvDetails = await getJellyseerrTVDetails(parseInt(tmdbId, 10))

      if (!tvDetails) {
        return reply.status(404).send({
          error: 'TV show not found',
          message: 'Could not fetch TV show details from Jellyseerr',
        })
      }

      return reply.send(tvDetails)
    }
  )

  /**
   * POST /api/jellyseerr/request
   * Create a content request
   */
  fastify.post<{
    Body: {
      tmdbId: number
      mediaType: 'movie' | 'series'
      title: string
      discoveryCandidateId?: string
      seasons?: number[] // For series
    }
  }>(
    '/api/jellyseerr/request',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { tmdbId, mediaType, title, discoveryCandidateId, seasons } = request.body

      // Check if Jellyseerr is configured
      if (!await isJellyseerrConfigured()) {
        return reply.status(503).send({
          error: 'Jellyseerr not configured',
          message: 'Content requests are not available',
        })
      }

      // Check if user can make requests
      const user = await queryOne<{ discover_request_enabled: boolean }>(
        `SELECT discover_request_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_request_enabled) {
        return reply.status(403).send({
          error: 'Content requests not enabled for your account',
          message: 'Contact your admin to enable content requests',
        })
      }

      // Check for existing request
      const existingRequest = await hasExistingRequest(currentUser.id, tmdbId, mediaType)
      if (existingRequest && ['pending', 'submitted', 'approved'].includes(existingRequest.status)) {
        return reply.status(409).send({
          error: 'Request already exists',
          request: existingRequest,
        })
      }

      // Create Aperture request record
      const apertureRequestId = await createDiscoveryRequest(
        currentUser.id,
        mediaType,
        tmdbId,
        title,
        discoveryCandidateId
      )

      // Submit to Jellyseerr
      const jellyseerrMediaType = mediaType === 'movie' ? 'movie' : 'tv'
      const result = await createJellyseerrRequest(tmdbId, jellyseerrMediaType, { seasons })

      if (!result.success) {
        // Update Aperture request as failed
        await updateDiscoveryRequestStatus(apertureRequestId, 'failed', {
          statusMessage: result.message,
        })

        return reply.status(500).send({
          error: 'Failed to submit request to Jellyseerr',
          message: result.message,
          apertureRequestId,
        })
      }

      // Update Aperture request with Jellyseerr info
      await updateDiscoveryRequestStatus(apertureRequestId, 'submitted', {
        jellyseerrRequestId: result.requestId,
      })

      return reply.send({
        success: true,
        message: 'Request submitted successfully',
        apertureRequestId,
        jellyseerrRequestId: result.requestId,
      })
    }
  )

  /**
   * GET /api/jellyseerr/requests
   * Get user's content requests
   */
  fastify.get<{
    Querystring: { mediaType?: string; status?: string; limit?: string }
  }>(
    '/api/jellyseerr/requests',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { mediaType, status, limit } = request.query

      const requests = await getDiscoveryRequests(currentUser.id, {
        mediaType: mediaType as 'movie' | 'series' | undefined,
        status: status as any,
        limit: limit ? parseInt(limit, 10) : 50,
      })

      return reply.send({ requests })
    }
  )

  /**
   * POST /api/jellyseerr/status/batch
   * Check Jellyseerr status for multiple items at once
   */
  fastify.post<{
    Body: {
      items: { tmdbId: number; mediaType: 'movie' | 'series' }[]
    }
  }>(
    '/api/jellyseerr/status/batch',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { items } = request.body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.status(400).send({ error: 'Items array required' })
      }

      // Limit batch size
      if (items.length > 100) {
        return reply.status(400).send({ error: 'Maximum 100 items per batch' })
      }

      // Check if Jellyseerr is configured
      if (!await isJellyseerrConfigured()) {
        return reply.send({ statuses: {} })
      }

      // Convert to Jellyseerr format
      const jellyseerrItems = items.map(item => ({
        tmdbId: item.tmdbId,
        mediaType: (item.mediaType === 'movie' ? 'movie' : 'tv') as 'movie' | 'tv',
      }))

      const statusMap = await batchGetJellyseerrMediaStatus(jellyseerrItems)

      // Convert Map to object for JSON response
      const statuses: Record<number, {
        exists: boolean
        status: string
        requested: boolean
        requestStatus?: string
      }> = {}

      for (const [tmdbId, status] of statusMap) {
        statuses[tmdbId] = status
      }

      return reply.send({ statuses })
    }
  )

  /**
   * GET /api/jellyseerr/request/:requestId/status
   * Get status of a specific request
   */
  fastify.get<{
    Params: { requestId: string }
  }>(
    '/api/jellyseerr/request/:requestId/status',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { requestId } = request.params

      // Get the Aperture request
      const apertureRequest = await queryOne<{
        id: string
        user_id: string
        jellyseerr_request_id: number | null
        status: string
      }>(
        `SELECT id, user_id, jellyseerr_request_id, status 
         FROM discovery_requests 
         WHERE id = $1`,
        [requestId]
      )

      if (!apertureRequest) {
        return reply.status(404).send({ error: 'Request not found' })
      }

      // Check ownership
      if (apertureRequest.user_id !== currentUser.id && !(request.user as SessionUser).isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // If we have a Jellyseerr request ID, get the latest status
      let jellyseerrStatus = null
      if (apertureRequest.jellyseerr_request_id) {
        jellyseerrStatus = await getJellyseerrRequestStatus(apertureRequest.jellyseerr_request_id)
        
        // Update Aperture status if Jellyseerr status changed
        if (jellyseerrStatus) {
          let newStatus = apertureRequest.status
          if (jellyseerrStatus.status === 'approved' && apertureRequest.status !== 'approved') {
            newStatus = 'approved'
          } else if (jellyseerrStatus.status === 'declined' && apertureRequest.status !== 'declined') {
            newStatus = 'declined'
          } else if (jellyseerrStatus.mediaStatus === 'available' && apertureRequest.status !== 'available') {
            newStatus = 'available'
          }
          
          if (newStatus !== apertureRequest.status) {
            await updateDiscoveryRequestStatus(requestId, newStatus as any)
          }
        }
      }

      return reply.send({
        apertureStatus: apertureRequest.status,
        jellyseerrStatus,
      })
    }
  )
}

export default jellyseerrRoutes

