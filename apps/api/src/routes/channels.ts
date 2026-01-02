import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth, type SessionUser } from '../plugins/auth.js'

interface ChannelRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  genre_filters: string[]
  text_preferences: string | null
  example_movie_ids: string[]
  is_pinned_row: boolean
  playlist_id: string | null
  is_active: boolean
  last_generated_at: Date | null
  created_at: Date
  updated_at: Date
}

interface ChannelCreateBody {
  name: string
  description?: string
  genreFilters?: string[]
  textPreferences?: string
  exampleMovieIds?: string[]
  isPinnedRow?: boolean
}

interface ChannelUpdateBody {
  name?: string
  description?: string
  genreFilters?: string[]
  textPreferences?: string
  exampleMovieIds?: string[]
  isPinnedRow?: boolean
  isActive?: boolean
}

const channelsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/channels
   * List user's channels
   */
  fastify.get('/api/channels', { preHandler: requireAuth }, async (request, reply) => {
    const currentUser = request.user as SessionUser

    const result = await query<ChannelRow>(
      `SELECT * FROM channels WHERE owner_id = $1 ORDER BY name ASC`,
      [currentUser.id]
    )

    return reply.send({ channels: result.rows })
  })

  /**
   * POST /api/channels
   * Create a new channel
   */
  fastify.post<{ Body: ChannelCreateBody }>(
    '/api/channels',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { name, description, genreFilters, textPreferences, exampleMovieIds, isPinnedRow } =
        request.body

      if (!name) {
        return reply.status(400).send({ error: 'Name is required' })
      }

      const channel = await queryOne<ChannelRow>(
        `INSERT INTO channels (owner_id, name, description, genre_filters, text_preferences, example_movie_ids, is_pinned_row)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          currentUser.id,
          name,
          description || null,
          genreFilters || [],
          textPreferences || null,
          exampleMovieIds || [],
          isPinnedRow || false,
        ]
      )

      return reply.status(201).send({ channel })
    }
  )

  /**
   * GET /api/channels/:id
   * Get channel by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/channels/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      const channel = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      // Check ownership or admin
      if (channel.owner_id !== currentUser.id && !currentUser.isAdmin) {
        // Check if shared with user
        const share = await queryOne(
          `SELECT * FROM channel_shares WHERE channel_id = $1 AND shared_with_user_id = $2`,
          [id, currentUser.id]
        )

        if (!share) {
          return reply.status(403).send({ error: 'Forbidden' })
        }
      }

      return reply.send({ channel })
    }
  )

  /**
   * PUT /api/channels/:id
   * Update channel
   */
  fastify.put<{ Params: { id: string }; Body: ChannelUpdateBody }>(
    '/api/channels/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Check ownership
      const existing = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!existing) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (existing.owner_id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const { name, description, genreFilters, textPreferences, exampleMovieIds, isPinnedRow, isActive } =
        request.body

      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(name)
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(description)
      }
      if (genreFilters !== undefined) {
        updates.push(`genre_filters = $${paramIndex++}`)
        values.push(genreFilters)
      }
      if (textPreferences !== undefined) {
        updates.push(`text_preferences = $${paramIndex++}`)
        values.push(textPreferences)
      }
      if (exampleMovieIds !== undefined) {
        updates.push(`example_movie_ids = $${paramIndex++}`)
        values.push(exampleMovieIds)
      }
      if (isPinnedRow !== undefined) {
        updates.push(`is_pinned_row = $${paramIndex++}`)
        values.push(isPinnedRow)
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`)
        values.push(isActive)
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' })
      }

      values.push(id)
      const channel = await queryOne<ChannelRow>(
        `UPDATE channels SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      )

      return reply.send({ channel })
    }
  )

  /**
   * DELETE /api/channels/:id
   * Delete channel
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/channels/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      const existing = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!existing) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (existing.owner_id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      await query('DELETE FROM channels WHERE id = $1', [id])

      return reply.send({ success: true })
    }
  )

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

export default channelsRoutes

