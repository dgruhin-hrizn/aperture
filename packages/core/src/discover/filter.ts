/**
 * Discovery Filter
 * 
 * Filters out content that is already in the user's library or has been watched
 */

import { createChildLogger } from '../lib/logger.js'
import { query } from '../lib/db.js'
import type { MediaType, RawCandidate } from './types.js'

const logger = createChildLogger('discover:filter')

/**
 * Get all TMDb IDs that are already in the library
 */
async function getLibraryTmdbIds(mediaType: MediaType): Promise<Set<number>> {
  const tableName = mediaType === 'movie' ? 'movies' : 'series'
  
  const result = await query<{ tmdb_id: string }>(
    `SELECT tmdb_id FROM ${tableName} WHERE tmdb_id IS NOT NULL`
  )

  const ids = new Set<number>()
  for (const row of result.rows) {
    const id = parseInt(row.tmdb_id, 10)
    if (!isNaN(id)) {
      ids.add(id)
    }
  }

  logger.debug({ mediaType, count: ids.size }, 'Loaded library TMDb IDs')
  return ids
}

/**
 * Get all TMDb IDs that the user has watched
 */
async function getWatchedTmdbIds(userId: string, mediaType: MediaType): Promise<Set<number>> {
  let result: { rows: { tmdb_id: string }[] }
  
  if (mediaType === 'movie') {
    result = await query<{ tmdb_id: string }>(
      `SELECT DISTINCT m.tmdb_id 
       FROM watch_history wh
       JOIN movies m ON m.id = wh.movie_id
       WHERE wh.user_id = $1 
         AND wh.media_type = 'movie'
         AND m.tmdb_id IS NOT NULL`,
      [userId]
    )
  } else {
    // For series, join through episodes to get the series
    result = await query<{ tmdb_id: string }>(
      `SELECT DISTINCT s.tmdb_id 
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN series s ON s.id = e.series_id
       WHERE wh.user_id = $1 
         AND wh.media_type = 'episode'
         AND s.tmdb_id IS NOT NULL`,
      [userId]
    )
  }

  const ids = new Set<number>()
  for (const row of result.rows) {
    const id = parseInt(row.tmdb_id, 10)
    if (!isNaN(id)) {
      ids.add(id)
    }
  }

  logger.debug({ userId, mediaType, count: ids.size }, 'Loaded watched TMDb IDs')
  return ids
}

/**
 * Get TMDb IDs that the user has already requested
 */
async function getRequestedTmdbIds(userId: string, mediaType: MediaType): Promise<Set<number>> {
  const result = await query<{ tmdb_id: number }>(
    `SELECT tmdb_id FROM discovery_requests 
     WHERE user_id = $1 
       AND media_type = $2
       AND status NOT IN ('declined', 'failed')`,
    [userId, mediaType]
  )

  const ids = new Set<number>(result.rows.map(r => r.tmdb_id))
  logger.debug({ userId, mediaType, count: ids.size }, 'Loaded requested TMDb IDs')
  return ids
}

/**
 * Filter candidates to remove content already in library or watched
 */
export async function filterCandidates(
  userId: string,
  mediaType: MediaType,
  candidates: RawCandidate[]
): Promise<RawCandidate[]> {
  logger.info({ userId, mediaType, inputCount: candidates.length }, 'Filtering candidates')

  // Load all exclusion sets in parallel
  const [libraryIds, watchedIds, requestedIds] = await Promise.all([
    getLibraryTmdbIds(mediaType),
    getWatchedTmdbIds(userId, mediaType),
    getRequestedTmdbIds(userId, mediaType),
  ])

  // Combine all exclusion sets
  const excludeIds = new Set<number>([
    ...libraryIds,
    ...watchedIds,
    ...requestedIds,
  ])

  logger.info({
    userId,
    mediaType,
    libraryCount: libraryIds.size,
    watchedCount: watchedIds.size,
    requestedCount: requestedIds.size,
    totalExclude: excludeIds.size,
  }, 'Built exclusion set')

  // Filter candidates
  const filtered = candidates.filter(c => !excludeIds.has(c.tmdbId))

  // Deduplicate by TMDb ID (keep first occurrence, which has highest priority source)
  const seenTmdbIds = new Set<number>()
  const deduplicated = filtered.filter(c => {
    if (seenTmdbIds.has(c.tmdbId)) {
      return false
    }
    seenTmdbIds.add(c.tmdbId)
    return true
  })

  logger.info({
    userId,
    mediaType,
    inputCount: candidates.length,
    afterFilter: filtered.length,
    afterDedup: deduplicated.length,
    removed: candidates.length - deduplicated.length,
  }, 'Filtered candidates')

  return deduplicated
}

/**
 * Check if a specific TMDb ID is already in the library
 */
export async function isInLibrary(tmdbId: number, mediaType: MediaType): Promise<boolean> {
  const tableName = mediaType === 'movie' ? 'movies' : 'series'
  
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE tmdb_id = $1`,
    [tmdbId.toString()]
  )

  return parseInt(result.rows[0]?.count ?? '0', 10) > 0
}

/**
 * Check if a user has already watched a specific TMDb ID
 */
export async function hasWatched(
  userId: string,
  tmdbId: number,
  mediaType: MediaType
): Promise<boolean> {
  let result: { rows: { count: string }[] }
  
  if (mediaType === 'movie') {
    result = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM watch_history wh
       JOIN movies m ON m.id = wh.movie_id
       WHERE wh.user_id = $1 
         AND m.tmdb_id = $2
         AND wh.media_type = 'movie'`,
      [userId, tmdbId.toString()]
    )
  } else {
    // For series, join through episodes to check if any episode was watched
    result = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN series s ON s.id = e.series_id
       WHERE wh.user_id = $1 
         AND s.tmdb_id = $2
         AND wh.media_type = 'episode'`,
      [userId, tmdbId.toString()]
    )
  }

  return parseInt(result.rows[0]?.count ?? '0', 10) > 0
}

