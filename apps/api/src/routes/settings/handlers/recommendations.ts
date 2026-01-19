/**
 * Recommendation Configuration Handlers
 * 
 * Endpoints:
 * - GET /api/settings/recommendations - Get recommendation config
 * - PATCH /api/settings/recommendations/movies - Update movie rec config
 * - PATCH /api/settings/recommendations/series - Update series rec config
 * - POST /api/settings/recommendations/movies/reset - Reset movie config
 * - POST /api/settings/recommendations/series/reset - Reset series config
 * - GET /api/settings/cost-inputs - Get cost estimation inputs
 * - PATCH /api/settings/cost-inputs/estimates - Update cost estimates
 */
import type { FastifyInstance } from 'fastify'
import {
  getRecommendationConfig,
  updateMovieRecommendationConfig,
  updateSeriesRecommendationConfig,
  resetMovieRecommendationConfig,
  resetSeriesRecommendationConfig,
  getJobConfig,
  formatSchedule,
  getSystemSetting,
  setSystemSetting,
  type MediaTypeConfig,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import {
  recommendationConfigSchema,
  updateRecommendationConfigSchema,
  resetRecommendationConfigSchema,
  costInputsSchema,
} from '../schemas.js'

/**
 * Helper function to validate config updates
 */
function validateConfigUpdates(updates: Partial<MediaTypeConfig>): string | null {
  const weights = ['similarityWeight', 'noveltyWeight', 'ratingWeight', 'diversityWeight'] as const
  for (const key of weights) {
    if (updates[key] !== undefined) {
      if (updates[key]! < 0 || updates[key]! > 1) {
        return `${key} must be between 0 and 1`
      }
    }
  }

  const counts = ['maxCandidates', 'selectedCount', 'recentWatchLimit'] as const
  for (const key of counts) {
    if (updates[key] !== undefined) {
      if (updates[key]! < 1) {
        return `${key} must be at least 1`
      }
    }
  }

  return null
}

/**
 * Helper function to calculate runs per week from job schedule
 */
function calculateRunsPerWeek(scheduleType: string, intervalHours?: number | null): number {
  switch (scheduleType) {
    case 'daily':
      return 7
    case 'weekly':
      return 1
    case 'interval':
      if (intervalHours && intervalHours > 0) {
        return Math.round((24 * 7) / intervalHours)
      }
      return 7
    case 'manual':
      return 0
    default:
      return 1
  }
}

export function registerRecommendationHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/recommendations
   */
  fastify.get('/api/settings/recommendations', { preHandler: requireAdmin, schema: recommendationConfigSchema }, async (_request, reply) => {
    try {
      const config = await getRecommendationConfig()
      return reply.send({ config })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get recommendation config')
      return reply.status(500).send({ error: 'Failed to get recommendation configuration' })
    }
  })

  /**
   * PATCH /api/settings/recommendations/movies
   */
  fastify.patch<{
    Body: Partial<MediaTypeConfig>
  }>('/api/settings/recommendations/movies', { preHandler: requireAdmin, schema: updateRecommendationConfigSchema }, async (request, reply) => {
    try {
      const updates = request.body
      const validationError = validateConfigUpdates(updates)
      if (validationError) {
        return reply.status(400).send({ error: validationError })
      }

      const config = await updateMovieRecommendationConfig(updates)
      return reply.send({ config, message: 'Movie configuration updated successfully' })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update movie recommendation config')
      return reply.status(500).send({ error: 'Failed to update movie recommendation configuration' })
    }
  })

  /**
   * PATCH /api/settings/recommendations/series
   */
  fastify.patch<{
    Body: Partial<MediaTypeConfig>
  }>('/api/settings/recommendations/series', { preHandler: requireAdmin, schema: updateRecommendationConfigSchema }, async (request, reply) => {
    try {
      const updates = request.body
      const validationError = validateConfigUpdates(updates)
      if (validationError) {
        return reply.status(400).send({ error: validationError })
      }

      const config = await updateSeriesRecommendationConfig(updates)
      return reply.send({ config, message: 'Series configuration updated successfully' })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update series recommendation config')
      return reply.status(500).send({ error: 'Failed to update series recommendation configuration' })
    }
  })

  /**
   * POST /api/settings/recommendations/movies/reset
   */
  fastify.post('/api/settings/recommendations/movies/reset', { preHandler: requireAdmin, schema: resetRecommendationConfigSchema }, async (_request, reply) => {
    try {
      const config = await resetMovieRecommendationConfig()
      return reply.send({ config, message: 'Movie configuration reset to defaults' })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to reset movie recommendation config')
      return reply.status(500).send({ error: 'Failed to reset movie recommendation configuration' })
    }
  })

  /**
   * POST /api/settings/recommendations/series/reset
   */
  fastify.post('/api/settings/recommendations/series/reset', { preHandler: requireAdmin, schema: resetRecommendationConfigSchema }, async (_request, reply) => {
    try {
      const config = await resetSeriesRecommendationConfig()
      return reply.send({ config, message: 'Series configuration reset to defaults' })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to reset series recommendation config')
      return reply.status(500).send({ error: 'Failed to reset series recommendation configuration' })
    }
  })

  /**
   * GET /api/settings/cost-inputs
   */
  fastify.get('/api/settings/cost-inputs', { preHandler: requireAdmin, schema: costInputsSchema }, async (_request, reply) => {
    try {
      const recConfig = await getRecommendationConfig()

      const [
        movieRecsJobConfig,
        seriesRecsJobConfig,
        movieEmbeddingsJobConfig,
        seriesEmbeddingsJobConfig,
        assistantJobConfig,
      ] = await Promise.all([
        getJobConfig('generate-movie-recommendations'),
        getJobConfig('generate-series-recommendations'),
        getJobConfig('generate-movie-embeddings'),
        getJobConfig('generate-series-embeddings'),
        getJobConfig('refresh-assistant-suggestions'),
      ])

      const costEstimationConfigStr = await getSystemSetting('cost_estimation_config')
      const costEstimationConfig = costEstimationConfigStr
        ? JSON.parse(costEstimationConfigStr)
        : {
            weeklyMoviesAdded: 5,
            weeklyShowsAdded: 3,
            weeklyEpisodesAdded: 20,
            weeklyChatMessagesPerUser: 50,
          }

      const { query, getCurrentEmbeddingDimensions, getFunctionConfig } = await import('@aperture/core')

      const embeddingConfig = await getFunctionConfig('embeddings')
      const dims = await getCurrentEmbeddingDimensions()
      const modelName = embeddingConfig ? `${embeddingConfig.provider}:${embeddingConfig.model}` : null

      const movieEmbedTable = dims ? `embeddings_${dims}` : 'embeddings_3072'
      const seriesEmbedTable = dims ? `series_embeddings_${dims}` : 'series_embeddings_3072'
      const episodeEmbedTable = dims ? `episode_embeddings_${dims}` : 'episode_embeddings_3072'
      const modelFilter = modelName ? `AND e.model = '${modelName}'` : ''

      const [enabledUsersResult, itemCountsResult, totalLibraryResult] = await Promise.all([
        query<{
          movies_enabled_count: string
          series_enabled_count: string
          total_enabled_count: string
        }>(`
          SELECT 
            COUNT(*) FILTER (WHERE movies_enabled = true) as movies_enabled_count,
            COUNT(*) FILTER (WHERE series_enabled = true) as series_enabled_count,
            COUNT(*) FILTER (WHERE is_enabled = true) as total_enabled_count
          FROM users
        `),
        query<{
          movie_count: string
          series_count: string
          episode_count: string
        }>(`
          SELECT 
            (SELECT COUNT(*) FROM movies m WHERE NOT EXISTS (SELECT 1 FROM ${movieEmbedTable} e WHERE e.movie_id = m.id ${modelFilter})) as movie_count,
            (SELECT COUNT(*) FROM series s WHERE NOT EXISTS (SELECT 1 FROM ${seriesEmbedTable} e WHERE e.series_id = s.id ${modelFilter})) as series_count,
            (SELECT COUNT(*) FROM episodes ep WHERE NOT EXISTS (SELECT 1 FROM ${episodeEmbedTable} e WHERE e.episode_id = ep.id ${modelFilter})) as episode_count
        `),
        query<{
          total_movies: string
          total_series: string
          total_episodes: string
        }>(`
          SELECT 
            (SELECT COUNT(*) FROM movies) as total_movies,
            (SELECT COUNT(*) FROM series) as total_series,
            (SELECT COUNT(*) FROM episodes) as total_episodes
        `),
      ])

      const moviesEnabledUsers = parseInt(enabledUsersResult.rows[0]?.movies_enabled_count || '0', 10)
      const seriesEnabledUsers = parseInt(enabledUsersResult.rows[0]?.series_enabled_count || '0', 10)
      const totalEnabledUsers = parseInt(enabledUsersResult.rows[0]?.total_enabled_count || '0', 10)

      const pendingMovieEmbeddings = parseInt(itemCountsResult.rows[0]?.movie_count || '0', 10)
      const pendingSeriesEmbeddings = parseInt(itemCountsResult.rows[0]?.series_count || '0', 10)
      const pendingEpisodeEmbeddings = parseInt(itemCountsResult.rows[0]?.episode_count || '0', 10)

      const totalMovies = parseInt(totalLibraryResult.rows[0]?.total_movies || '0', 10)
      const totalSeries = parseInt(totalLibraryResult.rows[0]?.total_series || '0', 10)
      const totalEpisodes = parseInt(totalLibraryResult.rows[0]?.total_episodes || '0', 10)

      const movieRecsRunsPerWeek = movieRecsJobConfig
        ? calculateRunsPerWeek(movieRecsJobConfig.scheduleType, movieRecsJobConfig.scheduleIntervalHours)
        : 1
      const seriesRecsRunsPerWeek = seriesRecsJobConfig
        ? calculateRunsPerWeek(seriesRecsJobConfig.scheduleType, seriesRecsJobConfig.scheduleIntervalHours)
        : 1
      const movieEmbeddingsRunsPerWeek = movieEmbeddingsJobConfig
        ? calculateRunsPerWeek(movieEmbeddingsJobConfig.scheduleType, movieEmbeddingsJobConfig.scheduleIntervalHours)
        : 7
      const seriesEmbeddingsRunsPerWeek = seriesEmbeddingsJobConfig
        ? calculateRunsPerWeek(seriesEmbeddingsJobConfig.scheduleType, seriesEmbeddingsJobConfig.scheduleIntervalHours)
        : 7
      const assistantRunsPerWeek = assistantJobConfig
        ? calculateRunsPerWeek(assistantJobConfig.scheduleType, assistantJobConfig.scheduleIntervalHours)
        : 168

      return reply.send({
        movie: {
          selectedCount: recConfig.movie.selectedCount,
          runsPerWeek: movieRecsRunsPerWeek,
          schedule: movieRecsJobConfig ? formatSchedule(movieRecsJobConfig) : 'Weekly on Sunday at 4:00 AM',
          enabledUsers: moviesEnabledUsers,
          source: {
            selectedCount: 'Settings > AI Config > Algorithm > Movies > Recs Per User',
            schedule: 'Jobs > generate-movie-recommendations',
          },
        },
        series: {
          selectedCount: recConfig.series.selectedCount,
          runsPerWeek: seriesRecsRunsPerWeek,
          schedule: seriesRecsJobConfig ? formatSchedule(seriesRecsJobConfig) : 'Weekly on Sunday at 4:00 AM',
          enabledUsers: seriesEnabledUsers,
          source: {
            selectedCount: 'Settings > AI Config > Algorithm > Series > Recs Per User',
            schedule: 'Jobs > generate-series-recommendations',
          },
        },
        embeddings: {
          movie: {
            runsPerWeek: movieEmbeddingsRunsPerWeek,
            schedule: movieEmbeddingsJobConfig ? formatSchedule(movieEmbeddingsJobConfig) : 'Daily at 3:00 AM',
            pendingItems: pendingMovieEmbeddings,
            source: { schedule: 'Jobs > generate-movie-embeddings' },
          },
          series: {
            runsPerWeek: seriesEmbeddingsRunsPerWeek,
            schedule: seriesEmbeddingsJobConfig ? formatSchedule(seriesEmbeddingsJobConfig) : 'Daily at 3:00 AM',
            pendingItems: pendingSeriesEmbeddings,
            pendingEpisodes: pendingEpisodeEmbeddings,
            source: { schedule: 'Jobs > generate-series-embeddings' },
          },
        },
        assistant: {
          runsPerWeek: assistantRunsPerWeek,
          schedule: assistantJobConfig ? formatSchedule(assistantJobConfig) : 'Every hour',
          enabledUsers: totalEnabledUsers,
          source: { schedule: 'Jobs > refresh-assistant-suggestions' },
        },
        library: { totalMovies, totalSeries, totalEpisodes },
        userEstimates: costEstimationConfig,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get cost inputs')
      return reply.status(500).send({ error: 'Failed to get cost estimation inputs' })
    }
  })

  /**
   * PATCH /api/settings/cost-inputs/estimates
   */
  fastify.patch<{
    Body: {
      weeklyMoviesAdded?: number
      weeklyShowsAdded?: number
      weeklyEpisodesAdded?: number
      weeklyChatMessagesPerUser?: number
    }
  }>('/api/settings/cost-inputs/estimates', { preHandler: requireAdmin, schema: { tags: ['settings'] } }, async (request, reply) => {
    try {
      const { weeklyMoviesAdded, weeklyShowsAdded, weeklyEpisodesAdded, weeklyChatMessagesPerUser } = request.body

      const existingConfigStr = await getSystemSetting('cost_estimation_config')
      const existingConfig = existingConfigStr
        ? JSON.parse(existingConfigStr)
        : {
            weeklyMoviesAdded: 5,
            weeklyShowsAdded: 3,
            weeklyEpisodesAdded: 20,
            weeklyChatMessagesPerUser: 50,
          }

      const newConfig = {
        weeklyMoviesAdded: weeklyMoviesAdded ?? existingConfig.weeklyMoviesAdded,
        weeklyShowsAdded: weeklyShowsAdded ?? existingConfig.weeklyShowsAdded,
        weeklyEpisodesAdded: weeklyEpisodesAdded ?? existingConfig.weeklyEpisodesAdded,
        weeklyChatMessagesPerUser: weeklyChatMessagesPerUser ?? existingConfig.weeklyChatMessagesPerUser,
      }

      await setSystemSetting(
        'cost_estimation_config',
        JSON.stringify(newConfig),
        'User-configurable cost estimation preferences'
      )

      return reply.send({ config: newConfig })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update cost estimation config')
      return reply.status(500).send({ error: 'Failed to update cost estimation preferences' })
    }
  })
}
