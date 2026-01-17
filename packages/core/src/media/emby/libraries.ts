/**
 * Emby Libraries Module
 */

import type { Library, LibraryCreateResult } from '../types.js'
import type { EmbyLibrary, EmbyLibraryResponse, EmbyUser } from './types.js'
import type { EmbyProviderBase } from './base.js'

export async function getLibraries(provider: EmbyProviderBase, apiKey: string): Promise<Library[]> {
  // Emby returns an array directly, not { Items: [...] }
  const response = await provider.fetch<EmbyLibrary[] | EmbyLibraryResponse>(
    '/Library/VirtualFolders',
    apiKey
  )

  // Handle both array response and object with Items property
  const libraries = Array.isArray(response) ? response : response.Items || []

  return libraries.map((lib: EmbyLibrary) => ({
    // ItemId is for Items API (/Items/...), Id is for VirtualFolders API
    id: lib.ItemId || lib.Id || '', // Primary ID for Items API
    virtualFolderId: lib.Id || '', // VirtualFolder ID for library options
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
    // Library already exists - ensure settings are configured
    await setLibrarySortTitle(provider, apiKey, existing.id, name)
    // Exclude from global search (merges with existing options to preserve ContentType etc)
    if (existing.virtualFolderId) {
      await setLibraryOptions(provider, apiKey, existing.virtualFolderId, {
        excludeFromSearch: true,
      })
    }
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

  // Exclude from global search (merges with existing options to preserve ContentType etc)
  if (created.virtualFolderId) {
    await setLibraryOptions(provider, apiKey, created.virtualFolderId, { excludeFromSearch: true })
  }

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
    const item = await provider.fetch<Record<string, unknown>>(`/Items/${libraryId}`, apiKey)

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

/**
 * Set library options like ExcludeFromSearch
 * Uses the VirtualFolders/LibraryOptions endpoint (requires Emby 4.9+)
 *
 * IMPORTANT: This fetches existing options first and merges, because Emby's
 * API replaces the entire LibraryOptions object. Sending partial options
 * would wipe out all other settings including ContentType.
 *
 * @param provider - Emby provider instance
 * @param apiKey - API key for authentication
 * @param libraryId - VirtualFolder Id (from VirtualFolderInfo.Id, not ItemId)
 * @param options - Options to merge into existing options
 */
async function setLibraryOptions(
  provider: EmbyProviderBase,
  apiKey: string,
  libraryId: string,
  options: { excludeFromSearch?: boolean }
): Promise<void> {
  try {
    // First, fetch existing library options to preserve all settings
    const libraries = await provider.fetch<EmbyLibrary[]>('/Library/VirtualFolders', apiKey)
    const library = libraries.find((lib) => lib.Id === libraryId)

    if (!library?.LibraryOptions) {
      // Library not found or no options - skip silently
      return
    }

    // Merge our options into the existing LibraryOptions
    const mergedOptions = {
      ...library.LibraryOptions,
      ExcludeFromSearch:
        options.excludeFromSearch ?? library.LibraryOptions.ExcludeFromSearch ?? false,
    }

    // POST the full merged options back
    await provider.fetch('/Library/VirtualFolders/LibraryOptions', apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Id: libraryId,
        LibraryOptions: mergedOptions,
      }),
    })
  } catch {
    // Non-fatal: library will still work, just won't be excluded from search
    // This fails silently on Emby < 4.9 which doesn't support ExcludeFromSearch
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

/**
 * Set the default sort order for a library for a specific user
 * This sets the DisplayPreferences so when the user first visits the library,
 * it will be sorted by the specified field.
 * Note: Emby Web caches sort preferences in localStorage after first visit,
 * so this only affects the initial view.
 */
export async function setLibrarySortPreference(
  provider: EmbyProviderBase,
  apiKey: string,
  userId: string,
  libraryId: string,
  sortBy: string = 'DateCreated',
  sortOrder: 'Ascending' | 'Descending' = 'Descending'
): Promise<void> {
  try {
    // Get the library item to find its DisplayPreferencesId
    const item = await provider.fetch<{ DisplayPreferencesId?: string }>(
      `/Users/${userId}/Items/${libraryId}`,
      apiKey
    )

    const displayPrefsId = item.DisplayPreferencesId || libraryId

    // Set display preferences for Emby Web client
    await provider.fetch(`/DisplayPreferences/${displayPrefsId}?UserId=${userId}`, apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Id: displayPrefsId,
        SortBy: sortBy,
        SortOrder: sortOrder,
        Client: 'Emby Web',
        CustomPrefs: {},
      }),
    })
  } catch {
    // Non-fatal: library will still work, just won't have custom sort default
  }
}

// NOTE: hideLibraryItemsFromResume was removed in v0.5.0
// Instead of hiding items from Continue Watching via API, we now omit external IDs (IMDB/TMDB)
// from NFO files. This prevents Emby from linking Aperture items with originals, so playback
// is tracked independently on each item - no duplicates in Continue Watching.
