import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import type { ChannelRow } from '../types.js'

export function registerSharesHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/channels/:id/shares
   * Get channel shares
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/channels/:id/shares',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      const channel = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (channel.owner_id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const shares = await query(
        `SELECT cs.*, u.username, u.display_name
         FROM channel_shares cs
         JOIN users u ON u.id = cs.shared_with_user_id
         WHERE cs.channel_id = $1`,
        [id]
      )

      return reply.send({ shares: shares.rows })
    }
  )

  /**
   * POST /api/channels/:id/shares
   * Share channel with user
   */
  fastify.post<{ Params: { id: string }; Body: { userId: string } }>(
    '/api/channels/:id/shares',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const { userId } = request.body
      const currentUser = request.user as SessionUser

      const channel = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (channel.owner_id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Check if user exists
      const targetUser = await queryOne(`SELECT id FROM users WHERE id = $1`, [userId])
      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' })
      }

      // Create share
      const share = await queryOne(
        `INSERT INTO channel_shares (channel_id, shared_with_user_id)
         VALUES ($1, $2)
         ON CONFLICT (channel_id, shared_with_user_id) DO NOTHING
         RETURNING *`,
        [id, userId]
      )

      return reply.status(201).send({ share })
    }
  )

  /**
   * DELETE /api/channels/:id/shares/:userId
   * Remove channel share
   */
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/api/channels/:id/shares/:userId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, userId } = request.params
      const currentUser = request.user as SessionUser

      const channel = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (channel.owner_id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      await query(
        `DELETE FROM channel_shares WHERE channel_id = $1 AND shared_with_user_id = $2`,
        [id, userId]
      )

      return reply.send({ success: true })
    }
  )
}



