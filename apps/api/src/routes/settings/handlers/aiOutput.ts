/**
 * AI Output and Feature Settings Handlers
 * 
 * Endpoints:
 * - GET /api/settings/ai-recs/output - Get AI recs output config
 * - PATCH /api/settings/ai-recs/output - Update AI recs output config
 * - GET /api/settings/output-format - Get output format (deprecated)
 * - PATCH /api/settings/output-format - Update output format (deprecated)
 * - GET /api/settings/ai-explanation - Get AI explanation config
 * - PATCH /api/settings/ai-explanation - Update AI explanation config
 * - GET /api/settings/ai-explanation/user/:userId - Get user's AI explanation settings
 * - PATCH /api/settings/ai-explanation/user/:userId - Update user's AI explanation override
 * - GET /api/settings/user/ai-explanation - Get current user's AI explanation preference
 * - PATCH /api/settings/user/ai-explanation - Update current user's AI explanation preference
 * - GET /api/settings/watching - Get watching library config
 * - PATCH /api/settings/watching - Update watching library config
 * - GET /api/settings/library-titles - Get library title templates
 * - PATCH /api/settings/library-titles - Update library title templates
 * - GET /api/settings/strm-libraries - Get STRM libraries
 */
import type { FastifyInstance } from 'fastify'
import {
  getAiRecsOutputConfig,
  setAiRecsOutputConfig,
  getAiExplanationConfig,
  setAiExplanationConfig,
  getUserAiExplanationSettings,
  setUserAiExplanationOverride,
  setUserAiExplanationPreference,
  getEffectiveAiExplanationSetting,
  getWatchingLibraryConfig,
  setWatchingLibraryConfig,
  getLibraryTitleConfig,
  setLibraryTitleConfig,
  getContinueWatchingConfig,
  setContinueWatchingConfig,
} from '@aperture/core'
import { restartContinueWatchingPoller } from '../../../lib/continueWatchingPoller.js'
import { query } from '../../../lib/db.js'
import { requireAdmin } from '../../../plugins/auth.js'
import {
  aiRecsOutputConfigSchema,
  updateAiRecsOutputConfigSchema,
  aiExplanationConfigSchema,
  updateAiExplanationConfigSchema,
  userAiExplanationSchema,
  updateUserAiExplanationSchema,
  watchingLibraryConfigSchema,
  updateWatchingLibraryConfigSchema,
  libraryTitleConfigSchema,
  updateLibraryTitleConfigSchema,
  strmLibrariesSchema,
  continueWatchingConfigSchema,
  updateContinueWatchingConfigSchema,
} from '../schemas.js'

export function registerAiOutputHandlers(fastify: FastifyInstance) {
  // =========================================================================
  // AI Recommendations Output Format
  // =========================================================================

  /**
   * GET /api/settings/ai-recs/output
   */
  fastify.get('/api/settings/ai-recs/output', { preHandler: requireAdmin, schema: aiRecsOutputConfigSchema }, async (_request, reply) => {
    try {
      const config = await getAiRecsOutputConfig()
      return reply.send(config)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI recs output format config')
      return reply.status(500).send({ error: 'Failed to get AI recommendations output format configuration' })
    }
  })

  /**
   * PATCH /api/settings/ai-recs/output
   */
  fastify.patch<{
    Body: {
      moviesUseSymlinks?: boolean
      seriesUseSymlinks?: boolean
    }
  }>('/api/settings/ai-recs/output', { preHandler: requireAdmin, schema: updateAiRecsOutputConfigSchema }, async (request, reply) => {
    try {
      const config = await setAiRecsOutputConfig(request.body)
      return reply.send({
        ...config,
        message: 'AI recommendations output format configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update AI recs output format config')
      return reply.status(500).send({ error: 'Failed to update AI recommendations output format configuration' })
    }
  })

  /**
   * GET /api/settings/output-format (deprecated - backwards compatibility)
   */
  fastify.get('/api/settings/output-format', { preHandler: requireAdmin, schema: { tags: ['settings'] } }, async (_request, reply) => {
    try {
      const config = await getAiRecsOutputConfig()
      return reply.send(config)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get output format config')
      return reply.status(500).send({ error: 'Failed to get output format configuration' })
    }
  })

  /**
   * PATCH /api/settings/output-format (deprecated - backwards compatibility)
   */
  fastify.patch<{
    Body: {
      moviesUseSymlinks?: boolean
      seriesUseSymlinks?: boolean
    }
  }>('/api/settings/output-format', { preHandler: requireAdmin, schema: { tags: ['settings'] } }, async (request, reply) => {
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
  // AI Explanation Settings
  // =========================================================================

  /**
   * GET /api/settings/ai-explanation
   */
  fastify.get('/api/settings/ai-explanation', { preHandler: requireAdmin, schema: aiExplanationConfigSchema }, async (_request, reply) => {
    try {
      const config = await getAiExplanationConfig()
      return reply.send(config)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI explanation config')
      return reply.status(500).send({ error: 'Failed to get AI explanation configuration' })
    }
  })

  /**
   * PATCH /api/settings/ai-explanation
   */
  fastify.patch<{
    Body: {
      enabled?: boolean
      userOverrideAllowed?: boolean
    }
  }>('/api/settings/ai-explanation', { preHandler: requireAdmin, schema: updateAiExplanationConfigSchema }, async (request, reply) => {
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
   */
  fastify.get<{
    Params: { userId: string }
  }>('/api/settings/ai-explanation/user/:userId', { preHandler: requireAdmin, schema: { tags: ['settings'] } }, async (request, reply) => {
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
  })

  /**
   * PATCH /api/settings/ai-explanation/user/:userId
   */
  fastify.patch<{
    Params: { userId: string }
    Body: { overrideAllowed: boolean }
  }>('/api/settings/ai-explanation/user/:userId', { preHandler: requireAdmin, schema: { tags: ['settings'] } }, async (request, reply) => {
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
  })

  /**
   * GET /api/settings/user/ai-explanation
   */
  fastify.get('/api/settings/user/ai-explanation', { schema: userAiExplanationSchema }, async (request, reply) => {
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
   */
  fastify.patch<{
    Body: { enabled: boolean | null }
  }>('/api/settings/user/ai-explanation', { schema: updateUserAiExplanationSchema }, async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { enabled } = request.body

      if (enabled !== null && typeof enabled !== 'boolean') {
        return reply.status(400).send({ error: 'enabled must be a boolean or null' })
      }

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
  // Watching Library Settings
  // =========================================================================

  /**
   * GET /api/settings/watching
   */
  fastify.get('/api/settings/watching', { preHandler: requireAdmin, schema: watchingLibraryConfigSchema }, async (_request, reply) => {
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
   */
  fastify.patch<{
    Body: {
      enabled?: boolean
      useSymlinks?: boolean
    }
  }>('/api/settings/watching', { preHandler: requireAdmin, schema: updateWatchingLibraryConfigSchema }, async (request, reply) => {
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
  // Library Title Templates
  // =========================================================================

  /**
   * GET /api/settings/library-titles
   */
  fastify.get('/api/settings/library-titles', { preHandler: requireAdmin, schema: libraryTitleConfigSchema }, async (_request, reply) => {
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
  })

  /**
   * PATCH /api/settings/library-titles
   */
  fastify.patch<{
    Body: {
      moviesTemplate?: string
      seriesTemplate?: string
    }
  }>('/api/settings/library-titles', { preHandler: requireAdmin, schema: updateLibraryTitleConfigSchema }, async (request, reply) => {
    try {
      const { moviesTemplate, seriesTemplate } = request.body

      if (moviesTemplate !== undefined && typeof moviesTemplate !== 'string') {
        return reply.status(400).send({ error: 'moviesTemplate must be a string' })
      }
      if (seriesTemplate !== undefined && typeof seriesTemplate !== 'string') {
        return reply.status(400).send({ error: 'seriesTemplate must be a string' })
      }

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
  // STRM Libraries
  // =========================================================================

  /**
   * GET /api/settings/strm-libraries
   */
  fastify.get('/api/settings/strm-libraries', { preHandler: requireAdmin, schema: strmLibrariesSchema }, async (_request, reply) => {
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
  })

  // =========================================================================
  // Continue Watching Settings
  // =========================================================================

  /**
   * GET /api/settings/continue-watching
   */
  fastify.get('/api/settings/continue-watching', { preHandler: requireAdmin, schema: continueWatchingConfigSchema }, async (_request, reply) => {
    try {
      const config = await getContinueWatchingConfig()
      return reply.send({
        ...config,
        supportedMergeTags: [
          { tag: '{{username}}', description: "User's display name" },
          { tag: '{{userid}}', description: "User's provider ID (for uniqueness)" },
        ],
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get continue watching config')
      return reply.status(500).send({ error: 'Failed to get continue watching configuration' })
    }
  })

  /**
   * PATCH /api/settings/continue-watching
   */
  fastify.patch<{
    Body: {
      enabled?: boolean
      useSymlinks?: boolean
      libraryName?: string
      pollIntervalSeconds?: number
      excludedLibraryIds?: string[]
    }
  }>('/api/settings/continue-watching', { preHandler: requireAdmin, schema: updateContinueWatchingConfigSchema }, async (request, reply) => {
    try {
      const { libraryName, pollIntervalSeconds } = request.body

      // Validate library name if provided
      if (libraryName !== undefined) {
        if (typeof libraryName !== 'string' || libraryName.trim().length === 0) {
          return reply.status(400).send({ error: 'libraryName must be a non-empty string' })
        }
        const invalidChars = /[<>:"/\\|?*]/
        if (invalidChars.test(libraryName.replace(/\{\{[^}]+\}\}/g, ''))) {
          return reply.status(400).send({
            error: 'libraryName contains invalid characters for file paths',
          })
        }
      }

      // Validate poll interval if provided
      if (pollIntervalSeconds !== undefined) {
        if (typeof pollIntervalSeconds !== 'number' || pollIntervalSeconds < 30 || pollIntervalSeconds > 300) {
          return reply.status(400).send({ error: 'pollIntervalSeconds must be between 30 and 300' })
        }
      }

      const config = await setContinueWatchingConfig(request.body)
      
      // Restart the poller if enabled/interval changed
      if (request.body.enabled !== undefined || request.body.pollIntervalSeconds !== undefined) {
        try {
          await restartContinueWatchingPoller()
        } catch (err) {
          fastify.log.error({ err }, 'Failed to restart continue watching poller')
        }
      }

      return reply.send({
        ...config,
        message: 'Continue watching configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update continue watching config')
      return reply.status(500).send({ error: 'Failed to update continue watching configuration' })
    }
  })
}
