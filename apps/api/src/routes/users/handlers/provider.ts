import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAdmin } from '../../../plugins/auth.js'
import { getMediaServerProvider } from '@aperture/core'
import type { UserRow } from '../types.js'

export function registerProviderHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/provider
   * Get all users from the media server (Emby/Jellyfin)
   * Returns users with their import status in Aperture
   */
  fastify.get(
    '/api/users/provider',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const apiKey = process.env.MEDIA_SERVER_API_KEY
      if (!apiKey) {
        return reply.status(500).send({ error: 'Media server API key not configured' })
      }

      try {
        const provider = getMediaServerProvider()
        const providerUsers = await provider.getUsers(apiKey)

        // Get existing users from our DB to check import status
        const existingResult = await query<{ provider_user_id: string; id: string; is_enabled: boolean; movies_enabled: boolean; series_enabled: boolean; ai_explanation_override_allowed: boolean }>(
          `SELECT provider_user_id, id, is_enabled, movies_enabled, series_enabled, COALESCE(ai_explanation_override_allowed, false) as ai_explanation_override_allowed FROM users WHERE provider = $1`,
          [provider.type]
        )
        const existingMap = new Map(
          existingResult.rows.map((row) => [row.provider_user_id, { 
            id: row.id, 
            isEnabled: row.is_enabled,
            moviesEnabled: row.movies_enabled,
            seriesEnabled: row.series_enabled,
            aiOverrideAllowed: row.ai_explanation_override_allowed,
          }])
        )

        // Combine provider users with import status
        const usersWithStatus = providerUsers.map((user) => {
          const existing = existingMap.get(user.id)
          return {
            providerUserId: user.id,
            name: user.name,
            isAdmin: user.isAdmin,
            isDisabled: user.isDisabled,
            lastActivityDate: user.lastActivityDate,
            // Aperture status
            apertureUserId: existing?.id || null,
            isImported: !!existing,
            isEnabled: existing?.isEnabled || false,
            moviesEnabled: existing?.moviesEnabled || false,
            seriesEnabled: existing?.seriesEnabled || false,
            aiOverrideAllowed: existing?.aiOverrideAllowed || false,
          }
        })

        return reply.send({
          provider: provider.type,
          users: usersWithStatus,
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to fetch provider users')
        return reply.status(500).send({ error: 'Failed to fetch users from media server' })
      }
    }
  )

  /**
   * POST /api/users/import
   * Import a user from the media server into Aperture
   */
  fastify.post<{ Body: { providerUserId: string; isEnabled?: boolean; moviesEnabled?: boolean; seriesEnabled?: boolean } }>(
    '/api/users/import',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { providerUserId, isEnabled = false, moviesEnabled, seriesEnabled } = request.body

      // Default movies to enabled if isEnabled is true (backwards compatibility)
      const enableMovies = moviesEnabled ?? isEnabled
      const enableSeries = seriesEnabled ?? false

      if (!providerUserId) {
        return reply.status(400).send({ error: 'providerUserId is required' })
      }

      const apiKey = process.env.MEDIA_SERVER_API_KEY
      if (!apiKey) {
        return reply.status(500).send({ error: 'Media server API key not configured' })
      }

      try {
        const provider = getMediaServerProvider()
        
        // Check if user already exists
        const existing = await queryOne<UserRow>(
          `SELECT * FROM users WHERE provider = $1 AND provider_user_id = $2`,
          [provider.type, providerUserId]
        )

        if (existing) {
          return reply.status(409).send({ 
            error: 'User already imported',
            user: existing 
          })
        }

        // Get user info from provider
        const providerUser = await provider.getUserById(apiKey, providerUserId)

        // Insert user into our database
        const newUser = await queryOne<UserRow>(
          `INSERT INTO users (username, display_name, provider, provider_user_id, is_admin, is_enabled, movies_enabled, series_enabled, max_parental_rating)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, username, display_name, provider, provider_user_id, is_admin, is_enabled, movies_enabled, series_enabled, max_parental_rating, created_at, updated_at`,
          [providerUser.name, providerUser.name, provider.type, providerUserId, providerUser.isAdmin, enableMovies || enableSeries, enableMovies, enableSeries, providerUser.maxParentalRating ?? null]
        )

        fastify.log.info({ userId: newUser?.id, providerUserId, name: providerUser.name }, 'User imported from media server')

        return reply.status(201).send({ user: newUser })
      } catch (error) {
        fastify.log.error({ error, providerUserId }, 'Failed to import user')
        return reply.status(500).send({ error: 'Failed to import user from media server' })
      }
    }
  )
}

