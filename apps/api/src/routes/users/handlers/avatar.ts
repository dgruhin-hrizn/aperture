/**
 * User Avatar Handler
 * Proxies user avatars from Emby/Jellyfin to avoid mixed content issues
 */

import type { FastifyInstance } from 'fastify'
import { queryOne } from '../../../lib/db.js'
import { getMediaServerConfig } from '@aperture/core'

interface AvatarParams {
  id: string
}

interface UserProviderInfo {
  provider: 'emby' | 'jellyfin'
  provider_user_id: string
}

export function registerAvatarHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/:id/avatar
   * Proxies user avatar from the media server
   * This endpoint does NOT require authentication to allow avatars in public contexts
   */
  fastify.get<{ Params: AvatarParams }>('/api/users/:id/avatar', async (request, reply) => {
    const { id } = request.params

    // Get user's provider info from database
    const user = await queryOne<UserProviderInfo>(
      `SELECT provider, provider_user_id FROM users WHERE id = $1`,
      [id]
    )

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Get media server config
    let config
    try {
      config = await getMediaServerConfig()
    } catch {
      return reply.status(503).send({ error: 'Media server not configured' })
    }

    if (!config.baseUrl || !config.apiKey) {
      return reply.status(503).send({ error: 'Media server not configured' })
    }

    // Build the avatar URL for Emby/Jellyfin
    const avatarUrl = `${config.baseUrl}/Users/${user.provider_user_id}/Images/Primary`

    try {
      // Fetch avatar from media server
      const response = await fetch(avatarUrl, {
        headers: {
          'X-Emby-Authorization': `MediaBrowser Client="Aperture", Device="Aperture Server", DeviceId="aperture-server", Version="1.0.0", Token="${config.apiKey}"`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // No avatar set - return a 404
          return reply.status(404).send({ error: 'User has no avatar' })
        }
        throw new Error(`Media server returned ${response.status}`)
      }

      // Get image data
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await response.arrayBuffer())

      // Set caching headers - avatars don't change often
      // Cache for 1 hour, allow stale-while-revalidate for 24 hours
      reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
      reply.header('Content-Type', contentType)

      return reply.send(buffer)
    } catch (err) {
      fastify.log.error({ err, userId: id }, 'Failed to fetch user avatar from media server')
      return reply.status(502).send({ error: 'Failed to fetch avatar from media server' })
    }
  })

  /**
   * GET /api/users/by-provider/:providerUserId/avatar
   * Proxies user avatar using the provider user ID directly
   * Useful for fetching avatars before a user is imported
   */
  fastify.get<{ Params: { providerUserId: string } }>(
    '/api/users/by-provider/:providerUserId/avatar',
    async (request, reply) => {
      const { providerUserId } = request.params

      // Get media server config
      let config
      try {
        config = await getMediaServerConfig()
      } catch {
        return reply.status(503).send({ error: 'Media server not configured' })
      }

      if (!config.baseUrl || !config.apiKey) {
        return reply.status(503).send({ error: 'Media server not configured' })
      }

      // Build the avatar URL for Emby/Jellyfin
      const avatarUrl = `${config.baseUrl}/Users/${providerUserId}/Images/Primary`

      try {
        // Fetch avatar from media server
        const response = await fetch(avatarUrl, {
          headers: {
            'X-Emby-Authorization': `MediaBrowser Client="Aperture", Device="Aperture Server", DeviceId="aperture-server", Version="1.0.0", Token="${config.apiKey}"`,
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            return reply.status(404).send({ error: 'User has no avatar' })
          }
          throw new Error(`Media server returned ${response.status}`)
        }

        // Get image data
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const buffer = Buffer.from(await response.arrayBuffer())

        // Set caching headers
        reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
        reply.header('Content-Type', contentType)

        return reply.send(buffer)
      } catch (err) {
        fastify.log.error({ err, providerUserId }, 'Failed to fetch user avatar from media server')
        return reply.status(502).send({ error: 'Failed to fetch avatar from media server' })
      }
    }
  )
}
