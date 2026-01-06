import type { FastifyInstance } from 'fastify'
import { queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import {
  updateChannelPlaylist,
  generateChannelRecommendations,
  getMediaServerProvider,
} from '@aperture/core'
import type { ChannelRow } from '../types.js'

export function registerPlaylistHandlers(fastify: FastifyInstance) {
  /**
   * POST /api/channels/:id/generate
   * Generate/refresh playlist for channel
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/channels/:id/generate',
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

      try {
        // Generate recommendations and update playlist
        const recommendations = await generateChannelRecommendations(id)
        const playlistId = await updateChannelPlaylist(id)

        return reply.send({
          playlistId,
          itemCount: recommendations.length,
          message: `Playlist updated with ${recommendations.length} movies`,
        })
      } catch (err) {
        request.log.error({ err, channelId: id }, 'Failed to generate channel playlist')
        return reply.status(500).send({ error: 'Failed to generate playlist' })
      }
    }
  )

  /**
   * GET /api/channels/:id/items
   * Get playlist items for a channel
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/channels/:id/items',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      const channel = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

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

      if (!channel.playlist_id) {
        return reply.send({ items: [], message: 'No playlist generated yet' })
      }

      const apiKey = process.env.MEDIA_SERVER_API_KEY
      if (!apiKey) {
        return reply.status(500).send({ error: 'Media server API key not configured' })
      }

      try {
        const provider = getMediaServerProvider()
        const items = await provider.getPlaylistItems(apiKey, channel.playlist_id)
        return reply.send({ items, playlistId: channel.playlist_id })
      } catch (err) {
        request.log.error({ err, channelId: id, playlistId: channel.playlist_id }, 'Failed to get playlist items')
        return reply.status(500).send({ error: 'Failed to get playlist items' })
      }
    }
  )

  /**
   * DELETE /api/channels/:id/items/:entryId
   * Remove an item from the playlist
   */
  fastify.delete<{ Params: { id: string; entryId: string } }>(
    '/api/channels/:id/items/:entryId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, entryId } = request.params
      const currentUser = request.user as SessionUser

      const channel = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (channel.owner_id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (!channel.playlist_id) {
        return reply.status(400).send({ error: 'No playlist exists for this channel' })
      }

      const apiKey = process.env.MEDIA_SERVER_API_KEY
      if (!apiKey) {
        return reply.status(500).send({ error: 'Media server API key not configured' })
      }

      try {
        const provider = getMediaServerProvider()
        await provider.removePlaylistItems(apiKey, channel.playlist_id, [entryId])
        return reply.send({ success: true })
      } catch (err) {
        request.log.error({ err, channelId: id, entryId }, 'Failed to remove playlist item')
        return reply.status(500).send({ error: 'Failed to remove item' })
      }
    }
  )

  /**
   * POST /api/channels/:id/items
   * Add items to the playlist
   */
  fastify.post<{ Params: { id: string }; Body: { itemIds: string[] } }>(
    '/api/channels/:id/items',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const { itemIds } = request.body
      const currentUser = request.user as SessionUser

      const channel = await queryOne<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [id])

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (channel.owner_id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (!channel.playlist_id) {
        return reply.status(400).send({ error: 'No playlist exists for this channel' })
      }

      if (!itemIds || itemIds.length === 0) {
        return reply.status(400).send({ error: 'No items provided' })
      }

      const apiKey = process.env.MEDIA_SERVER_API_KEY
      if (!apiKey) {
        return reply.status(500).send({ error: 'Media server API key not configured' })
      }

      try {
        const provider = getMediaServerProvider()
        await provider.addPlaylistItems(apiKey, channel.playlist_id, itemIds)
        return reply.send({ success: true, addedCount: itemIds.length })
      } catch (err) {
        request.log.error({ err, channelId: id, itemIds }, 'Failed to add playlist items')
        return reply.status(500).send({ error: 'Failed to add items' })
      }
    }
  )
}


