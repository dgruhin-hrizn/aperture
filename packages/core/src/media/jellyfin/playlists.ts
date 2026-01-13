/**
 * Jellyfin Playlists Module
 */

import type { PlaylistCreateResult, PlaylistItem } from '../types.js'
import type { JellyfinItemsResponse } from './types.js'
import { logger, type JellyfinProviderBase } from './base.js'

export async function createOrUpdatePlaylist(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  name: string,
  itemIds: string[]
): Promise<PlaylistCreateResult> {
  // First, try to find existing playlist
  const params = new URLSearchParams({
    IncludeItemTypes: 'Playlist',
    Recursive: 'true',
    SearchTerm: name,
  })

  const existing = await provider.fetch<JellyfinItemsResponse>(
    `/Users/${userId}/Items?${params}`,
    apiKey
  )
  const playlist = existing.Items.find((p) => p.Name === name)

  if (playlist) {
    // In Jellyfin, we need to get playlist items and remove them first
    const playlistItems = await provider.fetch<JellyfinItemsResponse>(
      `/Playlists/${playlist.Id}/Items`,
      apiKey
    )

    // Remove all existing items
    if (playlistItems.Items.length > 0) {
      const entryIds = playlistItems.Items.map((i) => i.Id).join(',')
      await provider.fetch(`/Playlists/${playlist.Id}/Items?EntryIds=${entryIds}`, apiKey, {
        method: 'DELETE',
      })
    }

    // Add new items
    if (itemIds.length > 0) {
      await provider.fetch(`/Playlists/${playlist.Id}/Items?Ids=${itemIds.join(',')}`, apiKey, {
        method: 'POST',
      })
    }

    return { playlistId: playlist.Id }
  }

  // Create new playlist
  const createBody = {
    Name: name,
    UserId: userId,
    MediaType: 'Video',
    Ids: itemIds,
  }

  const created = await provider.fetch<{ Id: string }>('/Playlists', apiKey, {
    method: 'POST',
    body: JSON.stringify(createBody),
  })

  return { playlistId: created.Id }
}

export async function deletePlaylist(
  provider: JellyfinProviderBase,
  apiKey: string,
  playlistId: string
): Promise<void> {
  await provider.fetch(`/Items/${playlistId}`, apiKey, { method: 'DELETE' })
}

export async function getPlaylistItems(
  provider: JellyfinProviderBase,
  apiKey: string,
  playlistId: string
): Promise<PlaylistItem[]> {
  const response = await provider.fetch<{
    Items: Array<{
      Id: string
      PlaylistItemId: string
      Name: string
      ProductionYear?: number
      ImageTags?: { Primary?: string }
      RunTimeTicks?: number
    }>
  }>(`/Playlists/${playlistId}/Items?Fields=ImageTags,ProductionYear,RunTimeTicks`, apiKey)

  return response.Items.map((item) => ({
    id: item.Id,
    playlistItemId: item.PlaylistItemId,
    title: item.Name,
    year: item.ProductionYear || null,
    posterUrl: item.ImageTags?.Primary
      ? `${provider.baseUrl}/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}`
      : null,
    runtime: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
  }))
}

export async function removePlaylistItems(
  provider: JellyfinProviderBase,
  apiKey: string,
  playlistId: string,
  entryIds: string[]
): Promise<void> {
  if (entryIds.length === 0) return
  await provider.fetch(`/Playlists/${playlistId}/Items?EntryIds=${entryIds.join(',')}`, apiKey, {
    method: 'DELETE',
  })
}

export async function addPlaylistItems(
  provider: JellyfinProviderBase,
  apiKey: string,
  playlistId: string,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return
  await provider.fetch(`/Playlists/${playlistId}/Items?Ids=${itemIds.join(',')}`, apiKey, {
    method: 'POST',
  })
}

export async function getGenres(provider: JellyfinProviderBase, apiKey: string): Promise<string[]> {
  const params = new URLSearchParams({
    IncludeItemTypes: 'Movie',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
  })

  const response = await provider.fetch<{ Items: Array<{ Name: string }> }>(
    `/Genres?${params}`,
    apiKey
  )

  return response.Items.map((item) => item.Name)
}

/**
 * Update playlist overview/description
 * Jellyfin requires posting the full item object back when updating metadata
 * 
 * Note: GET requires user context (/Users/{userId}/Items/{id})
 *       POST works with just /Items/{id}
 */
export async function updatePlaylistOverview(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  playlistId: string,
  overview: string
): Promise<void> {
  logger.info({ userId, playlistId, overviewLength: overview?.length }, 'Updating playlist overview')
  
  try {
    // Fetch the full item data using user context (required for playlists)
    logger.debug({ endpoint: `/Users/${userId}/Items/${playlistId}` }, 'Fetching playlist item')
    const item = await provider.fetch<Record<string, unknown>>(
      `/Users/${userId}/Items/${playlistId}`,
      apiKey
    )
    logger.debug({ itemName: item.Name, hasItem: !!item }, 'Fetched playlist item')

    // Update the overview
    item.Overview = overview

    // POST the full item back (doesn't need user context)
    logger.debug({ endpoint: `/Items/${playlistId}` }, 'Posting updated item')
    await provider.fetch(`/Items/${playlistId}`, apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    logger.info({ playlistId }, 'Successfully updated playlist overview')
  } catch (err) {
    // Log the full error for debugging
    logger.error({ err, userId, playlistId }, 'Failed to set overview for playlist')
  }
}

/**
 * Create a new playlist with items and optional overview
 */
export async function createPlaylistWithOverview(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  name: string,
  itemIds: string[],
  overview?: string
): Promise<PlaylistCreateResult> {
  // Create the playlist first
  const result = await createOrUpdatePlaylist(provider, apiKey, userId, name, itemIds)
  
  logger.info({ playlistId: result.playlistId, hasOverview: !!overview }, 'Playlist created, setting overview')

  // Set overview if provided
  if (overview) {
    // Small delay to ensure Jellyfin has fully registered the playlist
    await new Promise(resolve => setTimeout(resolve, 500))
    await updatePlaylistOverview(provider, apiKey, userId, result.playlistId, overview)
  }

  return result
}



