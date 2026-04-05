/**
 * Emby user favorites (series) — FavoriteItems API
 */

import type { EmbyProviderBase } from './base.js'
import { logger } from './base.js'

interface EmbyItemsIdResponse {
  Items: { Id: string }[]
  TotalRecordCount: number
}

/**
 * Paginated list of favorited series item ids for a user.
 */
export async function getFavoriteSeriesIdsForUser(
  provider: EmbyProviderBase,
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

    const response = await provider.fetch<EmbyItemsIdResponse>(
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

  logger.debug({ userId, count: ids.length }, 'Fetched Emby favorite series ids')
  return ids
}

export async function favoriteSeriesItem(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  itemId: string
): Promise<void> {
  const path = `/Users/${encodeURIComponent(userId)}/FavoriteItems/${encodeURIComponent(itemId)}`
  await provider.fetch(path, apiKey, { method: 'POST' })
}

/**
 * Idempotent: 404 means already not a favorite.
 */
export async function unfavoriteSeriesItem(
  provider: EmbyProviderBase,
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
