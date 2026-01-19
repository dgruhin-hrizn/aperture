/**
 * Setup Users Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getMediaServerApiKey,
  getMediaServerProvider,
} from '@aperture/core'
import { query, queryOne } from '../../../lib/db.js'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'

interface SetupUserImportBody {
  providerUserId: string
  moviesEnabled?: boolean
  seriesEnabled?: boolean
}

interface SetupUserEnableBody {
  apertureUserId: string
  moviesEnabled?: boolean
  seriesEnabled?: boolean
}

export async function registerUsersHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/setup/users
   * Fetch users from media server using saved API key.
   */
  fastify.get(
    '/api/setup/users',
    { schema: setupSchemas.getUsers },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) {
        return reply.status(403).send({
          error: 'Setup is complete. Manage users in Admin → Users.',
        })
      }

      const apiKey = await getMediaServerApiKey()
      if (!apiKey) {
        return reply.status(400).send({ error: 'Media server must be configured first' })
      }

      try {
        const provider = await getMediaServerProvider()
        const providerUsers = await provider.getUsers(apiKey)

        const existingResult = await query<{
          provider_user_id: string
          id: string
          is_enabled: boolean
          movies_enabled: boolean
          series_enabled: boolean
        }>(
          `SELECT provider_user_id, id, is_enabled, movies_enabled, series_enabled 
           FROM users WHERE provider = $1`,
          [provider.type]
        )

        const existingMap = new Map(
          existingResult.rows.map((row) => [
            row.provider_user_id,
            {
              id: row.id,
              isEnabled: row.is_enabled,
              moviesEnabled: row.movies_enabled,
              seriesEnabled: row.series_enabled,
            },
          ])
        )

        const usersWithStatus = providerUsers.map((user) => {
          const existing = existingMap.get(user.id)
          return {
            providerUserId: user.id,
            name: user.name,
            isAdmin: user.isAdmin,
            isDisabled: user.isDisabled,
            lastActivityDate: user.lastActivityDate,
            apertureUserId: existing?.id || null,
            isImported: !!existing,
            isEnabled: existing?.isEnabled || false,
            moviesEnabled: existing?.moviesEnabled || false,
            seriesEnabled: existing?.seriesEnabled || false,
          }
        })

        return reply.send({
          provider: provider.type,
          users: usersWithStatus,
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to fetch provider users during setup')
        return reply.status(500).send({ error: 'Failed to fetch users from media server' })
      }
    }
  )

  /**
   * POST /api/setup/users/import
   * Import a user from media server into Aperture DB.
   */
  fastify.post<{ Body: SetupUserImportBody }>(
    '/api/setup/users/import',
    { schema: setupSchemas.importUser },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) {
        return reply.status(403).send({
          error: 'Setup is complete. Manage users in Admin → Users.',
        })
      }

      const { providerUserId, moviesEnabled = false, seriesEnabled = false } = request.body || {}

      if (!providerUserId) {
        return reply.status(400).send({ error: 'providerUserId is required' })
      }

      const apiKey = await getMediaServerApiKey()
      if (!apiKey) {
        return reply.status(400).send({ error: 'Media server must be configured first' })
      }

      try {
        const provider = await getMediaServerProvider()

        const existing = await queryOne<{ id: string }>(
          `SELECT id FROM users WHERE provider = $1 AND provider_user_id = $2`,
          [provider.type, providerUserId]
        )

        if (existing) {
          const updated = await queryOne<{
            id: string
            username: string
            is_enabled: boolean
            movies_enabled: boolean
            series_enabled: boolean
          }>(
            `UPDATE users 
             SET movies_enabled = $1, series_enabled = $2, is_enabled = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING id, username, is_enabled, movies_enabled, series_enabled`,
            [moviesEnabled, seriesEnabled, moviesEnabled || seriesEnabled, existing.id]
          )
          return reply.send({ user: updated, alreadyImported: true })
        }

        const providerUser = await provider.getUserById(apiKey, providerUserId)

        const newUser = await queryOne<{
          id: string
          username: string
          is_admin: boolean
          is_enabled: boolean
          movies_enabled: boolean
          series_enabled: boolean
        }>(
          `INSERT INTO users (username, display_name, provider, provider_user_id, is_admin, is_enabled, movies_enabled, series_enabled, max_parental_rating)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, username, is_admin, is_enabled, movies_enabled, series_enabled`,
          [
            providerUser.name,
            providerUser.name,
            provider.type,
            providerUserId,
            providerUser.isAdmin,
            moviesEnabled || seriesEnabled,
            moviesEnabled,
            seriesEnabled,
            providerUser.maxParentalRating ?? null,
          ]
        )

        fastify.log.info(
          { userId: newUser?.id, providerUserId, name: providerUser.name },
          'User imported during setup'
        )

        return reply.status(201).send({ user: newUser })
      } catch (error) {
        fastify.log.error({ error, providerUserId }, 'Failed to import user during setup')
        return reply.status(500).send({ error: 'Failed to import user from media server' })
      }
    }
  )

  /**
   * POST /api/setup/users/enable
   * Update movies/series enabled status for an imported user.
   */
  fastify.post<{ Body: SetupUserEnableBody }>(
    '/api/setup/users/enable',
    { schema: setupSchemas.enableUser },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) {
        return reply.status(403).send({
          error: 'Setup is complete. Manage users in Admin → Users.',
        })
      }

      const { apertureUserId, moviesEnabled, seriesEnabled } = request.body || {}

      if (!apertureUserId) {
        return reply.status(400).send({ error: 'apertureUserId is required' })
      }

      try {
        const updates: string[] = []
        const values: unknown[] = []
        let paramIndex = 1

        if (moviesEnabled !== undefined) {
          updates.push(`movies_enabled = $${paramIndex++}`)
          values.push(moviesEnabled)
        }
        if (seriesEnabled !== undefined) {
          updates.push(`series_enabled = $${paramIndex++}`)
          values.push(seriesEnabled)
        }

        if (updates.length === 0) {
          return reply
            .status(400)
            .send({ error: 'At least one of moviesEnabled or seriesEnabled is required' })
        }

        updates.push(
          `is_enabled = COALESCE($${paramIndex++}, movies_enabled) OR COALESCE($${paramIndex++}, series_enabled)`
        )
        values.push(moviesEnabled ?? null, seriesEnabled ?? null)

        updates.push('updated_at = NOW()')
        values.push(apertureUserId)

        const updated = await queryOne<{
          id: string
          username: string
          is_enabled: boolean
          movies_enabled: boolean
          series_enabled: boolean
        }>(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
           RETURNING id, username, is_enabled, movies_enabled, series_enabled`,
          values
        )

        if (!updated) {
          return reply.status(404).send({ error: 'User not found' })
        }

        return reply.send({ user: updated })
      } catch (error) {
        fastify.log.error({ error, apertureUserId }, 'Failed to update user during setup')
        return reply.status(500).send({ error: 'Failed to update user' })
      }
    }
  )
}
