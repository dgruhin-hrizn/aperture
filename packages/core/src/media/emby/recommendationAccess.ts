import { query } from '../../lib/db.js'
import { getEnabledTvLibraryIds } from '../../lib/libraryConfig.js'
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
export async function getAllowedSeriesSourceIds(
  provider: EmbyProvider,
  apiKey: string,
  providerUserId: string
): Promise<string[]> {
  const [libraries, access, configured, generated] = await Promise.all([
    provider.getTvShowLibraries(apiKey),
    readRecommendationLibraryAccess(provider, apiKey, providerUserId),
    getEnabledTvLibraryIds(),
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

/** Verify paths against the user's current view, without resolving by title or external ID. */
export async function getVisibleEpisodePaths(
  provider: EmbyProvider,
  apiKey: string,
  providerUserId: string,
  seriesId: string,
  episodeIds: string[]
): Promise<Map<string, string>> {
  const visible = new Map<string, string>()
  for (let offset = 0; offset < episodeIds.length; offset += 50) {
    const ids = episodeIds.slice(offset, offset + 50)
    const params = new URLSearchParams({
      UserId: providerUserId,
      ParentId: seriesId,
      Ids: ids.join(','),
      Recursive: 'true',
      IncludeItemTypes: 'Episode',
      Fields: 'Path',
      Limit: String(ids.length),
    })
    const { Items } = await provider.fetch<{ Items: Array<{ Id: string; SeriesId?: string; Path?: string }> }>(
      `/Items?${params}`,
      apiKey
    )
    for (const episode of Items) {
      if (episode.SeriesId === seriesId && episode.Path && ids.includes(episode.Id)) {
        visible.set(episode.Id, episode.Path)
      }
    }
  }
  return visible
}
