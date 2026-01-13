/**
 * Graph Playlists - Create and manage playlists from similarity graphs
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'

const logger = createChildLogger('graphPlaylists')

export interface GraphPlaylist {
  id: string
  name: string
  description: string | null
  mediaServerPlaylistId: string
  ownerId: string
  sourceItemId: string | null
  sourceItemType: string | null
  itemCount: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateGraphPlaylistInput {
  name: string
  description?: string
  movieIds: string[]
  seriesIds: string[]
  sourceItemId?: string
  sourceItemType?: 'movie' | 'series'
}

/**
 * Get media server item IDs from Aperture movie/series IDs
 */
async function getMediaServerItemIds(
  movieIds: string[],
  seriesIds: string[]
): Promise<string[]> {
  const itemIds: string[] = []

  if (movieIds.length > 0) {
    const movies = await query<{ provider_item_id: string }>(
      'SELECT provider_item_id FROM movies WHERE id = ANY($1) AND provider_item_id IS NOT NULL',
      [movieIds]
    )
    itemIds.push(...movies.rows.map((m) => m.provider_item_id))
  }

  if (seriesIds.length > 0) {
    const series = await query<{ provider_item_id: string }>(
      'SELECT provider_item_id FROM series WHERE id = ANY($1) AND provider_item_id IS NOT NULL',
      [seriesIds]
    )
    itemIds.push(...series.rows.map((s) => s.provider_item_id))
  }

  return itemIds
}

/**
 * Create a new playlist from graph items
 */
export async function createGraphPlaylist(
  userId: string,
  input: CreateGraphPlaylistInput
): Promise<GraphPlaylist> {
  logger.info({ userId, input }, 'createGraphPlaylist called')

  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('Media server API key is not configured')
  }

  // Get user's media server user ID
  const user = await queryOne<{ provider_user_id: string }>(
    'SELECT provider_user_id FROM users WHERE id = $1',
    [userId]
  )

  logger.info({ userId, providerUserId: user?.provider_user_id }, 'Got user info')

  if (!user?.provider_user_id) {
    throw new Error('User is not linked to media server')
  }

  // Get media server item IDs
  const mediaServerItemIds = await getMediaServerItemIds(input.movieIds, input.seriesIds)

  logger.info({ movieIds: input.movieIds, seriesIds: input.seriesIds, mediaServerItemIds }, 'Got media server item IDs')

  if (mediaServerItemIds.length === 0) {
    throw new Error('No valid items found to add to playlist')
  }

  logger.info(
    { userId, name: input.name, itemCount: mediaServerItemIds.length },
    'Creating graph playlist on media server'
  )

  // Create playlist on media server with overview
  const result = await provider.createPlaylistWithOverview(
    apiKey,
    user.provider_user_id,
    input.name,
    mediaServerItemIds,
    input.description
  )

  logger.info({ result }, 'Media server playlist created')

  // Store in database
  const dbResult = await queryOne<GraphPlaylist>(
    `INSERT INTO graph_playlists (
      name, description, media_server_playlist_id, owner_id,
      source_item_id, source_item_type, item_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id, name, description,
      media_server_playlist_id as "mediaServerPlaylistId",
      owner_id as "ownerId",
      source_item_id as "sourceItemId",
      source_item_type as "sourceItemType",
      item_count as "itemCount",
      created_at as "createdAt",
      updated_at as "updatedAt"`,
    [
      input.name,
      input.description || null,
      result.playlistId,
      userId,
      input.sourceItemId || null,
      input.sourceItemType || null,
      mediaServerItemIds.length,
    ]
  )

  if (!dbResult) {
    throw new Error('Failed to create graph playlist record')
  }

  logger.info(
    { playlistId: dbResult.id, mediaServerPlaylistId: result.playlistId },
    'Graph playlist created'
  )

  return dbResult
}

/**
 * Get all graph playlists for a user
 */
export async function getGraphPlaylists(userId: string): Promise<GraphPlaylist[]> {
  const result = await query<GraphPlaylist>(
    `SELECT
      id, name, description,
      media_server_playlist_id as "mediaServerPlaylistId",
      owner_id as "ownerId",
      source_item_id as "sourceItemId",
      source_item_type as "sourceItemType",
      item_count as "itemCount",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM graph_playlists
    WHERE owner_id = $1
    ORDER BY created_at DESC`,
    [userId]
  )

  return result.rows
}

/**
 * Get a single graph playlist by ID
 */
export async function getGraphPlaylist(playlistId: string): Promise<GraphPlaylist | null> {
  return queryOne<GraphPlaylist>(
    `SELECT
      id, name, description,
      media_server_playlist_id as "mediaServerPlaylistId",
      owner_id as "ownerId",
      source_item_id as "sourceItemId",
      source_item_type as "sourceItemType",
      item_count as "itemCount",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM graph_playlists
    WHERE id = $1`,
    [playlistId]
  )
}

/**
 * Delete a graph playlist (from both media server and database)
 */
export async function deleteGraphPlaylist(playlistId: string, userId: string): Promise<void> {
  // Get playlist first
  const playlist = await getGraphPlaylist(playlistId)

  if (!playlist) {
    throw new Error('Playlist not found')
  }

  if (playlist.ownerId !== userId) {
    throw new Error('Not authorized to delete this playlist')
  }

  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('Media server API key is not configured')
  }

  logger.info({ playlistId, mediaServerPlaylistId: playlist.mediaServerPlaylistId }, 'Deleting graph playlist')

  // Delete from media server
  try {
    await provider.deletePlaylist(apiKey, playlist.mediaServerPlaylistId)
  } catch (error) {
    // Log but don't fail if media server deletion fails (playlist might already be gone)
    logger.warn({ error, playlistId }, 'Failed to delete playlist from media server')
  }

  // Delete from database
  await query('DELETE FROM graph_playlists WHERE id = $1', [playlistId])

  logger.info({ playlistId }, 'Graph playlist deleted')
}

/**
 * Get playlist items from media server
 */
export async function getGraphPlaylistItems(playlistId: string, userId: string) {
  const playlist = await getGraphPlaylist(playlistId)

  if (!playlist) {
    throw new Error('Playlist not found')
  }

  if (playlist.ownerId !== userId) {
    throw new Error('Not authorized to view this playlist')
  }

  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('Media server API key is not configured')
  }

  return provider.getPlaylistItems(apiKey, playlist.mediaServerPlaylistId)
}

