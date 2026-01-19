/**
 * Media Proxy Routes
 * Proxies images from Emby/Jellyfin to avoid mixed content issues
 * when accessing Aperture through a reverse proxy
 */

import type { FastifyPluginAsync } from 'fastify'
import { getMediaServerConfig } from '@aperture/core'
import { mediaProxySchemas } from './schemas.js'

const mediaProxyRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(mediaProxySchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * GET /api/media/images/*
   * Proxies image requests to the media server
   * 
   * Examples:
   * - /api/media/images/Items/{itemId}/Images/Primary
   * - /api/media/images/Items/{itemId}/Images/Backdrop
   * - /api/media/images/Persons/{name}/Images/Primary
   * - /api/media/images/Users/{userId}/Images/Primary
   */
  fastify.get('/api/media/images/*', async (request, reply) => {
    // Extract the path after /api/media/images/
    const imagePath = (request.params as { '*': string })['*']

    if (!imagePath) {
      return reply.status(400).send({ error: 'Image path required' })
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

    // Build the full URL to the media server
    // Preserve any query parameters from the original request
    const queryString = request.url.includes('?') 
      ? request.url.substring(request.url.indexOf('?')) 
      : ''
    const imageUrl = `${config.baseUrl}/${imagePath}${queryString}`

    try {
      // Fetch image from media server
      const response = await fetch(imageUrl, {
        headers: {
          'X-Emby-Authorization': `MediaBrowser Client="Aperture", Device="Aperture Server", DeviceId="aperture-server", Version="1.0.0", Token="${config.apiKey}"`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return reply.status(404).send({ error: 'Image not found' })
        }
        throw new Error(`Media server returned ${response.status}`)
      }

      // Get image data
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await response.arrayBuffer())

      // Set caching headers - images don't change often
      // Cache for 24 hours, allow stale-while-revalidate for 7 days
      reply.header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      reply.header('Content-Type', contentType)

      return reply.send(buffer)
    } catch (err) {
      fastify.log.error({ err, imagePath }, 'Failed to fetch image from media server')
      return reply.status(502).send({ error: 'Failed to fetch image from media server' })
    }
  })
}

export default mediaProxyRoutes
