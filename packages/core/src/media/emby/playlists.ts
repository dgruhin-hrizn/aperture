/**
 * Emby Playlists Module
 */

import type { PlaylistCreateResult, PlaylistItem } from '../types.js'
import type { EmbyItemsResponse } from './types.js'
import type { EmbyProviderBase } from './base.js'

export async function createOrUpdatePlaylist(
  provider: EmbyProviderBase,
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
    UserId: userId,
  })

  const existing = await provider.fetch<EmbyItemsResponse>(`/Items?${params}`, apiKey)
  const playlist = existing.Items.find((p) => p.Name === name)

  if (playlist) {
    // Get existing items to delete them by entry ID
    const existingItems = await provider.fetch<{
      Items: Array<{ PlaylistItemId: string }>
    }>(`/Playlists/${playlist.Id}/Items`, apiKey)

    // Remove all existing items if any
    if (existingItems.Items && existingItems.Items.length > 0) {
      const entryIds = existingItems.Items.map((item) => item.PlaylistItemId).join(',')
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
  const createParams = new URLSearchParams({
    Name: name,
    UserId: userId,
    MediaType: 'Video',
  })

  if (itemIds.length > 0) {
    createParams.set('Ids', itemIds.join(','))
  }

  const created = await provider.fetch<{ Id: string }>(`/Playlists?${createParams}`, apiKey, {
    method: 'POST',
  })

  return { playlistId: created.Id }
}

export async function deletePlaylist(
  provider: EmbyProviderBase,
  apiKey: string,
  playlistId: string
): Promise<void> {
  await provider.fetch(`/Items/${playlistId}`, apiKey, { method: 'DELETE' })
}

export async function getPlaylistItems(
  provider: EmbyProviderBase,
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
  provider: EmbyProviderBase,
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
  provider: EmbyProviderBase,
  apiKey: string,
  playlistId: string,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return
  await provider.fetch(`/Playlists/${playlistId}/Items?Ids=${itemIds.join(',')}`, apiKey, {
    method: 'POST',
  })
}

export async function getGenres(provider: EmbyProviderBase, apiKey: string): Promise<string[]> {
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
 * Emby requires posting the full item object back when updating metadata
 */
export async function updatePlaylistOverview(
  provider: EmbyProviderBase,
  apiKey: string,
  playlistId: string,
  overview: string
): Promise<void> {
  try {
    // Fetch the full item data (required by Emby API for updates)
    const item = await provider.fetch<Record<string, unknown>>(
      `/Items/${playlistId}`,
      apiKey
    )

    // Update the overview
    item.Overview = overview

    // POST the full item back
    await provider.fetch(`/Items/${playlistId}`, apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  } catch {
    // Non-fatal: playlist will still work, just won't have a description
    console.warn(`Failed to set overview for playlist ${playlistId}`)
  }
}

/**
 * Create a new playlist with items and optional overview
 */
export async function createPlaylistWithOverview(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  name: string,
  itemIds: string[],
  overview?: string
): Promise<PlaylistCreateResult> {
  // Create the playlist first
  const result = await createOrUpdatePlaylist(provider, apiKey, userId, name, itemIds)

  // Set overview if provided
  if (overview) {
    await updatePlaylistOverview(provider, apiKey, result.playlistId, overview)
  }

  return result
}



