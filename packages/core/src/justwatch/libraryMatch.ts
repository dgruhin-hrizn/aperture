import { query } from '../lib/db.js'
import type { JustWatchStreamingRow } from './types.js'

/**
 * Set inLibrary and local Aperture ids from movies/series tables by TMDb id.
 */
export async function attachLibraryMatch(rows: JustWatchStreamingRow[]): Promise<JustWatchStreamingRow[]> {
  const tmdbIds = [
    ...new Set(rows.map((r) => r.tmdbId).filter((x): x is number => x !== null)),
  ].map(String)
  if (tmdbIds.length === 0) {
    return rows.map((r) => ({ ...r, inLibrary: false }))
  }

  // movies.tmdb_id / series.tmdb_id are TEXT in schema. Use IN ($1,$2,…) not ANY($1::text[]):
  // node-pg can infer JS arrays as int[] when elements look numeric, which triggers text = integer.
  const placeholders = tmdbIds.map((_, i) => `$${i + 1}`).join(', ')
  const matchSql = `SELECT id, tmdb_id FROM __TABLE__ WHERE tmdb_id::text IN (${placeholders})`
  const [moviesRes, seriesRes] = await Promise.all([
    query<{ id: string; tmdb_id: string }>(matchSql.replace('__TABLE__', 'movies'), tmdbIds),
    query<{ id: string; tmdb_id: string }>(matchSql.replace('__TABLE__', 'series'), tmdbIds),
  ])

  const movieByTmdb = new Map(moviesRes.rows.map((r) => [String(r.tmdb_id), r.id]))
  const seriesByTmdb = new Map(seriesRes.rows.map((r) => [String(r.tmdb_id), r.id]))

  return rows.map((row) => {
    if (!row.tmdbId) {
      return { ...row, inLibrary: false, localMovieId: null, localSeriesId: null }
    }
    if (row.objectType === 'MOVIE') {
      const id = movieByTmdb.get(String(row.tmdbId)) ?? null
      return { ...row, inLibrary: !!id, localMovieId: id, localSeriesId: null }
    }
    if (row.objectType === 'SHOW') {
      const id = seriesByTmdb.get(String(row.tmdbId)) ?? null
      return { ...row, inLibrary: !!id, localSeriesId: id, localMovieId: null }
    }
    const mid = movieByTmdb.get(String(row.tmdbId)) ?? null
    const sid = seriesByTmdb.get(String(row.tmdbId)) ?? null
    if (mid) {
      return { ...row, inLibrary: true, localMovieId: mid, localSeriesId: null }
    }
    if (sid) {
      return { ...row, inLibrary: true, localSeriesId: sid, localMovieId: null }
    }
    return { ...row, inLibrary: false, localMovieId: null, localSeriesId: null }
  })
}
