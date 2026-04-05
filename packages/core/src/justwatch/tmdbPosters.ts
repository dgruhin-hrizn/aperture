import { getTMDbConfig } from '../settings/systemSettings.js'
import { getMovieDetails } from '../tmdb/movies.js'
import { getTVDetails } from '../tmdb/series.js'
import type { JustWatchStreamingRow } from './types.js'
import {
  getCachedTmdbPostersBatch,
  normalizePosterCacheLanguage,
  tmdbPosterCacheTtlMs,
  upsertTmdbPosterCache,
} from './tmdbPosterCache.js'

/**
 * Replace JustWatch poster URLs with TMDb `poster_path` values (path only, e.g. `/abc.jpg`)
 * so the web client can build `image.tmdb.org` URLs consistently with Discovery cards.
 *
 * Uses DB-backed cache + in-flight dedupe to limit TMDb API usage (see tmdb_poster_cache migration).
 */
export async function attachTmdbPosterPaths(
  rows: JustWatchStreamingRow[],
  options: { language?: string } = {}
): Promise<JustWatchStreamingRow[]> {
  const cfg = await getTMDbConfig()
  if (!cfg.enabled || !cfg.hasApiKey) {
    return rows
  }

  const { language } = options
  const lang = language || 'en'
  const ttl = tmdbPosterCacheTtlMs()

  const movieIds = new Set<number>()
  const tvIds = new Set<number>()

  for (const r of rows) {
    if (r.tmdbId == null) continue
    const ot = (r.objectType || '').toUpperCase()
    if (ot === 'MOVIE') movieIds.add(r.tmdbId)
    else if (ot === 'SHOW') tvIds.add(r.tmdbId)
  }

  const [movieCached, tvCached] = await Promise.all([
    getCachedTmdbPostersBatch('movie', [...movieIds], lang),
    getCachedTmdbPostersBatch('tv', [...tvIds], lang),
  ])

  const moviePoster = new Map<number, string | null>()
  const tvPoster = new Map<number, string | null>()
  const now = Date.now()

  for (const id of movieIds) {
    const row = movieCached.get(id)
    if (row && now - row.fetchedAtMs <= ttl) {
      moviePoster.set(id, row.posterPath)
    }
  }
  for (const id of tvIds) {
    const row = tvCached.get(id)
    if (row && now - row.fetchedAtMs <= ttl) {
      tvPoster.set(id, row.posterPath)
    }
  }

  const fetchMovieIds = [...movieIds].filter((id) => !moviePoster.has(id))
  const fetchTvIds = [...tvIds].filter((id) => !tvPoster.has(id))

  await Promise.all([
    ...fetchMovieIds.map((id) => fetchMoviePoster(id, lang, moviePoster)),
    ...fetchTvIds.map((id) => fetchTvPoster(id, lang, tvPoster)),
  ])

  return rows.map((r) => {
    if (r.tmdbId == null) return r
    const ot = (r.objectType || '').toUpperCase()
    let path: string | null | undefined
    if (ot === 'MOVIE') path = moviePoster.get(r.tmdbId)
    else if (ot === 'SHOW') path = tvPoster.get(r.tmdbId)
    else return r
    if (path == null || path === '') return r
    return { ...r, posterPath: path }
  })
}

const inflight = new Map<string, Promise<string | null>>()

function inflightKey(media: 'movie' | 'tv', id: number, lang: string): string {
  return `${media}:${id}:${normalizePosterCacheLanguage(lang)}`
}

async function fetchMoviePoster(
  id: number,
  lang: string,
  out: Map<number, string | null>
): Promise<void> {
  const key = inflightKey('movie', id, lang)
  let p = inflight.get(key)
  if (!p) {
    p = (async () => {
      const d = await getMovieDetails(id, { language: lang })
      const path = d?.poster_path ?? null
      await upsertTmdbPosterCache('movie', id, lang, path)
      return path
    })()
    inflight.set(key, p)
  }
  try {
    const path = await p
    out.set(id, path)
  } finally {
    inflight.delete(key)
  }
}

async function fetchTvPoster(id: number, lang: string, out: Map<number, string | null>): Promise<void> {
  const key = inflightKey('tv', id, lang)
  let p = inflight.get(key)
  if (!p) {
    p = (async () => {
      const d = await getTVDetails(id, { language: lang })
      const path = d?.poster_path ?? null
      await upsertTmdbPosterCache('tv', id, lang, path)
      return path
    })()
    inflight.set(key, p)
  }
  try {
    const path = await p
    out.set(id, path)
  } finally {
    inflight.delete(key)
  }
}
