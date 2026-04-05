import type { FastifyPluginAsync } from 'fastify'
import { requireAuth, requireAdmin, type SessionUser } from '../../plugins/auth.js'
import { query, queryOne } from '../../lib/db.js'
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
  hasExistingRequest,
  getSystemSetting,
  resolveSeerrUserIdForProfile,
  listRadarrServers,
  getRadarrServerDetails,
  listSonarrServers,
  getSonarrServerDetails,
} from '@aperture/core'
import {
  seerrSchemas,
  getSeerrConfigSchema,
  updateSeerrConfigSchema,
  testSeerrSchema,
  getMediaStatusSchema,
  getTVDetailsSchema,
  createRequestSchema,
  getRequestsSchema,
  batchStatusSchema,
  getRequestStatusSchema,
  listRadarrServiceSchema,
  getRadarrServiceSchema,
  listSonarrServiceSchema,
  getSonarrServiceSchema,
} from './schemas.js'

async function ensureSeerrUserIdForRequest(userId: string): Promise<number | null> {
  const row = await queryOne<{
    seerr_user_id: number | null
    email: string | null
    username: string
    display_name: string | null
    provider: 'emby' | 'jellyfin'
    provider_user_id: string
  }>(
    `SELECT seerr_user_id, email, username, display_name, provider, provider_user_id
     FROM users WHERE id = $1`,
    [userId]
  )
  if (!row) return null
  if (row.seerr_user_id != null) return row.seerr_user_id

  const resolved = await resolveSeerrUserIdForProfile({
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    provider: row.provider,
    providerUserId: row.provider_user_id,
  })
  if (resolved != null) {
    await query(`UPDATE users SET seerr_user_id = $1, updated_at = NOW() WHERE id = $2`, [
      resolved,
      userId,
    ])
  }
  return resolved
}

const seerrRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(seerrSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * GET /api/seerr/config
   * Get Seerr configuration (admin only)
   */
  fastify.get(
    '/api/seerr/config',
    { preHandler: requireAdmin, schema: getSeerrConfigSchema },
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
    { preHandler: requireAdmin, schema: updateSeerrConfigSchema },
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
    { preHandler: requireAdmin, schema: testSeerrSchema },
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
    { preHandler: requireAuth, schema: getMediaStatusSchema },
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
    { preHandler: requireAuth, schema: getTVDetailsSchema },
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

  async function ensureUserCanRequestSeerr(userId: string): Promise<
    | { ok: true }
    | { ok: false; reply: { status: number; body: Record<string, string> } }
  > {
    if (!(await isSeerrConfigured())) {
      return {
        ok: false,
        reply: {
          status: 503,
          body: { error: 'Seerr not configured', message: 'Content requests are not available' },
        },
      }
    }
    const user = await queryOne<{ discover_request_enabled: boolean }>(
      `SELECT discover_request_enabled FROM users WHERE id = $1`,
      [userId]
    )
    if (!user?.discover_request_enabled) {
      return {
        ok: false,
        reply: {
          status: 403,
          body: {
            error: 'Content requests not enabled for your account',
            message: 'Contact your admin to enable content requests',
          },
        },
      }
    }
    return { ok: true }
  }

  /**
   * GET /api/seerr/service/radarr
   * List Radarr servers (for movie request options)
   */
  fastify.get('/api/seerr/service/radarr', { preHandler: requireAuth, schema: listRadarrServiceSchema }, async (request, reply) => {
    const currentUser = request.user as SessionUser
    const gate = await ensureUserCanRequestSeerr(currentUser.id)
    if (!gate.ok) return reply.status(gate.reply.status).send(gate.reply.body)
    const data = await listRadarrServers()
    if (!data) {
      return reply.status(502).send({ error: 'Failed to load Radarr servers from Seerr' })
    }
    return reply.send(data)
  })

  /**
   * GET /api/seerr/service/radarr/:id
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/seerr/service/radarr/:id',
    { preHandler: requireAuth, schema: getRadarrServiceSchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const gate = await ensureUserCanRequestSeerr(currentUser.id)
      if (!gate.ok) return reply.status(gate.reply.status).send(gate.reply.body)
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) {
        return reply.status(400).send({ error: 'Invalid id' })
      }
      const data = await getRadarrServerDetails(id)
      if (!data) {
        return reply.status(404).send({ error: 'Radarr server not found or Seerr error' })
      }
      return reply.send(data)
    }
  )

  /**
   * GET /api/seerr/service/sonarr
   */
  fastify.get('/api/seerr/service/sonarr', { preHandler: requireAuth, schema: listSonarrServiceSchema }, async (request, reply) => {
    const currentUser = request.user as SessionUser
    const gate = await ensureUserCanRequestSeerr(currentUser.id)
    if (!gate.ok) return reply.status(gate.reply.status).send(gate.reply.body)
    const data = await listSonarrServers()
    if (!data) {
      return reply.status(502).send({ error: 'Failed to load Sonarr servers from Seerr' })
    }
    return reply.send(data)
  })

  /**
   * GET /api/seerr/service/sonarr/:id
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/seerr/service/sonarr/:id',
    { preHandler: requireAuth, schema: getSonarrServiceSchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const gate = await ensureUserCanRequestSeerr(currentUser.id)
      if (!gate.ok) return reply.status(gate.reply.status).send(gate.reply.body)
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) {
        return reply.status(400).send({ error: 'Invalid id' })
      }
      const data = await getSonarrServerDetails(id)
      if (!data) {
        return reply.status(404).send({ error: 'Sonarr server not found or Seerr error' })
      }
      return reply.send(data)
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
      seasons?: number[]
      rootFolder?: string
      profileId?: number
      serverId?: number
      languageProfileId?: number
      is4k?: boolean
    }
  }>(
    '/api/seerr/request',
    { preHandler: requireAuth, schema: createRequestSchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const {
        tmdbId,
        mediaType,
        title,
        discoveryCandidateId,
        seasons,
        rootFolder,
        profileId,
        serverId,
        languageProfileId,
        is4k,
      } = request.body

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

      const requireMapping =
        (await getSystemSetting('seerr_require_user_mapping')) === 'true'
      const seerrUserId = await ensureSeerrUserIdForRequest(currentUser.id)
      if (requireMapping && seerrUserId == null) {
        return reply.status(422).send({
          error: 'Seerr account not linked',
          message:
            'Your Aperture account could not be matched to a Seerr user. Match your email or username in Seerr to your media server account, or ask an admin to set seerrUserId on your user.',
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
      const result = await createSeerrRequest(tmdbId, seerrMediaType, {
        seasons,
        ...(seerrUserId != null ? { userId: seerrUserId } : {}),
        ...(rootFolder !== undefined ? { rootFolder } : {}),
        ...(profileId !== undefined ? { profileId } : {}),
        ...(serverId !== undefined ? { serverId } : {}),
        ...(languageProfileId !== undefined ? { languageProfileId } : {}),
        ...(is4k !== undefined ? { is4k } : {}),
      })

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
    Querystring: { mediaType?: string; status?: string; limit?: string; source?: string }
  }>(
    '/api/seerr/requests',
    { preHandler: requireAuth, schema: getRequestsSchema },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { mediaType, status, limit, source } = request.query

      const requests = await getDiscoveryRequests(currentUser.id, {
        mediaType: mediaType as 'movie' | 'series' | undefined,
        status: status as any,
        source:
          source === 'gap_analysis' || source === 'discovery'
            ? source
            : undefined,
        limit: limit ? parseInt(limit, 10) : 50,
      })

      if (!(await isSeerrConfigured())) {
        return reply.send({
          requests: requests.map((r) => ({
            ...r,
            seerrLive: null,
          })),
        })
      }

      const enriched = await Promise.all(
        requests.map(async (r) => {
          if (!r.seerrRequestId) {
            return { ...r, seerrLive: null }
          }
          const seerrLive = await getSeerrRequestStatus(r.seerrRequestId)
          return { ...r, seerrLive }
        })
      )

      return reply.send({ requests: enriched })
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
    { preHandler: requireAuth, schema: batchStatusSchema },
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
    { preHandler: requireAuth, schema: getRequestStatusSchema },
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
