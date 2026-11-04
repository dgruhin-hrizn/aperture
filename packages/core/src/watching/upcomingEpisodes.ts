/** Upcoming episode lookups: local data first, shared bounded TMDb fallback. */
import { query } from '../lib/db.js'
import { AsyncCache, concurrencyLimit } from '../lib/asyncCache.js'
import { getTMDbApiKey } from '../settings/systemSettings.js'
import { tmdbRequest } from '../tmdb/client.js'

export interface UpcomingEpisode {
  seriesId: string
  seasonNumber: number
  episodeNumber: number
  title: string
  overview: string | null
  airDate: string
  source: 'emby' | 'tmdb'
}
interface TMDbNextEpisode {
  name: string
  overview: string | null
  air_date: string | null
  season_number: number
  episode_number: number
}
interface TMDbDetails {
  next_episode_to_air: TMDbNextEpisode | null
}
interface LocalEpisode {
  series_id: string
  season_number: number
  episode_number: number
  title: string
  overview: string | null
  premiere_date: string | Date
}
export interface UpcomingEpisodeBatch {
  episodes: Map<string, UpcomingEpisode>
  /** Confirmed episodes OR confirmed absence. Failed remote reads are omitted. */
  resolvedSeriesIds: string[]
}
const forecasts = new AsyncCache<{ episode: TMDbNextEpisode | null } | null>(30 * 60_000, 2000)
const limitRemote = concurrencyLimit(4)

async function localUpcoming(seriesIds: string[], today: string) {
  const result = new Map<string, UpcomingEpisode>()
  if (!seriesIds.length) return result
  const rows = await query<LocalEpisode>(
    `SELECT DISTINCT ON (series_id)
            series_id, season_number, episode_number, title, overview, premiere_date
     FROM episodes WHERE series_id = ANY($1) AND premiere_date >= $2
     ORDER BY series_id, premiere_date ASC, season_number ASC, episode_number ASC`,
    [seriesIds, today]
  )
  for (const row of rows.rows)
    result.set(row.series_id, {
      seriesId: row.series_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      title: row.title,
      overview: row.overview,
      airDate:
        row.premiere_date instanceof Date
          ? row.premiere_date.toISOString().slice(0, 10)
          : row.premiere_date.slice(0, 10),
      source: 'emby',
    })
  return result
}
async function remoteUpcoming(apiKey: string, tmdbId: string, today: string) {
  // Cache only public forecast data. Include configuration and UTC day, never user membership.
  return forecasts.get(JSON.stringify([apiKey, tmdbId, today]), () =>
    limitRemote(async () => {
      const data = await tmdbRequest<TMDbDetails>(`/tv/${tmdbId}`, {
        apiKey,
        timeoutMs: 5000,
        maxRetries: 1,
      })
      if (!data) return null
      const next = data.next_episode_to_air
      return {
        episode:
          next?.air_date && /^\d{4}-\d{2}-\d{2}$/.test(next.air_date) && next.air_date >= today
            ? next
            : null,
      }
    })
  )
}
function fromRemote(seriesId: string, next: TMDbNextEpisode): UpcomingEpisode {
  return {
    seriesId,
    seasonNumber: next.season_number,
    episodeNumber: next.episode_number,
    title: next.name,
    overview: next.overview,
    airDate: next.air_date!,
    source: 'tmdb',
  }
}

/** A batch can resolve incrementally without turning an upstream failure into "no episodes". */
export async function getUpcomingEpisodeBatch(
  seriesIds: string[],
  options: { localOnly?: boolean } = {}
): Promise<UpcomingEpisodeBatch> {
  const ids = [...new Set(seriesIds)],
    today = new Date().toISOString().slice(0, 10)
  const episodes = await localUpcoming(ids, today)
  const resolved = new Set(episodes.keys())
  const remaining = ids.filter((id) => !episodes.has(id))
  if (options.localOnly || !remaining.length) return { episodes, resolvedSeriesIds: [...resolved] }
  const rows = await query<{ id: string; tmdb_id: string | null }>(
    'SELECT id, tmdb_id FROM series WHERE id = ANY($1)',
    [remaining]
  )
  // One configuration query per batch, rather than one per series.
  const apiKey = await getTMDbApiKey()
  await Promise.all(
    rows.rows.map(async (row) => {
      if (!apiKey || !row.tmdb_id || !/^\d+$/.test(row.tmdb_id)) {
        resolved.add(row.id)
        return
      }
      const data = await remoteUpcoming(apiKey, row.tmdb_id, today)
      if (!data) return
      resolved.add(row.id)
      if (data.episode) episodes.set(row.id, fromRemote(row.id, data.episode))
    })
  )
  return { episodes, resolvedSeriesIds: [...resolved] }
}

/** Backward-compatible full-result helpers; UI callers use small authenticated batches. */
export async function getUpcomingEpisodes(
  seriesIds: string[],
  options: { localOnly?: boolean } = {}
): Promise<Map<string, UpcomingEpisode>> {
  return (await getUpcomingEpisodeBatch(seriesIds, options)).episodes
}
export async function getUpcomingEpisodeForSeries(
  seriesId: string,
  tmdbId: string | null
): Promise<UpcomingEpisode | null> {
  const today = new Date().toISOString().slice(0, 10)
  const local = (await localUpcoming([seriesId], today)).get(seriesId)
  if (local) return local
  const apiKey = await getTMDbApiKey()
  if (!apiKey || !tmdbId || !/^\d+$/.test(tmdbId)) return null
  const data = await remoteUpcoming(apiKey, tmdbId, today)
  return data?.episode ? fromRemote(seriesId, data.episode) : null
}

/**
 * Format upcoming episode for display
 */
export function formatUpcomingEpisode(episode: UpcomingEpisode): string {
  const date = new Date(episode.airDate)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })

  return `S${episode.seasonNumber}E${episode.episodeNumber} - ${episode.title} (${dateStr})`
}
