/**
 * Emby item update helpers — fetch/modify/post pattern required by the Emby API.
 */

import { logger } from './base.js'
import type { EmbyProviderBase } from './base.js'

export async function updateEmbyItem(
  provider: EmbyProviderBase,
  apiKey: string,
  fetchPath: string,
  mutate: (item: Record<string, unknown>) => void
): Promise<string> {
  const item = await provider.fetch<Record<string, unknown>>(fetchPath, apiKey)
  mutate(item)

  const itemId = (item.Id as string) || fetchPath.split('/').pop() || ''
  await provider.fetch(`/Items/${itemId}`, apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })

  return itemId
}

export async function updateEmbyItemSafely(
  provider: EmbyProviderBase,
  apiKey: string,
  fetchPath: string,
  mutate: (item: Record<string, unknown>) => void,
  context: Record<string, unknown>
): Promise<void> {
  try {
    await updateEmbyItem(provider, apiKey, fetchPath, mutate)
  } catch (err) {
    logger.warn({ err, ...context }, 'Non-fatal Emby item update failed')
  }
}

export function setForcedSortName(
  item: Record<string, unknown>,
  sortName: string,
  lockSortName = true
): void {
  item.ForcedSortName = sortName

  if (!lockSortName) {
    return
  }

  const existingLocked = Array.isArray(item.LockedFields) ? item.LockedFields : []
  if (!existingLocked.includes('SortName')) {
    item.LockedFields = [...existingLocked, 'SortName']
  }
}
