import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { requireAuth, type SessionUser } from '../../plugins/auth.js'
import {
  generateGraphPlaylistName,
  generateGraphPlaylistDescription,
  createGraphPlaylist,
  getGraphPlaylists,
  getGraphPlaylist,
  deleteGraphPlaylist,
  getGraphPlaylistItems,
} from '@aperture/core'
import { graphPlaylistsSchemas } from './schemas.js'

const graphPlaylistRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(graphPlaylistsSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * POST /api/graph-playlists/ai-name
   * Generate an AI-powered name for a graph playlist
   */
  fastify.post<{
    Body: {
      movieIds: string[]
      seriesIds: string[]
    }
  }>(
    '/api/graph-playlists/ai-name',
    { preHandler: requireAuth, schema: { tags: ["playlists"] } },
    async (request, reply) => {
      const { movieIds, seriesIds } = request.body

      if ((!movieIds || movieIds.length === 0) && (!seriesIds || seriesIds.length === 0)) {
        return reply.status(400).send({ error: 'At least one movie or series ID is required' })
      }

      try {
        const name = await generateGraphPlaylistName(movieIds || [], seriesIds || [])
        return reply.send({ name })
      } catch (err) {
        request.log.error({ err }, 'Failed to generate graph playlist name')
        return reply.status(500).send({ error: 'Failed to generate playlist name' })
      }
    }
  )

  /**
   * POST /api/graph-playlists/ai-description
   * Generate an AI-powered description for a graph playlist
   */
  fastify.post<{
    Body: {
      movieIds: string[]
      seriesIds: string[]
      name?: string
    }
  }>(
    '/api/graph-playlists/ai-description',
    { preHandler: requireAuth, schema: { tags: ["playlists"] } },
    async (request, reply) => {
      const { movieIds, seriesIds, name } = request.body

      if ((!movieIds || movieIds.length === 0) && (!seriesIds || seriesIds.length === 0)) {
        return reply.status(400).send({ error: 'At least one movie or series ID is required' })
      }

      try {
        const description = await generateGraphPlaylistDescription(
          movieIds || [],
          seriesIds || [],
          name
        )
        return reply.send({ description })
      } catch (err) {
        request.log.error({ err }, 'Failed to generate graph playlist description')
        return reply.status(500).send({ error: 'Failed to generate playlist description' })
      }
    }
  )

  /**
   * POST /api/graph-playlists
   * Create a new graph playlist
   */
  fastify.post<{
    Body: {
      name: string
      description?: string
      movieIds: string[]
      seriesIds: string[]
      sourceItemId?: string
      sourceItemType?: 'movie' | 'series'
    }
  }>(
    '/api/graph-playlists',
    { preHandler: requireAuth, schema: { tags: ["playlists"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { name, description, movieIds, seriesIds, sourceItemId, sourceItemType } = request.body

      if (!name) {
        return reply.status(400).send({ error: 'Playlist name is required' })
      }

      if ((!movieIds || movieIds.length === 0) && (!seriesIds || seriesIds.length === 0)) {
        return reply.status(400).send({ error: 'At least one movie or series ID is required' })
      }

      try {
        request.log.info({
          userId: currentUser.id,
          name,
          movieIds: movieIds || [],
          seriesIds: seriesIds || [],
          sourceItemId,
          sourceItemType,
        }, 'Creating graph playlist')

        const playlist = await createGraphPlaylist(currentUser.id, {
          name,
          description,
          movieIds: movieIds || [],
          seriesIds: seriesIds || [],
          sourceItemId,
          sourceItemType,
        })

        return reply.status(201).send(playlist)
      } catch (err) {
        request.log.error({ 
          err, 
          userId: currentUser.id,
          errorMessage: err instanceof Error ? err.message : 'Unknown',
          errorStack: err instanceof Error ? err.stack : undefined,
        }, 'Failed to create graph playlist')
        const message = err instanceof Error ? err.message : 'Failed to create playlist'
        return reply.status(500).send({ error: message })
      }
    }
  )

  /**
   * GET /api/graph-playlists
   * Get all graph playlists for the current user
   */
  fastify.get(
    '/api/graph-playlists',
    { preHandler: requireAuth, schema: { tags: ["playlists"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser

      try {
        const playlists = await getGraphPlaylists(currentUser.id)
        return reply.send({ playlists })
      } catch (err) {
        request.log.error({ err, userId: currentUser.id }, 'Failed to get graph playlists')
        return reply.status(500).send({ error: 'Failed to get playlists' })
      }
    }
  )

  /**
   * GET /api/graph-playlists/:id
   * Get a single graph playlist
   */
  fastify.get<{
    Params: { id: string }
  }>(
    '/api/graph-playlists/:id',
    { preHandler: requireAuth, schema: { tags: ["playlists"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { id } = request.params

      try {
        const playlist = await getGraphPlaylist(id)

        if (!playlist) {
          return reply.status(404).send({ error: 'Playlist not found' })
        }

        if (playlist.ownerId !== currentUser.id && !currentUser.isAdmin) {
          return reply.status(403).send({ error: 'Not authorized to view this playlist' })
        }

        return reply.send(playlist)
      } catch (err) {
        request.log.error({ err, playlistId: id }, 'Failed to get graph playlist')
        return reply.status(500).send({ error: 'Failed to get playlist' })
      }
    }
  )

  /**
   * GET /api/graph-playlists/:id/items
   * Get items in a graph playlist
   */
  fastify.get<{
    Params: { id: string }
  }>(
    '/api/graph-playlists/:id/items',
    { preHandler: requireAuth, schema: { tags: ["playlists"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { id } = request.params

      try {
        const items = await getGraphPlaylistItems(id, currentUser.id)
        return reply.send({ items })
      } catch (err) {
        request.log.error({ err, playlistId: id }, 'Failed to get graph playlist items')
        const message = err instanceof Error ? err.message : 'Failed to get playlist items'
        return reply.status(500).send({ error: message })
      }
    }
  )

  /**
   * DELETE /api/graph-playlists/:id
   * Delete a graph playlist
   */
  fastify.delete<{
    Params: { id: string }
  }>(
    '/api/graph-playlists/:id',
    { preHandler: requireAuth, schema: { tags: ["playlists"] } },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { id } = request.params

      try {
        await deleteGraphPlaylist(id, currentUser.id)
        return reply.status(204).send()
      } catch (err) {
        request.log.error({ err, playlistId: id }, 'Failed to delete graph playlist')
        const message = err instanceof Error ? err.message : 'Failed to delete playlist'
        
        if (message === 'Playlist not found') {
          return reply.status(404).send({ error: message })
        }
        if (message === 'Not authorized to delete this playlist') {
          return reply.status(403).send({ error: message })
        }
        
        return reply.status(500).send({ error: message })
      }
    }
  )
}

export default graphPlaylistRoutes
