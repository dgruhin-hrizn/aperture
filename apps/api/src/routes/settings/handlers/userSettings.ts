/**
 * User Settings Handlers
 * 
 * Endpoints:
 * - GET /api/settings/user - Get user settings
 * - PATCH /api/settings/user - Update user settings
 * - GET /api/settings/user/include-watched - Get include watched preference
 * - PUT /api/settings/user/include-watched - Update include watched preference
 * - GET /api/settings/user/dislike-behavior - Get dislike behavior preference
 * - PATCH /api/settings/user/dislike-behavior - Update dislike behavior preference
 * - GET /api/settings/user/similarity-prefs - Get similarity graph preferences
 * - PATCH /api/settings/user/similarity-prefs - Update similarity graph preferences
 */
import type { FastifyInstance } from 'fastify'
import {
  getUserSettings,
  updateUserSettings,
  getDefaultLibraryNamePrefix,
} from '@aperture/core'
import { query, queryOne } from '../../../lib/db.js'
import {
  userSettingsSchema,
  updateUserSettingsSchema,
  includeWatchedSchema,
  updateIncludeWatchedSchema,
  dislikeBehaviorSchema,
  updateDislikeBehaviorSchema,
  similarityPrefsSchema,
  updateSimilarityPrefsSchema,
} from '../schemas.js'

export function registerUserSettingsHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/user
   */
  fastify.get('/api/settings/user', { schema: userSettingsSchema }, async (request, reply) => {
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
   */
  fastify.patch<{
    Body: {
      libraryName?: string | null
      seriesLibraryName?: string | null
    }
  }>('/api/settings/user', { schema: updateUserSettingsSchema }, async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { libraryName, seriesLibraryName } = request.body

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

  /**
   * GET /api/settings/user/include-watched
   */
  fastify.get('/api/settings/user/include-watched', { schema: includeWatchedSchema }, async (request, reply) => {
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
   */
  fastify.put<{
    Body: { includeWatched: boolean }
  }>('/api/settings/user/include-watched', { schema: updateIncludeWatchedSchema }, async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { includeWatched } = request.body
      if (typeof includeWatched !== 'boolean') {
        return reply.status(400).send({ error: 'includeWatched must be a boolean' })
      }

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

  /**
   * GET /api/settings/user/dislike-behavior
   */
  fastify.get('/api/settings/user/dislike-behavior', { schema: dislikeBehaviorSchema }, async (request, reply) => {
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
   */
  fastify.patch<{
    Body: { dislikeBehavior: 'exclude' | 'penalize' }
  }>('/api/settings/user/dislike-behavior', { schema: updateDislikeBehaviorSchema }, async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { dislikeBehavior } = request.body
      if (!dislikeBehavior || !['exclude', 'penalize'].includes(dislikeBehavior)) {
        return reply.status(400).send({ error: 'dislikeBehavior must be "exclude" or "penalize"' })
      }

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

  /**
   * GET /api/settings/user/similarity-prefs
   */
  fastify.get('/api/settings/user/similarity-prefs', { schema: similarityPrefsSchema }, async (request, reply) => {
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
   */
  fastify.patch<{
    Body: {
      fullFranchiseMode?: boolean
      hideWatched?: boolean
    }
  }>('/api/settings/user/similarity-prefs', { schema: updateSimilarityPrefsSchema }, async (request, reply) => {
    try {
      const userId = request.user?.id
      if (!userId) {
        return reply.status(401).send({ error: 'Not authenticated' })
      }

      const { fullFranchiseMode, hideWatched } = request.body

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
}
