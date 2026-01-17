import type { FastifyPluginAsync } from 'fastify'
import {
  createMediaServerProvider,
  getLibraryConfigs,
  setLibraryEnabled,
  syncLibraryConfigsFromProvider,
  getRecommendationConfig,
  updateMovieRecommendationConfig,
  updateSeriesRecommendationConfig,
  resetMovieRecommendationConfig,
  resetSeriesRecommendationConfig,
  getUserSettings,
  updateUserSettings,
  getDefaultLibraryNamePrefix,
  getEmbeddingModel,
  setEmbeddingModel,
  EMBEDDING_MODELS,
  getTextGenerationModel,
  setTextGenerationModel,
  TEXT_GENERATION_MODELS,
  getChatAssistantModel,
  setChatAssistantModel,
  CHAT_ASSISTANT_MODELS,
  getMediaServerConfig,
  setMediaServerConfig,
  testMediaServerConnection,
  getMediaServerTypes,
  getJobConfig,
  formatSchedule,
  getAiRecsOutputConfig,
  setAiRecsOutputConfig,
  getAiExplanationConfig,
  setAiExplanationConfig,
  getWatchingLibraryConfig,
  setWatchingLibraryConfig,
  getUserAiExplanationSettings,
  setUserAiExplanationOverride,
  setUserAiExplanationPreference,
  getEffectiveAiExplanationSetting,
  getLibraryTitleConfig,
  setLibraryTitleConfig,
  hasOpenAIApiKey,
  setOpenAIApiKey,
  testOpenAIConnection,
  // Multi-provider AI config
  getAIConfig,
  setAIConfig,
  getFunctionConfig,
  setFunctionConfig,
  getAICapabilitiesStatus,
  VALID_EMBEDDING_DIMENSIONS,
  checkLegacyEmbeddingsExist,
  dropLegacyEmbeddingTables,
  testProviderConnection,
  PROVIDERS,
  getProvidersForFunction,
  getModelsForFunctionWithCustom,
  getPricingForModelAsync,
  refreshPricingCache,
  getPricingCacheStatus,
  // Custom models
  addCustomModel,
  deleteCustomModel,
  // System settings
  getSystemSetting,
  setSystemSetting,
  type AIFunction,
  type ProviderType,
  getTMDbConfig,
  setTMDbConfig,
  testTMDbConnection,
  getOMDbConfig,
  setOMDbConfig,
  testOMDbConnection,
  getStudioLogosConfig,
  setStudioLogosConfig,
  getStudioLogoStats,
  type EmbeddingModel,
  type MediaServerType,
  type TextGenerationModel,
  type ChatAssistantModel,
  type MediaTypeConfig,
} from '@aperture/core'
import { requireAdmin, requireAuth } from '../plugins/auth.js'
import { query, queryOne } from '../lib/db.js'

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
    const config = await getMediaServerConfig()
    const baseUrl = config.baseUrl || ''
    const serverType = config.type || 'emby'
    const apiKey = config.apiKey || ''

    let serverId = ''
    let serverName = ''

    // Try to get server ID for deep linking
    if (baseUrl && apiKey && config.type) {
      try {
        const provider = createMediaServerProvider(config.type, baseUrl)
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
      webClientUrl: baseUrl ? `${baseUrl}/web/index.html` : '',
      isConfigured: config.isConfigured,
    })
  })

  // =========================================================================
  // Media Server Configuration (Admin)
  // =========================================================================

  /**
   * GET /api/settings/media-server/config
   * Get media server configuration (admin only)
   */
  fastify.get(
    '/api/settings/media-server/config',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const config = await getMediaServerConfig()
        const serverTypes = getMediaServerTypes()

        return reply.send({
          config: {
            type: config.type,
            baseUrl: config.baseUrl,
            // Don't expose the full API key, just indicate if it's set
            hasApiKey: !!config.apiKey,
            isConfigured: config.isConfigured,
          },
          serverTypes,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get media server config')
        return reply.status(500).send({ error: 'Failed to get media server configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/media-server/config
   * Update media server configuration
   */
  fastify.patch<{
    Body: {
      type?: MediaServerType
      baseUrl?: string
      apiKey?: string
    }
  }>('/api/settings/media-server/config', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { type, baseUrl, apiKey } = request.body

      // Validate server type
      if (type !== undefined) {
        const validTypes = getMediaServerTypes().map(
          (t: { id: MediaServerType; name: string }) => t.id
        )
        if (!validTypes.includes(type)) {
          return reply.status(400).send({
            error: `Invalid server type. Valid options: ${validTypes.join(', ')}`,
          })
        }
      }

      // Validate base URL format
      if (baseUrl !== undefined && baseUrl !== '') {
        try {
          new URL(baseUrl)
        } catch {
          return reply.status(400).send({ error: 'Invalid base URL format' })
        }
      }

      const config = await setMediaServerConfig({ type, baseUrl, apiKey })

      return reply.send({
        config: {
          type: config.type,
          baseUrl: config.baseUrl,
          hasApiKey: !!config.apiKey,
          isConfigured: config.isConfigured,
        },
        message: 'Media server configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update media server config')
      return reply.status(500).send({ error: 'Failed to update media server configuration' })
    }
  })

  /**
   * GET /api/settings/media-server/security
   * Get media server security settings (allow passwordless login)
   */
  fastify.get(
    '/api/settings/media-server/security',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const allowPasswordlessLogin = await getSystemSetting('allow_passwordless_login')
        return reply.send({
          allowPasswordlessLogin: allowPasswordlessLogin === 'true',
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get media server security settings')
        return reply.status(500).send({ error: 'Failed to get security settings' })
      }
    }
  )

  /**
   * PATCH /api/settings/media-server/security
   * Update media server security settings
   */
  fastify.patch<{
    Body: {
      allowPasswordlessLogin?: boolean
    }
  }>('/api/settings/media-server/security', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { allowPasswordlessLogin } = request.body

      if (allowPasswordlessLogin !== undefined) {
        await setSystemSetting(
          'allow_passwordless_login',
          String(allowPasswordlessLogin),
          'Allow users with no password on their media server account to log in'
        )
      }

      return reply.send({
        allowPasswordlessLogin: allowPasswordlessLogin ?? false,
        message: 'Security settings updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update media server security settings')
      return reply.status(500).send({ error: 'Failed to update security settings' })
    }
  })

  /**
   * POST /api/settings/media-server/test
   * Test media server connection with provided or saved credentials
   */
  fastify.post<{
    Body: {
      type?: MediaServerType
      baseUrl?: string
      apiKey?: string
      useSavedCredentials?: boolean
    }
  }>('/api/settings/media-server/test', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { type, baseUrl, apiKey, useSavedCredentials } = request.body

      let testType = type
      let testBaseUrl = baseUrl
      let testApiKey = apiKey

      // If using saved credentials, fetch from database
      if (useSavedCredentials) {
        const savedConfig = await getMediaServerConfig()
        testType = type || (savedConfig.type as MediaServerType) || undefined
        testBaseUrl = baseUrl || savedConfig.baseUrl || undefined
        testApiKey = apiKey || savedConfig.apiKey || undefined
      }

      // Validate required fields
      if (!testType || !testBaseUrl || !testApiKey) {
        return reply.status(400).send({ error: 'type, baseUrl, and apiKey are required' })
      }

      // Validate server type
      const validTypes = getMediaServerTypes().map((t) => t.id)
      if (!validTypes.includes(testType)) {
        return reply.status(400).send({
          error: `Invalid server type. Valid options: ${validTypes.join(', ')}`,
        })
      }

      // Test connection
      const result = await testMediaServerConnection({
        type: testType,
        baseUrl: testBaseUrl,
        apiKey: testApiKey,
      })

      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test media server connection')
      return reply.status(500).send({ error: 'Failed to test connection' })
    }
  })

  // =========================================================================
  // Genres
  // =========================================================================

  /**
   * GET /api/genres
   * Get all available movie genres from the media server
   */
  fastify.get('/api/genres', async (_request, reply) => {
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
   * This fetches both movie and TV show libraries and updates our config table
   */
  fastify.post(
    '/api/settings/libraries/sync',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const config = await getMediaServerConfig()

        if (!config.isConfigured || !config.apiKey || !config.type) {
          return reply.status(500).send({ error: 'Media server not configured' })
        }

        const provider = createMediaServerProvider(config.type, config.baseUrl || '')

        // Fetch both movie and TV show libraries
        const [movieLibraries, tvShowLibraries] = await Promise.all([
          provider.getMovieLibraries(config.apiKey),
          provider.getTvShowLibraries(config.apiKey),
        ])

        const allLibraries = [...movieLibraries, ...tvShowLibraries]

        // Sync to database
        const result = await syncLibraryConfigsFromProvider(
          allLibraries.map((lib) => ({
            id: lib.id,
            name: lib.name,
            collectionType: lib.collectionType,
          }))
        )

        // Get updated list
        const configs = await getLibraryConfigs()

        return reply.send({
          message: `Synced ${result.added} new, ${result.updated} updated (${movieLibraries.length} movies, ${tvShowLibraries.length} TV shows)`,
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
   * Get available libraries directly from media server (movies and TV shows)
   * Useful for seeing what's available before syncing
   */
  fastify.get(
    '/api/settings/libraries/available',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const config = await getMediaServerConfig()

        if (!config.isConfigured || !config.apiKey || !config.type) {
          return reply.status(500).send({ error: 'Media server not configured' })
        }

        const provider = createMediaServerProvider(config.type, config.baseUrl || '')

        // Fetch both movie and TV show libraries
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
   * Get current recommendation algorithm configuration (movies and series)
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

  // Helper function to validate config updates
  function validateConfigUpdates(updates: Partial<MediaTypeConfig>): string | null {
    const weights = [
      'similarityWeight',
      'noveltyWeight',
      'ratingWeight',
      'diversityWeight',
    ] as const
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
   * PATCH /api/settings/recommendations/movies
   * Update movie recommendation algorithm configuration
   */
  fastify.patch<{
    Body: Partial<MediaTypeConfig>
  }>(
    '/api/settings/recommendations/movies',
    { preHandler: requireAdmin },
    async (request, reply) => {
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
        return reply
          .status(500)
          .send({ error: 'Failed to update movie recommendation configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/recommendations/series
   * Update series recommendation algorithm configuration
   */
  fastify.patch<{
    Body: Partial<MediaTypeConfig>
  }>(
    '/api/settings/recommendations/series',
    { preHandler: requireAdmin },
    async (request, reply) => {
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
        return reply
          .status(500)
          .send({ error: 'Failed to update series recommendation configuration' })
      }
    }
  )

  /**
   * POST /api/settings/recommendations/movies/reset
   * Reset movie recommendation configuration to defaults
   */
  fastify.post(
    '/api/settings/recommendations/movies/reset',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const config = await resetMovieRecommendationConfig()
        return reply.send({ config, message: 'Movie configuration reset to defaults' })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to reset movie recommendation config')
        return reply
          .status(500)
          .send({ error: 'Failed to reset movie recommendation configuration' })
      }
    }
  )

  /**
   * POST /api/settings/recommendations/series/reset
   * Reset series recommendation configuration to defaults
   */
  fastify.post(
    '/api/settings/recommendations/series/reset',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const config = await resetSeriesRecommendationConfig()
        return reply.send({ config, message: 'Series configuration reset to defaults' })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to reset series recommendation config')
        return reply
          .status(500)
          .send({ error: 'Failed to reset series recommendation configuration' })
      }
    }
  )

  // =========================================================================
  // Cost Inputs (for cost estimator)
  // =========================================================================

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

  /**
   * GET /api/settings/cost-inputs
   * Get all values needed for cost estimation with source information
   */
  fastify.get('/api/settings/cost-inputs', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      // Get recommendation config
      const recConfig = await getRecommendationConfig()

      // Get all AI-related job schedules
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

      // Get user's cost estimation preferences
      const costEstimationConfigStr = await getSystemSetting('cost_estimation_config')
      const costEstimationConfig = costEstimationConfigStr
        ? JSON.parse(costEstimationConfigStr)
        : {
            weeklyMoviesAdded: 5,
            weeklyShowsAdded: 3,
            weeklyEpisodesAdded: 20,
            weeklyChatMessagesPerUser: 50,
          }

      // Get enabled user counts, total library counts, and pending counts
      const { query, getCurrentEmbeddingDimensions, getFunctionConfig } = await import('@aperture/core')
      
      // Get current embedding config for determining which dimension table to check
      const embeddingConfig = await getFunctionConfig('embeddings')
      const dims = await getCurrentEmbeddingDimensions()
      const modelName = embeddingConfig ? `${embeddingConfig.provider}:${embeddingConfig.model}` : null
      
      // Build queries based on current model's dimension table (or show all as pending if not configured)
      const movieEmbedTable = dims ? `embeddings_${dims}` : 'embeddings_3072' // fallback for unconfigured state
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

      // Calculate runs per week for each job
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
        : 168 // hourly = 168/week

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
            source: {
              schedule: 'Jobs > generate-movie-embeddings',
            },
          },
          series: {
            runsPerWeek: seriesEmbeddingsRunsPerWeek,
            schedule: seriesEmbeddingsJobConfig ? formatSchedule(seriesEmbeddingsJobConfig) : 'Daily at 3:00 AM',
            pendingItems: pendingSeriesEmbeddings,
            pendingEpisodes: pendingEpisodeEmbeddings,
            source: {
              schedule: 'Jobs > generate-series-embeddings',
            },
          },
        },
        assistant: {
          runsPerWeek: assistantRunsPerWeek,
          schedule: assistantJobConfig ? formatSchedule(assistantJobConfig) : 'Every hour',
          enabledUsers: totalEnabledUsers,
          source: {
            schedule: 'Jobs > refresh-assistant-suggestions',
          },
        },
        // Library totals for one-time embedding cost calculation
        library: {
          totalMovies,
          totalSeries,
          totalEpisodes,
        },
        // User-configurable estimates for recurring cost calculation
        userEstimates: costEstimationConfig,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get cost inputs')
      return reply.status(500).send({ error: 'Failed to get cost estimation inputs' })
    }
  })

  /**
   * PATCH /api/settings/cost-inputs/estimates
   * Update user-configurable cost estimation preferences
   */
  fastify.patch<{
    Body: {
      weeklyMoviesAdded?: number
      weeklyShowsAdded?: number
      weeklyEpisodesAdded?: number
      weeklyChatMessagesPerUser?: number
    }
  }>('/api/settings/cost-inputs/estimates', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { weeklyMoviesAdded, weeklyShowsAdded, weeklyEpisodesAdded, weeklyChatMessagesPerUser } = request.body

      // Get existing config
      const existingConfigStr = await getSystemSetting('cost_estimation_config')
      const existingConfig = existingConfigStr
        ? JSON.parse(existingConfigStr)
        : {
            weeklyMoviesAdded: 5,
            weeklyShowsAdded: 3,
            weeklyEpisodesAdded: 20,
            weeklyChatMessagesPerUser: 50,
          }

      // Merge updates
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
      seriesLibraryName?: string | null
    }
  }>('/api/settings/user', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { libraryName, seriesLibraryName } = request.body

      // Validate library names if provided
      const validateLibraryName = (name: unknown, label: string): string | null => {
        if (name === undefined || name === null) return null
        if (typeof name !== 'string' || name.length > 100) {
          return `${label} must be a string under 100 characters`
        }
        if (/[<>:"/\\|?*]/.test(name)) {
          return `${label} contains invalid characters`
        }
        return null
      }

      const movieNameError = validateLibraryName(libraryName, 'Movies library name')
      if (movieNameError) {
        return reply.status(400).send({ error: movieNameError })
      }

      const seriesNameError = validateLibraryName(seriesLibraryName, 'Series library name')
      if (seriesNameError) {
        return reply.status(400).send({ error: seriesNameError })
      }

      const settings = await updateUserSettings(userId, { libraryName, seriesLibraryName })

      return reply.send({
        settings,
        message: 'Settings updated successfully',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update user settings')
      return reply.status(500).send({ error: 'Failed to update user settings' })
    }
  })

  // =========================================================================
  // Embedding Model Settings (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/embedding-model
   * Get current embedding model configuration with cost estimates
   */
  fastify.get(
    '/api/settings/embedding-model',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const currentModel = await getEmbeddingModel()

        // Get movie count for cost estimation (only from enabled libraries)
        const { query, queryOne } = await import('@aperture/core')

        // Check if any library configs exist
        const configCheck = await queryOne<{ count: string }>('SELECT COUNT(*) FROM library_config')
        const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0

        const countResult = await query<{ count: string }>(
          hasLibraryConfigs
            ? `SELECT COUNT(*) as count FROM movies m
               WHERE EXISTS (
                 SELECT 1 FROM library_config lc
                 WHERE lc.provider_library_id = m.provider_library_id
                   AND lc.is_enabled = true
               )`
            : 'SELECT COUNT(*) as count FROM movies'
        )
        const movieCount = parseInt(countResult.rows[0]?.count || '0', 10)

        // Get embedding count to show current state (from all dimension tables)
        const embeddingUnions = VALID_EMBEDDING_DIMENSIONS.map(d => 
          `SELECT COUNT(*)::int as count, model FROM embeddings_${d} GROUP BY model`
        ).join(' UNION ALL ')
        const embeddingResult = await query<{ count: number; model: string }>(
          `SELECT SUM(count)::int as count, model FROM (${embeddingUnions}) t GROUP BY model`
        )
        const embeddingsByModel = embeddingResult.rows.reduce(
          (acc, row) => {
            acc[row.model] = row.count
            return acc
          },
          {} as Record<string, number>
        )

        return reply.send({
          currentModel,
          availableModels: EMBEDDING_MODELS,
          movieCount,
          embeddingsByModel,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get embedding model')
        return reply.status(500).send({ error: 'Failed to get embedding model configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/embedding-model
   * Update embedding model
   */
  fastify.patch<{
    Body: { model: string }
  }>('/api/settings/embedding-model', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { model } = request.body

      // Validate model
      const validModels = EMBEDDING_MODELS.map((m) => m.id)
      if (!validModels.includes(model as EmbeddingModel)) {
        return reply.status(400).send({
          error: `Invalid model. Valid options: ${validModels.join(', ')}`,
        })
      }

      await setEmbeddingModel(model as EmbeddingModel)

      return reply.send({
        model,
        message:
          'Embedding model updated. Delete existing embeddings and regenerate for the change to take effect.',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update embedding model')
      return reply.status(500).send({ error: 'Failed to update embedding model' })
    }
  })

  // =========================================================================
  // Text Generation Model Settings (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/text-generation-model
   * Get current text generation model configuration with cost estimates
   */
  fastify.get(
    '/api/settings/text-generation-model',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const currentModel = await getTextGenerationModel()

        // Get counts for cost estimation
        const { query } = await import('@aperture/core')

        // Get enabled users count for movie and series
        const enabledUsersResult = await query<{
          movies_enabled_count: string
          series_enabled_count: string
        }>(`
          SELECT 
            COUNT(*) FILTER (WHERE movies_enabled = true) as movies_enabled_count,
            COUNT(*) FILTER (WHERE series_enabled = true) as series_enabled_count
          FROM users
        `)
        const moviesEnabledUsers = parseInt(
          enabledUsersResult.rows[0]?.movies_enabled_count || '0',
          10
        )
        const seriesEnabledUsers = parseInt(
          enabledUsersResult.rows[0]?.series_enabled_count || '0',
          10
        )

        // Get movie/series counts from enabled libraries
        const movieCountResult = await query<{ count: string }>(`
          SELECT COUNT(*) as count FROM movies m
          WHERE EXISTS (
            SELECT 1 FROM library_config lc
            WHERE lc.provider_library_id = m.provider_library_id
              AND lc.is_enabled = true
          )
        `)
        const movieCount = parseInt(movieCountResult.rows[0]?.count || '0', 10)

        const seriesCountResult = await query<{ count: string }>(`
          SELECT COUNT(*) as count FROM series s
          WHERE EXISTS (
            SELECT 1 FROM library_config lc
            WHERE lc.provider_library_id = s.provider_library_id
              AND lc.is_enabled = true
          )
        `)
        const seriesCount = parseInt(seriesCountResult.rows[0]?.count || '0', 10)

        return reply.send({
          currentModel,
          availableModels: TEXT_GENERATION_MODELS,
          stats: {
            moviesEnabledUsers,
            seriesEnabledUsers,
            movieCount,
            seriesCount,
          },
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get text generation model')
        return reply
          .status(500)
          .send({ error: 'Failed to get text generation model configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/text-generation-model
   * Update text generation model
   */
  fastify.patch<{
    Body: { model: string }
  }>(
    '/api/settings/text-generation-model',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { model } = request.body

        // Validate model
        const validModels = TEXT_GENERATION_MODELS.map((m) => m.id)
        if (!validModels.includes(model as TextGenerationModel)) {
          return reply.status(400).send({
            error: `Invalid model. Valid options: ${validModels.join(', ')}`,
          })
        }

        await setTextGenerationModel(model as TextGenerationModel)

        return reply.send({
          model,
          message:
            'Text generation model updated. Future recommendation runs will use the new model.',
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to update text generation model')
        return reply.status(500).send({ error: 'Failed to update text generation model' })
      }
    }
  )

  // =========================================================================
  // Chat Assistant Model Settings (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/chat-assistant-model
   * Get current chat assistant model configuration
   */
  fastify.get(
    '/api/settings/chat-assistant-model',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const currentModel = await getChatAssistantModel()

        return reply.send({
          currentModel,
          availableModels: CHAT_ASSISTANT_MODELS,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get chat assistant model config')
        return reply.status(500).send({ error: 'Failed to get chat assistant model configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/chat-assistant-model
   * Update chat assistant model
   */
  fastify.patch<{
    Body: { model: string }
  }>('/api/settings/chat-assistant-model', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { model } = request.body

      // Validate model
      const validModels = CHAT_ASSISTANT_MODELS.map((m) => m.id)
      if (!validModels.includes(model as ChatAssistantModel)) {
        return reply.status(400).send({
          error: `Invalid model. Valid options: ${validModels.join(', ')}`,
        })
      }

      await setChatAssistantModel(model as ChatAssistantModel)

      return reply.send({
        model,
        message: 'Chat assistant model updated. Changes take effect immediately.',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update chat assistant model')
      return reply.status(500).send({ error: 'Failed to update chat assistant model' })
    }
  })

  // =========================================================================
  // Top Picks Configuration (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/top-picks
   * Get current Top Picks configuration including library info
   */
  fastify.get('/api/settings/top-picks', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const { getTopPicksConfig, getTopPicksLibraries } = await import('@aperture/core')
      const config = await getTopPicksConfig()

      // Try to get library info (may fail if libraries don't exist yet)
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
   * Update Top Picks configuration
   */
  fastify.patch<{
    Body: {
      isEnabled?: boolean
      // Movies-specific settings
      moviesPopularitySource?: 'local' | 'mdblist' | 'hybrid'
      moviesTimeWindowDays?: number
      moviesMinUniqueViewers?: number
      moviesUseAllMatches?: boolean
      moviesCount?: number
      // Series-specific settings
      seriesPopularitySource?: 'local' | 'mdblist' | 'hybrid'
      seriesTimeWindowDays?: number
      seriesMinUniqueViewers?: number
      seriesUseAllMatches?: boolean
      seriesCount?: number
      // Shared weights
      uniqueViewersWeight?: number
      playCountWeight?: number
      completionWeight?: number
      refreshCron?: string
      moviesLibraryName?: string
      seriesLibraryName?: string
      // Output format settings
      moviesUseSymlinks?: boolean
      seriesUseSymlinks?: boolean
      // Movies output modes
      moviesLibraryEnabled?: boolean
      moviesCollectionEnabled?: boolean
      moviesPlaylistEnabled?: boolean
      // Series output modes
      seriesLibraryEnabled?: boolean
      seriesCollectionEnabled?: boolean
      seriesPlaylistEnabled?: boolean
      // Collection/Playlist names
      moviesCollectionName?: string
      seriesCollectionName?: string
      // MDBList list selections
      mdblistMoviesListId?: number | null
      mdblistSeriesListId?: number | null
      mdblistMoviesListName?: string | null
      mdblistSeriesListName?: string | null
      // MDBList sort order
      mdblistMoviesSort?: string
      mdblistSeriesSort?: string
      // Hybrid weights
      hybridLocalWeight?: number
      hybridMdblistWeight?: number
    }
  }>('/api/settings/top-picks', { preHandler: requireAdmin }, async (request, reply) => {
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
   * Reset Top Picks configuration to defaults
   */
  fastify.post(
    '/api/settings/top-picks/reset',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const { resetTopPicksConfig } = await import('@aperture/core')
        const config = await resetTopPicksConfig()
        return reply.send(config)
      } catch (err) {
        fastify.log.error({ err }, 'Failed to reset Top Picks config')
        return reply.status(500).send({ error: 'Failed to reset Top Picks configuration' })
      }
    }
  )

  /**
   * POST /api/settings/top-picks/preview
   * Get preview counts for Top Picks settings (how many items would qualify with given settings)
   */
  fastify.post<{
    Body: {
      moviesMinViewers: number
      moviesTimeWindowDays: number
      seriesMinViewers: number
      seriesTimeWindowDays: number
    }
  }>(
    '/api/settings/top-picks/preview',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { getTopPicksPreviewCounts } = await import('@aperture/core')
        const result = await getTopPicksPreviewCounts(request.body)
        return reply.send(result)
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get Top Picks preview counts')
        return reply.status(500).send({ error: 'Failed to get preview counts' })
      }
    }
  )

  /**
   * POST /api/settings/top-picks/refresh
   * Trigger a manual refresh of Top Picks
   */
  fastify.post(
    '/api/settings/top-picks/refresh',
    { preHandler: requireAdmin },
    async (_request, reply) => {
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
    }
  )

  // =========================================================================
  // AI Recommendations Output Format Configuration (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/ai-recs/output
   * Get AI recommendations output format configuration
   */
  fastify.get(
    '/api/settings/ai-recs/output',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const config = await getAiRecsOutputConfig()
        return reply.send(config)
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get AI recs output format config')
        return reply
          .status(500)
          .send({ error: 'Failed to get AI recommendations output format configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/ai-recs/output
   * Update AI recommendations output format configuration
   */
  fastify.patch<{
    Body: {
      moviesUseSymlinks?: boolean
      seriesUseSymlinks?: boolean
    }
  }>('/api/settings/ai-recs/output', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const config = await setAiRecsOutputConfig(request.body)
      return reply.send({
        ...config,
        message: 'AI recommendations output format configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update AI recs output format config')
      return reply
        .status(500)
        .send({ error: 'Failed to update AI recommendations output format configuration' })
    }
  })

  /**
   * GET /api/settings/output-format (deprecated - for backwards compatibility)
   * Redirects to new endpoint structure
   */
  fastify.get(
    '/api/settings/output-format',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const config = await getAiRecsOutputConfig()
        return reply.send(config)
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get output format config')
        return reply.status(500).send({ error: 'Failed to get output format configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/output-format (deprecated - for backwards compatibility)
   */
  fastify.patch<{
    Body: {
      moviesUseSymlinks?: boolean
      seriesUseSymlinks?: boolean
    }
  }>('/api/settings/output-format', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const config = await setAiRecsOutputConfig(request.body)
      return reply.send({
        ...config,
        message: 'Output format configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update output format config')
      return reply.status(500).send({ error: 'Failed to update output format configuration' })
    }
  })

  // =========================================================================
  // AI Explanation Settings (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/ai-explanation
   * Get global AI explanation configuration
   */
  fastify.get(
    '/api/settings/ai-explanation',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const config = await getAiExplanationConfig()
        return reply.send(config)
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get AI explanation config')
        return reply.status(500).send({ error: 'Failed to get AI explanation configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/ai-explanation
   * Update global AI explanation configuration
   */
  fastify.patch<{
    Body: {
      enabled?: boolean
      userOverrideAllowed?: boolean
    }
  }>('/api/settings/ai-explanation', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const config = await setAiExplanationConfig(request.body)
      return reply.send({
        ...config,
        message: 'AI explanation configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update AI explanation config')
      return reply.status(500).send({ error: 'Failed to update AI explanation configuration' })
    }
  })

  /**
   * GET /api/settings/ai-explanation/user/:userId
   * Get a specific user's AI explanation settings (admin only)
   */
  fastify.get<{
    Params: { userId: string }
  }>(
    '/api/settings/ai-explanation/user/:userId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { userId } = request.params
        const settings = await getUserAiExplanationSettings(userId)
        const effective = await getEffectiveAiExplanationSetting(userId)
        const globalConfig = await getAiExplanationConfig()

        return reply.send({
          ...settings,
          effectiveValue: effective,
          globalConfig,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get user AI explanation settings')
        return reply.status(500).send({ error: 'Failed to get user AI explanation settings' })
      }
    }
  )

  /**
   * PATCH /api/settings/ai-explanation/user/:userId
   * Update a specific user's AI explanation override permission (admin only)
   */
  fastify.patch<{
    Params: { userId: string }
    Body: {
      overrideAllowed: boolean
    }
  }>(
    '/api/settings/ai-explanation/user/:userId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      try {
        const { userId } = request.params
        const { overrideAllowed } = request.body

        if (typeof overrideAllowed !== 'boolean') {
          return reply.status(400).send({ error: 'overrideAllowed must be a boolean' })
        }

        await setUserAiExplanationOverride(userId, overrideAllowed)
        const settings = await getUserAiExplanationSettings(userId)
        const effective = await getEffectiveAiExplanationSetting(userId)

        return reply.send({
          ...settings,
          effectiveValue: effective,
          message: `AI explanation override ${overrideAllowed ? 'enabled' : 'disabled'} for user`,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to update user AI explanation settings')
        return reply.status(500).send({ error: 'Failed to update user AI explanation settings' })
      }
    }
  )

  // =========================================================================
  // User AI Explanation Preference (User Self-Service)
  // =========================================================================

  /**
   * GET /api/settings/user/ai-explanation
   * Get current user's AI explanation preference
   */
  fastify.get('/api/settings/user/ai-explanation', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const settings = await getUserAiExplanationSettings(userId)
      const effective = await getEffectiveAiExplanationSetting(userId)
      const globalConfig = await getAiExplanationConfig()

      return reply.send({
        overrideAllowed: settings.overrideAllowed,
        userPreference: settings.enabled,
        effectiveValue: effective,
        globalEnabled: globalConfig.enabled,
        canOverride: globalConfig.userOverrideAllowed && settings.overrideAllowed,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get user AI explanation preference')
      return reply.status(500).send({ error: 'Failed to get AI explanation preference' })
    }
  })

  /**
   * PATCH /api/settings/user/ai-explanation
   * Update current user's AI explanation preference (only if override is allowed)
   */
  fastify.patch<{
    Body: {
      enabled: boolean | null
    }
  }>('/api/settings/user/ai-explanation', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { enabled } = request.body

      if (enabled !== null && typeof enabled !== 'boolean') {
        return reply.status(400).send({ error: 'enabled must be a boolean or null' })
      }

      // Check if user is allowed to override
      const settings = await getUserAiExplanationSettings(userId)
      const globalConfig = await getAiExplanationConfig()

      if (!globalConfig.userOverrideAllowed || !settings.overrideAllowed) {
        return reply.status(403).send({
          error: 'AI explanation override is not enabled for your account',
        })
      }

      await setUserAiExplanationPreference(userId, enabled)
      const effective = await getEffectiveAiExplanationSetting(userId)

      return reply.send({
        userPreference: enabled,
        effectiveValue: effective,
        message:
          enabled === null
            ? 'AI explanation preference reset to global default'
            : `AI explanations ${enabled ? 'enabled' : 'disabled'}`,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update user AI explanation preference')
      return reply.status(500).send({ error: 'Failed to update AI explanation preference' })
    }
  })

  // =========================================================================
  // Watching Library Settings (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/watching
   * Get watching library configuration
   */
  fastify.get('/api/settings/watching', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const config = await getWatchingLibraryConfig()
      return reply.send(config)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get watching library config')
      return reply.status(500).send({ error: 'Failed to get watching library configuration' })
    }
  })

  /**
   * PATCH /api/settings/watching
   * Update watching library configuration
   */
  fastify.patch<{
    Body: {
      enabled?: boolean
      useSymlinks?: boolean
    }
  }>('/api/settings/watching', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const config = await setWatchingLibraryConfig(request.body)
      return reply.send({
        ...config,
        message: 'Watching library configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update watching library config')
      return reply.status(500).send({ error: 'Failed to update watching library configuration' })
    }
  })

  // =========================================================================
  // User Include Watched Preference
  // =========================================================================

  /**
   * GET /api/settings/user/include-watched
   * Get current user's include watched preference
   */
  fastify.get('/api/settings/user/include-watched', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const result = await queryOne<{ include_watched: boolean }>(
        `SELECT COALESCE(include_watched, false) as include_watched FROM user_preferences WHERE user_id = $1`,
        [userId]
      )

      return reply.send({
        includeWatched: result?.include_watched ?? false,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get include watched preference')
      return reply.status(500).send({ error: 'Failed to get include watched preference' })
    }
  })

  /**
   * PUT /api/settings/user/include-watched
   * Update current user's include watched preference
   */
  fastify.put<{
    Body: {
      includeWatched: boolean
    }
  }>('/api/settings/user/include-watched', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { includeWatched } = request.body
      if (typeof includeWatched !== 'boolean') {
        return reply.status(400).send({ error: 'includeWatched must be a boolean' })
      }

      // Upsert the preference
      await query(
        `INSERT INTO user_preferences (user_id, include_watched)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET include_watched = EXCLUDED.include_watched`,
        [userId, includeWatched]
      )

      return reply.send({
        includeWatched,
        message: 'Include watched preference saved',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update include watched preference')
      return reply.status(500).send({ error: 'Failed to update include watched preference' })
    }
  })

  // =========================================================================
  // User Dislike Behavior Preference
  // =========================================================================

  /**
   * GET /api/settings/user/dislike-behavior
   * Get current user's dislike behavior preference
   */
  fastify.get('/api/settings/user/dislike-behavior', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const result = await queryOne<{ dislike_behavior: string }>(
        `SELECT COALESCE(dislike_behavior, 'exclude') as dislike_behavior FROM user_preferences WHERE user_id = $1`,
        [userId]
      )

      return reply.send({
        dislikeBehavior: result?.dislike_behavior || 'exclude',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get dislike behavior preference')
      return reply.status(500).send({ error: 'Failed to get dislike behavior preference' })
    }
  })

  /**
   * PATCH /api/settings/user/dislike-behavior
   * Update current user's dislike behavior preference
   */
  fastify.patch<{
    Body: {
      dislikeBehavior: 'exclude' | 'penalize'
    }
  }>('/api/settings/user/dislike-behavior', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { dislikeBehavior } = request.body
      if (!dislikeBehavior || !['exclude', 'penalize'].includes(dislikeBehavior)) {
        return reply.status(400).send({ error: 'dislikeBehavior must be "exclude" or "penalize"' })
      }

      // Upsert the preference
      await query(
        `INSERT INTO user_preferences (user_id, dislike_behavior)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET dislike_behavior = EXCLUDED.dislike_behavior`,
        [userId, dislikeBehavior]
      )

      return reply.send({
        dislikeBehavior,
        message: 'Dislike behavior preference saved',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update dislike behavior preference')
      return reply.status(500).send({ error: 'Failed to update dislike behavior preference' })
    }
  })

  // =========================================================================
  // Similarity Graph Preferences (User)
  // =========================================================================

  /**
   * GET /api/settings/user/similarity-prefs
   * Get current user's similarity graph preferences
   */
  fastify.get('/api/settings/user/similarity-prefs', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const result = await queryOne<{
        similarity_full_franchise: boolean
        similarity_hide_watched: boolean
      }>(
        `SELECT 
           COALESCE(similarity_full_franchise, false) as similarity_full_franchise,
           COALESCE(similarity_hide_watched, true) as similarity_hide_watched
         FROM user_preferences WHERE user_id = $1`,
        [userId]
      )

      return reply.send({
        fullFranchiseMode: result?.similarity_full_franchise ?? false,
        hideWatched: result?.similarity_hide_watched ?? true,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get similarity preferences')
      return reply.status(500).send({ error: 'Failed to get similarity preferences' })
    }
  })

  /**
   * PATCH /api/settings/user/similarity-prefs
   * Update current user's similarity graph preferences
   */
  fastify.patch<{
    Body: {
      fullFranchiseMode?: boolean
      hideWatched?: boolean
    }
  }>('/api/settings/user/similarity-prefs', async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { fullFranchiseMode, hideWatched } = request.body

      // Build dynamic update
      const updates: string[] = []
      const values: (string | boolean)[] = [userId]
      let paramIdx = 2

      if (fullFranchiseMode !== undefined) {
        updates.push(`similarity_full_franchise = $${paramIdx++}`)
        values.push(fullFranchiseMode)
      }
      if (hideWatched !== undefined) {
        updates.push(`similarity_hide_watched = $${paramIdx++}`)
        values.push(hideWatched)
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No preferences to update' })
      }

      // Upsert the preference(s)
      await query(
        `INSERT INTO user_preferences (user_id, ${updates.map(u => u.split(' = ')[0]).join(', ')})
         VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}`,
        values
      )

      return reply.send({
        message: 'Similarity preferences saved',
        fullFranchiseMode,
        hideWatched,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update similarity preferences')
      return reply.status(500).send({ error: 'Failed to update similarity preferences' })
    }
  })

  // =========================================================================
  // Library Title Templates (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/library-titles
   * Get library title template configuration
   */
  fastify.get(
    '/api/settings/library-titles',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const config = await getLibraryTitleConfig()
        return reply.send({
          ...config,
          supportedMergeTags: [
            { tag: '{{username}}', description: "User's display name" },
            { tag: '{{type}}', description: 'Media type (Movies or TV Series)' },
            { tag: '{{count}}', description: 'Number of recommendations (optional)' },
            { tag: '{{date}}', description: 'Date of last recommendation run (optional)' },
          ],
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get library title config')
        return reply.status(500).send({ error: 'Failed to get library title configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/library-titles
   * Update library title template configuration
   */
  fastify.patch<{
    Body: {
      moviesTemplate?: string
      seriesTemplate?: string
    }
  }>('/api/settings/library-titles', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { moviesTemplate, seriesTemplate } = request.body

      // Validate templates
      if (moviesTemplate !== undefined && typeof moviesTemplate !== 'string') {
        return reply.status(400).send({ error: 'moviesTemplate must be a string' })
      }
      if (seriesTemplate !== undefined && typeof seriesTemplate !== 'string') {
        return reply.status(400).send({ error: 'seriesTemplate must be a string' })
      }

      // Check for invalid characters in templates
      const invalidChars = /[<>:"/\\|?*]/
      if (moviesTemplate && invalidChars.test(moviesTemplate.replace(/\{\{[^}]+\}\}/g, ''))) {
        return reply.status(400).send({
          error: 'moviesTemplate contains invalid characters for file paths',
        })
      }
      if (seriesTemplate && invalidChars.test(seriesTemplate.replace(/\{\{[^}]+\}\}/g, ''))) {
        return reply.status(400).send({
          error: 'seriesTemplate contains invalid characters for file paths',
        })
      }

      const config = await setLibraryTitleConfig(request.body)
      return reply.send({
        ...config,
        message: 'Library title templates updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update library title config')
      return reply.status(500).send({ error: 'Failed to update library title configuration' })
    }
  })

  // =========================================================================
  // STRM Libraries (Aperture-created recommendation libraries)
  // =========================================================================

  /**
   * GET /api/settings/strm-libraries
   * Get all STRM libraries created by Aperture (user recommendation libraries)
   */
  fastify.get(
    '/api/settings/strm-libraries',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const result = await query<{
          id: string
          user_id: string | null
          channel_id: string | null
          name: string
          path: string
          provider_library_id: string | null
          is_active: boolean
          media_type: string
          file_count: number | null
          last_synced_at: Date | null
          created_at: Date
        }>(
          `SELECT sl.id, sl.user_id, sl.channel_id, sl.name, sl.path, 
                sl.provider_library_id, sl.is_active, sl.media_type,
                sl.file_count, sl.last_synced_at, sl.created_at,
                u.username as user_name, u.display_name as user_display_name
         FROM strm_libraries sl
         LEFT JOIN users u ON sl.user_id = u.id
         WHERE sl.is_active = true
         ORDER BY sl.created_at DESC`
        )

        const libraries = result.rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          userName: row.user_id
            ? (row as unknown as { user_display_name: string | null; user_name: string })
                .user_display_name || (row as unknown as { user_name: string }).user_name
            : null,
          channelId: row.channel_id,
          name: row.name,
          path: row.path,
          providerLibraryId: row.provider_library_id,
          isActive: row.is_active,
          mediaType: row.media_type,
          fileCount: row.file_count,
          lastSyncedAt: row.last_synced_at,
          createdAt: row.created_at,
        }))

        return reply.send({ libraries })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get STRM libraries')
        return reply.status(500).send({ error: 'Failed to get STRM libraries' })
      }
    }
  )

  // =========================================================================
  // OpenAI API Key Settings (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/openai
   * Get OpenAI configuration status
   */
  fastify.get('/api/settings/openai', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const hasKey = await hasOpenAIApiKey()
      return reply.send({
        hasApiKey: hasKey,
        isConfigured: hasKey,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get OpenAI config')
      return reply.status(500).send({ error: 'Failed to get OpenAI configuration' })
    }
  })

  /**
   * PATCH /api/settings/openai
   * Set OpenAI API key
   */
  fastify.patch<{
    Body: { apiKey: string }
  }>('/api/settings/openai', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { apiKey } = request.body

      if (!apiKey || typeof apiKey !== 'string') {
        return reply.status(400).send({ error: 'API key is required' })
      }

      // Validate the key format (OpenAI keys start with sk-)
      if (!apiKey.startsWith('sk-')) {
        return reply
          .status(400)
          .send({ error: 'Invalid API key format. OpenAI keys start with sk-' })
      }

      // Save the key
      await setOpenAIApiKey(apiKey)

      return reply.send({
        success: true,
        hasApiKey: true,
        isConfigured: true,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save OpenAI API key')
      return reply.status(500).send({ error: 'Failed to save OpenAI API key' })
    }
  })

  /**
   * POST /api/settings/openai/test
   * Test OpenAI API connection
   */
  fastify.post(
    '/api/settings/openai/test',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      try {
        const result = await testOpenAIConnection()
        return reply.send(result)
      } catch (err) {
        fastify.log.error({ err }, 'Failed to test OpenAI connection')
        return reply.status(500).send({ error: 'Failed to test OpenAI connection' })
      }
    }
  )

  // =========================================================================
  // Multi-Provider AI Configuration (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/ai
   * Get full AI configuration for all functions
   */
  fastify.get('/api/settings/ai', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const config = await getAIConfig()
      const capabilities = await getAICapabilitiesStatus()
      return reply.send({ config, capabilities })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI config')
      return reply.status(500).send({ error: 'Failed to get AI configuration' })
    }
  })

  /**
   * PUT /api/settings/ai
   * Update full AI configuration
   */
  fastify.put<{
    Body: {
      embeddings?: { provider: ProviderType; model: string; apiKey?: string; baseUrl?: string }
      chat?: { provider: ProviderType; model: string; apiKey?: string; baseUrl?: string }
      textGeneration?: { provider: ProviderType; model: string; apiKey?: string; baseUrl?: string }
      exploration?: { provider: ProviderType; model: string; apiKey?: string; baseUrl?: string }
    }
  }>('/api/settings/ai', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const currentConfig = await getAIConfig()
      const updates = request.body

      // Merge updates with current config
      const newConfig = {
        embeddings: updates.embeddings
          ? { ...currentConfig.embeddings, ...updates.embeddings }
          : currentConfig.embeddings,
        chat: updates.chat ? { ...currentConfig.chat, ...updates.chat } : currentConfig.chat,
        textGeneration: updates.textGeneration
          ? { ...currentConfig.textGeneration, ...updates.textGeneration }
          : currentConfig.textGeneration,
        exploration: updates.exploration
          ? { ...currentConfig.exploration, ...updates.exploration }
          : currentConfig.exploration,
      }

      await setAIConfig(newConfig)
      const capabilities = await getAICapabilitiesStatus()
      return reply.send({ config: newConfig, capabilities })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update AI config')
      return reply.status(500).send({ error: 'Failed to update AI configuration' })
    }
  })

  /**
   * GET /api/settings/ai/capabilities
   * Get AI capabilities status for each function (Admin - full details)
   */
  fastify.get('/api/settings/ai/capabilities', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const capabilities = await getAICapabilitiesStatus()
      return reply.send(capabilities)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI capabilities')
      return reply.status(500).send({ error: 'Failed to get AI capabilities' })
    }
  })

  /**
   * GET /api/settings/ai/features
   * Get AI feature availability status (User accessible - no sensitive info)
   */
  fastify.get('/api/settings/ai/features', { preHandler: requireAuth }, async (_request, reply) => {
    try {
      const capabilities = await getAICapabilitiesStatus()
      
      // Return only feature availability without sensitive config details
      return reply.send({
        embeddings: {
          configured: capabilities.embeddings.configured,
          supportsEmbeddings: capabilities.embeddings.capabilities?.supportsEmbeddings ?? false,
        },
        chat: {
          configured: capabilities.chat.configured,
          supportsToolCalling: capabilities.chat.capabilities?.supportsToolCalling ?? false,
          supportsStreaming: capabilities.chat.capabilities?.supportsToolStreaming ?? false,
        },
        textGeneration: {
          configured: capabilities.textGeneration.configured,
        },
        exploration: {
          configured: capabilities.exploration.configured,
        },
        features: {
          semanticSearch: capabilities.embeddings.configured,
          chatWithTools: capabilities.chat.configured && (capabilities.chat.capabilities?.supportsToolCalling ?? false),
          basicChat: capabilities.chat.configured,
          recommendations: capabilities.embeddings.configured && capabilities.textGeneration.configured,
          explanations: capabilities.textGeneration.configured,
          exploration: capabilities.exploration.configured && capabilities.embeddings.configured,
        },
        isFullyConfigured: capabilities.isFullyConfigured,
        isAnyConfigured: capabilities.isAnyConfigured,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI features')
      return reply.status(500).send({ error: 'Failed to get AI features' })
    }
  })

  /**
   * GET /api/settings/ai/credentials
   * Get saved credentials for all providers (API keys are masked)
   */
  fastify.get('/api/settings/ai/credentials', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const credentialsJson = await getSystemSetting('ai_provider_credentials')
      const credentials = credentialsJson ? JSON.parse(credentialsJson) : {}
      
      // Mask API keys for security
      const maskedCredentials: Record<string, { hasApiKey: boolean; baseUrl?: string }> = {}
      for (const [provider, creds] of Object.entries(credentials)) {
        const c = creds as { apiKey?: string; baseUrl?: string }
        maskedCredentials[provider] = {
          hasApiKey: !!c.apiKey,
          baseUrl: c.baseUrl,
        }
      }
      
      return reply.send({ credentials: maskedCredentials })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI credentials')
      return reply.status(500).send({ error: 'Failed to get AI credentials' })
    }
  })

  /**
   * GET /api/settings/ai/credentials/:provider
   * Get credentials for a specific provider (includes API key for form population)
   */
  fastify.get<{ Params: { provider: string } }>('/api/settings/ai/credentials/:provider', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { provider } = request.params
      const credentialsJson = await getSystemSetting('ai_provider_credentials')
      const credentials = credentialsJson ? JSON.parse(credentialsJson) : {}
      const providerCreds = credentials[provider] || {}
      
      return reply.send({
        provider,
        apiKey: providerCreds.apiKey || '',
        baseUrl: providerCreds.baseUrl || '',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get provider credentials')
      return reply.status(500).send({ error: 'Failed to get provider credentials' })
    }
  })

  /**
   * PUT /api/settings/ai/credentials/:provider
   * Save credentials for a specific provider
   */
  fastify.put<{ 
    Params: { provider: string }
    Body: { apiKey?: string; baseUrl?: string }
  }>('/api/settings/ai/credentials/:provider', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { provider } = request.params
      const { apiKey, baseUrl } = request.body
      
      const credentialsJson = await getSystemSetting('ai_provider_credentials')
      const credentials = credentialsJson ? JSON.parse(credentialsJson) : {}
      
      // Update credentials for this provider
      credentials[provider] = {
        ...(credentials[provider] || {}),
        ...(apiKey !== undefined && { apiKey }),
        ...(baseUrl !== undefined && { baseUrl }),
      }
      
      // Remove empty credentials
      if (!credentials[provider].apiKey && !credentials[provider].baseUrl) {
        delete credentials[provider]
      }
      
      await setSystemSetting('ai_provider_credentials', JSON.stringify(credentials), 'Stored credentials for AI providers')
      
      return reply.send({ success: true, provider })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save provider credentials')
      return reply.status(500).send({ error: 'Failed to save provider credentials' })
    }
  })

  /**
   * GET /api/settings/ai/providers
   * Get available providers and their models
   */
  fastify.get<{
    Querystring: { function?: string }
  }>('/api/settings/ai/providers', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const fn = request.query.function as AIFunction | undefined

      if (fn) {
        // Get providers for a specific function
        const providers = await getProvidersForFunction(fn)
        return reply.send({ providers })
      }

      // Return all providers
      return reply.send({ providers: PROVIDERS })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI providers')
      return reply.status(500).send({ error: 'Failed to get AI providers' })
    }
  })

  /**
   * GET /api/settings/ai/models
   * Get available models for a specific provider and function
   * Includes custom models for Ollama and OpenAI-compatible providers
   */
  fastify.get<{
    Querystring: { provider: string; function: string }
  }>('/api/settings/ai/models', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { provider, function: fn } = request.query

      if (!provider || !fn) {
        return reply.status(400).send({ error: 'provider and function are required' })
      }

      const models = await getModelsForFunctionWithCustom(provider as ProviderType, fn as AIFunction)
      return reply.send({ models })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI models')
      return reply.status(500).send({ error: 'Failed to get AI models' })
    }
  })

  /**
   * POST /api/settings/ai/custom-models
   * Add a custom model for Ollama or OpenAI-compatible provider
   */
  fastify.post<{
    Body: { provider: string; function: string; modelId: string }
  }>('/api/settings/ai/custom-models', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { provider, function: fn, modelId } = request.body

      if (!provider || !fn || !modelId) {
        return reply.status(400).send({ error: 'provider, function, and modelId are required' })
      }

      if (provider !== 'ollama' && provider !== 'openai-compatible') {
        return reply.status(400).send({ error: 'Custom models are only supported for ollama and openai-compatible providers' })
      }

      const customModel = await addCustomModel(
        provider as 'ollama' | 'openai-compatible',
        fn as AIFunction,
        modelId
      )

      return reply.send({ success: true, model: customModel })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to add custom model')
      return reply.status(500).send({ error: 'Failed to add custom model' })
    }
  })

  /**
   * DELETE /api/settings/ai/custom-models
   * Delete a custom model
   */
  fastify.delete<{
    Body: { provider: string; function: string; modelId: string }
  }>('/api/settings/ai/custom-models', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { provider, function: fn, modelId } = request.body

      if (!provider || !fn || !modelId) {
        return reply.status(400).send({ error: 'provider, function, and modelId are required' })
      }

      if (provider !== 'ollama' && provider !== 'openai-compatible') {
        return reply.status(400).send({ error: 'Custom models are only supported for ollama and openai-compatible providers' })
      }

      const deleted = await deleteCustomModel(
        provider as 'ollama' | 'openai-compatible',
        fn as AIFunction,
        modelId
      )

      if (!deleted) {
        return reply.status(404).send({ error: 'Custom model not found' })
      }

      return reply.send({ success: true })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete custom model')
      return reply.status(500).send({ error: 'Failed to delete custom model' })
    }
  })

  /**
   * GET /api/settings/ai/pricing
   * Get pricing info for all configured AI functions
   * Uses dynamic pricing from Helicone API (cached daily)
   */
  fastify.get('/api/settings/ai/pricing', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const aiConfig = await getAIConfig()

      const [embeddingsPricing, chatPricing, textGenerationPricing, explorationPricing] = await Promise.all([
        aiConfig.embeddings
          ? getPricingForModelAsync(aiConfig.embeddings.provider, aiConfig.embeddings.model, 'embeddings')
          : null,
        aiConfig.chat
          ? getPricingForModelAsync(aiConfig.chat.provider, aiConfig.chat.model, 'chat')
          : null,
        aiConfig.textGeneration
          ? getPricingForModelAsync(aiConfig.textGeneration.provider, aiConfig.textGeneration.model, 'textGeneration')
          : null,
        aiConfig.exploration
          ? getPricingForModelAsync(aiConfig.exploration.provider, aiConfig.exploration.model, 'exploration')
          : null,
      ])

      return reply.send({
        embeddings: embeddingsPricing,
        chat: chatPricing,
        textGeneration: textGenerationPricing,
        exploration: explorationPricing,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI pricing')
      return reply.status(500).send({ error: 'Failed to get AI pricing' })
    }
  })

  /**
   * GET /api/settings/ai/pricing/status
   * Get the status of the pricing cache
   */
  fastify.get('/api/settings/ai/pricing/status', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const status = await getPricingCacheStatus()
      return reply.send(status)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get pricing cache status')
      return reply.status(500).send({ error: 'Failed to get pricing cache status' })
    }
  })

  /**
   * POST /api/settings/ai/pricing/refresh
   * Force refresh the pricing cache from Helicone API
   */
  fastify.post('/api/settings/ai/pricing/refresh', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      await refreshPricingCache()
      const status = await getPricingCacheStatus()
      return reply.send({ success: true, status })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to refresh pricing cache')
      return reply.status(500).send({ error: 'Failed to refresh pricing cache' })
    }
  })

  /**
   * GET /api/settings/ai/embeddings/sets
   * List all embedding sets (grouped by model) with counts and dimensions
   * Queries all dimension-specific tables (embeddings_256, embeddings_384, etc.)
   */
  fastify.get('/api/settings/ai/embeddings/sets', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      // Build UNION ALL queries across all dimension tables
      const movieUnions = VALID_EMBEDDING_DIMENSIONS.map(d => 
        `SELECT model, COUNT(*)::int as count, ${d} as dimensions FROM embeddings_${d} GROUP BY model`
      ).join(' UNION ALL ')
      
      const seriesUnions = VALID_EMBEDDING_DIMENSIONS.map(d => 
        `SELECT model, COUNT(*)::int as count, ${d} as dimensions FROM series_embeddings_${d} GROUP BY model`
      ).join(' UNION ALL ')
      
      const episodeUnions = VALID_EMBEDDING_DIMENSIONS.map(d => 
        `SELECT model, COUNT(*)::int as count, ${d} as dimensions FROM episode_embeddings_${d} GROUP BY model`
      ).join(' UNION ALL ')
      
      // Get embedding sets from all dimension tables
      const movieSets = await query<{ model: string; count: number; dimensions: number }>(`${movieUnions}`)
      const seriesSets = await query<{ model: string; count: number; dimensions: number }>(`${seriesUnions}`)
      const episodeSets = await query<{ model: string; count: number; dimensions: number }>(`${episodeUnions}`)
      
      // Aggregate by model
      const setsMap = new Map<string, { model: string; dimensions: number; movieCount: number; seriesCount: number; episodeCount: number; totalCount: number }>()
      
      for (const row of movieSets.rows) {
        const existing = setsMap.get(row.model) || { model: row.model, dimensions: row.dimensions, movieCount: 0, seriesCount: 0, episodeCount: 0, totalCount: 0 }
        existing.movieCount += row.count
        existing.totalCount += row.count
        setsMap.set(row.model, existing)
      }
      
      for (const row of seriesSets.rows) {
        const existing = setsMap.get(row.model) || { model: row.model, dimensions: row.dimensions, movieCount: 0, seriesCount: 0, episodeCount: 0, totalCount: 0 }
        existing.seriesCount += row.count
        existing.totalCount += row.count
        setsMap.set(row.model, existing)
      }
      
      for (const row of episodeSets.rows) {
        const existing = setsMap.get(row.model) || { model: row.model, dimensions: row.dimensions, movieCount: 0, seriesCount: 0, episodeCount: 0, totalCount: 0 }
        existing.episodeCount += row.count
        existing.totalCount += row.count
        setsMap.set(row.model, existing)
      }
      
      // Get current configured embedding model
      const aiConfig = await getAIConfig()
      const currentModel = aiConfig.embeddings ? `${aiConfig.embeddings.provider}:${aiConfig.embeddings.model}` : null
      
      const sets = Array.from(setsMap.values()).map(set => ({
        ...set,
        isActive: set.model === currentModel,
      })).sort((a, b) => {
        // Active set first, then by total count
        if (a.isActive && !b.isActive) return -1
        if (!a.isActive && b.isActive) return 1
        return b.totalCount - a.totalCount
      })
      
      return reply.send({
        sets,
        currentModel,
        totalSets: sets.length,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get embedding sets')
      return reply.status(500).send({ error: 'Failed to get embedding sets' })
    }
  })

  /**
   * DELETE /api/settings/ai/embeddings/sets/:model
   * Delete a specific embedding set by model name
   * Deletes from all dimension-specific tables
   */
  fastify.delete<{ Params: { model: string } }>('/api/settings/ai/embeddings/sets/:model', { preHandler: requireAdmin }, async (request, reply) => {
    const { model } = request.params
    const decodedModel = decodeURIComponent(model)
    
    try {
      // Check if this is the active model - prevent deletion
      const aiConfig = await getAIConfig()
      const currentModel = aiConfig.embeddings ? `${aiConfig.embeddings.provider}:${aiConfig.embeddings.model}` : null
      
      if (decodedModel === currentModel) {
        return reply.status(400).send({ error: 'Cannot delete the active embedding set. Switch to a different model first.' })
      }
      
      // Delete from all dimension-specific tables
      let movieCount = 0
      let seriesCount = 0
      let episodeCount = 0
      
      for (const dim of VALID_EMBEDDING_DIMENSIONS) {
        const movieResult = await query(`DELETE FROM embeddings_${dim} WHERE model = $1`, [decodedModel])
        const seriesResult = await query(`DELETE FROM series_embeddings_${dim} WHERE model = $1`, [decodedModel])
        const episodeResult = await query(`DELETE FROM episode_embeddings_${dim} WHERE model = $1`, [decodedModel])
        
        movieCount += movieResult.rowCount || 0
        seriesCount += seriesResult.rowCount || 0
        episodeCount += episodeResult.rowCount || 0
      }
      
      const totalDeleted = movieCount + seriesCount + episodeCount
      
      fastify.log.info({ model: decodedModel, totalDeleted }, 'Deleted embedding set')
      return reply.send({ 
        success: true, 
        message: `Deleted embedding set for ${decodedModel}`,
        deleted: {
          movies: movieCount,
          series: seriesCount,
          episodes: episodeCount,
        }
      })
    } catch (err) {
      fastify.log.error({ err, model: decodedModel }, 'Failed to delete embedding set')
      return reply.status(500).send({ error: 'Failed to delete embedding set' })
    }
  })

  /**
   * POST /api/settings/ai/embeddings/clear
   * Clear all embeddings from all dimension-specific tables
   */
  fastify.post('/api/settings/ai/embeddings/clear', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      // Clear all dimension-specific embedding tables
      for (const dim of VALID_EMBEDDING_DIMENSIONS) {
        await query(`TRUNCATE embeddings_${dim}`)
        await query(`TRUNCATE series_embeddings_${dim}`)
        await query(`TRUNCATE episode_embeddings_${dim}`)
      }
      
      fastify.log.info('All embeddings cleared from dimension tables')
      return reply.send({ success: true, message: 'All embeddings cleared' })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to clear embeddings')
      return reply.status(500).send({ error: 'Failed to clear embeddings' })
    }
  })

  /**
   * GET /api/settings/ai/embeddings/legacy
   * Check if legacy embedding tables exist (from before multi-dimension migration)
   */
  fastify.get('/api/settings/ai/embeddings/legacy', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const legacyInfo = await checkLegacyEmbeddingsExist()
      return reply.send(legacyInfo)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to check legacy embeddings')
      return reply.status(500).send({ error: 'Failed to check legacy embeddings' })
    }
  })

  /**
   * DELETE /api/settings/ai/embeddings/legacy
   * Drop legacy embedding tables (embeddings_legacy, series_embeddings_legacy, episode_embeddings_legacy)
   */
  fastify.delete('/api/settings/ai/embeddings/legacy', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      // First check if legacy tables exist
      const legacyInfo = await checkLegacyEmbeddingsExist()
      if (!legacyInfo.exists) {
        return reply.status(404).send({ error: 'No legacy embedding tables found' })
      }
      
      await dropLegacyEmbeddingTables()
      
      fastify.log.info({ tables: legacyInfo.tables }, 'Legacy embedding tables dropped')
      return reply.send({ 
        success: true, 
        message: 'Legacy embedding tables dropped',
        droppedTables: legacyInfo.tables,
        totalRowsDeleted: legacyInfo.totalRows
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to drop legacy embeddings')
      return reply.status(500).send({ error: 'Failed to drop legacy embeddings' })
    }
  })

  /**
   * POST /api/settings/ai/test
   * Test a specific provider/model configuration
   */
  fastify.post<{
    Body: {
      function: string
      provider: string
      model: string
      apiKey?: string
      baseUrl?: string
    }
  }>('/api/settings/ai/test', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { function: fn, provider, model, apiKey, baseUrl } = request.body

      if (!fn || !provider || !model) {
        return reply.status(400).send({ error: 'function, provider, and model are required' })
      }

      // If no API key provided, try to use the saved one from the config
      let testApiKey = apiKey
      let testBaseUrl = baseUrl
      if (!testApiKey || !testBaseUrl) {
        const savedConfig = await getFunctionConfig(fn as AIFunction)
        if (savedConfig && savedConfig.provider === provider) {
          testApiKey = testApiKey || savedConfig.apiKey
          testBaseUrl = testBaseUrl || savedConfig.baseUrl
        }
      }

      const result = await testProviderConnection(
        {
          provider: provider as ProviderType,
          model,
          apiKey: testApiKey,
          baseUrl: testBaseUrl,
        },
        fn as AIFunction
      )

      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test AI provider')
      return reply.status(500).send({ error: 'Failed to test AI provider' })
    }
  })

  /**
   * PATCH /api/settings/ai/:function
   * Update configuration for a specific AI function
   * Also saves credentials to the provider credentials store for reuse
   */
  fastify.patch<{
    Params: { function: string }
    Body: { provider: string; model: string; apiKey?: string; baseUrl?: string }
  }>('/api/settings/ai/:function', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const fn = request.params.function as AIFunction
      const { provider, model, apiKey, baseUrl } = request.body

      if (!['embeddings', 'chat', 'textGeneration', 'exploration'].includes(fn)) {
        return reply.status(400).send({ error: 'Invalid function. Must be embeddings, chat, textGeneration, or exploration' })
      }

      // Save credentials to the provider credentials store for reuse
      if (apiKey || baseUrl) {
        const credentialsJson = await getSystemSetting('ai_provider_credentials')
        const credentials = credentialsJson ? JSON.parse(credentialsJson) : {}
        
        credentials[provider] = {
          ...(credentials[provider] || {}),
          ...(apiKey && { apiKey }),
          ...(baseUrl && { baseUrl }),
        }
        
        await setSystemSetting('ai_provider_credentials', JSON.stringify(credentials), 'Stored credentials for AI providers')
      }

      await setFunctionConfig(fn, {
        provider: provider as ProviderType,
        model,
        apiKey,
        baseUrl,
      })

      const config = await getFunctionConfig(fn)
      return reply.send({ config })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update AI function config')
      return reply.status(500).send({ error: 'Failed to update AI function configuration' })
    }
  })

  // =========================================================================
  // TMDb API Settings (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/tmdb
   * Get TMDb configuration status
   */
  fastify.get('/api/settings/tmdb', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const config = await getTMDbConfig()
      return reply.send({
        hasApiKey: config.hasApiKey,
        enabled: config.enabled,
        isConfigured: config.hasApiKey,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get TMDb config')
      return reply.status(500).send({ error: 'Failed to get TMDb configuration' })
    }
  })

  /**
   * PATCH /api/settings/tmdb
   * Update TMDb configuration
   */
  fastify.patch<{
    Body: { apiKey?: string; enabled?: boolean }
  }>('/api/settings/tmdb', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { apiKey, enabled } = request.body

      // Validate the API key if provided
      if (apiKey !== undefined && apiKey !== '' && typeof apiKey !== 'string') {
        return reply.status(400).send({ error: 'Invalid API key format' })
      }

      const config = await setTMDbConfig({ apiKey, enabled })

      return reply.send({
        hasApiKey: config.hasApiKey,
        enabled: config.enabled,
        isConfigured: config.hasApiKey,
        message: 'TMDb configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save TMDb config')
      return reply.status(500).send({ error: 'Failed to save TMDb configuration' })
    }
  })

  /**
   * POST /api/settings/tmdb/test
   * Test TMDb API connection
   */
  fastify.post<{
    Body?: { apiKey?: string }
  }>('/api/settings/tmdb/test', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const apiKey = request.body?.apiKey
      const result = await testTMDbConnection(apiKey)
      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test TMDb connection')
      return reply.status(500).send({ error: 'Failed to test TMDb connection' })
    }
  })

  // =========================================================================
  // OMDb API Settings (Admin Only)
  // =========================================================================

  /**
   * GET /api/settings/omdb
   * Get OMDb configuration status
   */
  fastify.get('/api/settings/omdb', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const config = await getOMDbConfig()
      return reply.send({
        hasApiKey: config.hasApiKey,
        enabled: config.enabled,
        isConfigured: config.hasApiKey,
        paidTier: config.paidTier,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get OMDb config')
      return reply.status(500).send({ error: 'Failed to get OMDb configuration' })
    }
  })

  /**
   * PATCH /api/settings/omdb
   * Update OMDb configuration
   */
  fastify.patch<{
    Body: { apiKey?: string; enabled?: boolean; paidTier?: boolean }
  }>('/api/settings/omdb', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { apiKey, enabled, paidTier } = request.body

      // Validate the API key if provided
      if (apiKey !== undefined && apiKey !== '' && typeof apiKey !== 'string') {
        return reply.status(400).send({ error: 'Invalid API key format' })
      }

      const config = await setOMDbConfig({ apiKey, enabled, paidTier })

      return reply.send({
        hasApiKey: config.hasApiKey,
        enabled: config.enabled,
        isConfigured: config.hasApiKey,
        paidTier: config.paidTier,
        message: 'OMDb configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save OMDb config')
      return reply.status(500).send({ error: 'Failed to save OMDb configuration' })
    }
  })

  /**
   * POST /api/settings/omdb/test
   * Test OMDb API connection
   */
  fastify.post<{
    Body?: { apiKey?: string }
  }>('/api/settings/omdb/test', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const apiKey = request.body?.apiKey
      const result = await testOMDbConnection(apiKey)
      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test OMDb connection')
      return reply.status(500).send({ error: 'Failed to test OMDb connection' })
    }
  })

  // =========================================================================
  // Studio Logos Configuration
  // =========================================================================

  /**
   * GET /api/settings/studio-logos
   * Get studio logos configuration and stats
   */
  fastify.get('/api/settings/studio-logos', { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const [config, stats] = await Promise.all([
        getStudioLogosConfig(),
        getStudioLogoStats(),
      ])

      return reply.send({
        pushToEmby: config.pushToEmby,
        stats: {
          studios: stats.studios,
          networks: stats.networks,
          pushedToEmby: stats.pushedToEmby,
        },
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get studio logos config')
      return reply.status(500).send({ error: 'Failed to get studio logos configuration' })
    }
  })

  /**
   * PATCH /api/settings/studio-logos
   * Update studio logos configuration
   */
  fastify.patch<{
    Body: { pushToEmby?: boolean }
  }>('/api/settings/studio-logos', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { pushToEmby } = request.body

      const config = await setStudioLogosConfig({ pushToEmby })

      return reply.send({
        pushToEmby: config.pushToEmby,
        message: 'Studio logos configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save studio logos config')
      return reply.status(500).send({ error: 'Failed to save studio logos configuration' })
    }
  })

  // =========================================================================
  // Taste Profile (User-specific)
  // =========================================================================

  /**
   * GET /api/settings/taste-profile
   * Get user's taste profile and preferences
   */
  fastify.get<{
    Querystring: { mediaType?: 'movie' | 'series' }
  }>('/api/settings/taste-profile', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const mediaType = (request.query.mediaType || 'movie') as 'movie' | 'series'

      const { getUserTasteData, REFRESH_INTERVAL_OPTIONS, MIN_FRANCHISE_ITEMS_OPTIONS, MIN_FRANCHISE_SIZE_OPTIONS } = await import('@aperture/core')
      const tasteData = await getUserTasteData(userId, mediaType)

      return reply.send({
        profile: tasteData.profile
          ? {
              id: tasteData.profile.id,
              mediaType: tasteData.profile.mediaType,
              hasEmbedding: !!tasteData.profile.embedding,
              embeddingModel: tasteData.profile.embeddingModel,
              autoUpdatedAt: tasteData.profile.autoUpdatedAt,
              userModifiedAt: tasteData.profile.userModifiedAt,
              isLocked: tasteData.profile.isLocked,
              refreshIntervalDays: tasteData.profile.refreshIntervalDays,
              minFranchiseItems: tasteData.profile.minFranchiseItems,
              minFranchiseSize: tasteData.profile.minFranchiseSize,
              createdAt: tasteData.profile.createdAt,
            }
          : null,
        franchises: tasteData.franchises.map((f) => ({
          id: f.id,
          franchiseName: f.franchiseName,
          mediaType: f.mediaType,
          preferenceScore: f.preferenceScore,
          isUserSet: f.isUserSet,
          itemsWatched: f.itemsWatched,
          totalEngagement: f.totalEngagement,
        })),
        genres: tasteData.genres.map((g) => ({
          id: g.id,
          genre: g.genre,
          weight: g.weight,
          isUserSet: g.isUserSet,
        })),
        customInterests: tasteData.customInterests.map((i) => ({
          id: i.id,
          interestText: i.interestText,
          hasEmbedding: !!i.embedding,
          weight: i.weight,
          createdAt: i.createdAt,
        })),
        refreshIntervalOptions: REFRESH_INTERVAL_OPTIONS,
        minFranchiseItemsOptions: MIN_FRANCHISE_ITEMS_OPTIONS,
        minFranchiseSizeOptions: MIN_FRANCHISE_SIZE_OPTIONS,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get taste profile')
      return reply.status(500).send({ error: 'Failed to get taste profile' })
    }
  })

  /**
   * POST /api/settings/taste-profile/rebuild
   * Force rebuild taste profile from watch history
   * 
   * @param mode - 'reset' to clear all and recalculate, 'merge' to only add new items
   */
  fastify.post<{
    Body: { mediaType: 'movie' | 'series'; mode?: 'reset' | 'merge' }
  }>('/api/settings/taste-profile/rebuild', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { mediaType, mode = 'reset' } = request.body

      if (!mediaType || !['movie', 'series'].includes(mediaType)) {
        return reply.status(400).send({ error: 'mediaType must be "movie" or "series"' })
      }

      if (mode && !['reset', 'merge'].includes(mode)) {
        return reply.status(400).send({ error: 'mode must be "reset" or "merge"' })
      }

      const { getUserTasteProfile, detectAndUpdateFranchises, detectAndUpdateGenres, getUserFranchisePreferences, getUserGenreWeights, getStoredProfile, DEFAULT_MIN_FRANCHISE_ITEMS, DEFAULT_MIN_FRANCHISE_SIZE } = await import('@aperture/core')

      // Get the user's franchise filter settings
      const storedProfile = await getStoredProfile(userId, mediaType)
      const minFranchiseItems = storedProfile?.minFranchiseItems ?? DEFAULT_MIN_FRANCHISE_ITEMS
      const minFranchiseSize = storedProfile?.minFranchiseSize ?? DEFAULT_MIN_FRANCHISE_SIZE

      // Force rebuild profile (embedding)
      const profile = await getUserTasteProfile(userId, mediaType, {
        forceRebuild: true,
        skipLockCheck: true, // Allow rebuild even if locked (user explicitly requested)
      })

      // Update franchise and genre detection with mode and franchise filters
      const franchiseResult = await detectAndUpdateFranchises(userId, mediaType, { mode, minFranchiseItems, minFranchiseSize })
      const genreResult = await detectAndUpdateGenres(userId, mediaType, { mode })

      // Fetch the updated lists to return to the frontend (avoid full page re-render)
      const [updatedFranchises, updatedGenres] = await Promise.all([
        getUserFranchisePreferences(userId),
        getUserGenreWeights(userId),
      ])

      // Filter franchises by mediaType
      const filteredFranchises = updatedFranchises.filter(
        (f) => f.mediaType === mediaType || f.mediaType === 'both'
      )

      return reply.send({
        success: true,
        profile: profile
          ? {
              id: profile.id,
              mediaType: profile.mediaType,
              hasEmbedding: !!profile.embedding,
              autoUpdatedAt: profile.autoUpdatedAt,
            }
          : null,
        franchisesUpdated: franchiseResult.updated,
        genresUpdated: genreResult.updated,
        newFranchises: franchiseResult.newItems,
        newGenres: genreResult.newItems,
        // Return full updated lists for direct state update (no page re-render needed)
        franchises: filteredFranchises.map((f) => ({
          id: f.id,
          franchiseName: f.franchiseName,
          preferenceScore: f.preferenceScore,
          itemsWatched: f.itemsWatched,
        })),
        genres: updatedGenres.map((g) => ({
          id: g.id,
          genre: g.genre,
          weight: g.weight,
        })),
        message: mode === 'merge' 
          ? `Added ${franchiseResult.newItems.length} new franchises and ${genreResult.newItems.length} new genres`
          : 'Taste profile rebuilt successfully',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to rebuild taste profile')
      return reply.status(500).send({ error: 'Failed to rebuild taste profile' })
    }
  })

  /**
   * PATCH /api/settings/taste-profile
   * Update profile settings (lock, refresh interval, min franchise items/size)
   */
  fastify.patch<{
    Body: { mediaType: 'movie' | 'series'; isLocked?: boolean; refreshIntervalDays?: number; minFranchiseItems?: number; minFranchiseSize?: number }
  }>('/api/settings/taste-profile', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { mediaType, isLocked, refreshIntervalDays, minFranchiseItems, minFranchiseSize } = request.body

      if (!mediaType || !['movie', 'series'].includes(mediaType)) {
        return reply.status(400).send({ error: 'mediaType must be "movie" or "series"' })
      }

      // Validate refresh interval
      const { REFRESH_INTERVAL_OPTIONS, MIN_FRANCHISE_ITEMS_OPTIONS, MIN_FRANCHISE_SIZE_OPTIONS, updateProfileSettings } = await import('@aperture/core')
      if (
        refreshIntervalDays !== undefined &&
        !REFRESH_INTERVAL_OPTIONS.includes(refreshIntervalDays as 7 | 14 | 30 | 60 | 90 | 180 | 365)
      ) {
        return reply.status(400).send({
          error: `refreshIntervalDays must be one of: ${REFRESH_INTERVAL_OPTIONS.join(', ')}`,
        })
      }

      // Validate min franchise items
      if (
        minFranchiseItems !== undefined &&
        !MIN_FRANCHISE_ITEMS_OPTIONS.includes(minFranchiseItems as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      ) {
        return reply.status(400).send({
          error: `minFranchiseItems must be one of: ${MIN_FRANCHISE_ITEMS_OPTIONS.join(', ')}`,
        })
      }

      // Validate min franchise size
      if (
        minFranchiseSize !== undefined &&
        !MIN_FRANCHISE_SIZE_OPTIONS.includes(minFranchiseSize as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      ) {
        return reply.status(400).send({
          error: `minFranchiseSize must be one of: ${MIN_FRANCHISE_SIZE_OPTIONS.join(', ')}`,
        })
      }

      await updateProfileSettings(userId, mediaType, {
        isLocked,
        refreshIntervalDays,
        minFranchiseItems,
        minFranchiseSize,
      })

      return reply.send({
        success: true,
        message: 'Profile settings updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update profile settings')
      return reply.status(500).send({ error: 'Failed to update profile settings' })
    }
  })

  /**
   * PUT /api/settings/taste-profile/franchises
   * Update franchise preferences
   */
  fastify.put<{
    Body: {
      franchises: Array<{
        franchiseName: string
        mediaType: 'movie' | 'series' | 'both'
        preferenceScore: number
      }>
    }
  }>('/api/settings/taste-profile/franchises', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { franchises } = request.body

      if (!Array.isArray(franchises)) {
        return reply.status(400).send({ error: 'franchises must be an array' })
      }

      const { setFranchisePreference } = await import('@aperture/core')

      for (const franchise of franchises) {
        if (
          !franchise.franchiseName ||
          !franchise.mediaType ||
          franchise.preferenceScore === undefined
        ) {
          continue
        }

        // Validate preferenceScore is -1 to 1
        if (franchise.preferenceScore < -1 || franchise.preferenceScore > 1) {
          return reply.status(400).send({
            error: `preferenceScore for "${franchise.franchiseName}" must be between -1 and 1`,
          })
        }

        await setFranchisePreference(
          userId,
          franchise.franchiseName,
          franchise.mediaType,
          franchise.preferenceScore,
          true // User-set
        )
      }

      return reply.send({
        success: true,
        updated: franchises.length,
        message: 'Franchise preferences updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update franchise preferences')
      return reply.status(500).send({ error: 'Failed to update franchise preferences' })
    }
  })

  /**
   * DELETE /api/settings/taste-profile/franchises/:franchiseName
   * Delete a franchise preference
   */
  fastify.delete<{
    Params: { franchiseName: string }
    Querystring: { mediaType: 'movie' | 'series' | 'both' }
  }>('/api/settings/taste-profile/franchises/:franchiseName', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { franchiseName } = request.params
      const { mediaType } = request.query

      if (!franchiseName) {
        return reply.status(400).send({ error: 'franchiseName is required' })
      }

      if (!mediaType || !['movie', 'series', 'both'].includes(mediaType)) {
        return reply.status(400).send({ error: 'mediaType query param is required (movie, series, or both)' })
      }

      const { deleteFranchisePreference } = await import('@aperture/core')
      const deleted = await deleteFranchisePreference(userId, decodeURIComponent(franchiseName), mediaType)

      return reply.send({
        success: deleted,
        message: deleted ? 'Franchise deleted' : 'Franchise not found',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete franchise preference')
      return reply.status(500).send({ error: 'Failed to delete franchise preference' })
    }
  })

  /**
   * PUT /api/settings/taste-profile/genres
   * Update genre weights
   */
  fastify.put<{
    Body: {
      genres: Array<{
        genre: string
        weight: number
      }>
    }
  }>('/api/settings/taste-profile/genres', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { genres } = request.body

      if (!Array.isArray(genres)) {
        return reply.status(400).send({ error: 'genres must be an array' })
      }

      const { setGenreWeight } = await import('@aperture/core')

      for (const genre of genres) {
        if (!genre.genre || genre.weight === undefined) {
          continue
        }

        // Validate weight is 0 to 2
        if (genre.weight < 0 || genre.weight > 2) {
          return reply.status(400).send({
            error: `weight for "${genre.genre}" must be between 0 and 2`,
          })
        }

        await setGenreWeight(userId, genre.genre, genre.weight, true)
      }

      return reply.send({
        success: true,
        updated: genres.length,
        message: 'Genre weights updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update genre weights')
      return reply.status(500).send({ error: 'Failed to update genre weights' })
    }
  })

  /**
   * DELETE /api/settings/taste-profile/genres/:genre
   * Delete a genre weight
   */
  fastify.delete<{
    Params: { genre: string }
  }>('/api/settings/taste-profile/genres/:genre', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { genre } = request.params

      if (!genre) {
        return reply.status(400).send({ error: 'genre is required' })
      }

      const { deleteGenreWeight } = await import('@aperture/core')
      const deleted = await deleteGenreWeight(userId, decodeURIComponent(genre))

      return reply.send({
        success: deleted,
        message: deleted ? 'Genre deleted' : 'Genre not found',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete genre weight')
      return reply.status(500).send({ error: 'Failed to delete genre weight' })
    }
  })

  /**
   * POST /api/settings/taste-profile/interests
   * Add a custom interest
   */
  fastify.post<{
    Body: { interestText: string; weight?: number }
  }>('/api/settings/taste-profile/interests', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { interestText, weight = 1.0 } = request.body

      if (!interestText || interestText.trim().length === 0) {
        return reply.status(400).send({ error: 'interestText is required' })
      }

      if (interestText.length > 500) {
        return reply.status(400).send({ error: 'interestText must be 500 characters or less' })
      }

      const { addCustomInterest, getEmbeddingModel, getEmbeddingModelInstance } = await import('@aperture/core')
      const { embed } = await import('ai')

      // Generate embedding for the interest
      let embedding: number[] | undefined
      let embeddingModel: string | undefined
      try {
        const modelId = await getEmbeddingModel()
        if (modelId) {
          const model = await getEmbeddingModelInstance()
          const result = await embed({ model, value: interestText.trim() })
          embedding = result.embedding
          embeddingModel = modelId
        }
      } catch {
        // Continue without embedding if it fails
        fastify.log.warn('Failed to generate embedding for custom interest')
      }

      const interestId = await addCustomInterest(
        userId,
        interestText.trim(),
        embedding,
        embeddingModel,
        weight
      )

      return reply.send({
        success: true,
        id: interestId,
        message: 'Custom interest added',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to add custom interest')
      return reply.status(500).send({ error: 'Failed to add custom interest' })
    }
  })

  /**
   * DELETE /api/settings/taste-profile/interests/:id
   * Remove a custom interest
   */
  fastify.delete<{
    Params: { id: string }
  }>('/api/settings/taste-profile/interests/:id', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { id } = request.params

      const { removeCustomInterest } = await import('@aperture/core')
      await removeCustomInterest(userId, id)

      return reply.send({
        success: true,
        message: 'Custom interest removed',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to remove custom interest')
      return reply.status(500).send({ error: 'Failed to remove custom interest' })
    }
  })
}

export default settingsRoutes
