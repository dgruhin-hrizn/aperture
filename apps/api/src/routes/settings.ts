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
  getUserAiExplanationSettings,
  setUserAiExplanationOverride,
  setUserAiExplanationPreference,
  getEffectiveAiExplanationSetting,
  getLibraryTitleConfig,
  setLibraryTitleConfig,
  type EmbeddingModel,
  type MediaServerType,
  type TextGenerationModel,
  type MediaTypeConfig,
} from '@aperture/core'
import { requireAdmin } from '../plugins/auth.js'
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

      // Get job schedules
      const movieJobConfig = await getJobConfig('generate-recommendations')
      const seriesJobConfig = await getJobConfig('generate-series-recommendations')

      // Get enabled user counts
      const { query } = await import('@aperture/core')
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

      // Calculate runs per week
      const movieRunsPerWeek = movieJobConfig
        ? calculateRunsPerWeek(movieJobConfig.scheduleType, movieJobConfig.scheduleIntervalHours)
        : 7
      const seriesRunsPerWeek = seriesJobConfig
        ? calculateRunsPerWeek(seriesJobConfig.scheduleType, seriesJobConfig.scheduleIntervalHours)
        : 7

      return reply.send({
        movie: {
          selectedCount: recConfig.movie.selectedCount,
          runsPerWeek: movieRunsPerWeek,
          schedule: movieJobConfig ? formatSchedule(movieJobConfig) : 'Daily at 4:00 AM',
          enabledUsers: moviesEnabledUsers,
          source: {
            selectedCount: 'Settings > AI Config > Algorithm > Movies > Recs Per User',
            schedule: 'Jobs > generate-recommendations',
          },
        },
        series: {
          selectedCount: recConfig.series.selectedCount,
          runsPerWeek: seriesRunsPerWeek,
          schedule: seriesJobConfig ? formatSchedule(seriesJobConfig) : 'Daily at 4:00 AM',
          enabledUsers: seriesEnabledUsers,
          source: {
            selectedCount: 'Settings > AI Config > Algorithm > Series > Recs Per User',
            schedule: 'Jobs > generate-series-recommendations',
          },
        },
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get cost inputs')
      return reply.status(500).send({ error: 'Failed to get cost estimation inputs' })
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

        // Get embedding count to show current state
        const embeddingResult = await query<{ count: string; model: string }>(
          'SELECT COUNT(*) as count, model FROM embeddings GROUP BY model'
        )
        const embeddingsByModel = embeddingResult.rows.reduce(
          (acc, row) => {
            acc[row.model] = parseInt(row.count, 10)
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
      let libraries: { movies: { id: string; guid: string; name: string } | null; series: { id: string; guid: string; name: string } | null } = { movies: null, series: null }
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
      timeWindowDays?: number
      moviesCount?: number
      seriesCount?: number
      uniqueViewersWeight?: number
      playCountWeight?: number
      completionWeight?: number
      refreshCron?: string
      moviesLibraryName?: string
      seriesLibraryName?: string
      minUniqueViewers?: number
      // Output format settings
      useSymlinks?: boolean
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
  fastify.get('/api/settings/strm-libraries', { preHandler: requireAdmin }, async (_request, reply) => {
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
        userName: row.user_id ? (row as unknown as { user_display_name: string | null; user_name: string }).user_display_name || (row as unknown as { user_name: string }).user_name : null,
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
  })
}

export default settingsRoutes
