import { query } from '../lib/db.js'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days (posters change rarely)

export function tmdbPosterCacheTtlMs(): number {
  const raw = process.env.TMDB_POSTER_CACHE_TTL_MS
  if (!raw) return DEFAULT_TTL_MS
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS
}

/** Normalize for cache key: primary language subtag (e.g. en-US → en). */
export function normalizePosterCacheLanguage(lang: string | undefined): string {
  const l = (lang || 'en').trim().toLowerCase()
  if (!l) return 'en'
  const i = l.indexOf('-')
  return i === -1 ? l : l.slice(0, i)
}

export interface CachedPosterRow {
  posterPath: string | null
  fetchedAtMs: number
}

/**
 * Load cached poster rows for many TMDb ids in one query per media type.
 */
export async function getCachedTmdbPostersBatch(
  mediaType: 'movie' | 'tv',
  tmdbIds: number[],
  language: string
): Promise<Map<number, CachedPosterRow>> {
  const out = new Map<number, CachedPosterRow>()
  if (tmdbIds.length === 0) return out
  const lang = normalizePosterCacheLanguage(language)
  const unique = [...new Set(tmdbIds)]
  const placeholders = unique.map((_, i) => `$${i + 3}`).join(', ')
  const res = await query<{ tmdb_id: number; poster_path: string | null; fetched_at: Date }>(
    `SELECT tmdb_id, poster_path, fetched_at FROM tmdb_poster_cache
     WHERE media_type = $1 AND language = $2 AND tmdb_id IN (${placeholders})`,
    [mediaType, lang, ...unique]
  )
  for (const row of res.rows) {
    out.set(row.tmdb_id, {
      posterPath: row.poster_path,
      fetchedAtMs: new Date(row.fetched_at).getTime(),
    })
  }
  return out
}

export async function upsertTmdbPosterCache(
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  language: string,
  posterPath: string | null
): Promise<void> {
  const lang = normalizePosterCacheLanguage(language)
  await query(
    `INSERT INTO tmdb_poster_cache (media_type, tmdb_id, language, poster_path, fetched_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (media_type, tmdb_id, language) DO UPDATE SET
       poster_path = EXCLUDED.poster_path,
       fetched_at = NOW()`,
    [mediaType, tmdbId, lang, posterPath]
  )
}
