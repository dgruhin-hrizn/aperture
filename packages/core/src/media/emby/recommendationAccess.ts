import { query } from '../../lib/db.js'
import { getEnabledLibraryIds, getEnabledTvLibraryIds } from '../../lib/libraryConfig.js'
import type { EmbyUser } from './types.js'
import type { EmbyProvider } from './EmbyProvider.js'

export async function readRecommendationLibraryAccess(provider: EmbyProvider, apiKey: string, userId: string) {
  const { Policy } = await provider.fetch<EmbyUser>(`/Users/${encodeURIComponent(userId)}`, apiKey)
  if (Policy?.IsDisabled || typeof Policy?.EnableAllFolders !== 'boolean') {
    throw new Error('Emby did not return an explicit library access policy')
  }
  return {
    enableAllFolders: Policy.EnableAllFolders,
    enabledFolders: (Policy.EnabledFolders ?? []).map((id) => id.toLowerCase()),
  }
}

/** Resolve Emby policy GUIDs to the item IDs stored by Aperture's catalog sync. */
export async function getAllowedRecommendationSourceIds(
  provider: EmbyProvider,
  apiKey: string,
  providerUserId: string,
  mediaType: 'movies' | 'tvshows'
): Promise<string[]> {
  const [libraries, access, configured, generated] = await Promise.all([
    mediaType === 'movies' ? provider.getMovieLibraries(apiKey) : provider.getTvShowLibraries(apiKey),
    readRecommendationLibraryAccess(provider, apiKey, providerUserId),
    mediaType === 'movies' ? getEnabledLibraryIds() : getEnabledTvLibraryIds(),
    query<{ provider_library_id: string }>(
      'SELECT provider_library_id FROM strm_libraries WHERE provider_library_id IS NOT NULL'
    ),
  ])
  const enabled = new Set(configured ?? [])
  const generatedIds = new Set(generated.rows.map((row) => row.provider_library_id))
  const allowedGuids = new Set(access.enabledFolders)
  return libraries
    .filter((library) => !generatedIds.has(library.id))
    .filter((library) => configured === null || enabled.has(library.id))
    .filter((library) => access.enableAllFolders || (library.guid && allowedGuids.has(library.guid.toLowerCase())))
    .map((library) => library.id)
}

export async function assertPrivateRecommendationLibrary(
  provider: EmbyProvider,
  apiKey: string,
  ownerId: string,
  libraryName: string,
  libraryPath: string,
  previousLibraryId?: string | null
): Promise<void> {
  const [libraries, users] = await Promise.all([provider.getLibraries(apiKey), provider.getUsers(apiKey)])
  const outputs = libraries.filter((library) =>
    library.name.toLowerCase() === libraryName.toLowerCase()
    || library.locations?.includes(libraryPath)
    || library.id === previousLibraryId
  )
  const guids = new Set(outputs.map((library) => library.guid.toLowerCase()))
  for (const user of users) {
    if (user.isAdmin || user.isDisabled || user.id === ownerId) continue
    const access = await readRecommendationLibraryAccess(provider, apiKey, user.id)
    if (access.enableAllFolders || access.enabledFolders.some((id) => guids.has(id))) {
      throw new Error('Another Emby user can access this generated library. Review Emby library access.')
    }
  }
}

interface VisibleItem {
  Id: string
  Path?: string
  SeriesId?: string
}

/** Resolve exact IDs against the user's current view, preserving the provider's original paths. */
export async function getVisibleRecommendationItems(
  provider: EmbyProvider,
  apiKey: string,
  providerUserId: string,
  itemIds: string[],
  type: 'Movie' | 'Series' | 'Episode' | 'Playlist',
  seriesId?: string
): Promise<Map<string, VisibleItem>> {
  const visible = new Map<string, VisibleItem>()
  for (let offset = 0; offset < itemIds.length; offset += 50) {
    const ids = new Set(itemIds.slice(offset, offset + 50))
    const params = new URLSearchParams({
      UserId: providerUserId,
      Ids: [...ids].join(','),
      Recursive: 'true',
      IncludeItemTypes: type,
      Fields: 'Path',
      Limit: String(ids.size),
    })
    // Emby can bypass user library filtering for queries scoped by ParentId.
    // Check SeriesId on the returned item instead.
    const { Items } = await provider.fetch<{ Items: VisibleItem[] }>(`/Items?${params}`, apiKey)
    for (const item of Items) {
      if (ids.has(item.Id) && (!seriesId || item.SeriesId === seriesId)) visible.set(item.Id, item)
    }
  }
  return visible
}
