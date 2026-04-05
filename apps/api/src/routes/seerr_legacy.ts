import type { FastifyPluginAsync } from 'fastify'
import { requireAuth, requireAdmin, type SessionUser } from '../plugins/auth.js'
import { queryOne } from '../lib/db.js'
import {
  getSeerrConfig,
  setSeerrConfig,
  isSeerrConfigured,
  testSeerrConnection,
  getSeerrMediaStatus,
  getSeerrTVDetails,
  batchGetSeerrMediaStatus,
  createSeerrRequest,
  getSeerrRequestStatus,
  createDiscoveryRequest,
  updateDiscoveryRequestStatus,
  getDiscoveryRequests,
  countDiscoveryRequests,
  hasExistingRequest,
  type SeerrConfig,
} from '@aperture/core'

type MediaType = 'movie' | 'tv'

const seerrRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/seerr/config
   * Get Seerr configuration (admin only)
   */
  fastify.get(
    '/api/seerr/config',
    { preHandler: requireAdmin, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const config = await getSeerrConfig()
      
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
   * PUT /api/seerr/config
   * Update Seerr configuration (admin only)
   */
  fastify.put<{
    Body: {
      url?: string
      apiKey?: string
      enabled?: boolean
    }
  }>(
    '/api/seerr/config',
    { preHandler: requireAdmin, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const { url, apiKey, enabled } = request.body

      await setSeerrConfig({
        url,
        apiKey,
        enabled,
      })

      return reply.send({
        message: 'Seerr configuration updated',
        configured: !!(url && apiKey),
        enabled: enabled ?? false,
      })
    }
  )

  /**
   * POST /api/seerr/test
   * Test Seerr connection (admin only)
   */
  fastify.post<{
    Body?: {
      url?: string
      apiKey?: string
    }
  }>(
    '/api/seerr/test',
    { preHandler: requireAdmin, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const { url, apiKey } = request.body || {}

      // If credentials provided, test those. Otherwise test saved config
      const testConfig = url && apiKey
        ? { url, apiKey, enabled: true }
        : undefined

      const result = await testSeerrConnection(testConfig)

      return reply.send(result)
    }
  )

  /**
   * GET /api/seerr/status/:mediaType/:tmdbId
   * Get media status from Seerr
   */
  fastify.get<{
    Params: { mediaType: string; tmdbId: string }
  }>(
    '/api/seerr/status/:mediaType/:tmdbId',
    { preHandler: requireAuth, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { mediaType, tmdbId } = request.params

      // Validate media type
      if (mediaType !== 'movie' && mediaType !== 'tv') {
        return reply.status(400).send({ error: 'Invalid media type' })
      }

      // Check if Seerr is configured
      if (!await isSeerrConfigured()) {
        return reply.status(503).send({
          error: 'Seerr not configured',
          message: 'Content requests are not available',
        })
      }

      // Check if user can make requests
      const user = await queryOne<{ discover_request_enabled: boolean }>(
        `SELECT discover_request_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      const canRequest = user?.discover_request_enabled ?? false

      // Get status from Seerr
      const status = await getSeerrMediaStatus(parseInt(tmdbId, 10), mediaType as 'movie' | 'tv')

      if (!status) {
        return reply.send({
          seerrStatus: null,
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
        seerrStatus: status,
        apertureRequest: existingRequest,
        canRequest,
      })
    }
  )

  /**
   * GET /api/seerr/tv/:tmdbId
   * Get TV show details with season information for the season selection modal
   */
  fastify.get<{
    Params: { tmdbId: string }
  }>(
    '/api/seerr/tv/:tmdbId',
    { preHandler: requireAuth, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const { tmdbId } = request.params

      // Check if Seerr is configured
      if (!await isSeerrConfigured()) {
        return reply.status(503).send({
          error: 'Seerr not configured',
          message: 'Content requests are not available',
        })
      }

      // Fetch TV details from Seerr
      const tvDetails = await getSeerrTVDetails(parseInt(tmdbId, 10))

      if (!tvDetails) {
        return reply.status(404).send({
          error: 'TV show not found',
          message: 'Could not fetch TV show details from Seerr',
        })
      }

      return reply.send(tvDetails)
    }
  )

  /**
   * POST /api/seerr/request
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
    '/api/seerr/request',
    { preHandler: requireAuth, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { tmdbId, mediaType, title, discoveryCandidateId, seasons } = request.body

      // Check if Seerr is configured
      if (!await isSeerrConfigured()) {
        return reply.status(503).send({
          error: 'Seerr not configured',
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

      // Submit to Seerr
      const seerrMediaType = mediaType === 'movie' ? 'movie' : 'tv'
      const result = await createSeerrRequest(tmdbId, seerrMediaType, { seasons })

      if (!result.success) {
        // Update Aperture request as failed
        await updateDiscoveryRequestStatus(apertureRequestId, 'failed', {
          statusMessage: result.message,
        })

        return reply.status(500).send({
          error: 'Failed to submit request to Seerr',
          message: result.message,
          apertureRequestId,
        })
      }

      // Update Aperture request with Seerr info
      await updateDiscoveryRequestStatus(apertureRequestId, 'submitted', {
        seerrRequestId: result.requestId,
      })

      return reply.send({
        success: true,
        message: 'Request submitted successfully',
        apertureRequestId,
        seerrRequestId: result.requestId,
      })
    }
  )

  /**
   * GET /api/seerr/requests
   * Get user's content requests
   */
  fastify.get<{
    Querystring: { mediaType?: string; status?: string; limit?: string; offset?: string; source?: string }
  }>(
    '/api/seerr/requests',
    { preHandler: requireAuth, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { mediaType, status, limit, offset, source } = request.query

      const filter = {
        mediaType: mediaType as 'movie' | 'series' | undefined,
        status: status as any,
        source:
          source === 'gap_analysis' || source === 'discovery'
            ? (source as 'discovery' | 'gap_analysis')
            : undefined,
      }

      const pageSizeRaw = limit ? parseInt(limit, 10) : 25
      const pageSize = Number.isFinite(pageSizeRaw)
        ? Math.min(100, Math.max(1, pageSizeRaw))
        : 25
      const offsetRaw = offset ? parseInt(offset, 10) : 0
      const offsetN = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

      const [total, requests] = await Promise.all([
        countDiscoveryRequests(currentUser.id, filter),
        getDiscoveryRequests(currentUser.id, {
          ...filter,
          limit: pageSize,
          offset: offsetN,
        }),
      ])

      return reply.send({ requests, total })
    }
  )

  /**
   * POST /api/seerr/status/batch
   * Check Seerr status for multiple items at once
   */
  fastify.post<{
    Body: {
      items: { tmdbId: number; mediaType: 'movie' | 'series' }[]
    }
  }>(
    '/api/seerr/status/batch',
    { preHandler: requireAuth, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const { items } = request.body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.status(400).send({ error: 'Items array required' })
      }

      // Limit batch size
      if (items.length > 100) {
        return reply.status(400).send({ error: 'Maximum 100 items per batch' })
      }

      // Check if Seerr is configured
      if (!await isSeerrConfigured()) {
        return reply.send({ statuses: {} })
      }

      // Convert to Seerr format
      const seerrItems = items.map(item => ({
        tmdbId: item.tmdbId,
        mediaType: (item.mediaType === 'movie' ? 'movie' : 'tv') as 'movie' | 'tv',
      }))

      const statusMap = await batchGetSeerrMediaStatus(seerrItems)

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
   * GET /api/seerr/request/:requestId/status
   * Get status of a specific request
   */
  fastify.get<{
    Params: { requestId: string }
  }>(
    '/api/seerr/request/:requestId/status',
    { preHandler: requireAuth, schema: { tags: ["seerr"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { requestId } = request.params

      // Get the Aperture request
      const apertureRequest = await queryOne<{
        id: string
        user_id: string
        seerr_request_id: number | null
        status: string
      }>(
        `SELECT id, user_id, seerr_request_id, status 
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

      // If we have a Seerr request ID, get the latest status
      let seerrStatus = null
      if (apertureRequest.seerr_request_id) {
        seerrStatus = await getSeerrRequestStatus(apertureRequest.seerr_request_id)
        
        // Update Aperture status if Seerr status changed
        if (seerrStatus) {
          let newStatus = apertureRequest.status
          if (seerrStatus.status === 'approved' && apertureRequest.status !== 'approved') {
            newStatus = 'approved'
          } else if (seerrStatus.status === 'declined' && apertureRequest.status !== 'declined') {
            newStatus = 'declined'
          } else if (seerrStatus.mediaStatus === 'available' && apertureRequest.status !== 'available') {
            newStatus = 'available'
          }
          
          if (newStatus !== apertureRequest.status) {
            await updateDiscoveryRequestStatus(requestId, newStatus as any)
          }
        }
      }

      return reply.send({
        apertureStatus: apertureRequest.status,
        seerrStatus,
      })
    }
  )
}

export default seerrRoutes

