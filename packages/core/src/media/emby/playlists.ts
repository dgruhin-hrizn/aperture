/**
 * Emby Playlists Module
 */

import type { PlaylistCreateResult, PlaylistItem } from '../types.js'
import type { EmbyItemsResponse } from './types.js'
import { logger, type EmbyProviderBase } from './base.js'
import { updateEmbyItem } from './itemUpdates.js'
import {
  buildItemSearchParams,
  buildPlaylistCreateParams,
  playlistAddItemsPath,
  playlistItemsPath,
  playlistRemoveItemsPath,
} from './requestBuilders.js'

export async function createOrUpdatePlaylist(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  name: string,
  itemIds: string[]
): Promise<PlaylistCreateResult> {
  const params = buildItemSearchParams({
    includeItemTypes: 'Playlist',
    searchTerm: name,
    userId,
  })

  const existing = await provider.fetch<EmbyItemsResponse>(`/Items?${params}`, apiKey)
  const playlist = existing.Items.find((p) => p.Name === name)

  if (playlist) {
    const existingItems = await provider.fetch<{
      Items: Array<{ PlaylistItemId: string }>
    }>(playlistItemsPath(playlist.Id), apiKey)

    if (existingItems.Items && existingItems.Items.length > 0) {
      const entryIds = existingItems.Items.map((item) => item.PlaylistItemId)
      await provider.fetch(playlistRemoveItemsPath(playlist.Id, entryIds), apiKey, {
        method: 'DELETE',
      })
    }

    if (itemIds.length > 0) {
      await provider.fetch(playlistAddItemsPath(playlist.Id, itemIds), apiKey, {
        method: 'POST',
      })
    }

    return { playlistId: playlist.Id }
  }

  const createParams = buildPlaylistCreateParams(name, userId, itemIds)

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
  }>(`${playlistItemsPath(playlistId)}?Fields=ImageTags,ProductionYear,RunTimeTicks`, apiKey)

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
  await provider.fetch(playlistRemoveItemsPath(playlistId, entryIds), apiKey, {
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
  await provider.fetch(playlistAddItemsPath(playlistId, itemIds), apiKey, {
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

export async function updatePlaylistOverview(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  playlistId: string,
  overview: string
): Promise<void> {
  logger.info({ userId, playlistId, overviewLength: overview?.length }, 'Updating playlist overview')

  try {
    const itemId = await updateEmbyItem(
      provider,
      apiKey,
      `/Users/${userId}/Items/${playlistId}`,
      (item) => {
        item.Overview = overview
      }
    )
    logger.info({ playlistId, itemId }, 'Successfully updated playlist overview')
  } catch (err) {
    logger.error({ err, userId, playlistId }, 'Failed to set overview for playlist')
  }
}

export async function createPlaylistWithOverview(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  name: string,
  itemIds: string[],
  overview?: string
): Promise<PlaylistCreateResult> {
  const result = await createOrUpdatePlaylist(provider, apiKey, userId, name, itemIds)

  logger.info({ playlistId: result.playlistId, hasOverview: !!overview }, 'Playlist created, setting overview')

  if (overview) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await updatePlaylistOverview(provider, apiKey, userId, result.playlistId, overview)
  }

  return result
}
