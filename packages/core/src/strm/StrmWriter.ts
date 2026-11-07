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
import { getLatestSeriesOutputRunId, writeSeriesStrmFilesForUser } from './series/writer.js'
import {
  ensureUserSeriesLibrary,
  refreshUserSeriesLibrary,
  updateUserSeriesLibraryPermissions,
} from './series/library.js'
import { publishEmbyRecommendationPlaylists } from './embyPlaylists.js'
import { getAiRecsOutputConfig } from '../settings/systemSettings.js'
import { getSeriesRecommendationGroups } from '../recommender/series/groups.js'
import { getMediaServerProvider } from '../media/index.js'
import { cleanupRetiredSeriesOutputs, reconcileStaleStrmLibraries } from './cleanup.js'
import { acknowledgeOutputRefresh } from './incrementalOutput.js'

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

    const mode = (await getAiRecsOutputConfig()).moviesOutputMode
    if (mode === 'playlist') await reconcileStaleStrmLibraries(actualJobId)
    const users = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
    }>(
      'SELECT id, provider_user_id, display_name, username FROM users WHERE $1 AND is_enabled = true AND movies_enabled = true AND provider_disabled = false',
      [mode !== 'off']
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

        if (mode === 'playlist') {
          const published = await publishEmbyRecommendationPlaylists(user.id, user.provider_user_id, displayName, 'movies')
          userResults.push({
            userId: user.id,
            providerUserId: user.provider_user_id,
            username: user.username,
            displayName,
            status: published.count ? 'success' : 'skipped',
            recommendationCount: published.count,
            libraryName: published.names.join(', '),
          })
          if (published.count) success++
          else skipped++
          totalRecommendations += published.count
          updateJobProgress(actualJobId, i + 1, totalUsers, `${success + skipped}/${totalUsers} users`)
          continue
        }

        const strmResult = await writeStrmFilesForUser(user.id, user.provider_user_id, displayName)
        addLog(actualJobId, 'debug', `  📝 STRM files written: ${strmResult.written} files at ${strmResult.localPath}`)

        // Skip further processing if no recommendations
        if (strmResult.written === 0) {
          if (strmResult.withheldReason) addLog(actualJobId, 'warn', strmResult.withheldReason)
          if (strmResult.needsRefresh) {
            await refreshUserLibrary(user.id)
            await acknowledgeOutputRefresh(strmResult.localPath, strmResult.revision)
          }
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

        const libraryResult = await ensureUserLibrary(user.id, user.provider_user_id, displayName)
        // Unchanged output does not need another Emby scan. Pending refreshes
        // remain recorded until the server accepts one successfully.
        if (strmResult.needsRefresh || libraryResult.created) {
          await refreshUserLibrary(user.id)
          await acknowledgeOutputRefresh(strmResult.localPath, strmResult.revision)
        }

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

    const mode = (await getAiRecsOutputConfig()).seriesOutputMode
    if (mode === 'playlist') await reconcileStaleStrmLibraries(actualJobId)
    const users = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
    }>(
      'SELECT id, provider_user_id, display_name, username FROM users WHERE $1 AND is_enabled = true AND series_enabled = true AND provider_disabled = false',
      [mode !== 'off']
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

        if (mode === 'playlist') {
          const published = await publishEmbyRecommendationPlaylists(user.id, user.provider_user_id, displayName, 'series')
          userResults.push({
            userId: user.id,
            providerUserId: user.provider_user_id,
            username: user.username,
            displayName,
            status: published.count ? 'success' : 'skipped',
            recommendationCount: published.count,
            libraryName: published.names.join(', '),
          })
          if (published.count) success++
          else skipped++
          totalRecommendations += published.count
          updateJobProgress(actualJobId, i + 1, totalUsers, `${success + skipped}/${totalUsers} users`)
          continue
        }

        const provider = await getMediaServerProvider()
        const groups = provider.type === 'emby' ? await getSeriesRecommendationGroups() : []
        const outputs = groups.length ? groups : [null]
        const runId = await getLatestSeriesOutputRunId(user.id)
        await cleanupRetiredSeriesOutputs(user, outputs.map((group) => group?.id ?? null))

        let recommendationCount = 0
        let libraryCreated = false
        const libraryNames: string[] = []
        const outputErrors: string[] = []
        for (const group of outputs) {
          const groupId = group?.id ?? null
          try {
            const strmResult = await writeSeriesStrmFilesForUser(user.id, user.provider_user_id, displayName, group, runId)
            if (strmResult.seriesCount === 0) {
              if (strmResult.withheldReason) {
                addLog(actualJobId, 'warn', `${displayName}: ${strmResult.withheldReason}`)
              }
              if (strmResult.needsRefresh) {
                await refreshUserSeriesLibrary(user.id, groupId)
                await acknowledgeOutputRefresh(strmResult.localPath, strmResult.revision)
              }
              continue
            }

            const library = await ensureUserSeriesLibrary(user.id, user.provider_user_id, displayName, group)
            await updateUserSeriesLibraryPermissions(user.id, user.provider_user_id, groupId)
            if (strmResult.needsRefresh || library.created) {
              await refreshUserSeriesLibrary(user.id, groupId)
              await acknowledgeOutputRefresh(strmResult.localPath, strmResult.revision)
            }
            recommendationCount += strmResult.seriesCount
            libraryCreated ||= library.created
            libraryNames.push(library.name)
          } catch (err) {
            outputErrors.push(`${group?.name ?? 'TV'}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }

        if (outputErrors.length > 0) throw new Error(outputErrors.join(' | '))

        userResults.push({
          userId: user.id,
          providerUserId: user.provider_user_id,
          username: user.username,
          displayName,
          status: recommendationCount > 0 ? 'success' : 'skipped',
          recommendationCount,
          libraryName: libraryNames.join(', '),
          libraryCreated,
        })

        if (recommendationCount > 0) success++
        else skipped++
        totalRecommendations += recommendationCount
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
