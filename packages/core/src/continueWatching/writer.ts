/**
 * Continue Watching Writer Module
 * 
 * Writes STRM files or symlinks for deduplicated continue watching items.
 */

import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getConfig } from '../strm/config.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'
import { sanitizeFilename, getUserFolderName } from '../strm/filenames.js'
import { 
  ensureUserContinueWatchingLibrary,
  refreshUserContinueWatchingLibrary,
  updateUserContinueWatchingLibraryPermissions,
} from './library.js'
import { syncContinueWatchingForUser, getContinueWatchingItemsForUser } from './sync.js'

const logger = createChildLogger('continue-watching-writer')

/**
 * Build filename for a continue watching item
 */
function buildItemFilename(item: {
  title: string
  year?: number | null
  providerItemId: string
  mediaType: 'movie' | 'episode'
  seriesName?: string | null
  seasonNumber?: number | null
  episodeNumber?: number | null
}): string {
  const title = sanitizeFilename(item.title)
  
  if (item.mediaType === 'episode' && item.seriesName) {
    const seriesTitle = sanitizeFilename(item.seriesName)
    const season = item.seasonNumber?.toString().padStart(2, '0') || '00'
    const episode = item.episodeNumber?.toString().padStart(2, '0') || '00'
    return `${seriesTitle} - S${season}E${episode} - ${title} [${item.providerItemId}]`
  }
  
  const year = item.year ? ` (${item.year})` : ''
  return `${title}${year} [${item.providerItemId}]`
}

/**
 * Write STRM files or symlinks for a user's continue watching items
 */
export async function writeContinueWatchingForUser(
  userId: string,
  providerUserId: string
): Promise<{
  written: number
  deleted: number
  added: number
  unchanged: number
  hasChanges: boolean
  localPath: string
}> {
  const config = await getConfig()
  const cwConfig = await getContinueWatchingConfig()
  const useSymlinks = cwConfig?.useSymlinks ?? false
  
  // Get user's display name for folder naming
  const userRecord = await queryOne<{ display_name: string | null; username: string }>(
    'SELECT display_name, username FROM users WHERE id = $1',
    [userId]
  )
  const displayName = userRecord?.display_name || userRecord?.username || providerUserId
  
  // Build user folder name
  const userFolder = getUserFolderName(displayName, providerUserId)
  
  // Build paths
  const localPath = path.join(config.strmRoot, 'aperture-continue-watching', userFolder)
  
  // Get continue watching items from database
  const items = await getContinueWatchingItemsForUser(userId)
  
  logger.info(
    { userId, localPath, useSymlinks, count: items.length },
    `📁 Writing continue watching ${useSymlinks ? 'symlinks' : 'STRM files'}`
  )
  
  // Ensure directory exists
  await fs.mkdir(localPath, { recursive: true })
  
  // Get existing files to track deletions
  const existingFiles = new Set(await fs.readdir(localPath).catch(() => []))
  const currentFiles = new Set<string>()
  
  let written = 0
  let added = 0
  let unchanged = 0
  
  // Get media server provider for resolving paths
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()
  
  for (const item of items) {
    const filename = buildItemFilename({
      title: item.title,
      year: null, // We don't store year in continue_watching table
      providerItemId: item.providerItemId,
      mediaType: item.mediaType,
      seriesName: item.seriesName,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber,
    })
    
    const strmFilename = `${filename}.strm`
    currentFiles.add(strmFilename)
    
    const filePath = path.join(localPath, strmFilename)
    const isNew = !existingFiles.has(strmFilename)
    
    // Get the item path from media server if we don't have it
    let itemPath: string | null | undefined = item.path
    if (!itemPath && apiKey) {
      try {
        if (item.mediaType === 'movie') {
          const movie = await provider.getMovieById(apiKey, item.providerItemId)
          itemPath = movie?.path ?? movie?.mediaSources?.[0]?.path ?? null
        } else {
          const episode = await provider.getEpisodeById(apiKey, item.providerItemId)
          itemPath = episode?.path ?? episode?.mediaSources?.[0]?.path ?? null
        }
      } catch {
        logger.warn({ itemId: item.providerItemId }, 'Failed to get item path from media server')
      }
    }
    
    if (!itemPath) {
      logger.warn({ itemId: item.providerItemId, title: item.title }, 'No path available for item, skipping')
      continue
    }
    
    if (useSymlinks) {
      // Create symlink
      try {
        // Remove existing file/link if it exists
        await fs.unlink(filePath).catch(() => {})
        await fs.symlink(itemPath, filePath)
      } catch (err) {
        logger.error({ err, itemPath, filePath }, 'Failed to create symlink')
        continue
      }
    } else {
      // Create STRM file
      try {
        await fs.writeFile(filePath, itemPath, 'utf-8')
      } catch (err) {
        logger.error({ err, itemPath, filePath }, 'Failed to write STRM file')
        continue
      }
    }
    
    written++
    if (isNew) added++
    else unchanged++
  }
  
  // Delete files that are no longer in continue watching
  let deleted = 0
  for (const existingFile of existingFiles) {
    if (!currentFiles.has(existingFile)) {
      try {
        await fs.unlink(path.join(localPath, existingFile))
        deleted++
      } catch {
        // Ignore deletion errors
      }
    }
  }
  
  const hasChanges = added > 0 || deleted > 0
  
  logger.info(
    { userId, written, added, unchanged, deleted, hasChanges },
    'Continue watching files written'
  )
  
  return { written, deleted, added, unchanged, hasChanges, localPath }
}

/**
 * Process continue watching for a single user (sync + write + library management)
 */
export async function processContinueWatchingForUser(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{
  synced: number
  removed: number
  written: number
  libraryCreated: boolean
}> {
  const cwConfig = await getContinueWatchingConfig()
  
  if (!cwConfig?.enabled) {
    logger.debug({ userId }, 'Continue watching disabled, skipping')
    return { synced: 0, removed: 0, written: 0, libraryCreated: false }
  }
  
  // Sync from media server
  const syncResult = await syncContinueWatchingForUser(userId, providerUserId)
  
  // Ensure library exists
  const libraryResult = await ensureUserContinueWatchingLibrary(userId, providerUserId, displayName)
  
  // Write files
  const writeResult = await writeContinueWatchingForUser(userId, providerUserId)
  
  // Refresh library if there were changes
  if (writeResult.hasChanges) {
    await refreshUserContinueWatchingLibrary(userId)
  }
  
  // Update permissions
  await updateUserContinueWatchingLibraryPermissions(userId, providerUserId)
  
  return {
    synced: syncResult.synced,
    removed: syncResult.removed,
    written: writeResult.written,
    libraryCreated: libraryResult.created,
  }
}

/**
 * Process continue watching for all users
 */
export async function processContinueWatchingForAllUsers(): Promise<{
  success: number
  failed: number
  users: Array<{
    userId: string
    displayName: string
    synced: number
    removed: number
    written: number
    libraryCreated: boolean
    error?: string
  }>
}> {
  const cwConfig = await getContinueWatchingConfig()
  
  if (!cwConfig?.enabled) {
    logger.info('Continue watching disabled, skipping all users')
    return { success: 0, failed: 0, users: [] }
  }
  
  // Get all users with provider IDs
  const users = await query<{ id: string; provider_user_id: string; display_name: string | null; username: string }>(
    `SELECT id, provider_user_id, display_name, username FROM users WHERE provider_user_id IS NOT NULL`
  )
  
  logger.info({ userCount: users.rows.length }, 'Processing continue watching for all users')
  
  const results: Array<{
    userId: string
    displayName: string
    synced: number
    removed: number
    written: number
    libraryCreated: boolean
    error?: string
  }> = []
  
  let success = 0
  let failed = 0
  
  for (const user of users.rows) {
    const displayName = user.display_name || user.username
    
    try {
      const result = await processContinueWatchingForUser(user.id, user.provider_user_id, displayName)
      results.push({
        userId: user.id,
        displayName,
        ...result,
      })
      success++
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logger.error({ err, userId: user.id }, 'Failed to process continue watching')
      results.push({
        userId: user.id,
        displayName,
        synced: 0,
        removed: 0,
        written: 0,
        libraryCreated: false,
        error,
      })
      failed++
    }
  }
  
  logger.info({ success, failed }, 'Continue watching processing complete')
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
