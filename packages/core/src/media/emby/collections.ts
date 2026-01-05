/**
 * Emby Collections (Box Sets) Module
 * 
 * Collections appear as Box Sets in the media server and group items within libraries.
 * Unlike Playlists, Collections appear in the normal library browse view.
 */

import type { CollectionCreateResult } from '../types.js'
import type { EmbyItemsResponse } from './types.js'
import type { EmbyProviderBase } from './base.js'

/**
 * Create or update a collection (Box Set)
 * Items are added in the order provided and their sort names are set to maintain rank order.
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param name - Collection name
 * @param itemIds - Array of media item IDs to include (in ranked order)
 * @returns Collection ID
 */
export async function createOrUpdateCollection(
  provider: EmbyProviderBase,
  apiKey: string,
  name: string,
  itemIds: string[]
): Promise<CollectionCreateResult> {
  // First, try to find existing collection (Box Set)
  const params = new URLSearchParams({
    IncludeItemTypes: 'BoxSet',
    Recursive: 'true',
    SearchTerm: name,
  })

  const existing = await provider.fetch<EmbyItemsResponse>(`/Items?${params}`, apiKey)
  const collection = existing.Items.find((c) => c.Name === name)

  let collectionId: string

  if (collection) {
    collectionId = collection.Id
    
    // Get existing items in the collection
    const existingItems = await provider.fetch<EmbyItemsResponse>(
      `/Items?ParentId=${collection.Id}&Recursive=true`,
      apiKey
    )

    // Remove all existing items if any
    if (existingItems.Items && existingItems.Items.length > 0) {
      const existingIds = existingItems.Items.map((item) => item.Id).join(',')
      await provider.fetch(`/Collections/${collection.Id}/Items?Ids=${existingIds}`, apiKey, {
        method: 'DELETE',
      })
    }

    // Add new items
    if (itemIds.length > 0) {
      await provider.fetch(`/Collections/${collection.Id}/Items?Ids=${itemIds.join(',')}`, apiKey, {
        method: 'POST',
      })
    }
  } else {
    // Create new collection
    const createParams = new URLSearchParams({
      Name: name,
    })

    if (itemIds.length > 0) {
      createParams.set('Ids', itemIds.join(','))
    }

    const created = await provider.fetch<{ Id: string }>(`/Collections?${createParams}`, apiKey, {
      method: 'POST',
    })
    
    collectionId = created.Id

    // Set sort title to force collection to sort at top
    await setCollectionSortTitle(provider, apiKey, collectionId, name)
  }

  // Set sort names on items to maintain rank order (01, 02, 03, etc.)
  await setItemRankSortNames(provider, apiKey, itemIds)

  return { collectionId }
}

/**
 * Delete a collection
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param collectionId - Collection ID to delete
 */
export async function deleteCollection(
  provider: EmbyProviderBase,
  apiKey: string,
  collectionId: string
): Promise<void> {
  await provider.fetch(`/Items/${collectionId}`, apiKey, { method: 'DELETE' })
}

/**
 * Get items in a collection
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param collectionId - Collection ID
 * @returns Array of item IDs
 */
export async function getCollectionItems(
  provider: EmbyProviderBase,
  apiKey: string,
  collectionId: string
): Promise<string[]> {
  const response = await provider.fetch<EmbyItemsResponse>(
    `/Items?ParentId=${collectionId}&Recursive=true`,
    apiKey
  )

  return response.Items.map((item) => item.Id)
}

/**
 * Add items to a collection
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param collectionId - Collection ID
 * @param itemIds - Array of item IDs to add
 */
export async function addCollectionItems(
  provider: EmbyProviderBase,
  apiKey: string,
  collectionId: string,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return
  await provider.fetch(`/Collections/${collectionId}/Items?Ids=${itemIds.join(',')}`, apiKey, {
    method: 'POST',
  })
}

/**
 * Remove items from a collection
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param collectionId - Collection ID
 * @param itemIds - Array of item IDs to remove
 */
export async function removeCollectionItems(
  provider: EmbyProviderBase,
  apiKey: string,
  collectionId: string,
  itemIds: string[]
): Promise<void> {
  if (itemIds.length === 0) return
  await provider.fetch(`/Collections/${collectionId}/Items?Ids=${itemIds.join(',')}`, apiKey, {
    method: 'DELETE',
  })
}

/**
 * Find a collection by name
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param name - Collection name to search for
 * @returns Collection ID if found, null otherwise
 */
export async function findCollectionByName(
  provider: EmbyProviderBase,
  apiKey: string,
  name: string
): Promise<string | null> {
  const params = new URLSearchParams({
    IncludeItemTypes: 'BoxSet',
    Recursive: 'true',
    SearchTerm: name,
  })

  const response = await provider.fetch<EmbyItemsResponse>(`/Items?${params}`, apiKey)
  const collection = response.Items.find((c) => c.Name === name)
  
  return collection?.Id ?? null
}

/**
 * Set the sort title for a collection to force it to appear at the top
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param collectionId - Collection ID
 * @param name - Display name of the collection
 */
async function setCollectionSortTitle(
  provider: EmbyProviderBase,
  apiKey: string,
  collectionId: string,
  name: string
): Promise<void> {
  // Prepend !!!!!! to sort title so collection appears at top when sorted alphabetically
  const sortTitle = `!!!!!!${name}`
  
  try {
    // First, fetch the full item data (required by Emby API for updates)
    const item = await provider.fetch<Record<string, unknown>>(
      `/Items/${collectionId}`,
      apiKey
    )
    
    // Update the sort name and lock it to prevent automatic overwrites
    item.ForcedSortName = sortTitle
    item.LockedFields = ['SortName']
    
    // POST the full item back
    await provider.fetch(`/Items/${collectionId}`, apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  } catch {
    // Non-fatal: collection will still work, just won't sort to top
    console.warn(`Failed to set sort title for collection ${collectionId}`)
  }
}

/**
 * Set sort names on items to maintain rank order within collections
 * Each item gets a sort name prefixed with its rank: "01 - Title", "02 - Title", etc.
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param itemIds - Array of item IDs in ranked order
 */
async function setItemRankSortNames(
  provider: EmbyProviderBase,
  apiKey: string,
  itemIds: string[]
): Promise<void> {
  for (let i = 0; i < itemIds.length; i++) {
    const itemId = itemIds[i]
    const rank = i + 1
    const rankPrefix = String(rank).padStart(2, '0')
    
    try {
      // Fetch the full item data
      const item = await provider.fetch<Record<string, unknown>>(
        `/Items/${itemId}`,
        apiKey
      )
      
      // Get the original name for the sort title
      const originalName = item.Name || 'Unknown'
      const sortTitle = `${rankPrefix} - ${originalName}`
      
      // Update the sort name and lock it
      item.ForcedSortName = sortTitle
      
      // Merge with existing locked fields if any
      const existingLocked = Array.isArray(item.LockedFields) ? item.LockedFields : []
      if (!existingLocked.includes('SortName')) {
        item.LockedFields = [...existingLocked, 'SortName']
      }
      
      // POST the full item back
      await provider.fetch(`/Items/${itemId}`, apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
    } catch {
      // Non-fatal: item will still be in collection, just won't sort by rank
      console.warn(`Failed to set rank sort name for item ${itemId}`)
    }
  }
}

