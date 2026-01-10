/**
 * Setup Routes
 * 
 * Public endpoints for first-run setup wizard.
 * These endpoints only work when the system is not yet configured.
 */

import type { FastifyPluginAsync } from 'fastify'
import dgram from 'dgram'
import {
  // Setup progress
  getSetupProgress,
  setSetupCurrentStep,
  markSetupStepCompleted,
  resetSetupProgress,
  isSetupComplete,
  markSetupComplete,
  type SetupStepId,

  getMediaServerConfig,
  setMediaServerConfig,
  testMediaServerConnection,
  getMediaServerTypes,
  getMediaServerProvider,
  getMediaServerApiKey,

  // Library config
  getLibraryConfigs,
  syncLibraryConfigsFromProvider,
  setLibraryEnabled,

  // AI output config + library images
  getAiRecsOutputConfig,
  setAiRecsOutputConfig,
  initUploads,
  uploadImage,
  type LibraryType,

  // Top Picks
  getTopPicksConfig,
  updateTopPicksConfig,

  hasOpenAIApiKey,
  getOpenAIApiKey,
  setOpenAIApiKey,
  testOpenAIConnection,
  type MediaServerType,
} from '@aperture/core'
import { requireAdmin } from '../plugins/auth.js'
import { query, queryOne } from '../lib/db.js'

interface DiscoveredServer {
  id: string
  name: string
  address: string
  type: 'emby' | 'jellyfin'
}

interface SetupStatusResponse {
  needsSetup: boolean
  configured: {
    mediaServer: boolean
    openai: boolean
  }
}

interface MediaServerBody {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}

interface OpenAIBody {
  apiKey: string
}

interface TestMediaServerBody {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}

function isAdminRequest(request: unknown): boolean {
  return !!(request as { user?: { isAdmin?: boolean } }).user?.isAdmin
}

/**
 * Guard that ensures setup endpoints only work during initial setup,
 * unless the requester is an authenticated admin (admin rerun).
 *
 * For non-admin callers after completion, we intentionally respond as 404
 * to avoid revealing setup endpoints.
 */
async function requireSetupWritable(request: unknown): Promise<{ complete: boolean; isAdmin: boolean }> {
  const complete = await isSetupComplete()
  const isAdmin = isAdminRequest(request)
  return { complete, isAdmin }
}

const setupRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/setup/status
   * Check if setup is needed (public endpoint)
   */
  fastify.get<{ Reply: SetupStatusResponse }>(
    '/api/setup/status',
    async (_request, reply) => {
      const setupComplete = await isSetupComplete()
      const mediaServerConfig = await getMediaServerConfig()
      const hasOpenAI = await hasOpenAIApiKey()

      return reply.send({
        needsSetup: !setupComplete,
        configured: {
          mediaServer: mediaServerConfig.isConfigured,
          openai: hasOpenAI,
        },
      })
    }
  )

  /**
   * GET /api/setup/progress
   * Public (first-run only): Return resumable wizard progress + current config snapshot
   */
  fastify.get('/api/setup/progress', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) {
      return reply.status(404).send({ error: 'Not Found' })
    }

    const progress = await getSetupProgress()

    // Snapshot (safe for first-run; excludes user list)
    const mediaServerConfig = await getMediaServerConfig()
    const hasOpenAI = await hasOpenAIApiKey()
    // Exclude Aperture-created libraries from selection
    const libraries = await getLibraryConfigs(true)
    const aiRecsOutput = await getAiRecsOutputConfig()
    const topPicks = await getTopPicksConfig()

    return reply.send({
      progress,
      snapshot: {
        mediaServer: mediaServerConfig,
        openai: { configured: hasOpenAI },
        libraries,
        aiRecsOutput,
        topPicks,
      },
    })
  })

  interface SetupProgressBody {
    currentStep?: SetupStepId | null
    completedStep?: SetupStepId
    reset?: boolean
  }

  /**
   * POST /api/setup/progress
   * Public (first-run only): Update wizard progress (resume support)
   */
  fastify.post<{ Body: SetupProgressBody }>('/api/setup/progress', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) {
      return reply.status(404).send({ error: 'Not Found' })
    }

    const { currentStep, completedStep, reset } = request.body || {}

    // During first-run we allow reset; for admin rerun prefer /api/admin/setup/progress below.
    if (reset) {
      await resetSetupProgress()
      return reply.send({ success: true })
    }

    if (currentStep !== undefined) {
      await setSetupCurrentStep(currentStep ?? null)
    }
    if (completedStep) {
      await markSetupStepCompleted(completedStep)
    }

    return reply.send({ success: true })
  })

  /**
   * GET /api/setup/media-server-types
   * Get available media server types (public during setup)
   */
  fastify.get('/api/setup/media-server-types', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
    const types = getMediaServerTypes()
    return reply.send({ types })
  })

  /**
   * GET /api/setup/discover-servers
   * Discover Emby/Jellyfin servers on the local network via UDP broadcast.
   * Sends "Who is EmbyServer?" and "Who is JellyfinServer?" to port 7359.
   */
  fastify.get('/api/setup/discover-servers', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

    const DISCOVERY_PORT = 7359
    const DISCOVERY_TIMEOUT = 3000 // 3 seconds

    const discoveredServers: DiscoveredServer[] = []
    const seenIds = new Set<string>()

    const discoverType = (message: string, serverType: 'emby' | 'jellyfin'): Promise<void> => {
      return new Promise((resolve) => {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

        const cleanup = () => {
          try {
            socket.close()
          } catch {
            // Ignore close errors
          }
        }

        socket.on('error', (err) => {
          fastify.log.debug({ err, serverType }, 'Discovery socket error')
          cleanup()
          resolve()
        })

        socket.on('message', (msg) => {
          try {
            const response = JSON.parse(msg.toString())
            // Emby/Jellyfin respond with: { Id, Name, Address, ... }
            if (response.Id && response.Address && !seenIds.has(response.Id)) {
              seenIds.add(response.Id)
              discoveredServers.push({
                id: response.Id,
                name: response.Name || `${serverType} Server`,
                address: response.Address,
                type: serverType,
              })
            }
          } catch {
            // Ignore non-JSON responses
          }
        })

        socket.bind(() => {
          try {
            socket.setBroadcast(true)
            const buffer = Buffer.from(message)
            socket.send(buffer, 0, buffer.length, DISCOVERY_PORT, '255.255.255.255', (err) => {
              if (err) {
                fastify.log.debug({ err, serverType }, 'Discovery send error')
              }
            })
          } catch (err) {
            fastify.log.debug({ err, serverType }, 'Discovery broadcast setup error')
          }
        })

        // Wait for responses then cleanup
        setTimeout(() => {
          cleanup()
          resolve()
        }, DISCOVERY_TIMEOUT)
      })
    }

    try {
      // Run both discoveries in parallel
      await Promise.all([
        discoverType('Who is EmbyServer?', 'emby'),
        discoverType('Who is JellyfinServer?', 'jellyfin'),
      ])

      return reply.send({ servers: discoveredServers })
    } catch (err) {
      fastify.log.error({ err }, 'Server discovery failed')
      return reply.send({ servers: [], error: 'Discovery failed' })
    }
  })

  /**
   * POST /api/setup/media-server/test
   * Test media server connection (public during setup)
   */
  fastify.post<{ Body: TestMediaServerBody }>(
    '/api/setup/media-server/test',
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      const { type, baseUrl, apiKey } = request.body

      if (!type || !baseUrl || !apiKey) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Type, base URL, and API key are required' 
        })
      }

      const result = await testMediaServerConnection({ type, baseUrl, apiKey })
      return reply.send(result)
    }
  )

  /**
   * POST /api/setup/media-server
   * Save media server configuration (only during setup)
   */
  fastify.post<{ Body: MediaServerBody }>(
    '/api/setup/media-server',
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const { type, baseUrl, apiKey } = request.body

      if (!type || !baseUrl || !apiKey) {
        return reply.status(400).send({ 
          error: 'Type, base URL, and API key are required' 
        })
      }

      // Test connection first
      const testResult = await testMediaServerConnection({ type, baseUrl, apiKey })
      if (!testResult.success) {
        return reply.status(400).send({ 
          error: `Connection failed: ${testResult.error}` 
        })
      }

      // Save configuration
      await setMediaServerConfig({ type, baseUrl, apiKey })

      return reply.send({ 
        success: true, 
        serverName: testResult.serverName 
      })
    }
  )

  /**
   * GET /api/setup/libraries
   * Fetch libraries from media server and sync into local library_config table
   */
  fastify.get('/api/setup/libraries', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

    const msConfig = await getMediaServerConfig()
    if (!msConfig.isConfigured || !msConfig.apiKey) {
      return reply.status(400).send({ error: 'Media server must be configured first' })
    }

    const provider = await getMediaServerProvider()
    const apiKey = await getMediaServerApiKey()
    if (!apiKey) return reply.status(400).send({ error: 'Media server API key missing' })

    const libs = await provider.getLibraries(apiKey)
    await syncLibraryConfigsFromProvider(
      libs.map((l) => ({ id: l.id, name: l.name, collectionType: l.collectionType }))
    )

    // Exclude Aperture-created libraries from selection
    const configs = await getLibraryConfigs(true)
    return reply.send({ libraries: configs })
  })

  interface SetLibrariesBody {
    libraries: Array<{ providerLibraryId: string; isEnabled: boolean }>
  }

  /**
   * POST /api/setup/libraries
   * Enable/disable libraries in local config (used to scope initial sync/jobs)
   */
  fastify.post<{ Body: SetLibrariesBody }>('/api/setup/libraries', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

    const body = request.body
    if (!body?.libraries || !Array.isArray(body.libraries)) {
      return reply.status(400).send({ error: 'libraries array is required' })
    }

    const results = []
    for (const lib of body.libraries) {
      const updated = await setLibraryEnabled(lib.providerLibraryId, lib.isEnabled)
      results.push(updated)
    }

    // Exclude Aperture-created libraries from response
    return reply.send({ success: true, libraries: await getLibraryConfigs(true) })
  })

  /**
   * GET /api/setup/ai-recs-output
   */
  fastify.get('/api/setup/ai-recs-output', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
    return reply.send(await getAiRecsOutputConfig())
  })

  /**
   * POST /api/setup/ai-recs-output
   */
  fastify.post<{ Body: Partial<Awaited<ReturnType<typeof getAiRecsOutputConfig>>> }>(
    '/api/setup/ai-recs-output',
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      const updated = await setAiRecsOutputConfig(request.body ?? {})
      return reply.send(updated)
    }
  )

  interface LibraryImageBody {
    dataBase64: string
    mimeType: string
    filename?: string
  }

  /**
   * POST /api/setup/library-image/:libraryType
   * Upload a global library banner image (16:9) for AI recs / Top Picks libraries.
   *
   * libraryType: ai-recs-movies | ai-recs-series | top-picks-movies | top-picks-series
   */
  fastify.post<{ Params: { libraryType: LibraryType }; Body: LibraryImageBody }>(
    '/api/setup/library-image/:libraryType',
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const { libraryType } = request.params
      const { dataBase64, mimeType, filename } = request.body || ({} as LibraryImageBody)

      if (!dataBase64 || !mimeType) {
        return reply.status(400).send({ error: 'dataBase64 and mimeType are required' })
      }

      const buffer = Buffer.from(dataBase64, 'base64')
      await initUploads()
      const image = await uploadImage({
        entityType: 'library',
        entityId: libraryType,
        imageType: 'Primary',
        buffer,
        originalFilename: filename || `${libraryType}.jpg`,
        mimeType,
        isDefault: true,
      })

      return reply.send({ success: true, image })
    }
  )

  /**
   * GET /api/setup/top-picks-config
   */
  fastify.get('/api/setup/top-picks-config', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
    return reply.send(await getTopPicksConfig())
  })

  /**
   * POST /api/setup/top-picks-config
   */
  fastify.post<{ Body: Record<string, unknown> }>('/api/setup/top-picks-config', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
    const updated = await updateTopPicksConfig(request.body as never)
    return reply.send(updated)
  })

  // ==========================================================================
  // Setup Users Endpoints (STRICTLY first-run only - returns 403 after setup)
  // ==========================================================================

  /**
   * GET /api/setup/users
   * Fetch users from media server using saved API key.
   * ONLY available during first-run setup - returns 403 after setup is complete.
   */
  fastify.get('/api/setup/users', async (_request, reply) => {
    const complete = await isSetupComplete()
    if (complete) {
      return reply.status(403).send({
        error: 'Setup is complete. Manage users in Admin → Users.',
      })
    }

    const apiKey = await getMediaServerApiKey()
    if (!apiKey) {
      return reply.status(400).send({ error: 'Media server must be configured first' })
    }

    try {
      const provider = await getMediaServerProvider()
      const providerUsers = await provider.getUsers(apiKey)

      // Get existing users from DB to check import status
      const existingResult = await query<{
        provider_user_id: string
        id: string
        is_enabled: boolean
        movies_enabled: boolean
        series_enabled: boolean
      }>(
        `SELECT provider_user_id, id, is_enabled, movies_enabled, series_enabled 
         FROM users WHERE provider = $1`,
        [provider.type]
      )
      const existingMap = new Map(
        existingResult.rows.map((row) => [
          row.provider_user_id,
          {
            id: row.id,
            isEnabled: row.is_enabled,
            moviesEnabled: row.movies_enabled,
            seriesEnabled: row.series_enabled,
          },
        ])
      )

      // Combine provider users with import status
      const usersWithStatus = providerUsers.map((user) => {
        const existing = existingMap.get(user.id)
        return {
          providerUserId: user.id,
          name: user.name,
          isAdmin: user.isAdmin,
          isDisabled: user.isDisabled,
          lastActivityDate: user.lastActivityDate,
          // Aperture status
          apertureUserId: existing?.id || null,
          isImported: !!existing,
          isEnabled: existing?.isEnabled || false,
          moviesEnabled: existing?.moviesEnabled || false,
          seriesEnabled: existing?.seriesEnabled || false,
        }
      })

      return reply.send({
        provider: provider.type,
        users: usersWithStatus,
      })
    } catch (error) {
      fastify.log.error({ error }, 'Failed to fetch provider users during setup')
      return reply.status(500).send({ error: 'Failed to fetch users from media server' })
    }
  })

  interface SetupUserImportBody {
    providerUserId: string
    moviesEnabled?: boolean
    seriesEnabled?: boolean
  }

  /**
   * POST /api/setup/users/import
   * Import a user from media server into Aperture DB.
   * ONLY available during first-run setup.
   */
  fastify.post<{ Body: SetupUserImportBody }>('/api/setup/users/import', async (request, reply) => {
    const complete = await isSetupComplete()
    if (complete) {
      return reply.status(403).send({
        error: 'Setup is complete. Manage users in Admin → Users.',
      })
    }

    const { providerUserId, moviesEnabled = false, seriesEnabled = false } = request.body || {}

    if (!providerUserId) {
      return reply.status(400).send({ error: 'providerUserId is required' })
    }

    const apiKey = await getMediaServerApiKey()
    if (!apiKey) {
      return reply.status(400).send({ error: 'Media server must be configured first' })
    }

    try {
      const provider = await getMediaServerProvider()

      // Check if user already exists
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM users WHERE provider = $1 AND provider_user_id = $2`,
        [provider.type, providerUserId]
      )

      if (existing) {
        // User already imported - just update their enabled status
        const updated = await queryOne<{
          id: string
          username: string
          is_enabled: boolean
          movies_enabled: boolean
          series_enabled: boolean
        }>(
          `UPDATE users 
           SET movies_enabled = $1, series_enabled = $2, is_enabled = $3, updated_at = NOW()
           WHERE id = $4
           RETURNING id, username, is_enabled, movies_enabled, series_enabled`,
          [moviesEnabled, seriesEnabled, moviesEnabled || seriesEnabled, existing.id]
        )
        return reply.send({ user: updated, alreadyImported: true })
      }

      // Get user info from provider
      const providerUser = await provider.getUserById(apiKey, providerUserId)

      // Insert user into database
      const newUser = await queryOne<{
        id: string
        username: string
        is_admin: boolean
        is_enabled: boolean
        movies_enabled: boolean
        series_enabled: boolean
      }>(
        `INSERT INTO users (username, display_name, provider, provider_user_id, is_admin, is_enabled, movies_enabled, series_enabled, max_parental_rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, username, is_admin, is_enabled, movies_enabled, series_enabled`,
        [
          providerUser.name,
          providerUser.name,
          provider.type,
          providerUserId,
          providerUser.isAdmin,
          moviesEnabled || seriesEnabled,
          moviesEnabled,
          seriesEnabled,
          providerUser.maxParentalRating ?? null,
        ]
      )

      fastify.log.info({ userId: newUser?.id, providerUserId, name: providerUser.name }, 'User imported during setup')

      return reply.status(201).send({ user: newUser })
    } catch (error) {
      fastify.log.error({ error, providerUserId }, 'Failed to import user during setup')
      return reply.status(500).send({ error: 'Failed to import user from media server' })
    }
  })

  interface SetupUserEnableBody {
    apertureUserId: string
    moviesEnabled?: boolean
    seriesEnabled?: boolean
  }

  /**
   * POST /api/setup/users/enable
   * Update movies/series enabled status for an imported user.
   * ONLY available during first-run setup.
   */
  fastify.post<{ Body: SetupUserEnableBody }>('/api/setup/users/enable', async (request, reply) => {
    const complete = await isSetupComplete()
    if (complete) {
      return reply.status(403).send({
        error: 'Setup is complete. Manage users in Admin → Users.',
      })
    }

    const { apertureUserId, moviesEnabled, seriesEnabled } = request.body || {}

    if (!apertureUserId) {
      return reply.status(400).send({ error: 'apertureUserId is required' })
    }

    try {
      // Build update query dynamically based on provided fields
      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (moviesEnabled !== undefined) {
        updates.push(`movies_enabled = $${paramIndex++}`)
        values.push(moviesEnabled)
      }
      if (seriesEnabled !== undefined) {
        updates.push(`series_enabled = $${paramIndex++}`)
        values.push(seriesEnabled)
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'At least one of moviesEnabled or seriesEnabled is required' })
      }

      // Compute is_enabled based on final values
      updates.push(`is_enabled = COALESCE($${paramIndex++}, movies_enabled) OR COALESCE($${paramIndex++}, series_enabled)`)
      values.push(moviesEnabled ?? null, seriesEnabled ?? null)

      updates.push('updated_at = NOW()')
      values.push(apertureUserId)

      const updated = await queryOne<{
        id: string
        username: string
        is_enabled: boolean
        movies_enabled: boolean
        series_enabled: boolean
      }>(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, username, is_enabled, movies_enabled, series_enabled`,
        values
      )

      if (!updated) {
        return reply.status(404).send({ error: 'User not found' })
      }

      return reply.send({ user: updated })
    } catch (error) {
      fastify.log.error({ error, apertureUserId }, 'Failed to update user during setup')
      return reply.status(500).send({ error: 'Failed to update user' })
    }
  })

  /**
   * POST /api/setup/openai/test
   * Test OpenAI connection (public during setup)
   */
  fastify.post<{ Body: OpenAIBody }>(
    '/api/setup/openai/test',
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      const { apiKey } = request.body

      if (!apiKey) {
        return reply.status(400).send({ 
          success: false, 
          error: 'API key is required' 
        })
      }

      // Temporarily test with the provided key
      const originalKey = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = apiKey
      
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (response.ok) {
          return reply.send({ success: true })
        } else {
          const data = await response.json().catch(() => ({})) as { error?: { message?: string } }
          return reply.send({ 
            success: false, 
            error: data.error?.message || `API returned status ${response.status}` 
          })
        }
      } catch (err) {
        return reply.send({ 
          success: false, 
          error: err instanceof Error ? err.message : 'Connection failed' 
        })
      } finally {
        // Restore original key
        if (originalKey) {
          process.env.OPENAI_API_KEY = originalKey
        } else {
          delete process.env.OPENAI_API_KEY
        }
      }
    }
  )

  /**
   * GET /api/setup/openai
   * Check if OpenAI API key exists and return masked version
   */
  fastify.get('/api/setup/openai', async (request, reply) => {
    const { complete, isAdmin } = await requireSetupWritable(request)
    if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

    const existingKey = await getOpenAIApiKey()

    if (existingKey) {
      // Return a masked version: show first 7 chars (sk-proj) and last 4 chars
      const masked =
        existingKey.length > 12
          ? `${existingKey.slice(0, 7)}...${existingKey.slice(-4)}`
          : '••••••••'
      return reply.send({ configured: true, maskedKey: masked })
    }

    return reply.send({ configured: false, maskedKey: null })
  })

  /**
   * POST /api/setup/openai
   * Save OpenAI API key (only during setup)
   */
  fastify.post<{ Body: OpenAIBody }>(
    '/api/setup/openai',
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const { apiKey } = request.body

      if (!apiKey) {
        return reply.status(400).send({ error: 'API key is required' })
      }

      await setOpenAIApiKey(apiKey)

      return reply.send({ success: true })
    }
  )

  /**
   * POST /api/setup/jobs/:name/run
   * Run a job during first-time setup (no auth required, only works before setup is complete)
   */
  fastify.post<{ Params: { name: string } }>(
    '/api/setup/jobs/:name/run',
    async (request, reply) => {
      const complete = await isSetupComplete()
      if (complete) {
        return reply.status(403).send({ 
          error: 'Setup is already complete. Use admin job endpoints instead.' 
        })
      }

      const { name } = request.params

      // Only allow specific jobs during setup
      const allowedJobs = [
        'sync-movies',
        'sync-series',
        'sync-movie-watch-history',
        'sync-series-watch-history',
        'generate-movie-embeddings',
        'generate-series-embeddings',
        'generate-movie-recommendations',
        'generate-series-recommendations',
        'sync-movie-libraries',
        'sync-series-libraries',
      ]

      if (!allowedJobs.includes(name)) {
        return reply.status(400).send({ error: `Job "${name}" is not allowed during setup` })
      }

      // Forward to the actual job runner via inject (bypasses auth for internal call)
      const res = await fastify.inject({
        method: 'POST',
        url: `/api/jobs/${name}/run`,
        headers: {
          // Mark as internal request to bypass auth
          'x-internal-request': 'true',
        },
      })

      return reply.status(res.statusCode).send(res.json())
    }
  )

  /**
   * POST /api/setup/complete
   * Mark setup as complete
   */
  fastify.post(
    '/api/setup/complete',
    async (request, reply) => {
      // Verify media server is configured before completing
      const mediaServerConfig = await getMediaServerConfig()
      if (!mediaServerConfig.isConfigured) {
        return reply.status(400).send({ 
          error: 'Media server must be configured before completing setup' 
        })
      }

      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      await markSetupComplete()
      await markSetupStepCompleted('initialJobs')

      return reply.send({ success: true })
    }
  )

  /**
   * POST /api/admin/setup/run-initial-jobs
   * Admin-only orchestration endpoint: runs initial jobs in the required order.
   *
   * Returns jobIds in order. Jobs run in background.
   */
  fastify.post(
    '/api/admin/setup/run-initial-jobs',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const jobs = [
        'sync-movies',
        'sync-series',
        'sync-movie-watch-history',
        'sync-series-watch-history',
        'generate-movie-embeddings',
        'generate-series-embeddings',
        'generate-movie-recommendations',
        'generate-series-recommendations',
        'sync-movie-libraries',
        'sync-series-libraries',
      ] as const

      // We reuse the existing jobs runner endpoint by calling it via fastify.inject,
      // so the orchestration logic stays in one place.
      const jobIds: string[] = []
      for (const name of jobs) {
        const res = await fastify.inject({
          method: 'POST',
          url: `/api/jobs/${name}/run`,
        })

        if (res.statusCode >= 400) {
          return reply.status(500).send({
            error: `Failed to start job ${name}`,
            statusCode: res.statusCode,
            body: res.body,
          })
        }

        const parsed = res.json() as { jobId?: string }
        if (parsed.jobId) jobIds.push(parsed.jobId)
      }

      // Mark step complete (admin rerun uses this to resume)
      await markSetupStepCompleted('initialJobs')

      return reply.send({ success: true, jobIds })
    }
  )

  // ==========================================================================
  // Admin-only rerun endpoints (accessible from Admin Settings UI)
  // ==========================================================================

  fastify.get('/api/admin/setup/progress', { preHandler: requireAdmin }, async (_request, reply) => {
    const progress = await getSetupProgress()
    const mediaServerConfig = await getMediaServerConfig()
    const hasOpenAI = await hasOpenAIApiKey()
    // Exclude Aperture-created libraries from selection
    const libraries = await getLibraryConfigs(true)
    const aiRecsOutput = await getAiRecsOutputConfig()
    const topPicks = await getTopPicksConfig()

    return reply.send({
      progress,
      snapshot: {
        mediaServer: mediaServerConfig,
        openai: { configured: hasOpenAI },
        libraries,
        aiRecsOutput,
        topPicks,
      },
    })
  })

  fastify.post<{ Body: SetupProgressBody }>(
    '/api/admin/setup/progress',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { currentStep, completedStep, reset } = request.body || {}
      if (reset) {
        // Keep setup locked down; admin rerun should not reopen public /setup.
        await resetSetupProgress()
        await markSetupComplete()
        return reply.send({ success: true })
      }
      if (currentStep !== undefined) {
        await setSetupCurrentStep(currentStep ?? null)
      }
      if (completedStep) {
        await markSetupStepCompleted(completedStep)
      }
      return reply.send({ success: true })
    }
  )
}

export default setupRoutes

