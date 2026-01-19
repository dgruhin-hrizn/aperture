/**
 * Library Settings Handlers
 * 
 * Endpoints:
 * - GET /api/settings/libraries - Get library configurations
 * - POST /api/settings/libraries/sync - Sync libraries from media server
 * - PATCH /api/settings/libraries/:id - Update library enabled status
 * - GET /api/settings/libraries/available - Get available libraries from server
 * - GET /api/genres - Get available genres
 */
import type { FastifyInstance } from 'fastify'
import {
  createMediaServerProvider,
  getLibraryConfigs,
  setLibraryEnabled,
  syncLibraryConfigsFromProvider,
  getMediaServerConfig,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import {
  librariesSchema,
  syncLibrariesSchema,
  availableLibrariesSchema,
  updateLibrarySchema,
} from '../schemas.js'

export function registerLibraryHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/libraries
   */
  fastify.get('/api/settings/libraries', { preHandler: requireAdmin, schema: librariesSchema }, async (_request, reply) => {
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
   */
  fastify.post('/api/settings/libraries/sync', { preHandler: requireAdmin, schema: syncLibrariesSchema }, async (_request, reply) => {
    try {
      const config = await getMediaServerConfig()

      if (!config.isConfigured || !config.apiKey || !config.type) {
        return reply.status(500).send({ error: 'Media server not configured' })
      }

      const provider = createMediaServerProvider(config.type, config.baseUrl || '')

      const [movieLibraries, tvShowLibraries] = await Promise.all([
        provider.getMovieLibraries(config.apiKey),
        provider.getTvShowLibraries(config.apiKey),
      ])

      const allLibraries = [...movieLibraries, ...tvShowLibraries]

      const result = await syncLibraryConfigsFromProvider(
        allLibraries.map((lib) => ({
          id: lib.id,
          name: lib.name,
          collectionType: lib.collectionType,
        }))
      )

      const configs = await getLibraryConfigs()

      return reply.send({
        message: `Synced ${result.added} new, ${result.updated} updated (${movieLibraries.length} movies, ${tvShowLibraries.length} TV shows)`,
        libraries: configs,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to sync libraries from media server')
      return reply.status(500).send({ error: 'Failed to sync libraries from media server' })
    }
  })

  /**
   * PATCH /api/settings/libraries/:id
   */
  fastify.patch<{
    Params: { id: string }
    Body: { isEnabled: boolean }
  }>('/api/settings/libraries/:id', { preHandler: requireAdmin, schema: updateLibrarySchema }, async (request, reply) => {
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
   */
  fastify.get('/api/settings/libraries/available', { preHandler: requireAdmin, schema: availableLibrariesSchema }, async (_request, reply) => {
    try {
      const config = await getMediaServerConfig()

      if (!config.isConfigured || !config.apiKey || !config.type) {
        return reply.status(500).send({ error: 'Media server not configured' })
      }

      const provider = createMediaServerProvider(config.type, config.baseUrl || '')

      const [movieLibraries, tvShowLibraries] = await Promise.all([
        provider.getMovieLibraries(config.apiKey),
        provider.getTvShowLibraries(config.apiKey),
      ])

      return reply.send({
        libraries: [...movieLibraries, ...tvShowLibraries],
        movieCount: movieLibraries.length,
        tvShowCount: tvShowLibraries.length,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get available libraries')
      return reply.status(500).send({ error: 'Failed to get available libraries from media server' })
    }
  })

  /**
   * GET /api/genres
   */
  fastify.get('/api/genres', { schema: { tags: ['settings'], summary: 'Get available genres' } }, async (_request, reply) => {
    try {
      const config = await getMediaServerConfig()

      if (!config.isConfigured || !config.apiKey || !config.type) {
        return reply.status(500).send({ error: 'Media server not configured' })
      }

      const provider = createMediaServerProvider(config.type, config.baseUrl || '')
      const genres = await provider.getGenres(config.apiKey)

      return reply.send({ genres })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch genres from media server')
      return reply.status(500).send({ error: 'Failed to fetch genres' })
    }
  })
}
