/**
 * Jellyfin user favorites (series) — same routes as Emby
 */

import type { JellyfinProviderBase } from './base.js'
import { logger } from './base.js'

interface JellyfinItemsIdResponse {
  Items: { Id: string }[]
  TotalRecordCount: number
}

export async function getFavoriteSeriesIdsForUser(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string
): Promise<string[]> {
  const ids: string[] = []
  let startIndex = 0
  const pageSize = 500

  while (true) {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Series',
      Recursive: 'true',
      Fields: 'Id',
      IsFavorite: 'true',
      UserId: userId,
      StartIndex: String(startIndex),
      Limit: String(pageSize),
    })

    const response = await provider.fetch<JellyfinItemsIdResponse>(
      `/Users/${userId}/Items?${params}`,
      apiKey
    )

    for (const item of response.Items) {
      ids.push(item.Id)
    }

    if (response.Items.length === 0 || startIndex + response.Items.length >= response.TotalRecordCount) {
      break
    }
    startIndex += response.Items.length
  }

  logger.debug({ userId, count: ids.length }, 'Fetched Jellyfin favorite series ids')
  return ids
}

export async function favoriteSeriesItem(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  itemId: string
): Promise<void> {
  const path = `/Users/${encodeURIComponent(userId)}/FavoriteItems/${encodeURIComponent(itemId)}`
  await provider.fetch(path, apiKey, { method: 'POST' })
}

export async function unfavoriteSeriesItem(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  itemId: string
): Promise<void> {
  const path = `/Users/${encodeURIComponent(userId)}/FavoriteItems/${encodeURIComponent(itemId)}`
  try {
    await provider.fetch(path, apiKey, { method: 'DELETE' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('404')) {
      logger.debug({ userId, itemId }, 'Unfavorite noop (already not favorite)')
      return
    }
    throw err
  }
}
