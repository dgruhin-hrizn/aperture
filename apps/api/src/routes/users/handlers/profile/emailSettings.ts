import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../../plugins/auth.js'
import { requireSelfOrAdmin } from './shared.js'

export function registerEmailSettingsHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/:id/email-settings
   * Get user's email and notification settings
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/email-settings',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      try {
        const result = await queryOne<{
          email: string | null
          email_locked: boolean
          email_notifications_enabled: boolean
        }>(
          `SELECT email, email_locked, email_notifications_enabled FROM users WHERE id = $1`,
          [id]
        )

        if (!result) {
          return reply.status(404).send({ error: 'User not found' })
        }

        return reply.send({
          email: result.email,
          emailLocked: result.email_locked,
          emailNotificationsEnabled: result.email_notifications_enabled,
        })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get email settings')
        return reply.status(500).send({ error: 'Failed to get email settings' })
      }
    }
  )

  /**
   * PATCH /api/users/:id/email-settings
   * Update user's email (locks it to prevent Emby sync overwrite)
   */
  fastify.patch<{
    Params: { id: string }
    Body: {
      email?: string | null
      emailNotificationsEnabled?: boolean
    }
  }>(
    '/api/users/:id/email-settings',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser
      const { email, emailNotificationsEnabled } = request.body

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      try {
        const updates: string[] = []
        const values: (string | boolean | null)[] = []
        let paramIndex = 1

        if (email !== undefined) {
          updates.push(`email = $${paramIndex}`)
          values.push(email)
          paramIndex++

          if (email !== null && email.trim() !== '') {
            updates.push(`email_locked = TRUE`)
          } else {
            updates.push(`email_locked = FALSE`)
          }
        }

        if (emailNotificationsEnabled !== undefined) {
          updates.push(`email_notifications_enabled = $${paramIndex}`)
          values.push(emailNotificationsEnabled)
          paramIndex++
        }

        if (updates.length === 0) {
          return reply.status(400).send({ error: 'No updates provided' })
        }

        updates.push('updated_at = NOW()')
        values.push(id)

        await query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
          values
        )

        const result = await queryOne<{
          email: string | null
          email_locked: boolean
          email_notifications_enabled: boolean
        }>(
          `SELECT email, email_locked, email_notifications_enabled FROM users WHERE id = $1`,
          [id]
        )

        return reply.send({
          email: result?.email,
          emailLocked: result?.email_locked,
          emailNotificationsEnabled: result?.email_notifications_enabled,
        })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to update email settings')
        return reply.status(500).send({ error: 'Failed to update email settings' })
      }
    }
  )
}
