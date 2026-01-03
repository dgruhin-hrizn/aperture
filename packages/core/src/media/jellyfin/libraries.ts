/**
 * Jellyfin Libraries Module
 */

import type { Library, LibraryCreateResult } from '../types.js'
import type { JellyfinLibrary, JellyfinUser } from './types.js'
import type { JellyfinProviderBase } from './base.js'

export async function getLibraries(
  provider: JellyfinProviderBase,
  apiKey: string
): Promise<Library[]> {
  // Jellyfin may return an array directly
  const response = await provider.fetch<JellyfinLibrary[]>('/Library/VirtualFolders', apiKey)

  // Handle both array response and object with Items property
  const libraries = Array.isArray(response) ? response : (response as any).Items || []

  return libraries.map((lib: JellyfinLibrary) => ({
    id: lib.Id,
    guid: lib.Guid || lib.Id, // Jellyfin may use Id for permissions
    name: lib.Name,
    collectionType: lib.CollectionType,
    path: lib.Path,
    refreshStatus: lib.RefreshStatus,
  }))
}

export async function getMovieLibraries(
  provider: JellyfinProviderBase,
  apiKey: string
): Promise<Library[]> {
  const libraries = await getLibraries(provider, apiKey)
  return libraries.filter((lib) => lib.collectionType === 'movies')
}

export async function getTvShowLibraries(
  provider: JellyfinProviderBase,
  apiKey: string
): Promise<Library[]> {
  const libraries = await getLibraries(provider, apiKey)
  return libraries.filter((lib) => lib.collectionType === 'tvshows')
}

export async function createVirtualLibrary(
  provider: JellyfinProviderBase,
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

  // Jellyfin uses the same collection type names as our interface
  await provider.fetch(
    `/Library/VirtualFolders?name=${encodeURIComponent(name)}&collectionType=${collectionType}&paths=${encodeURIComponent(path)}&refreshLibrary=true`,
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
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string
): Promise<{ enableAllFolders: boolean; enabledFolders: string[] }> {
  const user = await provider.fetch<JellyfinUser>(`/Users/${userId}`, apiKey)
  return {
    enableAllFolders: user.Policy?.EnableAllFolders ?? true,
    enabledFolders: user.Policy?.EnabledFolders ?? [],
  }
}

export async function updateUserLibraryAccess(
  provider: JellyfinProviderBase,
  apiKey: string,
  userId: string,
  allowedLibraryGuids: string[]
): Promise<void> {
  // Get current user policy
  const user = await provider.fetch<JellyfinUser>(`/Users/${userId}`, apiKey)

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
  provider: JellyfinProviderBase,
  apiKey: string,
  libraryId: string
): Promise<void> {
  await provider.fetch(`/Items/${libraryId}/Refresh`, apiKey, { method: 'POST' })
}

