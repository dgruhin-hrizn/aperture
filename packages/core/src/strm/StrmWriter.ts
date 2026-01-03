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

const logger = createChildLogger('strm-writer')

/**
 * Process STRM output for all enabled users
 */
export async function processStrmForAllUsers(
  jobId?: string
): Promise<{
  success: number
  failed: number
  jobId: string
}> {
  const actualJobId = jobId || crypto.randomUUID()
  
  // Initialize job progress
  createJobProgress(actualJobId, 'sync-strm', 2)
  
  try {
    setJobStep(actualJobId, 0, 'Finding enabled users')
    addLog(actualJobId, 'info', '🔍 Finding enabled users...')

    const users = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
    }>('SELECT id, provider_user_id, display_name, username FROM users WHERE is_enabled = true')

    const totalUsers = users.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No enabled users found')
      completeJob(actualJobId, { success: 0, failed: 0 })
      return { success: 0, failed: 0, jobId: actualJobId }
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} enabled user(s)`)
    setJobStep(actualJobId, 1, 'Processing STRM files', totalUsers)

    let success = 0
    let failed = 0

    for (let i = 0; i < users.rows.length; i++) {
      const user = users.rows[i]
      
      try {
        const displayName = user.display_name || user.username
        addLog(actualJobId, 'info', `📁 Processing STRM for ${displayName}...`)

        // Step 1: Write STRM files first (this creates the directory that Emby needs)
        const strmResult = await writeStrmFilesForUser(user.id, user.provider_user_id, displayName)
        addLog(actualJobId, 'debug', `  📝 STRM files written: ${strmResult.written} files at ${strmResult.localPath}`)

        // Step 2: Now ensure the library exists in the media server (directory exists now)
        const libraryResult = await ensureUserLibrary(user.id, user.provider_user_id, displayName)
        if (libraryResult.created) {
          addLog(actualJobId, 'info', `  📚 Created new library in media server`)
        } else {
          addLog(actualJobId, 'debug', `  📚 Library already exists in media server`)
        }

        // Step 3: Refresh library to pick up new/changed STRM files
        await refreshUserLibrary(user.id)
        addLog(actualJobId, 'debug', `  🔄 Library refreshed`)

        // Step 4: Update user permissions to grant access to the library
        await updateUserLibraryPermissions(user.id, user.provider_user_id)
        addLog(actualJobId, 'debug', `  🔐 User permissions updated`)

        success++
        addLog(actualJobId, 'info', `✅ Completed STRM processing for ${displayName} (${strmResult.written} recommendations)`)
        updateJobProgress(actualJobId, success + failed, totalUsers, `${success + failed}/${totalUsers} users`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to process STRM')
        addLog(actualJobId, 'error', `❌ Failed for ${user.username}: ${errorMsg}`)
        failed++
        updateJobProgress(actualJobId, success + failed, totalUsers, `${success + failed}/${totalUsers} users (${failed} failed)`)
      }
    }

    const finalResult = { success, failed, jobId: actualJobId }
    
    if (failed > 0) {
      addLog(actualJobId, 'warn', `⚠️ Completed with ${failed} failure(s): ${success} succeeded, ${failed} failed`)
    } else {
      addLog(actualJobId, 'info', `🎉 All ${success} user(s) processed successfully!`)
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
 */
export async function processSeriesStrmForAllUsers(
  jobId?: string
): Promise<{
  success: number
  failed: number
  jobId: string
}> {
  const actualJobId = jobId || crypto.randomUUID()

  createJobProgress(actualJobId, 'sync-series-strm', 2)

  try {
    setJobStep(actualJobId, 0, 'Finding enabled users')
    addLog(actualJobId, 'info', '🔍 Finding enabled users...')

    const users = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
    }>('SELECT id, provider_user_id, display_name, username FROM users WHERE is_enabled = true')

    const totalUsers = users.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No enabled users found')
      completeJob(actualJobId, { success: 0, failed: 0 })
      return { success: 0, failed: 0, jobId: actualJobId }
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} enabled user(s)`)
    setJobStep(actualJobId, 1, 'Processing Series STRM files', totalUsers)

    let success = 0
    let failed = 0

    for (let i = 0; i < users.rows.length; i++) {
      const user = users.rows[i]

      try {
        const displayName = user.display_name || user.username
        addLog(actualJobId, 'info', `📺 Processing Series STRM for ${displayName}...`)

        // Step 1: Write STRM files
        const strmResult = await writeSeriesStrmFilesForUser(user.id, user.provider_user_id, displayName)
        addLog(actualJobId, 'debug', `  📝 Series STRM files written: ${strmResult.written} files at ${strmResult.localPath}`)

        // Step 2: Ensure the TV library exists in the media server
        const libraryResult = await ensureUserSeriesLibrary(user.id, user.provider_user_id, displayName)
        if (libraryResult.created) {
          addLog(actualJobId, 'info', `  📺 Created new TV library in media server`)
        } else {
          addLog(actualJobId, 'debug', `  📺 TV library already exists in media server`)
        }

        // Step 3: Refresh library
        await refreshUserSeriesLibrary(user.id)
        addLog(actualJobId, 'debug', `  🔄 TV library refreshed`)

        // Step 4: Update user permissions
        await updateUserSeriesLibraryPermissions(user.id, user.provider_user_id)
        addLog(actualJobId, 'debug', `  🔐 User permissions updated`)

        success++
        addLog(actualJobId, 'info', `✅ Completed Series STRM processing for ${displayName} (${strmResult.written} files)`)
        updateJobProgress(actualJobId, success + failed, totalUsers, `${success + failed}/${totalUsers} users`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to process Series STRM')
        addLog(actualJobId, 'error', `❌ Failed for ${user.username}: ${errorMsg}`)
        failed++
        updateJobProgress(actualJobId, success + failed, totalUsers, `${success + failed}/${totalUsers} users (${failed} failed)`)
      }
    }

    const finalResult = { success, failed, jobId: actualJobId }

    if (failed > 0) {
      addLog(actualJobId, 'warn', `⚠️ Completed with ${failed} failure(s): ${success} succeeded, ${failed} failed`)
    } else {
      addLog(actualJobId, 'info', `🎉 All ${success} user(s) processed successfully!`)
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
