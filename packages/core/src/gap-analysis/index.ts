/**
 * Library gap analysis: TMDB movie collection completeness vs synced movies table.
 *
 * Architecture: the scan job persists ALL released collection parts with their status
 * (in_library, seerr_status) into gap_analysis_results. Display-time functions read
 * pure SQL — zero Seerr or TMDb HTTP calls on page load.
 */

import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { fetchCollectionDataAndCache } from '../tmdb/collection-cache.js'
import type { CollectionData } from '../tmdb/types.js'
import { setJobStep, addLog, updateJobProgress } from '../jobs/progress.js'
import { batchGetMediaStatus, isSeerrConfigured } from '../seerr/provider.js'

const logger = createChildLogger('gap-analysis')

const CHUNK_SIZE = 10
const CHUNK_DELAY_MS = 200

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isReleasedReleaseDate(releaseDate: string | null | undefined): boolean {
  if (releaseDate == null || typeof releaseDate !== 'string') return false
  const s = releaseDate.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return false
  if (y < 100 || mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const releaseUtc = Date.UTC(y, mo - 1, d)
  const parsed = new Date(releaseUtc)
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== mo - 1 || parsed.getUTCDate() !== d) return false
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return releaseUtc <= todayUtc
}

/** TMDb IDs are positive PostgreSQL integers; never accept partial numeric strings. */
export function parseTmdbId(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null
  const id = Number(value)
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null
}

function parseYear(releaseDate: string | null): number | null {
  if (!releaseDate || releaseDate.length < 4) return null
  const y = parseInt(releaseDate.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeerrStatus = 'none' | 'requested' | 'processing' | 'available'
export type GapAnalysisRunStatus = 'running' | 'completed' | 'failed'

export interface GapAnalysisRun {
  id: string
  status: GapAnalysisRunStatus
  errorMessage: string | null
  collectionsScanned: number
  totalParts: number
  ownedParts: number
  missingCount: number
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
}

export interface GapAnalysisResultRow {
  id: string
  runId: string
  collectionId: number
  collectionName: string
  collectionPosterPath: string | null
  tmdbId: number
  title: string
  releaseYear: number | null
  releaseDate: string | null
  posterPath: string | null
  inLibrary: boolean
  seerrStatus: SeerrStatus
}

export interface GapResult extends GapAnalysisResultRow {
  requestStatus: string | null
  requestSource: string | null
}

export interface GapCollectionSummary {
  collectionId: number
  collectionName: string
  collectionPosterPath: string | null
  totalReleased: number
  ownedCount: number
  seerrCount: number
  missingCount: number
}

export interface GapCollectionPart {
  tmdbId: number
  title: string
  releaseYear: number | null
  releaseDate: string | null
  posterPath: string | null
  inLibrary: boolean
  seerrStatus: SeerrStatus
}

export type GapResultsSortBy = 'title' | 'release_date' | 'collection_name'
export type GapResultsSortDir = 'asc' | 'desc'

export interface ListGapResultsOptions {
  runId: string
  userId: string
  collectionId?: number
  search?: string
  sortBy?: GapResultsSortBy
  sortDir?: GapResultsSortDir
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// DB: run management
// ---------------------------------------------------------------------------

type GapRunRow = {
  id: string
  status: GapAnalysisRunStatus
  error_message: string | null
  collections_scanned: number
  total_parts: number
  owned_parts: number
  missing_count: number
  started_at: Date
  completed_at: Date | null
  created_at: Date
}

function rowToGapRun(row: GapRunRow): GapAnalysisRun {
  return {
    id: row.id,
    status: row.status,
    errorMessage: row.error_message,
    collectionsScanned: row.collections_scanned,
    totalParts: row.total_parts,
    ownedParts: row.owned_parts,
    missingCount: row.missing_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

export async function getLatestCompletedGapRun(): Promise<GapAnalysisRun | null> {
  const row = await queryOne<GapRunRow>(
    `SELECT * FROM gap_analysis_runs
     WHERE status = 'completed' AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT 1`
  )
  return row ? rowToGapRun(row) : null
}

export async function getActiveRunningGapRun(): Promise<GapAnalysisRun | null> {
  const row = await queryOne<GapRunRow>(
    `SELECT * FROM gap_analysis_runs
     WHERE status = 'running'
     ORDER BY started_at DESC LIMIT 1`
  )
  return row ? rowToGapRun(row) : null
}

async function insertRunningGapRun(): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO gap_analysis_runs (
      status, started_at, completed_at,
      collections_scanned, total_parts, owned_parts, missing_count, error_message
    ) VALUES ('running', NOW(), NULL, 0, 0, 0, 0, NULL)
    RETURNING id`
  )
  if (!row) throw new Error('Failed to insert running gap_analysis_runs')
  return row.id
}

async function insertEmptyRun(): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO gap_analysis_runs (
      status, started_at, completed_at,
      collections_scanned, total_parts, owned_parts, missing_count, error_message
    ) VALUES ('completed', NOW(), NOW(), 0, 0, 0, 0, NULL)
    RETURNING id`
  )
  if (!row) throw new Error('Failed to insert empty gap run')
  return row.id
}

async function failGapRun(runId: string, message: string): Promise<void> {
  await query(`DELETE FROM gap_analysis_results WHERE run_id = $1`, [runId])
  await query(
    `UPDATE gap_analysis_runs
     SET status = 'failed', completed_at = NOW(), error_message = $2
     WHERE id = $1`,
    [runId, message]
  )
}

/** Prune only after success; never delete an active scan or the last good fallback. */
async function pruneGapSnapshots(): Promise<void> {
  try {
    await query(`DELETE FROM gap_analysis_runs WHERE id IN (
      SELECT id FROM (
        SELECT id, status, ROW_NUMBER() OVER (PARTITION BY status ORDER BY completed_at DESC, id) AS position
        FROM gap_analysis_runs WHERE status IN ('completed', 'failed')
      ) ranked WHERE (status = 'completed' AND position > 2) OR (status = 'failed' AND position > 5)
    )`)
  } catch (err) {
    logger.warn({ err }, 'Could not prune old gap snapshots; completed results remain available')
  }
}

// ---------------------------------------------------------------------------
// DB: library helpers (used by scan job)
// ---------------------------------------------------------------------------

export async function getDistinctMovieCollectionIds(): Promise<number[]> {
  const result = await query<{ collection_id: string }>(
    `SELECT collection_id
     FROM (
       SELECT DISTINCT collection_id FROM movies
       WHERE collection_id IS NOT NULL AND trim(collection_id) != ''
     ) AS t
     ORDER BY collection_id ASC`
  )
  return [...new Set(result.rows.map((r) => parseTmdbId(r.collection_id))
    .filter((id): id is number => id !== null))].sort((a, b) => a - b)
}

export async function getLibraryMovieTmdbIdSet(): Promise<Set<string>> {
  const result = await query<{ tmdb_id: string }>(
    `SELECT DISTINCT tmdb_id FROM movies WHERE tmdb_id IS NOT NULL AND tmdb_id != ''`
  )
  return new Set(result.rows.map((r) => parseTmdbId(r.tmdb_id)).filter((id) => id !== null).map(String))
}

export async function getMovieTmdbIdsWithActiveDiscoveryRequest(): Promise<Set<number>> {
  const result = await query<{ tmdb_id: number }>(
    `SELECT DISTINCT tmdb_id FROM discovery_requests
     WHERE media_type = 'movie' AND status NOT IN ('declined', 'failed')`
  )
  return new Set(result.rows.map((r) => r.tmdb_id))
}

// ---------------------------------------------------------------------------
// Scan job: runLibraryGapAnalysis
// ---------------------------------------------------------------------------

function deriveSeerrStatus(
  st: { exists: boolean; status: string; requested: boolean } | undefined
): SeerrStatus {
  if (!st) return 'none'
  if (st.exists) return 'available'
  if (st.status === 'processing') return 'processing'
  if (st.requested) return 'requested'
  return 'none'
}

export async function runLibraryGapAnalysis(options: { jobId?: string } = {}): Promise<{
  runId: string
  collectionsScanned: number
  totalParts: number
  ownedParts: number
  missingCount: number
}> {
  const { jobId } = options
  let runId: string | null = null

  const log = (msg: string) => {
    logger.info(msg)
    if (jobId) addLog(jobId, 'info', msg)
  }

  try {
    // Keep previous snapshots readable throughout refresh and after any failure.
    if (jobId) setJobStep(jobId, 0, 'Collecting collection IDs from library', 1)

    const collectionIds = await getDistinctMovieCollectionIds()
    log(`Found ${collectionIds.length} distinct collection IDs in library`)

    if (collectionIds.length === 0) {
      const id = await insertEmptyRun()
      await pruneGapSnapshots()
      log('No collections to scan')
      return { runId: id, collectionsScanned: 0, totalParts: 0, ownedParts: 0, missingCount: 0 }
    }

    if (jobId) {
      updateJobProgress(jobId, 1, 1)
      setJobStep(jobId, 1, 'Loading library TMDb IDs', 1)
    }

    const libraryTmdb = await getLibraryMovieTmdbIdSet()
    log(`Library has ${libraryTmdb.size} distinct movie TMDb IDs`)

    if (jobId) {
      updateJobProgress(jobId, 1, 1)
      setJobStep(jobId, 2, `Fetching ${collectionIds.length} collections from TMDb`, collectionIds.length)
    }

    runId = await insertRunningGapRun()
    log(`Created gap run ${runId} (streaming results)`)

    const collectionsData = new Map<number, CollectionData>()
    let totalParts = 0
    let ownedParts = 0
    let missingParts = 0
    let scannedCollections = 0
    const seerrOk = await isSeerrConfigured()

    for (let i = 0; i < collectionIds.length; i += CHUNK_SIZE) {
      const chunk = collectionIds.slice(i, i + CHUNK_SIZE)
      const batchEnd = Math.min(i + CHUNK_SIZE, collectionIds.length)
      log(`Fetching collections ${i + 1}-${batchEnd} / ${collectionIds.length}`)

      const promises = chunk.map(async (id) => {
        let notFound = false
        const data = await fetchCollectionDataAndCache(id, {
          onLog: (_provider, _endpoint, status) => { if (status === 'not_found') notFound = true },
        })
        if (notFound) {
          log(`TMDb collection ${id} no longer exists; skipped`)
          return
        }
        if (!data) throw new Error(`Could not retrieve TMDb collection ${id}; previous snapshot retained`)
        collectionsData.set(id, data)
      })
      await Promise.all(promises)
      scannedCollections += chunk.length

      // Gather all released parts from this chunk
      type PartRow = {
        collectionId: number
        collectionName: string
        collectionPosterPath: string | null
        tmdbId: number
        title: string
        releaseYear: number | null
        releaseDate: string | null
        posterPath: string | null
        inLibrary: boolean
      }
      const uniqueParts = new Map<string, PartRow>()
      for (const cid of chunk) {
        const col = collectionsData.get(cid)
        if (!col) continue
        for (const part of col.parts) {
          if (!isReleasedReleaseDate(part.releaseDate)) continue
          const partTmdb = parseTmdbId(part.tmdbId)
          if (partTmdb === null) continue
          const inLib = libraryTmdb.has(String(partTmdb))
          uniqueParts.set(`${cid}:${partTmdb}`, {
            collectionId: col.tmdbId,
            collectionName: col.name,
            collectionPosterPath: col.posterPath,
            tmdbId: partTmdb,
            title: part.title,
            releaseYear: parseYear(part.releaseDate),
            releaseDate: part.releaseDate,
            posterPath: part.posterPath,
            inLibrary: inLib,
          })
        }
      }

      const chunkParts = [...uniqueParts.values()]

      // Seerr cross-reference for non-library parts
      const nonLibIds = [...new Set(
        chunkParts.filter((p) => !p.inLibrary).map((p) => p.tmdbId).filter((id) => Number.isFinite(id))
      )]
      let seerrMap = new Map<number, { exists: boolean; status: string; requested: boolean }>()
      if (seerrOk && nonLibIds.length > 0) {
        seerrMap = await batchGetMediaStatus(
          nonLibIds.map((tmdbId) => ({ tmdbId, mediaType: 'movie' as const }))
        )
        const noStatus = nonLibIds.filter((id) => !seerrMap.has(id))
        if (noStatus.length > 0) {
          throw new Error(`Seerr status unavailable for ${noStatus.length} title(s); previous snapshot retained`)
        }
      }

      // One write per chunk. Counters reflect the deduplicated rows actually persisted.
      const rows = chunkParts.map((part) => ({
        ...part,
        seerrStatus: part.inLibrary ? 'available' as SeerrStatus : deriveSeerrStatus(seerrMap.get(part.tmdbId)),
      }))
      if (rows.length) await query(
        `INSERT INTO gap_analysis_results (
          run_id, collection_id, collection_name, collection_poster_path,
          tmdb_id, title, release_year, release_date, poster_path, in_library, seerr_status
        ) SELECT $1::uuid, p."collectionId", p."collectionName", p."collectionPosterPath",
                 p."tmdbId", p.title, p."releaseYear", p."releaseDate", p."posterPath", p."inLibrary", p."seerrStatus"
          FROM jsonb_to_recordset($2::jsonb) AS p(
            "collectionId" int, "collectionName" text, "collectionPosterPath" text,
            "tmdbId" int, title text, "releaseYear" int, "releaseDate" text,
            "posterPath" text, "inLibrary" boolean, "seerrStatus" text
          )`,
        [runId, JSON.stringify(rows)]
      )
      const chunkOwned = rows.filter((part) => part.inLibrary).length
      const chunkMissing = rows.filter((part) => !part.inLibrary && part.seerrStatus === 'none').length

      totalParts += chunkParts.length
      ownedParts += chunkOwned
      missingParts += chunkMissing

      await query(
        `UPDATE gap_analysis_runs SET
           collections_scanned = $1, total_parts = $2, owned_parts = $3, missing_count = $4
         WHERE id = $5`,
        [scannedCollections, totalParts, ownedParts, missingParts, runId]
      )

      if (jobId) {
        updateJobProgress(jobId, batchEnd, collectionIds.length, `Batch ${batchEnd}/${collectionIds.length}`)
      }

      if (i + CHUNK_SIZE < collectionIds.length) await sleep(CHUNK_DELAY_MS)
    }

    log(`Diff complete: ${totalParts} parts, ${ownedParts} in library, ${missingParts} missing`)

    if (jobId) {
      setJobStep(jobId, 3, 'Finalizing snapshot', 1)
      updateJobProgress(jobId, 1, 1)
    }

    await query(
      `UPDATE gap_analysis_runs SET
         status = 'completed', completed_at = NOW(),
         collections_scanned = $1, total_parts = $2, owned_parts = $3, missing_count = $4
       WHERE id = $5`,
      [scannedCollections, totalParts, ownedParts, missingParts, runId]
    )

    await pruneGapSnapshots()
    log(`Completed gap run ${runId}`)
    return { runId, collectionsScanned: scannedCollections, totalParts, ownedParts, missingCount: missingParts }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (runId) await failGapRun(runId, msg)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Display: collection summaries (pure SQL)
// ---------------------------------------------------------------------------

export async function getGapCollectionSummaries(runId: string): Promise<GapCollectionSummary[]> {
  const result = await query<{
    collection_id: number
    collection_name: string
    collection_poster_path: string | null
    total_released: string
    owned_count: string
    seerr_count: string
    missing_count: string
  }>(
    `SELECT
       collection_id,
       collection_name,
       collection_poster_path,
       COUNT(*)::text                                                          AS total_released,
       COUNT(*) FILTER (WHERE in_library)::text                                AS owned_count,
       COUNT(*) FILTER (WHERE NOT in_library AND seerr_status != 'none')::text AS seerr_count,
       COUNT(*) FILTER (WHERE NOT in_library AND seerr_status  = 'none')::text AS missing_count
     FROM (${gapDisplaySql()}) AS r
     WHERE run_id = $1
     GROUP BY collection_id, collection_name, collection_poster_path
     HAVING COUNT(*) FILTER (WHERE NOT in_library AND seerr_status = 'none') > 0
     ORDER BY collection_name ASC`,
    [runId]
  )

  return result.rows.map((r) => ({
    collectionId: r.collection_id,
    collectionName: r.collection_name,
    collectionPosterPath: r.collection_poster_path,
    totalReleased: parseInt(r.total_released, 10),
    ownedCount: parseInt(r.owned_count, 10),
    seerrCount: parseInt(r.seerr_count, 10),
    missingCount: parseInt(r.missing_count, 10),
  }))
}

// ---------------------------------------------------------------------------
// Display: paginated gap results (pure SQL)
// ---------------------------------------------------------------------------

/** Overlay locally known availability/requests so summaries, parts and list agree. */
function gapDisplaySql(): string {
  return `SELECT r.id, r.run_id, r.collection_id, r.collection_name, r.collection_poster_path,
    r.tmdb_id, r.title, r.release_year, r.release_date, r.poster_path,
    (r.in_library OR EXISTS (SELECT 1 FROM movies m WHERE m.tmdb_id = r.tmdb_id::text)) AS in_library,
    CASE WHEN r.seerr_status = 'none' AND NOT (${sqlNoActiveDiscoveryRequest('r')})
      THEN 'requested' ELSE r.seerr_status END AS seerr_status
    FROM gap_analysis_results r`
}

/** No active Aperture discovery request for this movie. */
function sqlNoActiveDiscoveryRequest(alias: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM discovery_requests dr
    WHERE dr.tmdb_id = ${alias}.tmdb_id
      AND dr.media_type = 'movie'
      AND dr.status NOT IN ('declined', 'failed')
  )`
}

export async function listGapResults(opts: ListGapResultsOptions): Promise<{
  rows: GapResult[]
  total: number
  page: number
  pageSize: number
}> {
  const page = Number.isFinite(opts.page) ? Math.max(1, Math.min(1000000, Math.floor(opts.page!))) : 1
  const pageSize = Number.isFinite(opts.pageSize) ? Math.min(500, Math.max(1, Math.floor(opts.pageSize!))) : 50
  const offset = (page - 1) * pageSize

  const conditions: string[] = [
    'r.run_id = $1',
    'r.in_library = FALSE',
    "r.seerr_status = 'none'",
  ]
  const params: unknown[] = [opts.runId]
  let p = 2

  if (opts.collectionId != null) {
    conditions.push(`r.collection_id = $${p}`)
    params.push(opts.collectionId)
    p++
  }

  if (opts.search?.trim()) {
    const term = `%${opts.search.trim().toLowerCase()}%`
    conditions.push(`(LOWER(r.title) LIKE $${p} OR LOWER(r.collection_name) LIKE $${p})`)
    params.push(term)
    p++
  }

  const whereSql = conditions.join(' AND ')

  const sortBy: GapResultsSortBy = opts.sortBy ?? 'release_date'
  const sortDir: GapResultsSortDir = opts.sortDir ?? 'desc'
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC'
  let orderSql: string
  if (sortBy === 'title') {
    orderSql = `ORDER BY r.title ${dir}, r.collection_name ASC, r.tmdb_id ASC`
  } else if (sortBy === 'release_date') {
    orderSql = `ORDER BY r.release_date ${dir} NULLS LAST, r.collection_name ASC, r.title ASC, r.collection_id ASC, r.tmdb_id ASC`
  } else {
    orderSql = `ORDER BY r.collection_name ${dir}, r.title ASC, r.tmdb_id ASC`
  }

  const countRow = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM (${gapDisplaySql()}) r WHERE ${whereSql}`,
    params
  )
  const total = parseInt(countRow?.c ?? '0', 10)

  params.push(opts.userId, pageSize, offset)
  const uidIdx = p
  const limitIdx = p + 1
  const offsetIdx = p + 2

  const result = await query<{
    id: string
    run_id: string
    collection_id: number
    collection_name: string
    collection_poster_path: string | null
    tmdb_id: number
    title: string
    release_year: number | null
    release_date: string | null
    poster_path: string | null
    in_library: boolean
    seerr_status: SeerrStatus
    request_status: string | null
    request_source: string | null
  }>(
    `SELECT
       r.id, r.run_id, r.collection_id, r.collection_name, r.collection_poster_path,
       r.tmdb_id, r.title, r.release_year, r.release_date, r.poster_path,
       r.in_library, r.seerr_status,
       dr.status AS request_status,
       dr.source AS request_source
     FROM (${gapDisplaySql()}) r
     LEFT JOIN LATERAL (
       SELECT status, source FROM discovery_requests
       WHERE user_id = $${uidIdx}::uuid AND tmdb_id = r.tmdb_id AND media_type = 'movie'
       ORDER BY created_at DESC LIMIT 1
     ) dr ON true
     WHERE ${whereSql}
     ${orderSql}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  )

  const rows: GapResult[] = result.rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    collectionId: row.collection_id,
    collectionName: row.collection_name,
    collectionPosterPath: row.collection_poster_path,
    tmdbId: row.tmdb_id,
    title: row.title,
    releaseYear: row.release_year,
    releaseDate: row.release_date,
    posterPath: row.poster_path,
    inLibrary: row.in_library,
    seerrStatus: row.seerr_status,
    requestStatus: row.request_status,
    requestSource: row.request_source,
  }))

  return { rows, total, page, pageSize }
}

// ---------------------------------------------------------------------------
// Display: collection parts (pure SQL — replaces getGapCollectionReleasedPartsWithLibrary)
// ---------------------------------------------------------------------------

export async function getGapCollectionParts(
  runId: string,
  collectionIds: number[]
): Promise<Map<number, { collectionId: number; collectionName: string; collectionPosterPath: string | null; parts: GapCollectionPart[] }>> {
  const ids = [...new Set(collectionIds.filter((n) => parseTmdbId(n) !== null))]
  const out = new Map<number, { collectionId: number; collectionName: string; collectionPosterPath: string | null; parts: GapCollectionPart[] }>()
  if (ids.length === 0) return out

  const result = await query<{
    collection_id: number
    collection_name: string
    collection_poster_path: string | null
    tmdb_id: number
    title: string
    release_year: number | null
    release_date: string | null
    poster_path: string | null
    in_library: boolean
    seerr_status: SeerrStatus
  }>(
    `SELECT collection_id, collection_name, collection_poster_path,
            tmdb_id, title, release_year, release_date, poster_path,
            in_library, seerr_status
     FROM (${gapDisplaySql()}) AS r
     WHERE run_id = $1 AND collection_id = ANY($2::int[])
     ORDER BY collection_name ASC, release_date DESC NULLS LAST, title ASC`,
    [runId, ids]
  )

  for (const row of result.rows) {
    let entry = out.get(row.collection_id)
    if (!entry) {
      entry = {
        collectionId: row.collection_id,
        collectionName: row.collection_name,
        collectionPosterPath: row.collection_poster_path,
        parts: [],
      }
      out.set(row.collection_id, entry)
    }
    entry.parts.push({
      tmdbId: row.tmdb_id,
      title: row.title,
      releaseYear: row.release_year,
      releaseDate: row.release_date,
      posterPath: row.poster_path,
      inLibrary: row.in_library,
      seerrStatus: row.seerr_status,
    })
  }

  return out
}
