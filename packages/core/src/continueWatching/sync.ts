/**
 * Continue Watching Sync Module
 * 
 * Fetches resume items from Emby/Jellyfin, filters and deduplicates them,
 * and stores the results in the database.
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'
import { getApertureLibraryIds } from '../lib/libraryExclusions.js'
import type { ResumeItem } from '../media/types.js'

const logger = createChildLogger('continue-watching-sync')

/**
 * Continue watching item stored in the database
 */
export interface ContinueWatchingItem {
  id: string
  userId: string
  providerItemId: string
  mediaType: 'movie' | 'episode'
  title: string
  tmdbId: string | null
  imdbId: string | null
  progressPercent: number
  playbackPositionTicks: number
  runtimeTicks: number
  lastPlayedAt: Date | null
  sourceLibraryId: string
  sourceLibraryName: string | null
  // Episode-specific
  seriesId: string | null
  seriesName: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  // Path for STRM/symlink
  path: string | null
}

/**
 * Filter and deduplicate resume items
 * 
 * 1. Filter out Aperture-created libraries
 * 2. Filter out admin-excluded libraries
 * 3. Group by provider ID (TMDB/IMDB)
 * 4. Pick the best item from each group
 */
export function filterAndDeduplicate(
  items: ResumeItem[],
  apertureLibraryIds: Set<string>,
  excludedLibraryIds: Set<string>,
  libraryNames: Map<string, string>
): ResumeItem[] {
  // Step 1: Filter out Aperture libraries (automatic)
  let filtered = items.filter(item => !apertureLibraryIds.has(item.parentId))
  
  logger.debug({ 
    before: items.length, 
    afterApertureFilter: filtered.length 
  }, 'Filtered Aperture libraries')
  
  // Step 2: Filter out admin-excluded libraries
  filtered = filtered.filter(item => !excludedLibraryIds.has(item.parentId))
  
  logger.debug({ 
    afterExcludedFilter: filtered.length 
  }, 'Filtered admin-excluded libraries')
  
  // Step 3: Group by provider ID for deduplication
  const grouped = new Map<string, ResumeItem[]>()
  for (const item of filtered) {
    // Use TMDB ID first, then IMDB ID, then item ID as fallback
    const key = item.tmdbId || item.imdbId || item.id
    const existing = grouped.get(key) || []
    existing.push(item)
    grouped.set(key, existing)
  }
  
  logger.debug({ 
    uniqueItems: grouped.size 
  }, 'Grouped by provider ID')
  
  // Step 4: For each group, pick the best item
  const deduplicated = Array.from(grouped.values()).map(group => {
    if (group.length === 1) return group[0]
    
    return group.sort((a, b) => {
      // Prefer higher progress percentage
      if (a.progressPercent !== b.progressPercent) {
        return b.progressPercent - a.progressPercent
      }
      
      // Then prefer most recent play date
      const dateA = a.userData.lastPlayedDate || ''
      const dateB = b.userData.lastPlayedDate || ''
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA)
      }
      
      // Final tiebreaker: alphabetical by library name (deterministic)
      const nameA = libraryNames.get(a.parentId) || a.parentId
      const nameB = libraryNames.get(b.parentId) || b.parentId
      return nameA.localeCompare(nameB)
    })[0]
  })
  
  // Add library names to items
  for (const item of deduplicated) {
    item.parentName = libraryNames.get(item.parentId)
  }
  
  return deduplicated
}

/**
 * Sync continue watching items for a single user
 */
export async function syncContinueWatchingForUser(
  userId: string,
  providerUserId: string
): Promise<{ synced: number; removed: number }> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()
  
  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }
  
  logger.info({ userId, providerUserId }, 'Syncing continue watching items')
  
  // Get resume items from media server
  const resumeItems = await provider.getResumeItems(apiKey, providerUserId)
  
  // Get Aperture library IDs to exclude
  const apertureLibraryIds = new Set(await getApertureLibraryIds())
  
  // Get admin-excluded library IDs from config
  const config = await getContinueWatchingConfig()
  const excludedLibraryIds = new Set(config?.excludedLibraryIds || [])
  
  // Get library names for tiebreaker
  const libraries = await provider.getLibraries(apiKey)
  const libraryNames = new Map(libraries.map(lib => [lib.id, lib.name]))
  
  // Filter and deduplicate
  const deduplicated = filterAndDeduplicate(
    resumeItems,
    apertureLibraryIds,
    excludedLibraryIds,
    libraryNames
  )
  
  logger.info({ 
    userId, 
    raw: resumeItems.length, 
    deduplicated: deduplicated.length 
  }, 'Filtered and deduplicated resume items')
  
  // Get existing items for this user
  const existingItems = await query<{ provider_item_id: string }>(
    `SELECT provider_item_id FROM continue_watching WHERE user_id = $1`,
    [userId]
  )
  const existingIds = new Set(existingItems.rows.map(r => r.provider_item_id))
  
  // Upsert deduplicated items
  let synced = 0
  for (const item of deduplicated) {
    await query(
      `INSERT INTO continue_watching (
        user_id, provider_item_id, media_type, title, tmdb_id, imdb_id,
        progress_percent, playback_position_ticks, runtime_ticks, last_played_at,
        source_library_id, source_library_name, series_id, series_name,
        season_number, episode_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (user_id, provider_item_id) DO UPDATE SET
        media_type = EXCLUDED.media_type,
        title = EXCLUDED.title,
        tmdb_id = EXCLUDED.tmdb_id,
        imdb_id = EXCLUDED.imdb_id,
        progress_percent = EXCLUDED.progress_percent,
        playback_position_ticks = EXCLUDED.playback_position_ticks,
        runtime_ticks = EXCLUDED.runtime_ticks,
        last_played_at = EXCLUDED.last_played_at,
        source_library_id = EXCLUDED.source_library_id,
        source_library_name = EXCLUDED.source_library_name,
        series_id = EXCLUDED.series_id,
        series_name = EXCLUDED.series_name,
        season_number = EXCLUDED.season_number,
        episode_number = EXCLUDED.episode_number,
        updated_at = now()`,
      [
        userId,
        item.id,
        item.type === 'Movie' ? 'movie' : 'episode',
        item.name,
        item.tmdbId || null,
        item.imdbId || null,
        item.progressPercent,
        item.playbackPositionTicks,
        item.runTimeTicks,
        item.userData.lastPlayedDate ? new Date(item.userData.lastPlayedDate) : null,
        item.parentId,
        item.parentName || null,
        item.seriesId || null,
        item.seriesName || null,
        item.seasonNumber || null,
        item.episodeNumber || null,
      ]
    )
    synced++
    existingIds.delete(item.id)
  }
  
  // Remove items that are no longer in resume list
  let removed = 0
  if (existingIds.size > 0) {
    const idsToRemove = Array.from(existingIds)
    await query(
      `DELETE FROM continue_watching 
       WHERE user_id = $1 AND provider_item_id = ANY($2)`,
      [userId, idsToRemove]
    )
    removed = idsToRemove.length
    logger.debug({ userId, removed }, 'Removed stale continue watching items')
  }
  
  logger.info({ userId, synced, removed }, 'Continue watching sync complete')
  return { synced, removed }
}

/**
 * Sync continue watching items for all users
 */
export async function syncContinueWatchingForAllUsers(): Promise<{
  success: number
  failed: number
  users: Array<{ userId: string; synced: number; removed: number; error?: string }>
}> {
  // Get all users with provider IDs
  const users = await query<{ id: string; provider_user_id: string; display_name: string }>(
    `SELECT id, provider_user_id, display_name FROM users WHERE provider_user_id IS NOT NULL`
  )
  
  logger.info({ userCount: users.rows.length }, 'Starting continue watching sync for all users')
  
  const results: Array<{ userId: string; synced: number; removed: number; error?: string }> = []
  let success = 0
  let failed = 0
  
  for (const user of users.rows) {
    try {
      const result = await syncContinueWatchingForUser(user.id, user.provider_user_id)
      results.push({ userId: user.id, ...result })
      success++
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logger.error({ err, userId: user.id }, 'Failed to sync continue watching')
      results.push({ userId: user.id, synced: 0, removed: 0, error })
      failed++
    }
  }
  
  logger.info({ success, failed }, 'Continue watching sync complete for all users')
  return { success, failed, users: results }
}

/**
 * Get continue watching config from database
 */
async function getContinueWatchingConfig(): Promise<{
  enabled: boolean
  useSymlinks: boolean
  libraryName: string
  pollIntervalSeconds: number
  excludedLibraryIds: string[]
} | null> {
  const row = await queryOne<{
    enabled: boolean
    use_symlinks: boolean
    library_name: string
    poll_interval_seconds: number
    excluded_library_ids: string[]
  }>(
    `SELECT enabled, use_symlinks, library_name, poll_interval_seconds, excluded_library_ids
     FROM continue_watching_config LIMIT 1`
  )
  
  if (!row) return null
  
  return {
    enabled: row.enabled,
    useSymlinks: row.use_symlinks,
    libraryName: row.library_name,
    pollIntervalSeconds: row.poll_interval_seconds,
    excludedLibraryIds: row.excluded_library_ids || [],
  }
}

/**
 * Get continue watching items for a user from database
 */
export async function getContinueWatchingItemsForUser(userId: string): Promise<ContinueWatchingItem[]> {
  const result = await query<{
    id: string
    user_id: string
    provider_item_id: string
    media_type: 'movie' | 'episode'
    title: string
    tmdb_id: string | null
    imdb_id: string | null
    progress_percent: number
    playback_position_ticks: string
    runtime_ticks: string
    last_played_at: Date | null
    source_library_id: string
    source_library_name: string | null
    series_id: string | null
    series_name: string | null
    season_number: number | null
    episode_number: number | null
  }>(
    `SELECT * FROM continue_watching 
     WHERE user_id = $1 
     ORDER BY last_played_at DESC NULLS LAST`,
    [userId]
  )
  
  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    providerItemId: row.provider_item_id,
    mediaType: row.media_type,
    title: row.title,
    tmdbId: row.tmdb_id,
    imdbId: row.imdb_id,
    progressPercent: Number(row.progress_percent),
    playbackPositionTicks: Number(row.playback_position_ticks),
    runtimeTicks: Number(row.runtime_ticks),
    lastPlayedAt: row.last_played_at,
    sourceLibraryId: row.source_library_id,
    sourceLibraryName: row.source_library_name,
    seriesId: row.series_id,
    seriesName: row.series_name,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    path: null, // Will be resolved from media server if needed
  }))
}
