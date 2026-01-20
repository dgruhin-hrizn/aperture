import type { FastifyPluginAsync } from 'fastify'
import { requireAuth, requireAdmin } from '../../plugins/auth.js'
import { topPicksSchemas } from './schemas.js'
import type { PopularitySource, HybridExternalSource } from '@aperture/core'

interface PopularMovieResponse {
  movieId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  uniqueViewers: number
  playCount: number
  popularityScore: number
  rank: number
}

interface PopularSeriesResponse {
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  network: string | null
  uniqueViewers: number
  totalEpisodesWatched: number
  avgCompletionRate: number
  popularityScore: number
  rank: number
}

interface TopPicksConfigResponse {
  // Movies settings
  moviesTimeWindowDays: number
  moviesMinUniqueViewers: number
  moviesCount: number
  // Series settings  
  seriesTimeWindowDays: number
  seriesMinUniqueViewers: number
  seriesCount: number
  lastRefreshedAt: Date | null
}

const topPicksRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(topPicksSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * GET /api/top-picks/movies
   * Get globally popular movies based on watch history across all users
   */
  fastify.get<{
    Reply: {
      movies: PopularMovieResponse[]
      config: TopPicksConfigResponse
    }
  }>('/api/top-picks/movies', { preHandler: requireAuth, schema: { tags: ["top-picks"] } }, async (_request, reply) => {
    try {
      const { getTopMovies, getTopPicksConfig } = await import('@aperture/core')
      
      const [movies, config] = await Promise.all([
        getTopMovies(),
        getTopPicksConfig()
      ])

      return reply.send({
        movies,
        config: {
          moviesTimeWindowDays: config.moviesTimeWindowDays,
          moviesMinUniqueViewers: config.moviesMinUniqueViewers,
          moviesCount: config.moviesCount,
          seriesTimeWindowDays: config.seriesTimeWindowDays,
          seriesMinUniqueViewers: config.seriesMinUniqueViewers,
          seriesCount: config.seriesCount,
          lastRefreshedAt: config.lastRefreshedAt
        }
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get top picks movies')
      return reply.status(500).send({ error: 'Failed to get top picks movies' } as never)
    }
  })

  /**
   * GET /api/top-picks/series
   * Get globally popular TV series based on watch history across all users
   */
  fastify.get<{
    Reply: {
      series: PopularSeriesResponse[]
      config: TopPicksConfigResponse
    }
  }>('/api/top-picks/series', { preHandler: requireAuth, schema: { tags: ["top-picks"] } }, async (_request, reply) => {
    try {
      const { getTopSeries, getTopPicksConfig } = await import('@aperture/core')
      
      const [series, config] = await Promise.all([
        getTopSeries(),
        getTopPicksConfig()
      ])

      return reply.send({
        series,
        config: {
          moviesTimeWindowDays: config.moviesTimeWindowDays,
          moviesMinUniqueViewers: config.moviesMinUniqueViewers,
          moviesCount: config.moviesCount,
          seriesTimeWindowDays: config.seriesTimeWindowDays,
          seriesMinUniqueViewers: config.seriesMinUniqueViewers,
          seriesCount: config.seriesCount,
          lastRefreshedAt: config.lastRefreshedAt
        }
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get top picks series')
      return reply.status(500).send({ error: 'Failed to get top picks series' } as never)
    }
  })

  /**
   * POST /api/top-picks/preview
   * Preview what items would be included in Top Picks for a given source configuration
   * Returns both matched (in library) and missing items with their TMDB IDs
   */
  fastify.post<{
    Body: {
      mediaType: 'movies' | 'series'
      source: PopularitySource
      hybridExternalSource?: HybridExternalSource
      mdblistListId?: number
      mdblistSort?: string
      limit?: number
      languages?: string[]
      includeUnknownLanguage?: boolean
    }
  }>('/api/top-picks/preview', { preHandler: requireAdmin, schema: { tags: ["top-picks"] } }, async (request, reply) => {
    try {
      const { 
        mediaType, 
        source, 
        hybridExternalSource,
        mdblistListId, 
        mdblistSort = 'score',
        limit = 100,
        languages = [],
        includeUnknownLanguage = true,
      } = request.body

      const { 
        getTopMoviesPreview,
        getTopSeriesPreview,
      } = await import('@aperture/core')

      const options = {
        limit,
        hybridExternalSource,
        mdblistListId,
        mdblistSort,
        languages,
        includeUnknownLanguage,
      }

      const result = mediaType === 'movies'
        ? await getTopMoviesPreview(source, options)
        : await getTopSeriesPreview(source, options)

      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get top picks preview')
      return reply.status(500).send({ error: 'Failed to get preview' } as never)
    }
  })

  /**
   * POST /api/top-picks/request-missing
   * Bulk request missing items via Jellyseerr
   */
  fastify.post<{
    Body: {
      items: Array<{
        tmdbId: number
        title: string
        mediaType: 'movie' | 'tv'
      }>
      limit?: number
    }
  }>('/api/top-picks/request-missing', { preHandler: requireAdmin, schema: { tags: ["top-picks"] } }, async (request, reply) => {
    try {
      const { items, limit = 10 } = request.body

      const { isJellyseerrConfigured, createJellyseerrRequest, getJellyseerrMediaStatus } = await import('@aperture/core')

      // Check if Jellyseerr is configured
      const configured = await isJellyseerrConfigured()
      if (!configured) {
        return reply.status(400).send({ error: 'Jellyseerr is not configured' } as never)
      }

      // Limit the number of requests
      const itemsToRequest = items.slice(0, limit)
      const results: Array<{
        tmdbId: number
        title: string
        success: boolean
        message?: string
        requestId?: number
      }> = []

      for (const item of itemsToRequest) {
        // Check if already requested or available
        const status = await getJellyseerrMediaStatus(item.tmdbId, item.mediaType)
        if (status?.exists || status?.requested) {
          results.push({
            tmdbId: item.tmdbId,
            title: item.title,
            success: false,
            message: status.exists ? 'Already in library' : 'Already requested',
          })
          continue
        }

        // Create the request
        const result = await createJellyseerrRequest(item.tmdbId, item.mediaType)
        results.push({
          tmdbId: item.tmdbId,
          title: item.title,
          success: result.success,
          message: result.message,
          requestId: result.requestId,
        })

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      return reply.send({
        success: true,
        requested: successCount,
        skipped: failCount,
        results,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to request missing items')
      return reply.status(500).send({ error: 'Failed to request missing items' } as never)
    }
  })

  /**
   * GET /api/top-picks/auto-request/config
   * Get auto-request configuration
   */
  fastify.get('/api/top-picks/auto-request/config', { preHandler: requireAdmin, schema: { tags: ["top-picks"] } }, async (_request, reply) => {
    try {
      const { getTopPicksConfig } = await import('@aperture/core')
      const config = await getTopPicksConfig()

      return reply.send({
        moviesAutoRequestEnabled: config.moviesAutoRequestEnabled,
        moviesAutoRequestLimit: config.moviesAutoRequestLimit,
        seriesAutoRequestEnabled: config.seriesAutoRequestEnabled,
        seriesAutoRequestLimit: config.seriesAutoRequestLimit,
        autoRequestCron: config.autoRequestCron,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get auto-request config')
      return reply.status(500).send({ error: 'Failed to get config' } as never)
    }
  })

  /**
   * PATCH /api/top-picks/auto-request/config
   * Update auto-request configuration
   */
  fastify.patch<{
    Body: {
      moviesAutoRequestEnabled?: boolean
      moviesAutoRequestLimit?: number
      seriesAutoRequestEnabled?: boolean
      seriesAutoRequestLimit?: number
      autoRequestCron?: string
    }
  }>('/api/top-picks/auto-request/config', { preHandler: requireAdmin, schema: { tags: ["top-picks"] } }, async (request, reply) => {
    try {
      const { updateTopPicksConfig } = await import('@aperture/core')
      const config = await updateTopPicksConfig(request.body)

      return reply.send({
        moviesAutoRequestEnabled: config.moviesAutoRequestEnabled,
        moviesAutoRequestLimit: config.moviesAutoRequestLimit,
        seriesAutoRequestEnabled: config.seriesAutoRequestEnabled,
        seriesAutoRequestLimit: config.seriesAutoRequestLimit,
        autoRequestCron: config.autoRequestCron,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update auto-request config')
      return reply.status(500).send({ error: 'Failed to update config' } as never)
    }
  })
}

export default topPicksRoutes
