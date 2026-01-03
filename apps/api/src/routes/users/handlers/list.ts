import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, requireAdmin, type SessionUser } from '../../../plugins/auth.js'
import type { UserRow, UserListResponse, UserUpdateBody } from '../types.js'

export function registerListHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users
   * List all users (admin only)
   */
  fastify.get<{ Reply: UserListResponse }>(
    '/api/users',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const result = await query<UserRow>(
        `SELECT id, username, display_name, provider, provider_user_id, is_admin, is_enabled, movies_enabled, series_enabled, created_at, updated_at
         FROM users
         ORDER BY username ASC`
      )

      return reply.send({
        users: result.rows,
        total: result.rows.length,
      })
    }
  )

  /**
   * GET /api/users/:id
   * Get user by ID (admin only, or own user)
   */
  fastify.get<{ Params: { id: string }; Reply: UserRow }>(
    '/api/users/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Allow access to own user or admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' } as never)
      }

      const user = await queryOne<UserRow>(
        `SELECT id, username, display_name, provider, provider_user_id, is_admin, is_enabled, movies_enabled, series_enabled, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
      )

      if (!user) {
        return reply.status(404).send({ error: 'User not found' } as never)
      }

      return reply.send(user)
    }
  )

  /**
   * PUT /api/users/:id
   * Update user (admin only)
   */
  fastify.put<{ Params: { id: string }; Body: UserUpdateBody; Reply: UserRow }>(
    '/api/users/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params
      const { displayName, isEnabled, moviesEnabled, seriesEnabled } = request.body

      // Build update query dynamically
      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (displayName !== undefined) {
        updates.push(`display_name = $${paramIndex++}`)
        values.push(displayName)
      }

      if (isEnabled !== undefined) {
        updates.push(`is_enabled = $${paramIndex++}`)
        values.push(isEnabled)
      }

      if (moviesEnabled !== undefined) {
        updates.push(`movies_enabled = $${paramIndex++}`)
        values.push(moviesEnabled)
        // Also update is_enabled for backwards compatibility
        if (moviesEnabled || seriesEnabled) {
          updates.push(`is_enabled = true`)
        }
      }

      if (seriesEnabled !== undefined) {
        updates.push(`series_enabled = $${paramIndex++}`)
        values.push(seriesEnabled)
        // Also update is_enabled for backwards compatibility
        if (moviesEnabled || seriesEnabled) {
          updates.push(`is_enabled = true`)
        }
      }

      // If both movies and series are disabled, disable overall is_enabled
      if (moviesEnabled === false && seriesEnabled === false) {
        updates.push(`is_enabled = false`)
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' } as never)
      }

      values.push(id)
      const user = await queryOne<UserRow>(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING id, username, display_name, provider, provider_user_id, is_admin, is_enabled, movies_enabled, series_enabled, created_at, updated_at`,
        values
      )

      if (!user) {
        return reply.status(404).send({ error: 'User not found' } as never)
      }

      return reply.send(user)
    }
  )
}

