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
    // Library already exists, return its ID
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

  return { libraryId: created.id, alreadyExists: false }
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

  // Update the policy with new library access (using GUIDs)
  await provider.fetch(`/Users/${userId}/Policy`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      ...user.Policy,
      EnableAllFolders: false,
      EnabledFolders: allowedLibraryGuids,
    }),
  })
}

export async function refreshLibrary(
  provider: EmbyProviderBase,
  apiKey: string,
  libraryId: string
): Promise<void> {
  await provider.fetch(`/Items/${libraryId}/Refresh`, apiKey, { method: 'POST' })
}

