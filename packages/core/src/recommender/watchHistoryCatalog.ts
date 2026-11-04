import { query } from '../lib/db.js'
import type { WatchedItem, WatchedEpisode } from '../media/types.js'

interface MovieIdentity {
  id: string
  provider_item_id: string
  provider_library_id: string | null
  tmdb_id: string | null
  imdb_id: string | null
  runtime_minutes: number | null
}

interface SeriesIdentity {
  id: string
  provider_item_id: string
  tmdb_id: string | null
  imdb_id: string | null
  tvdb_id: string | null
}

interface EpisodeIdentity {
  id: string
  provider_item_id: string
  series_id: string
  season_number: number
  episode_number: number
  provider_library_id: string | null
  runtime_minutes: number | null
}

const movieColumns = 'id, provider_item_id, provider_library_id, tmdb_id, imdb_id, runtime_minutes'
const seriesColumns = 'id, provider_item_id, tmdb_id, imdb_id, tvdb_id'
const episodeQuery = `SELECT e.id, e.provider_item_id, e.series_id, e.season_number,
  e.episode_number, e.runtime_minutes, s.provider_library_id
  FROM episodes e JOIN series s ON s.id = e.series_id
  WHERE e.provider_item_id IS NOT NULL`

/** Catalog identities live for one sync job. User history and exclusions are loaded separately. */
export async function loadMovieWatchHistoryCatalog() {
  const entries = new Map<string, MovieIdentity>()
  const providerIds = new Map<string, string>()
  const tmdbIds = new Map<string, string>()
  const imdbIds = new Map<string, string>()
  function add(rows: MovieIdentity[]) {
    for (const row of rows) {
      entries.set(row.id, row)
      providerIds.set(row.provider_item_id, row.id)
      if (row.tmdb_id) tmdbIds.set(row.tmdb_id, row.id)
      if (row.imdb_id) imdbIds.set(row.imdb_id, row.id)
    }
  }
  function resolve(item: WatchedItem): string | undefined {
    return providerIds.get(item.movieId)
      ?? (item.tmdbId ? tmdbIds.get(item.tmdbId) : undefined)
      ?? (item.imdbId ? imdbIds.get(item.imdbId) : undefined)
  }
  add((await query<MovieIdentity>(`SELECT ${movieColumns} FROM movies WHERE provider_item_id IS NOT NULL`)).rows)
  return {
    entries: entries as ReadonlyMap<string, MovieIdentity>,
    resolve,
    isProviderMatch: (item: WatchedItem) => providerIds.has(item.movieId),
    async refreshMissing(items: WatchedItem[]) {
      const missing = items.filter((item) => !resolve(item))
      if (missing.length === 0) return
      const result = await query<MovieIdentity>(
        `SELECT ${movieColumns} FROM movies WHERE provider_item_id IS NOT NULL
         AND (provider_item_id = ANY($1::text[]) OR tmdb_id = ANY($2::text[]) OR imdb_id = ANY($3::text[]))`,
        [missing.map((item) => item.movieId), missing.map((item) => item.tmdbId).filter(Boolean),
          missing.map((item) => item.imdbId).filter(Boolean)]
      )
      add(result.rows)
    },
  }
}

export type MovieWatchHistoryCatalog = Awaited<ReturnType<typeof loadMovieWatchHistoryCatalog>>

export async function loadSeriesWatchHistoryCatalog() {
  const entries = new Map<string, EpisodeIdentity>()
  const providerSeriesIds = new Map<string, string>()
  const tmdbIds = new Map<string, string>()
  const imdbIds = new Map<string, string>()
  const tvdbIds = new Map<string, string>()
  const providerEpisodeIds = new Map<string, string>()
  const episodeKeys = new Map<string, string>()
  function addSeries(rows: SeriesIdentity[]) {
    for (const row of rows) {
      providerSeriesIds.set(row.provider_item_id, row.id)
      if (row.tmdb_id) tmdbIds.set(row.tmdb_id, row.id)
      if (row.imdb_id) imdbIds.set(row.imdb_id, row.id)
      if (row.tvdb_id) tvdbIds.set(row.tvdb_id, row.id)
    }
  }
  function addEpisodes(rows: EpisodeIdentity[]) {
    for (const row of rows) {
      entries.set(row.id, row)
      providerEpisodeIds.set(row.provider_item_id, row.id)
      episodeKeys.set(`${row.series_id}:${row.season_number}:${row.episode_number}`, row.id)
    }
  }
  function resolveSeries(item: WatchedEpisode): string | undefined {
    return providerSeriesIds.get(item.seriesId)
      ?? (item.tmdbId ? tmdbIds.get(item.tmdbId) : undefined)
      ?? (item.imdbId ? imdbIds.get(item.imdbId) : undefined)
      ?? (item.tvdbId ? tvdbIds.get(item.tvdbId) : undefined)
  }
  function resolve(item: WatchedEpisode): string | undefined {
    const direct = providerEpisodeIds.get(item.episodeId)
    if (direct) return direct
    const seriesId = resolveSeries(item)
    return seriesId && item.seasonNumber != null && item.episodeNumber != null
      ? episodeKeys.get(`${seriesId}:${item.seasonNumber}:${item.episodeNumber}`)
      : undefined
  }
  const [series, episodes] = await Promise.all([
    query<SeriesIdentity>(`SELECT ${seriesColumns} FROM series WHERE provider_item_id IS NOT NULL`),
    query<EpisodeIdentity>(episodeQuery),
  ])
  addSeries(series.rows)
  addEpisodes(episodes.rows)
  return {
    entries: entries as ReadonlyMap<string, EpisodeIdentity>,
    resolve,
    isProviderMatch: (item: WatchedEpisode) => providerEpisodeIds.has(item.episodeId),
    async refreshMissing(items: WatchedEpisode[]) {
      const missing = items.filter((item) => !resolve(item))
      if (missing.length === 0) return
      const series = await query<SeriesIdentity>(
        `SELECT ${seriesColumns} FROM series WHERE provider_item_id IS NOT NULL
         AND (provider_item_id = ANY($1::text[]) OR tmdb_id = ANY($2::text[])
           OR imdb_id = ANY($3::text[]) OR tvdb_id = ANY($4::text[]))`,
        [missing.map((item) => item.seriesId), missing.map((item) => item.tmdbId).filter(Boolean),
          missing.map((item) => item.imdbId).filter(Boolean), missing.map((item) => item.tvdbId).filter(Boolean)]
      )
      addSeries(series.rows)
      const coordinates = missing.filter((item) => resolveSeries(item)
        && item.seasonNumber != null && item.episodeNumber != null)
      const episodes = await query<EpisodeIdentity>(
        `${episodeQuery} AND (e.provider_item_id = ANY($1::text[]) OR (e.series_id, e.season_number, e.episode_number) IN (
          SELECT * FROM unnest($2::uuid[], $3::int[], $4::int[]) AS wanted(series_id, season_number, episode_number)
        ))`,
        [missing.map((item) => item.episodeId), coordinates.map((item) => resolveSeries(item)),
          coordinates.map((item) => item.seasonNumber), coordinates.map((item) => item.episodeNumber)]
      )
      addEpisodes(episodes.rows)
    },
  }
}

export type SeriesWatchHistoryCatalog = Awaited<ReturnType<typeof loadSeriesWatchHistoryCatalog>>
