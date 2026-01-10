import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../plugins/auth.js'

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
  timeWindowDays: number
  moviesCount: number
  seriesCount: number
  minUniqueViewers: number
  lastRefreshedAt: Date | null
}

const topPicksRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/top-picks/movies
   * Get globally popular movies based on watch history across all users
   */
  fastify.get<{
    Reply: {
      movies: PopularMovieResponse[]
      config: TopPicksConfigResponse
    }
  }>('/api/top-picks/movies', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      const { getTopMovies, getTopPicksConfig } = await import('@aperture/core')
      
      const [movies, config] = await Promise.all([
        getTopMovies(),
        getTopPicksConfig()
      ])

      return reply.send({
        movies,
        config: {
          timeWindowDays: config.timeWindowDays,
          moviesCount: config.moviesCount,
          seriesCount: config.seriesCount,
          minUniqueViewers: config.minUniqueViewers,
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
  }>('/api/top-picks/series', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      const { getTopSeries, getTopPicksConfig } = await import('@aperture/core')
      
      const [series, config] = await Promise.all([
        getTopSeries(),
        getTopPicksConfig()
      ])

      return reply.send({
        series,
        config: {
          timeWindowDays: config.timeWindowDays,
          moviesCount: config.moviesCount,
          seriesCount: config.seriesCount,
          minUniqueViewers: config.minUniqueViewers,
          lastRefreshedAt: config.lastRefreshedAt
        }
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get top picks series')
      return reply.status(500).send({ error: 'Failed to get top picks series' } as never)
    }
  })
}

export default topPicksRoutes



