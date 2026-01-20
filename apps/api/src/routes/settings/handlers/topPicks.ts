/**
 * Top Picks Configuration Handlers
 * 
 * Endpoints:
 * - GET /api/settings/top-picks - Get Top Picks config
 * - PATCH /api/settings/top-picks - Update Top Picks config
 * - POST /api/settings/top-picks/reset - Reset Top Picks config
 * - POST /api/settings/top-picks/preview - Get preview counts
 * - POST /api/settings/top-picks/refresh - Trigger manual refresh
 */
import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '../../../plugins/auth.js'
import {
  topPicksConfigSchema,
  updateTopPicksConfigSchema,
} from '../schemas.js'
import type { PopularitySource, HybridExternalSource } from '@aperture/core'

export function registerTopPicksHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/top-picks
   */
  fastify.get('/api/settings/top-picks', { preHandler: requireAdmin, schema: topPicksConfigSchema }, async (_request, reply) => {
    try {
      const { getTopPicksConfig, getTopPicksLibraries } = await import('@aperture/core')
      const config = await getTopPicksConfig()

      let libraries: {
        movies: { id: string; guid: string; name: string } | null
        series: { id: string; guid: string; name: string } | null
      } = { movies: null, series: null }
      try {
        libraries = await getTopPicksLibraries()
      } catch {
        // Libraries don't exist yet, that's fine
      }

      return reply.send({
        ...config,
        libraries,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get Top Picks config')
      return reply.status(500).send({ error: 'Failed to get Top Picks configuration' })
    }
  })

  /**
   * PATCH /api/settings/top-picks
   */
  fastify.patch<{
    Body: {
      isEnabled?: boolean
      moviesPopularitySource?: PopularitySource
      moviesTimeWindowDays?: number
      moviesMinUniqueViewers?: number
      moviesUseAllMatches?: boolean
      moviesCount?: number
      moviesHybridExternalSource?: HybridExternalSource
      seriesPopularitySource?: PopularitySource
      seriesTimeWindowDays?: number
      seriesMinUniqueViewers?: number
      seriesUseAllMatches?: boolean
      seriesCount?: number
      seriesHybridExternalSource?: HybridExternalSource
      uniqueViewersWeight?: number
      playCountWeight?: number
      completionWeight?: number
      refreshCron?: string
      moviesLibraryName?: string
      seriesLibraryName?: string
      moviesUseSymlinks?: boolean
      seriesUseSymlinks?: boolean
      moviesLibraryEnabled?: boolean
      moviesCollectionEnabled?: boolean
      moviesPlaylistEnabled?: boolean
      seriesLibraryEnabled?: boolean
      seriesCollectionEnabled?: boolean
      seriesPlaylistEnabled?: boolean
      moviesCollectionName?: string
      seriesCollectionName?: string
      mdblistMoviesListId?: number | null
      mdblistSeriesListId?: number | null
      mdblistMoviesListName?: string | null
      mdblistSeriesListName?: string | null
      mdblistMoviesSort?: string
      mdblistSeriesSort?: string
      hybridLocalWeight?: number
      hybridExternalWeight?: number
      moviesAutoRequestEnabled?: boolean
      moviesAutoRequestLimit?: number
      seriesAutoRequestEnabled?: boolean
      seriesAutoRequestLimit?: number
      autoRequestCron?: string
    }
  }>('/api/settings/top-picks', { preHandler: requireAdmin, schema: updateTopPicksConfigSchema }, async (request, reply) => {
    try {
      const { updateTopPicksConfig } = await import('@aperture/core')
      const config = await updateTopPicksConfig(request.body)
      return reply.send(config)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update Top Picks config')
      return reply.status(500).send({ error: 'Failed to update Top Picks configuration' })
    }
  })

  /**
   * POST /api/settings/top-picks/reset
   */
  fastify.post('/api/settings/top-picks/reset', { preHandler: requireAdmin, schema: { tags: ['settings'], summary: 'Reset Top Picks config' } }, async (_request, reply) => {
    try {
      const { resetTopPicksConfig } = await import('@aperture/core')
      const config = await resetTopPicksConfig()
      return reply.send(config)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to reset Top Picks config')
      return reply.status(500).send({ error: 'Failed to reset Top Picks configuration' })
    }
  })

  /**
   * POST /api/settings/top-picks/preview
   */
  fastify.post<{
    Body: {
      moviesMinViewers: number
      moviesTimeWindowDays: number
      seriesMinViewers: number
      seriesTimeWindowDays: number
    }
  }>('/api/settings/top-picks/preview', { preHandler: requireAdmin, schema: { tags: ['settings'], summary: 'Preview Top Picks counts' } }, async (request, reply) => {
    try {
      const { getTopPicksPreviewCounts } = await import('@aperture/core')
      const result = await getTopPicksPreviewCounts(request.body)
      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get Top Picks preview counts')
      return reply.status(500).send({ error: 'Failed to get preview counts' })
    }
  })

  /**
   * POST /api/settings/top-picks/refresh
   */
  fastify.post('/api/settings/top-picks/refresh', { preHandler: requireAdmin, schema: { tags: ['settings'], summary: 'Refresh Top Picks' } }, async (_request, reply) => {
    try {
      const { refreshTopPicks } = await import('@aperture/core')
      const result = await refreshTopPicks()
      return reply.send({
        success: true,
        ...result,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to refresh Top Picks')
      return reply.status(500).send({ error: 'Failed to refresh Top Picks' })
    }
  })
}
