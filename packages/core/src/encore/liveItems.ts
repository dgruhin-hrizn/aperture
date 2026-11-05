import { query } from './scopedDb.js'
import { getEncoreAccount, mediaRequest } from './access.js'
import type { PlanCandidate } from './planScheduling.js'
export interface LiveItem {
  Id: string
  Name: string
  Type: string
  RunTimeTicks?: number
  UserData?: { Played?: boolean; PlaybackPositionTicks?: number }
  PlaylistItemId?: string
}
export async function resolveEncoreItems(
  userId: string,
  items: Array<{ id: string; type: 'movie' | 'episode' }>,
  allowRewatch = false
): Promise<PlanCandidate[]> {
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new Error('Choose each item only once')
  const ids = items.map((i) => i.id)
  const metadata = (
    await query<{
      id: string
      provider_item_id: string
      title: string
      type: 'movie' | 'episode'
      series_id?: string
      season_number?: number
      episode_number?: number
    }>(
      `
    SELECT id,provider_item_id,title,'movie'::text type,NULL::uuid series_id,NULL::int season_number,NULL::int episode_number FROM movies WHERE id=ANY($1::uuid[])
    UNION ALL SELECT e.id,e.provider_item_id,s.title || ' — S' || e.season_number || ' E' || e.episode_number || ': ' || e.title,'episode',s.id,e.season_number,e.episode_number
    FROM episodes e JOIN series s ON s.id=e.series_id WHERE e.id=ANY($1::uuid[])`,
      [ids]
    )
  ).rows
  if (items.some((i) => !metadata.some((m) => m.id === i.id && m.type === i.type)))
    throw new Error('One or more selected items are no longer accessible')
  const account = await getEncoreAccount(userId)
  const params = new URLSearchParams({
    Ids: metadata.map((m) => m.provider_item_id).join(','),
    Recursive: 'true',
    IncludeItemTypes: 'Movie,Episode',
    Fields: 'RunTimeTicks',
    EnableUserData: 'true',
    Limit: '100',
  })
  const response = await mediaRequest<{ Items: LiveItem[] }>(
    account,
    `/Users/${encodeURIComponent(account.provider_user_id)}/Items?${params}`
  )
  if (!Array.isArray(response.Items))
    throw new Error('Could not verify selected items on the media server')
  return items.map((i) => {
    const m = metadata.find((m) => m.id === i.id)!,
      live = response.Items.find(
        (l) => l.Id === m.provider_item_id && l.Type === (i.type === 'movie' ? 'Movie' : 'Episode')
      )
    const runtime = live?.RunTimeTicks,
      position =
        allowRewatch && live?.UserData?.Played ? 0 : (live?.UserData?.PlaybackPositionTicks ?? 0)
    const minutes =
      runtime && Number.isFinite(runtime) && runtime > 0
        ? Math.ceil(Math.max(0, runtime - position) / 600_000_000)
        : null
    return {
      id: i.id,
      type: i.type,
      title: m.title,
      providerId: m.provider_item_id,
      minutes,
      seriesId: m.series_id,
      order: (m.season_number ?? 0) * 10000 + (m.episode_number ?? 0),
      reason: !live
        ? 'unavailable'
        : live.UserData?.Played && !allowRewatch
          ? 'alreadyWatched'
          : !minutes
            ? 'unknownRuntime'
            : undefined,
    }
  })
}
export async function getEncoreEpisodes(userId: string, seriesId: string) {
  const episodes = (
    await query<{
      id: string
      title: string
      season_number: number
      episode_number: number
      runtime_minutes: number | null
    }>(
      `SELECT e.id,e.title,e.season_number,e.episode_number,e.runtime_minutes FROM episodes e JOIN series s ON s.id=e.series_id
    WHERE s.id=$1 AND NOT EXISTS(SELECT 1 FROM watch_history wh WHERE wh.user_id=$2 AND wh.episode_id=e.id)
    ORDER BY e.season_number,e.episode_number LIMIT 30`,
      [seriesId, userId]
    )
  ).rows
  const live = episodes.length
    ? await resolveEncoreItems(
        userId,
        episodes.map((episode) => ({ id: episode.id, type: 'episode' })),
        false
      )
    : []
  const visible = new Set(
    live
      .filter((item) => item.reason !== 'unavailable' && item.reason !== 'alreadyWatched')
      .map((item) => item.id)
  )
  return {
    kind: 'episodes' as const,
    seriesId,
    episodes: episodes.filter((episode) => visible.has(episode.id)),
    warning:
      'Episode metadata is synchronized; planning rechecks current availability and progress.',
  }
}
