/**
 * Discovery Storage
 * 
 * Database operations for storing discovery runs, candidates, and requests
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import type {
  MediaType,
  DiscoveryRun,
  DiscoveryCandidate,
  DiscoveryRequest,
  ScoredCandidate,
  DiscoveryRunStatus,
  DiscoveryRequestStatus,
  DiscoveryFilterOptions,
  PoolCandidate,
  RawCandidate,
  GlobalDiscoverySource,
  GLOBAL_SOURCES,
} from './types.js'

const logger = createChildLogger('discover:storage')

// ============================================================================
// Discovery Runs
// ============================================================================

/**
 * Create a new discovery run record
 */
export async function createDiscoveryRun(
  userId: string,
  mediaType: MediaType,
  runType: 'scheduled' | 'manual' = 'scheduled'
): Promise<string> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO discovery_runs (user_id, media_type, run_type, status)
     VALUES ($1, $2, $3, 'running')
     RETURNING id`,
    [userId, mediaType, runType]
  )

  if (!result) {
    throw new Error('Failed to create discovery run')
  }

  logger.debug({ runId: result.id, userId, mediaType }, 'Created discovery run')
  return result.id
}

/**
 * Update discovery run statistics
 */
export async function updateDiscoveryRunStats(
  runId: string,
  stats: {
    candidatesFetched?: number
    candidatesFiltered?: number
    candidatesScored?: number
    candidatesStored?: number
  }
): Promise<void> {
  const updates: string[] = []
  const values: (string | number)[] = [runId]
  let paramIndex = 2

  if (stats.candidatesFetched !== undefined) {
    updates.push(`candidates_fetched = $${paramIndex}`)
    values.push(stats.candidatesFetched)
    paramIndex++
  }
  if (stats.candidatesFiltered !== undefined) {
    updates.push(`candidates_filtered = $${paramIndex}`)
    values.push(stats.candidatesFiltered)
    paramIndex++
  }
  if (stats.candidatesScored !== undefined) {
    updates.push(`candidates_scored = $${paramIndex}`)
    values.push(stats.candidatesScored)
    paramIndex++
  }
  if (stats.candidatesStored !== undefined) {
    updates.push(`candidates_stored = $${paramIndex}`)
    values.push(stats.candidatesStored)
    paramIndex++
  }

  if (updates.length === 0) return

  await query(
    `UPDATE discovery_runs SET ${updates.join(', ')} WHERE id = $1`,
    values
  )
}

/**
 * Finalize a discovery run
 */
export async function finalizeDiscoveryRun(
  runId: string,
  status: DiscoveryRunStatus,
  durationMs: number,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE discovery_runs 
     SET status = $2, duration_ms = $3, error_message = $4
     WHERE id = $1`,
    [runId, status, durationMs, errorMessage ?? null]
  )

  logger.debug({ runId, status, durationMs }, 'Finalized discovery run')
}

/**
 * Get the latest discovery run for a user
 */
export async function getLatestDiscoveryRun(
  userId: string,
  mediaType: MediaType
): Promise<DiscoveryRun | null> {
  const result = await queryOne<{
    id: string
    user_id: string
    media_type: MediaType
    run_type: 'scheduled' | 'manual'
    candidates_fetched: number
    candidates_filtered: number
    candidates_scored: number
    candidates_stored: number
    duration_ms: number | null
    status: DiscoveryRunStatus
    error_message: string | null
    created_at: Date
  }>(
    `SELECT * FROM discovery_runs 
     WHERE user_id = $1 AND media_type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, mediaType]
  )

  if (!result) return null

  return {
    id: result.id,
    userId: result.user_id,
    mediaType: result.media_type,
    runType: result.run_type,
    candidatesFetched: result.candidates_fetched,
    candidatesFiltered: result.candidates_filtered,
    candidatesScored: result.candidates_scored,
    candidatesStored: result.candidates_stored,
    durationMs: result.duration_ms,
    status: result.status,
    errorMessage: result.error_message,
    createdAt: result.created_at,
  }
}

// ============================================================================
// Discovery Pool (Shared Candidates)
// ============================================================================

/**
 * Upsert candidates into the shared discovery pool
 * Global candidates are shared across all users to avoid duplicate storage
 */
export async function upsertPoolCandidates(
  mediaType: MediaType,
  candidates: RawCandidate[]
): Promise<{ inserted: number; updated: number }> {
  if (candidates.length === 0) return { inserted: 0, updated: 0 }

  let inserted = 0
  let updated = 0

  for (const c of candidates) {
    try {
      // Check if candidate already exists
      const existing = await queryOne<{ id: string; sources: string[] }>(
        `SELECT id, sources FROM discovery_pool WHERE media_type = $1 AND tmdb_id = $2`,
        [mediaType, c.tmdbId]
      )

      if (existing) {
        // Update existing - merge sources and update metadata if better
        const existingSources = existing.sources || []
        const newSources = [...new Set([...existingSources, c.source])]
        
        await query(
          `UPDATE discovery_pool SET
            sources = $3,
            title = COALESCE(NULLIF($4, ''), title),
            original_title = COALESCE($5, original_title),
            original_language = COALESCE($6, original_language),
            release_year = COALESCE($7, release_year),
            poster_path = COALESCE($8, poster_path),
            backdrop_path = COALESCE($9, backdrop_path),
            overview = COALESCE(NULLIF($10, ''), overview),
            genres = CASE WHEN $11::jsonb != '[]'::jsonb THEN $11::jsonb ELSE genres END,
            vote_average = COALESCE($12, vote_average),
            vote_count = COALESCE($13, vote_count),
            popularity = COALESCE($14, popularity),
            updated_at = NOW()
          WHERE id = $1 AND media_type = $2`,
          [
            existing.id, mediaType, newSources,
            c.title, c.originalTitle, c.originalLanguage, c.releaseYear,
            c.posterPath, c.backdropPath, c.overview,
            JSON.stringify(c.genres || []),
            c.voteAverage, c.voteCount, c.popularity,
          ]
        )
        updated++
      } else {
        // Insert new
        await query(
          `INSERT INTO discovery_pool (
            media_type, tmdb_id, imdb_id, sources,
            title, original_title, original_language, release_year,
            poster_path, backdrop_path, overview,
            genres, vote_average, vote_count, popularity
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11,
            $12, $13, $14, $15
          )`,
          [
            mediaType, c.tmdbId, c.imdbId, [c.source],
            c.title, c.originalTitle, c.originalLanguage, c.releaseYear,
            c.posterPath, c.backdropPath, c.overview,
            JSON.stringify(c.genres || []),
            c.voteAverage, c.voteCount, c.popularity,
          ]
        )
        inserted++
      }
    } catch (err) {
      logger.warn({ err, tmdbId: c.tmdbId, title: c.title }, 'Failed to upsert pool candidate')
    }
  }

  logger.info({ mediaType, inserted, updated, total: candidates.length }, 'Upserted pool candidates')
  return { inserted, updated }
}

/**
 * Get all candidates from the pool for a media type
 */
export async function getPoolCandidates(
  mediaType: MediaType
): Promise<PoolCandidate[]> {
  const result = await query<{
    id: string
    media_type: MediaType
    tmdb_id: number
    imdb_id: string | null
    title: string
    original_title: string | null
    original_language: string | null
    release_year: number | null
    poster_path: string | null
    backdrop_path: string | null
    overview: string | null
    genres: { id: number; name: string }[]
    vote_average: string | null
    vote_count: number | null
    popularity: string | null
    cast_members: { id: number; name: string; character: string; profilePath: string | null }[] | null
    directors: string[] | null
    runtime_minutes: number | null
    tagline: string | null
    is_enriched: boolean
    sources: string[]
    created_at: Date
    updated_at: Date
  }>(
    `SELECT * FROM discovery_pool WHERE media_type = $1 ORDER BY popularity DESC NULLS LAST`,
    [mediaType]
  )

  return result.rows.map(row => ({
    id: row.id,
    mediaType: row.media_type,
    tmdbId: row.tmdb_id,
    imdbId: row.imdb_id,
    title: row.title,
    originalTitle: row.original_title,
    originalLanguage: row.original_language,
    releaseYear: row.release_year,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    overview: row.overview,
    genres: row.genres || [],
    voteAverage: row.vote_average ? parseFloat(row.vote_average) : null,
    voteCount: row.vote_count,
    popularity: row.popularity ? parseFloat(row.popularity) : null,
    castMembers: row.cast_members,
    directors: row.directors,
    runtimeMinutes: row.runtime_minutes,
    tagline: row.tagline,
    isEnriched: row.is_enriched,
    sources: row.sources as GlobalDiscoverySource[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/**
 * Get pool candidate by TMDb ID
 */
export async function getPoolCandidateByTmdbId(
  mediaType: MediaType,
  tmdbId: number
): Promise<PoolCandidate | null> {
  const result = await queryOne<{
    id: string
    media_type: MediaType
    tmdb_id: number
    imdb_id: string | null
    title: string
    original_title: string | null
    original_language: string | null
    release_year: number | null
    poster_path: string | null
    backdrop_path: string | null
    overview: string | null
    genres: { id: number; name: string }[]
    vote_average: string | null
    vote_count: number | null
    popularity: string | null
    cast_members: { id: number; name: string; character: string; profilePath: string | null }[] | null
    directors: string[] | null
    runtime_minutes: number | null
    tagline: string | null
    is_enriched: boolean
    sources: string[]
    created_at: Date
    updated_at: Date
  }>(
    `SELECT * FROM discovery_pool WHERE media_type = $1 AND tmdb_id = $2`,
    [mediaType, tmdbId]
  )

  if (!result) return null

  return {
    id: result.id,
    mediaType: result.media_type,
    tmdbId: result.tmdb_id,
    imdbId: result.imdb_id,
    title: result.title,
    originalTitle: result.original_title,
    originalLanguage: result.original_language,
    releaseYear: result.release_year,
    posterPath: result.poster_path,
    backdropPath: result.backdrop_path,
    overview: result.overview,
    genres: result.genres || [],
    voteAverage: result.vote_average ? parseFloat(result.vote_average) : null,
    voteCount: result.vote_count,
    popularity: result.popularity ? parseFloat(result.popularity) : null,
    castMembers: result.cast_members,
    directors: result.directors,
    runtimeMinutes: result.runtime_minutes,
    tagline: result.tagline,
    isEnriched: result.is_enriched,
    sources: result.sources as GlobalDiscoverySource[],
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  }
}

/**
 * Mark pool candidates as enriched and update their metadata
 */
export async function updatePoolCandidateEnrichment(
  poolId: string,
  enrichmentData: {
    castMembers?: { id: number; name: string; character: string; profilePath: string | null }[]
    directors?: string[]
    runtimeMinutes?: number | null
    tagline?: string | null
    imdbId?: string | null
  }
): Promise<void> {
  await query(
    `UPDATE discovery_pool SET
      cast_members = COALESCE($2, cast_members),
      directors = COALESCE($3, directors),
      runtime_minutes = COALESCE($4, runtime_minutes),
      tagline = COALESCE($5, tagline),
      imdb_id = COALESCE($6, imdb_id),
      is_enriched = TRUE,
      updated_at = NOW()
    WHERE id = $1`,
    [
      poolId,
      enrichmentData.castMembers ? JSON.stringify(enrichmentData.castMembers) : null,
      enrichmentData.directors || null,
      enrichmentData.runtimeMinutes ?? null,
      enrichmentData.tagline ?? null,
      enrichmentData.imdbId ?? null,
    ]
  )
}

/**
 * Get pool candidates that need enrichment
 */
export async function getUnenrichedPoolCandidates(
  mediaType: MediaType,
  limit: number = 100
): Promise<PoolCandidate[]> {
  const result = await query<{
    id: string
    media_type: MediaType
    tmdb_id: number
    imdb_id: string | null
    title: string
    original_title: string | null
    original_language: string | null
    release_year: number | null
    poster_path: string | null
    backdrop_path: string | null
    overview: string | null
    genres: { id: number; name: string }[]
    vote_average: string | null
    vote_count: number | null
    popularity: string | null
    cast_members: { id: number; name: string; character: string; profilePath: string | null }[] | null
    directors: string[] | null
    runtime_minutes: number | null
    tagline: string | null
    is_enriched: boolean
    sources: string[]
    created_at: Date
    updated_at: Date
  }>(
    `SELECT * FROM discovery_pool 
     WHERE media_type = $1 AND is_enriched = FALSE
     ORDER BY popularity DESC NULLS LAST
     LIMIT $2`,
    [mediaType, limit]
  )

  return result.rows.map(row => ({
    id: row.id,
    mediaType: row.media_type,
    tmdbId: row.tmdb_id,
    imdbId: row.imdb_id,
    title: row.title,
    originalTitle: row.original_title,
    originalLanguage: row.original_language,
    releaseYear: row.release_year,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    overview: row.overview,
    genres: row.genres || [],
    voteAverage: row.vote_average ? parseFloat(row.vote_average) : null,
    voteCount: row.vote_count,
    popularity: row.popularity ? parseFloat(row.popularity) : null,
    castMembers: row.cast_members,
    directors: row.directors,
    runtimeMinutes: row.runtime_minutes,
    tagline: row.tagline,
    isEnriched: row.is_enriched,
    sources: row.sources as GlobalDiscoverySource[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/**
 * Clear old pool entries (for maintenance)
 */
export async function clearOldPoolEntries(
  mediaType: MediaType,
  olderThanDays: number = 30
): Promise<number> {
  const result = await query(
    `DELETE FROM discovery_pool 
     WHERE media_type = $1 AND updated_at < NOW() - INTERVAL '1 day' * $2`,
    [mediaType, olderThanDays]
  )

  logger.info({ mediaType, deleted: result.rowCount, olderThanDays }, 'Cleared old pool entries')
  return result.rowCount ?? 0
}

/**
 * Convert pool candidate to raw candidate format for scoring
 */
export function poolCandidateToRaw(pool: PoolCandidate): RawCandidate {
  return {
    tmdbId: pool.tmdbId,
    imdbId: pool.imdbId,
    title: pool.title,
    originalTitle: pool.originalTitle,
    originalLanguage: pool.originalLanguage,
    overview: pool.overview,
    releaseYear: pool.releaseYear,
    posterPath: pool.posterPath,
    backdropPath: pool.backdropPath,
    genres: pool.genres,
    voteAverage: pool.voteAverage ?? 0,
    voteCount: pool.voteCount ?? 0,
    popularity: pool.popularity ?? 0,
    source: pool.sources[0] || 'tmdb_discover', // Use first source
    castMembers: pool.castMembers ?? undefined,
    directors: pool.directors ?? undefined,
    runtimeMinutes: pool.runtimeMinutes,
    tagline: pool.tagline,
  }
}

// ============================================================================
// Discovery Candidates
// ============================================================================

/**
 * Store discovery candidates (upsert to handle duplicates)
 */
export async function storeDiscoveryCandidates(
  runId: string,
  userId: string,
  candidates: ScoredCandidate[],
  mediaType: MediaType
): Promise<number> {
  if (candidates.length === 0) return 0

  // Delete old candidates for this user/media type
  await query(
    `DELETE FROM discovery_candidates WHERE user_id = $1 AND media_type = $2`,
    [userId, mediaType]
  )

  // Insert new candidates
  let stored = 0
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    
    try {
      await query(
        `INSERT INTO discovery_candidates (
          run_id, user_id, media_type, tmdb_id, imdb_id, rank,
          final_score, similarity_score, popularity_score, recency_score, source_score,
          source, source_media_id,
          title, original_title, original_language, release_year,
          poster_path, backdrop_path, overview,
          genres, vote_average, vote_count, score_breakdown,
          cast_members, directors, runtime_minutes, tagline,
          is_enriched
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27, $28,
          $29
        )`,
        [
          runId, userId, mediaType, c.tmdbId, c.imdbId, i + 1,
          c.finalScore, c.similarityScore, c.popularityScore, c.recencyScore, c.sourceScore,
          c.source, c.sourceMediaId ?? null,
          c.title, c.originalTitle, c.originalLanguage ?? null, c.releaseYear,
          c.posterPath, c.backdropPath, c.overview,
          JSON.stringify(c.genres),
          c.voteAverage, c.voteCount, JSON.stringify(c.scoreBreakdown),
          JSON.stringify(c.castMembers ?? []),
          c.directors ?? [],
          c.runtimeMinutes ?? null,
          c.tagline ?? null,
          c.isEnriched ?? false,
        ]
      )
      stored++
    } catch (err) {
      logger.warn({ err, tmdbId: c.tmdbId, title: c.title }, 'Failed to store discovery candidate')
    }
  }

  logger.info({ runId, userId, mediaType, stored, total: candidates.length }, 'Stored discovery candidates')
  return stored
}

/**
 * Get discovery candidates for a user with real-time library filtering
 */
export async function getDiscoveryCandidates(
  userId: string,
  mediaType: MediaType,
  options: DiscoveryFilterOptions = {}
): Promise<DiscoveryCandidate[]> {
  const limit = options.limit ?? 50
  const offset = options.offset ?? 0

  // Build dynamic WHERE clause for filters
  const conditions: string[] = ['dc.user_id = $1', 'dc.media_type = $2']
  const params: (string | number | string[])[] = [userId, mediaType]
  let paramIndex = 3

  // Real-time library exclusion - exclude items that are now in the library
  // This fixes the bug where items added after discovery generation still appear
  const libraryTable = mediaType === 'movie' ? 'movies' : 'series'
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM ${libraryTable} lib WHERE lib.tmdb_id = dc.tmdb_id::text
  )`)

  // Language filter
  if (options.languages && options.languages.length > 0) {
    // Default to including unknown language content when filtering
    const includeUnknown = options.includeUnknownLanguage !== false
    if (includeUnknown) {
      conditions.push(`(dc.original_language = ANY($${paramIndex}::text[]) OR dc.original_language IS NULL)`)
    } else {
      conditions.push(`dc.original_language = ANY($${paramIndex}::text[])`)
    }
    params.push(options.languages)
    paramIndex++
  }

  // Genre filter - check if any of the requested genres exist in the genres JSONB array
  if (options.genreIds && options.genreIds.length > 0) {
    // Use JSONB containment to check if any genre ID matches
    const genreConditions = options.genreIds.map((_: number, i: number) => 
      `dc.genres @> $${paramIndex + i}::jsonb`
    )
    conditions.push(`(${genreConditions.join(' OR ')})`)
    for (const genreId of options.genreIds) {
      params.push(JSON.stringify([{ id: genreId }]))
      paramIndex++
    }
  }

  // Year range filter
  if (options.yearStart !== undefined) {
    conditions.push(`dc.release_year >= $${paramIndex}`)
    params.push(options.yearStart)
    paramIndex++
  }
  if (options.yearEnd !== undefined) {
    conditions.push(`dc.release_year <= $${paramIndex}`)
    params.push(options.yearEnd)
    paramIndex++
  }

  // Minimum similarity threshold filter
  if (options.minSimilarity !== undefined && options.minSimilarity > 0) {
    conditions.push(`dc.similarity_score >= $${paramIndex}`)
    params.push(options.minSimilarity)
    paramIndex++
  }

  // Add pagination params
  params.push(limit, offset)

  const result = await query<{
    id: string
    run_id: string
    user_id: string
    media_type: MediaType
    tmdb_id: number
    imdb_id: string | null
    rank: number
    final_score: string
    similarity_score: string | null
    popularity_score: string | null
    recency_score: string | null
    source_score: string | null
    source: string
    source_media_id: number | null
    title: string
    original_title: string | null
    original_language: string | null
    release_year: number | null
    poster_path: string | null
    backdrop_path: string | null
    overview: string | null
    genres: { id: number; name: string }[]
    vote_average: string | null
    vote_count: number | null
    score_breakdown: Record<string, number>
    cast_members: { id: number; name: string; character: string; profilePath: string | null }[] | null
    directors: string[] | null
    runtime_minutes: number | null
    tagline: string | null
    is_enriched: boolean
    created_at: Date
  }>(
    `SELECT dc.* FROM discovery_candidates dc
     WHERE ${conditions.join(' AND ')}
     ORDER BY dc.rank ASC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  )

  return result.rows.map(row => ({
    id: row.id,
    runId: row.run_id,
    userId: row.user_id,
    mediaType: row.media_type,
    tmdbId: row.tmdb_id,
    imdbId: row.imdb_id,
    rank: row.rank,
    finalScore: parseFloat(row.final_score),
    similarityScore: row.similarity_score ? parseFloat(row.similarity_score) : null,
    popularityScore: row.popularity_score ? parseFloat(row.popularity_score) : null,
    recencyScore: row.recency_score ? parseFloat(row.recency_score) : null,
    sourceScore: row.source_score ? parseFloat(row.source_score) : null,
    source: row.source as DiscoveryCandidate['source'],
    sourceMediaId: row.source_media_id,
    title: row.title,
    originalTitle: row.original_title,
    originalLanguage: row.original_language,
    releaseYear: row.release_year,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    overview: row.overview,
    genres: row.genres,
    voteAverage: row.vote_average ? parseFloat(row.vote_average) : null,
    voteCount: row.vote_count,
    scoreBreakdown: row.score_breakdown,
    castMembers: row.cast_members || [],
    directors: row.directors || [],
    runtimeMinutes: row.runtime_minutes,
    tagline: row.tagline,
    isEnriched: row.is_enriched ?? true, // Default to true for backwards compatibility
    createdAt: row.created_at,
  }))
}

/**
 * Get count of discovery candidates for a user with real-time library filtering
 */
export async function getDiscoveryCandidateCount(
  userId: string,
  mediaType: MediaType,
  options: Omit<DiscoveryFilterOptions, 'limit' | 'offset'> = {}
): Promise<number> {
  // Build dynamic WHERE clause for filters (same logic as getDiscoveryCandidates)
  const conditions: string[] = ['dc.user_id = $1', 'dc.media_type = $2']
  const params: (string | number | string[])[] = [userId, mediaType]
  let paramIndex = 3

  // Real-time library exclusion
  const libraryTable = mediaType === 'movie' ? 'movies' : 'series'
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM ${libraryTable} lib WHERE lib.tmdb_id = dc.tmdb_id::text
  )`)

  // Language filter
  if (options.languages && options.languages.length > 0) {
    // Default to including unknown language content when filtering
    const includeUnknown = options.includeUnknownLanguage !== false
    if (includeUnknown) {
      conditions.push(`(dc.original_language = ANY($${paramIndex}::text[]) OR dc.original_language IS NULL)`)
    } else {
      conditions.push(`dc.original_language = ANY($${paramIndex}::text[])`)
    }
    params.push(options.languages)
    paramIndex++
  }

  // Genre filter
  if (options.genreIds && options.genreIds.length > 0) {
    const genreConditions = options.genreIds.map((_: number, i: number) => 
      `dc.genres @> $${paramIndex + i}::jsonb`
    )
    conditions.push(`(${genreConditions.join(' OR ')})`)
    for (const genreId of options.genreIds) {
      params.push(JSON.stringify([{ id: genreId }]))
      paramIndex++
    }
  }

  // Year range filter
  if (options.yearStart !== undefined) {
    conditions.push(`dc.release_year >= $${paramIndex}`)
    params.push(options.yearStart)
    paramIndex++
  }
  if (options.yearEnd !== undefined) {
    conditions.push(`dc.release_year <= $${paramIndex}`)
    params.push(options.yearEnd)
    paramIndex++
  }

  // Minimum similarity threshold filter
  if (options.minSimilarity !== undefined && options.minSimilarity > 0) {
    conditions.push(`dc.similarity_score >= $${paramIndex}`)
    params.push(options.minSimilarity)
    paramIndex++
  }

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM discovery_candidates dc
     WHERE ${conditions.join(' AND ')}`,
    params
  )

  return parseInt(result?.count ?? '0', 10)
}

/**
 * Clear discovery candidates for a user
 */
export async function clearDiscoveryCandidates(
  userId: string,
  mediaType?: MediaType
): Promise<number> {
  let result
  if (mediaType) {
    result = await query(
      `DELETE FROM discovery_candidates WHERE user_id = $1 AND media_type = $2`,
      [userId, mediaType]
    )
  } else {
    result = await query(
      `DELETE FROM discovery_candidates WHERE user_id = $1`,
      [userId]
    )
  }

  logger.info({ userId, mediaType, deleted: result.rowCount }, 'Cleared discovery candidates')
  return result.rowCount ?? 0
}

// ============================================================================
// Discovery Requests
// ============================================================================

/**
 * Create a discovery request record
 */
export async function createDiscoveryRequest(
  userId: string,
  mediaType: MediaType,
  tmdbId: number,
  title: string,
  discoveryCandidateId?: string
): Promise<string> {
  // Validate that the discovery candidate exists before linking
  // (candidates may be cleaned up during refresh, but we still want to allow the request)
  let validCandidateId: string | null = null
  if (discoveryCandidateId) {
    const candidate = await queryOne<{ id: string }>(
      `SELECT id FROM discovery_candidates WHERE id = $1`,
      [discoveryCandidateId]
    )
    if (candidate) {
      validCandidateId = discoveryCandidateId
    } else {
      logger.warn({ discoveryCandidateId }, 'Discovery candidate not found, proceeding without link')
    }
  }

  const result = await queryOne<{ id: string }>(
    `INSERT INTO discovery_requests (
      user_id, media_type, tmdb_id, title, discovery_candidate_id, status
    ) VALUES ($1, $2, $3, $4, $5, 'pending')
    RETURNING id`,
    [userId, mediaType, tmdbId, title, validCandidateId]
  )

  if (!result) {
    throw new Error('Failed to create discovery request')
  }

  logger.info({ requestId: result.id, userId, mediaType, tmdbId, title }, 'Created discovery request')
  return result.id
}

/**
 * Update a discovery request status
 */
export async function updateDiscoveryRequestStatus(
  requestId: string,
  status: DiscoveryRequestStatus,
  options: {
    jellyseerrRequestId?: number
    jellyseerrMediaId?: number
    statusMessage?: string
  } = {}
): Promise<void> {
  await query(
    `UPDATE discovery_requests 
     SET status = $2,
         jellyseerr_request_id = COALESCE($3, jellyseerr_request_id),
         jellyseerr_media_id = COALESCE($4, jellyseerr_media_id),
         status_message = COALESCE($5, status_message)
     WHERE id = $1`,
    [
      requestId,
      status,
      options.jellyseerrRequestId ?? null,
      options.jellyseerrMediaId ?? null,
      options.statusMessage ?? null,
    ]
  )

  logger.info({ requestId, status }, 'Updated discovery request status')
}

/**
 * Get discovery requests for a user
 */
export async function getDiscoveryRequests(
  userId: string,
  options: {
    mediaType?: MediaType
    status?: DiscoveryRequestStatus
    limit?: number
  } = {}
): Promise<DiscoveryRequest[]> {
  let sql = `SELECT * FROM discovery_requests WHERE user_id = $1`
  const params: (string | number)[] = [userId]
  let paramIndex = 2

  if (options.mediaType) {
    sql += ` AND media_type = $${paramIndex}`
    params.push(options.mediaType)
    paramIndex++
  }
  if (options.status) {
    sql += ` AND status = $${paramIndex}`
    params.push(options.status)
    paramIndex++
  }

  sql += ` ORDER BY created_at DESC`

  if (options.limit) {
    sql += ` LIMIT $${paramIndex}`
    params.push(options.limit)
  }

  const result = await query<{
    id: string
    user_id: string
    media_type: MediaType
    tmdb_id: number
    title: string
    jellyseerr_request_id: number | null
    jellyseerr_media_id: number | null
    status: DiscoveryRequestStatus
    status_message: string | null
    discovery_candidate_id: string | null
    created_at: Date
    updated_at: Date
  }>(sql, params)

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    mediaType: row.media_type,
    tmdbId: row.tmdb_id,
    title: row.title,
    jellyseerrRequestId: row.jellyseerr_request_id,
    jellyseerrMediaId: row.jellyseerr_media_id,
    status: row.status,
    statusMessage: row.status_message,
    discoveryCandidateId: row.discovery_candidate_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/**
 * Check if a request already exists for a TMDb ID
 */
export async function hasExistingRequest(
  userId: string,
  tmdbId: number,
  mediaType: MediaType
): Promise<DiscoveryRequest | null> {
  const result = await queryOne<{
    id: string
    user_id: string
    media_type: MediaType
    tmdb_id: number
    title: string
    jellyseerr_request_id: number | null
    jellyseerr_media_id: number | null
    status: DiscoveryRequestStatus
    status_message: string | null
    discovery_candidate_id: string | null
    created_at: Date
    updated_at: Date
  }>(
    `SELECT * FROM discovery_requests 
     WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, tmdbId, mediaType]
  )

  if (!result) return null

  return {
    id: result.id,
    userId: result.user_id,
    mediaType: result.media_type,
    tmdbId: result.tmdb_id,
    title: result.title,
    jellyseerrRequestId: result.jellyseerr_request_id,
    jellyseerrMediaId: result.jellyseerr_media_id,
    status: result.status,
    statusMessage: result.status_message,
    discoveryCandidateId: result.discovery_candidate_id,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  }
}

