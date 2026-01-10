/**
 * Emby Libraries Module
 */

import type { Library, LibraryCreateResult } from '../types.js'
import type { EmbyLibrary, EmbyLibraryResponse, EmbyUser } from './types.js'
import type { EmbyProviderBase } from './base.js'

export async function getLibraries(
  provider: EmbyProviderBase,
  apiKey: string
): Promise<Library[]> {
  // Emby returns an array directly, not { Items: [...] }
  const response = await provider.fetch<EmbyLibrary[] | EmbyLibraryResponse>(
    '/Library/VirtualFolders',
    apiKey
  )

  // Handle both array response and object with Items property
  const libraries = Array.isArray(response) ? response : response.Items || []

  return libraries.map((lib: EmbyLibrary) => ({
    id: lib.ItemId || lib.Id || '',
    guid: lib.Guid || lib.ItemId || lib.Id || '', // GUID is used for user permissions
    name: lib.Name,
    collectionType: lib.CollectionType,
    path: lib.Path,
    refreshStatus: lib.RefreshStatus,
  }))
}

export async function getMovieLibraries(
  provider: EmbyProviderBase,
  apiKey: string
): Promise<Library[]> {
  const libraries = await getLibraries(provider, apiKey)
  return libraries.filter((lib) => lib.collectionType === 'movies')
}

export async function getTvShowLibraries(
  provider: EmbyProviderBase,
  apiKey: string
): Promise<Library[]> {
  const libraries = await getLibraries(provider, apiKey)
  return libraries.filter((lib) => lib.collectionType === 'tvshows')
}

export async function createVirtualLibrary(
  provider: EmbyProviderBase,
  apiKey: string,
  name: string,
  path: string,
  collectionType: 'movies' | 'tvshows'
): Promise<LibraryCreateResult> {
  // Check if library with this name already exists
  const existingLibraries = await getLibraries(provider, apiKey)
  const existing = existingLibraries.find((lib) => lib.name === name)
  
  if (existing) {
    // Library already exists - ensure it has the sort title set
    await setLibrarySortTitle(provider, apiKey, existing.id, name)
    return { libraryId: existing.id, alreadyExists: true }
  }

  // Emby uses different collection type names
  const embyCollectionType = collectionType === 'movies' ? 'movies' : 'tvshows'

  await provider.fetch(
    `/Library/VirtualFolders?name=${encodeURIComponent(name)}&collectionType=${embyCollectionType}&paths=${encodeURIComponent(path)}&refreshLibrary=true`,
    apiKey,
    { method: 'POST' }
  )

  // Get the created library to find its ID
  const libraries = await getLibraries(provider, apiKey)
  const created = libraries.find((lib) => lib.name === name)

  if (!created) {
    throw new Error(`Failed to find created library: ${name}`)
  }

  // Set forced sort name so library appears at top
  await setLibrarySortTitle(provider, apiKey, created.id, name)

  return { libraryId: created.id, alreadyExists: false }
}

/**
 * Set the sort title for a library to force it to appear at the top
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param libraryId - Library ID
 * @param name - Display name of the library
 */
async function setLibrarySortTitle(
  provider: EmbyProviderBase,
  apiKey: string,
  libraryId: string,
  name: string
): Promise<void> {
  // Prepend !!!!!! to sort title so library appears at top when sorted alphabetically
  const sortTitle = `!!!!!!${name}`
  
  try {
    // Fetch the full item data (required by Emby API for updates)
    const item = await provider.fetch<Record<string, unknown>>(
      `/Items/${libraryId}`,
      apiKey
    )
    
    // Update the sort name and lock it to prevent automatic overwrites
    item.ForcedSortName = sortTitle
    
    // Merge with existing locked fields if any
    const existingLocked = Array.isArray(item.LockedFields) ? item.LockedFields : []
    if (!existingLocked.includes('SortName')) {
      item.LockedFields = [...existingLocked, 'SortName']
    }
    
    // POST the full item back
    await provider.fetch(`/Items/${libraryId}`, apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  } catch {
    // Non-fatal: library will still work, just won't sort to top
    console.warn(`Failed to set sort title for library ${libraryId}`)
  }
}

export async function getUserLibraryAccess(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string
): Promise<{ enableAllFolders: boolean; enabledFolders: string[] }> {
  const user = await provider.fetch<EmbyUser>(`/Users/${userId}`, apiKey)
  return {
    enableAllFolders: user.Policy?.EnableAllFolders ?? true,
    enabledFolders: user.Policy?.EnabledFolders ?? [],
  }
}

export async function updateUserLibraryAccess(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  allowedLibraryGuids: string[]
): Promise<void> {
  // Get current user policy
  const user = await provider.fetch<EmbyUser>(`/Users/${userId}`, apiKey)

  // Cast to Record to access all dynamic fields - API may have more fields than our type
  const currentPolicy = (user.Policy || {}) as Record<string, unknown>
  
  // Create updated policy preserving all existing fields except the ones we're changing
  const updatedPolicy: Record<string, unknown> = {
    ...currentPolicy,
    // Override library access - the fields we're actually changing
    EnableAllFolders: false,
    EnabledFolders: allowedLibraryGuids,
  }

  // Update the policy with new library access (using GUIDs)
  await provider.fetch(`/Users/${userId}/Policy`, apiKey, {
    method: 'POST',
    body: JSON.stringify(updatedPolicy),
  })
}

export async function refreshLibrary(
  provider: EmbyProviderBase,
  apiKey: string,
  libraryId: string
): Promise<void> {
  await provider.fetch(`/Items/${libraryId}/Refresh`, apiKey, { method: 'POST' })
}

