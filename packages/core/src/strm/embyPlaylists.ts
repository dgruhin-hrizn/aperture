import { query, queryOne } from '../lib/db.js'
import { getEffectiveLibraryTitle } from '../lib/userSettings.js'
import { EmbyProvider, getMediaServerProvider } from '../media/index.js'
import { isEmbyNotFoundError } from '../media/emby/fetchHelpers.js'
import {
  getAllowedRecommendationSourceIds,
  getVisibleRecommendationItems,
} from '../media/emby/recommendationAccess.js'
import { getSeriesRecommendationGroups } from '../recommender/series/groups.js'
import {
  getExpandedWatchedMovieIds,
  getExpandedWatchedSeriesIds,
  getUserIncludeWatched,
} from '../recommender/watchedExclusion.js'
import { getAiRecsOutputConfig, getMediaServerApiKey } from '../settings/systemSettings.js'

type MediaType = 'movies' | 'series'

interface Output {
  user_id: string
  provider_user_id: string
  media_type: MediaType
  group_key: string
  provider_playlist_id: string
  name: string
}

async function removeOutput(provider: EmbyProvider, apiKey: string, output: Output): Promise<void> {
  try {
    const item = await provider.fetch<{ Id: string; Type: string; Name: string }>(
      `/Users/${encodeURIComponent(output.provider_user_id)}/Items/${encodeURIComponent(output.provider_playlist_id)}`,
      apiKey
    )
    if (item.Id !== output.provider_playlist_id || item.Type !== 'Playlist' || item.Name !== output.name) {
      throw new Error('The tracked Emby item no longer matches the managed recommendation playlist')
    }
    await provider.deletePlaylist(apiKey, output.provider_playlist_id)
  } catch (err) {
    if (!isEmbyNotFoundError(err)) throw err
  }
  await query(
    'DELETE FROM emby_recommendation_playlists WHERE user_id = $1 AND media_type = $2 AND group_key = $3 AND provider_playlist_id = $4',
    [output.user_id, output.media_type, output.group_key, output.provider_playlist_id]
  )
}

export async function cleanupEmbyRecommendationPlaylists(userId?: string, mediaType?: MediaType): Promise<void> {
  const mode = await getAiRecsOutputConfig()
  const { rows } = await query<Output>(
    `SELECT p.*, u.provider_user_id FROM emby_recommendation_playlists p JOIN users u ON u.id = p.user_id
     WHERE ($1::uuid IS NULL OR p.user_id = $1)
       AND ($2::text IS NULL OR p.media_type = $2)
       AND ($1 IS NOT NULL OR NOT u.is_enabled OR u.provider_disabled
         OR (p.media_type = 'movies' AND (NOT u.movies_enabled OR $3))
         OR (p.media_type = 'series' AND (NOT u.series_enabled OR $4)))`,
    [userId ?? null, mediaType ?? null, mode.moviesOutputMode !== 'playlist', mode.seriesOutputMode !== 'playlist']
  )
  if (!rows.length) return
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()
  if (!(provider instanceof EmbyProvider) || !apiKey) {
    throw new Error('Emby credentials are required to remove managed recommendation playlists')
  }
  for (const output of rows) await removeOutput(provider, apiKey, output)
}

export async function publishEmbyRecommendationPlaylists(
  userId: string,
  providerUserId: string,
  displayName: string,
  mediaType: MediaType
): Promise<{ count: number; names: string[] }> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()
  if (!(provider instanceof EmbyProvider) || !apiKey) {
    throw new Error('Emby credentials are required to publish native recommendation playlists')
  }

  const owner = await queryOne<{ provider_access_token: string | null }>(
    "SELECT provider_access_token FROM users WHERE id = $1 AND provider = 'emby' AND provider_user_id = $2",
    [userId, providerUserId]
  )
  const { rows: existing } = await query<Output>(
    'SELECT p.*, $3::text AS provider_user_id FROM emby_recommendation_playlists p WHERE user_id = $1 AND media_type = $2',
    [userId, mediaType, providerUserId]
  )
  const userToken = owner?.provider_access_token
  if (!userToken) {
    for (const output of existing) await removeOutput(provider, apiKey, output)
    throw new Error(`${displayName} must sign into Aperture with Emby before publishing a private playlist`)
  }

  const movies = mediaType === 'movies'
  const groups = movies ? [] : await getSeriesRecommendationGroups()
  const mediaTable = movies ? 'movies' : 'series'
  const mediaId = movies ? 'movie_id' : 'series_id'
  const { rows } = await query<{ id: string; provider_item_id: string; provider_library_id: string; series_group_id: string | null }>(
    `SELECT m.id, m.provider_item_id, m.provider_library_id, c.series_group_id
     FROM recommendation_candidates c JOIN ${mediaTable} m ON m.id = c.${mediaId}
     WHERE c.is_selected AND c.run_id = (
       SELECT id FROM recommendation_runs WHERE user_id = $1 AND media_type = $2 AND status = 'completed'
       ORDER BY created_at DESC LIMIT 1
     )
     ORDER BY c.selected_rank`,
    [userId, movies ? 'movie' : 'series']
  )

  try {
    const sources = new Set(await getAllowedRecommendationSourceIds(provider, apiKey, providerUserId, movies ? 'movies' : 'tvshows'))
    const watched = await getUserIncludeWatched(userId)
      ? new Set<string>()
      : await (movies ? getExpandedWatchedMovieIds(userId) : getExpandedWatchedSeriesIds(userId))
    const eligible = rows.filter((row) => sources.has(row.provider_library_id) && !watched.has(row.id))
    const visible = await getVisibleRecommendationItems(
      provider, userToken, providerUserId, eligible.map((row) => row.provider_item_id), movies ? 'Movie' : 'Series'
    )
    const baseName = await getEffectiveLibraryTitle(userId, displayName, mediaType)
    const outputs = (groups.length ? groups : [null]).flatMap((group) => {
      const ids = [...new Set(eligible.filter((row) =>
        row.series_group_id === (group?.id ?? null) && visible.has(row.provider_item_id)
        && (!group || group.sourceIds.includes(row.provider_library_id))
      ).map((row) => row.provider_item_id))]
      return ids.length ? [{ key: group?.id ?? '', name: group ? `${baseName} – ${group.name}` : baseName, ids }] : []
    })
    for (const output of existing) {
      if (!outputs.some((entry) => entry.key === output.group_key && entry.name === output.name)) {
        await removeOutput(provider, apiKey, output)
      }
    }

    for (const output of outputs) {
      let playlistId = existing.find((entry) => entry.group_key === output.key && entry.name === output.name)?.provider_playlist_id
      if (playlistId) {
        try {
          const item = await provider.fetch<{ Id: string; Type: string; Name: string }>(
            `/Users/${encodeURIComponent(providerUserId)}/Items/${encodeURIComponent(playlistId)}`,
            userToken
          )
          if (item.Id !== playlistId || item.Type !== 'Playlist' || item.Name !== output.name) {
            throw new Error('The tracked Emby item no longer matches the managed recommendation playlist')
          }
        } catch (err) {
          if (!isEmbyNotFoundError(err)) throw err
          playlistId = undefined
        }
      }
      if (!playlistId) {
        const params = new URLSearchParams({ Name: output.name, UserId: providerUserId, MediaType: 'Video' })
        const created = await provider.fetch<{ Id: string }>(`/Playlists?${params}`, userToken, { method: 'POST' })
        playlistId = created.Id
        if (!playlistId) throw new Error('Emby did not return a playlist ID')
        await query(
          `INSERT INTO emby_recommendation_playlists (user_id, media_type, group_key, provider_playlist_id, name)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, media_type, group_key)
           DO UPDATE SET provider_playlist_id = EXCLUDED.provider_playlist_id, name = EXCLUDED.name`,
          [userId, mediaType, output.key, playlistId, output.name]
        )
      }
      await provider.fetch(`/Items/${encodeURIComponent(playlistId)}/MakePrivate`, userToken, { method: 'POST' })
      const endpoint = `/Playlists/${encodeURIComponent(playlistId)}/Items`
      const user = new URLSearchParams({ UserId: providerUserId })
      const current = await provider.fetch<{ Items: Array<{ PlaylistItemId: string }> }>(`${endpoint}?${user}`, userToken)
      if (current.Items.length) {
        const params = new URLSearchParams({ EntryIds: current.Items.map((item) => item.PlaylistItemId).join(',') })
        await provider.fetch(`${endpoint}?${params}`, userToken, { method: 'DELETE' })
      }
      user.set('Ids', output.ids.join(','))
      await provider.fetch(`${endpoint}?${user}`, userToken, { method: 'POST' })
    }
    return { count: outputs.reduce((sum, output) => sum + output.ids.length, 0), names: outputs.map((output) => output.name) }
  } catch (err) {
    // Remove previously published picks if access or privacy could not be confirmed.
    await cleanupEmbyRecommendationPlaylists(userId, mediaType)
    throw err
  }
}
