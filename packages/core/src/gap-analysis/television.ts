import { query } from '../lib/db.js'
import { AsyncCache, concurrencyLimit } from '../lib/asyncCache.js'
import { getMediaServerProvider } from '../media/index.js'
import { EmbyProvider } from '../media/emby/EmbyProvider.js'
import { getMediaServerApiKey, getTMDbApiKey } from '../settings/systemSettings.js'
import { literalTitlePattern } from '../lib/titleSearch.js'
import { tmdbRequest } from '../tmdb/client.js'
import { isReleasedReleaseDate, parseTmdbId } from './index.js'

interface TmdbEpisode {
  episode_number: number
  name: string
  air_date: string | null
}

interface TmdbSeason {
  season_number: number
  name: string
  episodes: TmdbEpisode[]
}

const seasonCache = new AsyncCache<TmdbSeason>(30 * 60_000, 500)
const tmdbReads = concurrencyLimit(4)
const embyReads = concurrencyLimit(2)

export async function findTelevisionGapSeries(text: string) {
  const pattern = literalTitlePattern(text)
  const { rows } = await query<{ id: string; title: string; year: number | null }>(
    `SELECT * FROM (SELECT DISTINCT ON (s.tmdb_id) s.id, s.title, s.year
      FROM series s
      WHERE s.title ILIKE $1 AND s.tmdb_id ~ '^[0-9]{1,10}$'
        AND NOT EXISTS (
          SELECT 1 FROM library_config lc WHERE lc.provider_library_id = s.provider_library_id AND NOT lc.is_enabled
        )
      ORDER BY s.tmdb_id, s.title, s.id) matches ORDER BY title, id LIMIT 20`, [pattern]
  )
  return rows
}

async function getLiveEpisodes(provider: EmbyProvider, key: string, seriesId: string) {
  const params = new URLSearchParams({
    Ids: seriesId, IncludeItemTypes: 'Series', Recursive: 'true', Limit: '1',
  })
  const series = await provider.fetch<{ Items: Array<{ Id: string }> }>(`/Items?${params}`, key)
  if (!series.Items?.some((item) => item.Id === seriesId)) {
    throw new Error('A synced Emby series is unavailable')
  }
  const numbers = new Set<string>()
  const ids = new Set<string>()
  let total: number | undefined
  for (let offset = 0; offset < 20_000;) {
    const page = await provider.getEpisodes(key, { parentIds: [seriesId], limit: 250, startIndex: offset })
    total ??= page.totalRecordCount
    if (!Number.isInteger(total) || total !== page.totalRecordCount || (page.startIndex !== undefined && page.startIndex !== offset)) {
      throw new Error('Emby episode inventory changed during the check')
    }
    for (const item of page.items) {
      if (item.seriesId !== seriesId || !item.id || ids.has(item.id)) {
        throw new Error('Emby returned an inconsistent episode inventory')
      }
      ids.add(item.id)
      if (item.path || item.mediaSources?.some((source) => source.path)) {
        const first = item.episodeNumber
        const last = item.episodeNumberEnd ?? first
        if (Number.isInteger(first) && Number.isInteger(last) && last >= first && last - first <= 100) {
          for (let number = first; number <= last; number++) {
            numbers.add(`${item.seasonNumber}:${number}`)
          }
        }
      }
    }
    offset += page.items.length
    if (offset === total) return numbers
    if (offset > total || page.items.length === 0) break
  }
  throw new Error('Emby episode inventory could not be verified completely')
}

export async function inspectTelevisionGaps(seriesId: string) {
  const [sources, provider, embyKey, tmdbKey] = await Promise.all([
    query<{ provider_item_id: string; title: string; tmdb_id: string }>(
      `SELECT s.provider_item_id, s.title, s.tmdb_id
        FROM series s JOIN series selected ON selected.id = $1 AND selected.tmdb_id = s.tmdb_id
        WHERE NOT EXISTS (
          SELECT 1 FROM library_config lc WHERE lc.provider_library_id = s.provider_library_id AND NOT lc.is_enabled
        )
        ORDER BY (s.id = $1) DESC, s.id LIMIT 21`, [seriesId]
    ),
    getMediaServerProvider(), getMediaServerApiKey(), getTMDbApiKey(),
  ])
  if (!sources.rows.length) return null
  const tmdbId = parseTmdbId(sources.rows[0].tmdb_id)
  if (!tmdbId || !tmdbKey || !embyKey || !(provider instanceof EmbyProvider)) {
    throw new Error('Checking TV gaps requires Emby and a TMDb match')
  }
  if (sources.rows.length > 20) throw new Error('Too many library editions to verify in one check')
  const config = { apiKey: tmdbKey, timeoutMs: 5000, maxRetries: 1 }
  const show = await tmdbRequest<{ id: number; seasons: Array<{ season_number: number }> }>(
    `/tv/${tmdbId}`, config
  )
  if (show?.id !== tmdbId || !Array.isArray(show.seasons)) {
    throw new Error('TMDb could not verify this series and its seasons')
  }
  const seasonNumbers = [...new Set(show.seasons.map((season) => season.season_number)
    .filter((number) => Number.isInteger(number) && number > 0))].sort((a, b) => a - b)
  if (seasonNumbers.length > 60) throw new Error('Too many seasons to verify in one check')

  const [inventories, seasons] = await Promise.all([
    Promise.all(sources.rows.map((source) =>
      embyReads(() => getLiveEpisodes(provider, embyKey, source.provider_item_id))
    )),
    Promise.all(seasonNumbers.map((number) => seasonCache.get(`${tmdbId}:${number}`, () => tmdbReads(async () => {
      const season = await tmdbRequest<TmdbSeason>(`/tv/${tmdbId}/season/${number}`, config)
      if (season?.season_number !== number || !Array.isArray(season.episodes)) {
        throw new Error(`TMDb could not verify season ${number}`)
      }
      return season
    })))),
  ])

  const present = new Set(inventories.flatMap((inventory) => [...inventory]))
  return {
    title: sources.rows[0].title,
    tmdbId,
    checkedAt: new Date().toISOString(),
    seasons: seasons.map((season) => {
      const released = new Map(season.episodes
        .filter((episode) => Number.isInteger(episode.episode_number) && episode.episode_number > 0
          && isReleasedReleaseDate(episode.air_date))
        .map((episode) => [episode.episode_number, episode]))
      const missing = [...released.values()]
        .filter((episode) => !present.has(`${season.season_number}:${episode.episode_number}`))
        .sort((a, b) => a.episode_number - b.episode_number)
        .map((episode) => ({ number: episode.episode_number, title: episode.name, airDate: episode.air_date }))
      return { number: season.season_number, name: season.name, released: released.size, missing }
    }),
  }
}
