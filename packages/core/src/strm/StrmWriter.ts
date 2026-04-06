// Re-exports from modular files for backwards compatibility
import { createChildLogger } from '../lib/logger.js'
import { query } from '../lib/db.js'
import {
  createJobProgress,
  updateJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
} from '../jobs/progress.js'

// Per-user library result type for transparency
export interface UserLibraryResult {
  userId: string
  providerUserId: string
  username: string
  displayName: string
  status: 'success' | 'skipped' | 'failed'
  recommendationCount?: number
  libraryName?: string
  libraryCreated?: boolean
  error?: string
}

export interface ProcessStrmResult {
  success: number
  failed: number
  skipped: number
  jobId: string
  users: UserLibraryResult[]
  [key: string]: unknown // Index signature for Record<string, unknown> compatibility
}

// Re-export all public functions (movies)
export { writeStrmFilesForUser } from './movies/writer.js'
export { ensureUserLibrary, refreshUserLibrary, updateUserLibraryPermissions } from './movies/library.js'
export { generateNfoContent } from './movies/nfo.js'

// Re-export all public functions (series)
export { writeSeriesStrmFilesForUser } from './series/writer.js'
export {
  ensureUserSeriesLibrary,
  refreshUserSeriesLibrary,
  updateUserSeriesLibraryPermissions,
} from './series/library.js'

// Shared utilities
export { createRankedPoster } from './poster.js'
export { downloadImage } from './images.js'
export { getConfig } from './config.js'
export * from './types.js'
export * from './filenames.js'

// Import functions needed for processStrmForAllUsers
import { writeStrmFilesForUser } from './movies/writer.js'
import { ensureUserLibrary, refreshUserLibrary, updateUserLibraryPermissions } from './movies/library.js'
import { writeSeriesStrmFilesForUser } from './series/writer.js'
import {
  ensureUserSeriesLibrary,
  refreshUserSeriesLibrary,
  updateUserSeriesLibraryPermissions,
} from './series/library.js'
import { reconcileStaleStrmLibraries } from './cleanup.js'

const logger = createChildLogger('strm-writer')

/**
 * Process STRM output for all enabled users
 * Returns detailed per-user results for transparency in the UI
 */
export async function processStrmForAllUsers(
  jobId?: string
): Promise<ProcessStrmResult> {
  const actualJobId = jobId || crypto.randomUUID()
  const userResults: UserLibraryResult[] = []
  
  // Initialize job progress
  createJobProgress(actualJobId, 'sync-movie-libraries', 2)
  
  try {
    setJobStep(actualJobId, 0, 'Finding enabled users')
    addLog(actualJobId, 'info', '🔍 Finding enabled users...')

    const users = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
    }>(
      'SELECT id, provider_user_id, display_name, username FROM users WHERE is_enabled = true AND movies_enabled = true AND provider_disabled = false'
    )

    const totalUsers = users.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No users enabled for movies')
      try {
        await reconcileStaleStrmLibraries(actualJobId)
      } catch (err) {
        logger.warn({ err }, 'reconcile stale STRM libraries failed')
        addLog(actualJobId, 'warn', `Reconcile skipped: ${err instanceof Error ? err.message : String(err)}`)
      }
      const result: ProcessStrmResult = { success: 0, failed: 0, skipped: 0, jobId: actualJobId, users: [] }
      completeJob(actualJobId, result)
      return result
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} user(s) enabled for movies`)
    setJobStep(actualJobId, 1, 'Processing STRM files', totalUsers)

    let success = 0
    let failed = 0
    let skipped = 0
    let totalRecommendations = 0

    for (let i = 0; i < users.rows.length; i++) {
      const user = users.rows[i]
      const displayName = user.display_name || user.username
      
      try {
        addLog(actualJobId, 'info', `📁 Processing STRM for ${displayName}...`)

        // Step 1: Create empty directory first (Emby requires folder to exist for library creation)
        const { ensureUserDirectory } = await import('./movies/writer.js')
        const dirResult = await ensureUserDirectory(user.id, user.provider_user_id, displayName)
        
        // Step 2: Create library BEFORE adding files (so Emby uses our CollectionType, not auto-detect)
        const libraryResult = await ensureUserLibrary(user.id, user.provider_user_id, displayName)
        if (libraryResult.created) {
          addLog(actualJobId, 'info', `  📚 Created new library in media server: ${libraryResult.name}`)
        } else {
          addLog(actualJobId, 'debug', `  📚 Library already exists in media server: ${libraryResult.name}`)
        }

        // Step 3: Now write STRM files (library already exists with correct type)
        const strmResult = await writeStrmFilesForUser(user.id, user.provider_user_id, displayName)
        addLog(actualJobId, 'debug', `  📝 STRM files written: ${strmResult.written} files at ${strmResult.localPath}`)

        // Skip further processing if no recommendations
        if (strmResult.written === 0) {
          addLog(actualJobId, 'info', `⏭️ No recommendations for ${displayName}`)
          userResults.push({
            userId: user.id,
            providerUserId: user.provider_user_id,
            username: user.username,
            displayName,
            status: 'skipped',
            recommendationCount: 0,
            error: 'No recommendations generated (insufficient watch history)',
          })
          skipped++
          updateJobProgress(actualJobId, i + 1, totalUsers, `${success + skipped}/${totalUsers} users (${totalRecommendations} recommendations)`)
          continue
        }

        // Step 4: Refresh library to pick up new STRM files
        await refreshUserLibrary(user.id)
        addLog(actualJobId, 'debug', `  🔄 Library refreshed`)

        // Step 4: Update user permissions to grant access to the library
        await updateUserLibraryPermissions(user.id, user.provider_user_id)
        addLog(actualJobId, 'debug', `  🔐 User permissions updated`)

        userResults.push({
          userId: user.id,
          providerUserId: user.provider_user_id,
          username: user.username,
          displayName,
          status: 'success',
          recommendationCount: strmResult.written,
          libraryName: libraryResult.name,
          libraryCreated: libraryResult.created,
        })

        success++
        totalRecommendations += strmResult.written
        addLog(actualJobId, 'info', `✅ Completed STRM processing for ${displayName} (${strmResult.written} recommendations)`)
        updateJobProgress(actualJobId, i + 1, totalUsers, `${success + skipped}/${totalUsers} users (${totalRecommendations} recommendations)`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to process STRM')
        addLog(actualJobId, 'error', `❌ Failed for ${displayName}: ${errorMsg}`)
        
        userResults.push({
          userId: user.id,
          providerUserId: user.provider_user_id,
          username: user.username,
          displayName,
          status: 'failed',
          error: errorMsg,
        })
        
        failed++
        updateJobProgress(actualJobId, i + 1, totalUsers, `${success + skipped}/${totalUsers} users (${failed} failed)`)
      }
    }

    const finalResult: ProcessStrmResult = { success, failed, skipped, jobId: actualJobId, users: userResults }
    
    if (failed > 0) {
      addLog(actualJobId, 'warn', `⚠️ Completed with issues: ${success} succeeded, ${skipped} skipped, ${failed} failed (${totalRecommendations} total recommendations)`)
    } else if (skipped > 0) {
      addLog(actualJobId, 'info', `✅ Completed: ${success} succeeded, ${skipped} skipped (${totalRecommendations} total recommendations)`)
    } else {
      addLog(actualJobId, 'info', `🎉 All ${success} user(s) processed successfully! (${totalRecommendations} total recommendations)`)
    }

    try {
      await reconcileStaleStrmLibraries(actualJobId)
    } catch (err) {
      logger.warn({ err }, 'reconcile stale STRM libraries failed')
      addLog(actualJobId, 'warn', `Reconcile skipped: ${err instanceof Error ? err.message : String(err)}`)
    }

    completeJob(actualJobId, finalResult)
    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    addLog(actualJobId, 'error', `❌ Job failed: ${error}`)
    failJob(actualJobId, error)
    throw err
  }
}

/**
 * Process Series STRM output for all enabled users
 * Returns detailed per-user results for transparency in the UI
 */
export async function processSeriesStrmForAllUsers(
  jobId?: string
): Promise<ProcessStrmResult> {
  const actualJobId = jobId || crypto.randomUUID()
  const userResults: UserLibraryResult[] = []

  createJobProgress(actualJobId, 'sync-series-libraries', 2)

  try {
    setJobStep(actualJobId, 0, 'Finding enabled users')
    addLog(actualJobId, 'info', '🔍 Finding enabled users...')

    const users = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
    }>(
      'SELECT id, provider_user_id, display_name, username FROM users WHERE is_enabled = true AND series_enabled = true AND provider_disabled = false'
    )

    const totalUsers = users.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No users enabled for TV series')
      try {
        await reconcileStaleStrmLibraries(actualJobId)
      } catch (err) {
        logger.warn({ err }, 'reconcile stale STRM libraries failed')
        addLog(actualJobId, 'warn', `Reconcile skipped: ${err instanceof Error ? err.message : String(err)}`)
      }
      const result: ProcessStrmResult = { success: 0, failed: 0, skipped: 0, jobId: actualJobId, users: [] }
      completeJob(actualJobId, result)
      return result
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} user(s) enabled for TV series`)
    setJobStep(actualJobId, 1, 'Processing Series STRM files', totalUsers)

    let success = 0
    let failed = 0
    let skipped = 0
    let totalRecommendations = 0

    for (let i = 0; i < users.rows.length; i++) {
      const user = users.rows[i]
      const displayName = user.display_name || user.username

      try {
        addLog(actualJobId, 'info', `📺 Processing Series STRM for ${displayName}...`)

        // Step 1: Write STRM files
        const strmResult = await writeSeriesStrmFilesForUser(user.id, user.provider_user_id, displayName)
        addLog(actualJobId, 'debug', `  📝 Series STRM files written: ${strmResult.seriesCount} series (${strmResult.written} episode files) at ${strmResult.localPath}`)

        // Skip library creation/permissions if no recommendations (prevents 400 errors)
        if (strmResult.seriesCount === 0) {
          addLog(actualJobId, 'info', `⏭️ Skipping TV library sync for ${displayName} (no recommendations yet)`)
          userResults.push({
            userId: user.id,
            providerUserId: user.provider_user_id,
            username: user.username,
            displayName,
            status: 'skipped',
            recommendationCount: 0,
            error: 'No recommendations generated (insufficient watch history)',
          })
          skipped++
          updateJobProgress(actualJobId, i + 1, totalUsers, `${success + skipped}/${totalUsers} users (${totalRecommendations} series)`)
          continue
        }

        // Step 2: Ensure the TV library exists in the media server
        const libraryResult = await ensureUserSeriesLibrary(user.id, user.provider_user_id, displayName)
        if (libraryResult.created) {
          addLog(actualJobId, 'info', `  📺 Created new TV library in media server: ${libraryResult.name}`)
        } else {
          addLog(actualJobId, 'debug', `  📺 TV library already exists in media server: ${libraryResult.name}`)
        }

        // Step 3: Refresh library
        await refreshUserSeriesLibrary(user.id)
        addLog(actualJobId, 'debug', `  🔄 TV library refreshed`)

        // Step 4: Update user permissions
        await updateUserSeriesLibraryPermissions(user.id, user.provider_user_id)
        addLog(actualJobId, 'debug', `  🔐 User permissions updated`)

        userResults.push({
          userId: user.id,
          providerUserId: user.provider_user_id,
          username: user.username,
          displayName,
          status: 'success',
          recommendationCount: strmResult.seriesCount,
          libraryName: libraryResult.name,
          libraryCreated: libraryResult.created,
        })

        success++
        totalRecommendations += strmResult.seriesCount
        addLog(actualJobId, 'info', `✅ Completed Series STRM processing for ${displayName} (${strmResult.seriesCount} series, ${strmResult.written} episodes)`)
        updateJobProgress(actualJobId, i + 1, totalUsers, `${success + skipped}/${totalUsers} users (${totalRecommendations} series)`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to process Series STRM')
        addLog(actualJobId, 'error', `❌ Failed for ${displayName}: ${errorMsg}`)
        
        userResults.push({
          userId: user.id,
          providerUserId: user.provider_user_id,
          username: user.username,
          displayName,
          status: 'failed',
          error: errorMsg,
        })
        
        failed++
        updateJobProgress(actualJobId, i + 1, totalUsers, `${success + skipped}/${totalUsers} users (${failed} failed)`)
      }
    }

    const finalResult: ProcessStrmResult = { success, failed, skipped, jobId: actualJobId, users: userResults }

    if (failed > 0) {
      addLog(actualJobId, 'warn', `⚠️ Completed with issues: ${success} succeeded, ${skipped} skipped, ${failed} failed (${totalRecommendations} total series)`)
    } else if (skipped > 0) {
      addLog(actualJobId, 'info', `✅ Completed: ${success} succeeded, ${skipped} skipped (${totalRecommendations} total series)`)
    } else {
      addLog(actualJobId, 'info', `🎉 All ${success} user(s) processed successfully! (${totalRecommendations} total series)`)
    }

    try {
      await reconcileStaleStrmLibraries(actualJobId)
    } catch (err) {
      logger.warn({ err }, 'reconcile stale STRM libraries failed')
      addLog(actualJobId, 'warn', `Reconcile skipped: ${err instanceof Error ? err.message : String(err)}`)
    }

    completeJob(actualJobId, finalResult)
    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    addLog(actualJobId, 'error', `❌ Job failed: ${error}`)
    failJob(actualJobId, error)
    throw err
  }
}
