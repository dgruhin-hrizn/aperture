import type { FastifyPluginAsync } from 'fastify'
import {
  getMediaServerProvider,
  getLibraryConfigs,
  setLibraryEnabled,
  syncLibraryConfigsFromProvider,
  getRecommendationConfig,
  updateRecommendationConfig,
  resetRecommendationConfig,
  getUserSettings,
  updateUserSettings,
  getDefaultLibraryNamePrefix,
} from '@aperture/core'
import { requireAdmin } from '../plugins/auth.js'

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // =========================================================================
  // Media Server Info (public - for play buttons)
  // =========================================================================

  /**
   * GET /api/settings/media-server
   * Get media server info for frontend (URL for play links)
   * Note: Does not require admin - all authenticated users can use play buttons
   */
  fastify.get('/api/settings/media-server', async (_request, reply) => {
    const baseUrl = process.env.MEDIA_SERVER_BASE_URL || ''
    const serverType = process.env.MEDIA_SERVER_TYPE || 'emby'
    const apiKey = process.env.MEDIA_SERVER_API_KEY || ''

    let serverId = ''
    let serverName = ''

    // Try to get server ID for deep linking
    if (baseUrl && apiKey) {
      try {
        const provider = getMediaServerProvider()
        if ('getServerInfo' in provider) {
          const info = await (
            provider as { getServerInfo: (key: string) => Promise<{ id: string; name: string }> }
          ).getServerInfo(apiKey)
          serverId = info.id
          serverName = info.name
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Could not fetch media server info')
      }
    }

    return reply.send({
      baseUrl,
      type: serverType,
      serverId,
      serverName,
      webClientUrl: `${baseUrl}/web/index.html`,
    })
  })

  // =========================================================================
  // Library Configuration
  // =========================================================================

  /**
   * GET /api/settings/libraries
   * Get all library configurations from database
   */
  fastify.get('/api/settings/libraries', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const configs = await getLibraryConfigs()
      return reply.send({ libraries: configs })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get library configs')
      return reply.status(500).send({ error: 'Failed to get library configurations' })
    }
  })

  /**
   * POST /api/settings/libraries/sync
   * Sync library list from media server to database
   * This fetches the current list of movie libraries and updates our config table
   */
  fastify.post(
    '/api/settings/libraries/sync',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const apiKey = process.env.MEDIA_SERVER_API_KEY

        if (!apiKey) {
          return reply.status(500).send({ error: 'MEDIA_SERVER_API_KEY not configured' })
        }

        const provider = getMediaServerProvider()
        const movieLibraries = await provider.getMovieLibraries(apiKey)

        // Sync to database
        const result = await syncLibraryConfigsFromProvider(
          movieLibraries.map((lib) => ({
            id: lib.id,
            name: lib.name,
            collectionType: lib.collectionType,
          }))
        )

        // Get updated list
        const configs = await getLibraryConfigs()

        return reply.send({
          message: `Synced ${result.added} new, ${result.updated} updated`,
          libraries: configs,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to sync libraries from media server')
        return reply.status(500).send({ error: 'Failed to sync libraries from media server' })
      }
    }
  )

  /**
   * PATCH /api/settings/libraries/:id
   * Update library configuration (enable/disable)
   */
  fastify.patch<{
    Params: { id: string }
    Body: { isEnabled: boolean }
  }>('/api/settings/libraries/:id', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { id } = request.params
      const { isEnabled } = request.body

      if (typeof isEnabled !== 'boolean') {
        return reply.status(400).send({ error: 'isEnabled must be a boolean' })
      }

      const updated = await setLibraryEnabled(id, isEnabled)

      if (!updated) {
        return reply.status(404).send({ error: 'Library not found' })
      }

      return reply.send({ library: updated })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update library config')
      return reply.status(500).send({ error: 'Failed to update library configuration' })
    }
  })

  /**
   * GET /api/settings/libraries/available
   * Get available movie libraries directly from media server
   * Useful for seeing what's available before syncing
   */
  fastify.get(
    '/api/settings/libraries/available',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const apiKey = process.env.MEDIA_SERVER_API_KEY

        if (!apiKey) {
          return reply.status(500).send({ error: 'MEDIA_SERVER_API_KEY not configured' })
        }

        const provider = getMediaServerProvider()
        const movieLibraries = await provider.getMovieLibraries(apiKey)

        return reply.send({ libraries: movieLibraries })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get available libraries')
        return reply
          .status(500)
          .send({ error: 'Failed to get available libraries from media server' })
      }
    }
  )

  // =========================================================================
  // Recommendation Configuration
  // =========================================================================

  /**
   * GET /api/settings/recommendations
   * Get current recommendation algorithm configuration
   */
  fastify.get(
    '/api/settings/recommendations',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const config = await getRecommendationConfig()
        return reply.send({ config })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get recommendation config')
        return reply.status(500).send({ error: 'Failed to get recommendation configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/recommendations
   * Update recommendation algorithm configuration
   */
  fastify.patch<{
    Body: {
      maxCandidates?: number
      selectedCount?: number
      recentWatchLimit?: number
      similarityWeight?: number
      noveltyWeight?: number
      ratingWeight?: number
      diversityWeight?: number
    }
  }>('/api/settings/recommendations', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const updates = request.body

      // Validate weights are between 0 and 1
      const weights = [
        'similarityWeight',
        'noveltyWeight',
        'ratingWeight',
        'diversityWeight',
      ] as const
      for (const key of weights) {
        if (updates[key] !== undefined) {
          if (updates[key]! < 0 || updates[key]! > 1) {
            return reply.status(400).send({ error: `${key} must be between 0 and 1` })
          }
        }
      }

      // Validate counts are positive
      const counts = ['maxCandidates', 'selectedCount', 'recentWatchLimit'] as const
      for (const key of counts) {
        if (updates[key] !== undefined) {
          if (updates[key]! < 1) {
            return reply.status(400).send({ error: `${key} must be at least 1` })
          }
        }
      }

      const config = await updateRecommendationConfig(updates)
      return reply.send({ config, message: 'Configuration updated successfully' })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update recommendation config')
      return reply.status(500).send({ error: 'Failed to update recommendation configuration' })
    }
  })

  /**
   * POST /api/settings/recommendations/reset
   * Reset recommendation configuration to defaults
   */
  fastify.post(
    '/api/settings/recommendations/reset',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const config = await resetRecommendationConfig()
        return reply.send({ config, message: 'Configuration reset to defaults' })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to reset recommendation config')
        return reply.status(500).send({ error: 'Failed to reset recommendation configuration' })
      }
    }
  )

  // =========================================================================
  // User Settings (per-user preferences)
  // =========================================================================

  /**
   * GET /api/settings/user
   * Get current user's settings
   */
  fastify.get('/api/settings/user', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const settings = await getUserSettings(userId)
      const defaultPrefix = getDefaultLibraryNamePrefix()

      return reply.send({
        settings,
        defaults: {
          libraryNamePrefix: defaultPrefix,
        },
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get user settings')
      return reply.status(500).send({ error: 'Failed to get user settings' })
    }
  })

  /**
   * PATCH /api/settings/user
   * Update current user's settings
   */
  fastify.patch<{
    Body: {
      libraryName?: string | null
    }
  }>('/api/settings/user', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { libraryName } = request.body

      // Validate library name if provided
      if (libraryName !== undefined && libraryName !== null) {
        if (typeof libraryName !== 'string' || libraryName.length > 100) {
          return reply
            .status(400)
            .send({ error: 'Library name must be a string under 100 characters' })
        }
        // Check for invalid characters (media server path-safe)
        if (/[<>:"/\\|?*]/.test(libraryName)) {
          return reply.status(400).send({ error: 'Library name contains invalid characters' })
        }
      }

      const settings = await updateUserSettings(userId, { libraryName })

      return reply.send({
        settings,
        message: 'Settings updated successfully',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update user settings')
      return reply.status(500).send({ error: 'Failed to update user settings' })
    }
  })
}

export default settingsRoutes
