/**
 * Persisted TMDb collection metadata + parts for gap analysis and other features.
 * Gap analysis run populates this; admin gap UI reads summaries from cache only (no N API calls).
 */

import { query } from '../lib/db.js'
import { getImageUrl, type ApiLogCallback } from './client.js'
import { getCollectionData } from './collections.js'
import type { CollectionData } from './types.js'

type CachedPart = {
  tmdbId: number
  title: string
  releaseDate: string | null
  posterPath: string | null
}

function rowToCollectionData(row: {
  collection_id: number
  name: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  parts_json: unknown
}): CollectionData {
  const raw = row.parts_json
  const partsArr = Array.isArray(raw) ? raw : []
  const parts: CollectionData['parts'] = partsArr.map((p: CachedPart) => ({
    tmdbId: Number(p.tmdbId),
    title: String(p.title),
    releaseDate: p.releaseDate ?? null,
    posterPath: p.posterPath ?? null,
  }))
  return {
    tmdbId: row.collection_id,
    name: row.name,
    overview: row.overview,
    posterUrl: getImageUrl(row.poster_path),
    posterPath: row.poster_path,
    backdropUrl: getImageUrl(row.backdrop_path, 'original'),
    backdropPath: row.backdrop_path,
    parts,
  }
}

/**
 * Upsert full collection payload after a successful TMDb fetch.
 */
export async function upsertCollectionCache(data: CollectionData): Promise<void> {
  const parts: CachedPart[] = data.parts.map((p) => ({
    tmdbId: p.tmdbId,
    title: p.title,
    releaseDate: p.releaseDate,
    posterPath: p.posterPath,
  }))
  await query(
    `INSERT INTO tmdb_collection_cache (
       collection_id, name, overview, poster_path, backdrop_path, parts_json, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
     ON CONFLICT (collection_id) DO UPDATE SET
       name = EXCLUDED.name,
       overview = EXCLUDED.overview,
       poster_path = EXCLUDED.poster_path,
       backdrop_path = EXCLUDED.backdrop_path,
       parts_json = EXCLUDED.parts_json,
       updated_at = NOW()`,
    [
      data.tmdbId,
      data.name,
      data.overview,
      data.posterPath,
      data.backdropPath ?? null,
      JSON.stringify(parts),
    ]
  )
}

/**
 * Load many collections from cache in one query (gap analysis summaries).
 */
export async function getCachedCollectionDataBatch(
  collectionIds: number[]
): Promise<Map<number, CollectionData>> {
  const out = new Map<number, CollectionData>()
  if (collectionIds.length === 0) return out

  const result = await query<{
    collection_id: number
    name: string
    overview: string | null
    poster_path: string | null
    backdrop_path: string | null
    parts_json: unknown
  }>(
    `SELECT collection_id, name, overview, poster_path, backdrop_path, parts_json
     FROM tmdb_collection_cache
     WHERE collection_id = ANY($1::int[])`,
    [collectionIds]
  )
  for (const row of result.rows) {
    out.set(row.collection_id, rowToCollectionData(row))
  }
  return out
}

/**
 * Fetch from TMDb and persist to cache (gap analysis pipeline).
 */
export async function fetchCollectionDataAndCache(
  collectionId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<CollectionData | null> {
  const data = await getCollectionData(collectionId, options)
  if (data) {
    await upsertCollectionCache(data)
  }
  return data
}
