/**
 * Top Picks Refresh Job
 * 
 * Calculates popularity scores and generates STRM libraries for Top Picks.
 */

import { createChildLogger } from '../lib/logger.js'
import { randomUUID } from 'crypto'
import {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
} from '../jobs/progress.js'
import { getTopPicksConfig, updateTopPicksLastRefreshed } from './config.js'
import { getTopMovies, getTopSeries } from './popularity.js'
import { writeTopPicksMovies, writeTopPicksSeries } from './writer.js'
import { grantTopPicksAccessToAllUsers, getTopPicksLibraries } from './permissions.js'
import { getMediaServerProvider } from '../media/index.js'
import { getConfig } from '../strm/config.js'
import path from 'path'

const logger = createChildLogger('top-picks-job')

export interface RefreshTopPicksResult {
  moviesCount: number
  seriesCount: number
  usersUpdated: number
  jobId: string
}

/**
 * Refresh Top Picks libraries
 */
export async function refreshTopPicks(
  existingJobId?: string
): Promise<RefreshTopPicksResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'refresh-top-picks', 6)

  try {
    // Step 1: Check if Top Picks is enabled
    setJobStep(jobId, 0, 'Checking configuration')
    const config = await getTopPicksConfig()
    
    if (!config.isEnabled) {
      addLog(jobId, 'warn', '⚠️ Top Picks is disabled')
      completeJob(jobId, { moviesCount: 0, seriesCount: 0, usersUpdated: 0 })
      return { moviesCount: 0, seriesCount: 0, usersUpdated: 0, jobId }
    }

    addLog(jobId, 'info', `⚙️ Configuration loaded: ${config.timeWindowDays} day window, ${config.moviesCount} movies, ${config.seriesCount} series`)
    addLog(jobId, 'info', `📊 Weights: Viewers ${config.uniqueViewersWeight}, Plays ${config.playCountWeight}, Completion ${config.completionWeight}`)

    // Step 2: Calculate top movies
    setJobStep(jobId, 1, 'Calculating top movies')
    addLog(jobId, 'info', '🎬 Calculating top movies based on watch history...')
    const topMovies = await getTopMovies()
    addLog(jobId, 'info', `🎬 Found ${topMovies.length} popular movies`)
    
    if (topMovies.length > 0) {
      for (const movie of topMovies.slice(0, 3)) {
        addLog(jobId, 'info', `  #${movie.rank}: ${movie.title} (${movie.year}) - ${movie.uniqueViewers} viewers`)
      }
      if (topMovies.length > 3) {
        addLog(jobId, 'info', `  ... and ${topMovies.length - 3} more`)
      }
    }

    // Step 3: Calculate top series
    setJobStep(jobId, 2, 'Calculating top series')
    addLog(jobId, 'info', '📺 Calculating top series based on watch history...')
    const topSeries = await getTopSeries()
    addLog(jobId, 'info', `📺 Found ${topSeries.length} popular series`)
    
    if (topSeries.length > 0) {
      for (const series of topSeries.slice(0, 3)) {
        addLog(jobId, 'info', `  #${series.rank}: ${series.title} (${series.year}) - ${series.uniqueViewers} viewers`)
      }
      if (topSeries.length > 3) {
        addLog(jobId, 'info', `  ... and ${topSeries.length - 3} more`)
      }
    }

    // Step 4: Write STRM files for movies
    setJobStep(jobId, 3, 'Writing movie STRM files')
    addLog(jobId, 'info', '📁 Writing Top Picks Movies STRM files...')
    const moviesResult = await writeTopPicksMovies(topMovies)
    addLog(jobId, 'info', `✅ Written ${moviesResult.written} movie files to ${moviesResult.localPath}`)

    // Step 5: Write STRM files for series
    setJobStep(jobId, 4, 'Writing series STRM files')
    addLog(jobId, 'info', '📁 Writing Top Picks Series STRM files...')
    const seriesResult = await writeTopPicksSeries(topSeries)
    addLog(jobId, 'info', `✅ Written ${seriesResult.written} series to ${seriesResult.localPath}`)

    // Step 6: Create/refresh Emby libraries and grant access
    setJobStep(jobId, 5, 'Managing library access')
    
    // Check if libraries exist, create if not
    const provider = getMediaServerProvider()
    const apiKey = process.env.MEDIA_SERVER_API_KEY
    if (apiKey) {
      const strmConfig = getConfig()
      
      // Ensure Top Picks movies library exists
      try {
        const moviesLibPath = path.join(strmConfig.libraryPathPrefix, '..', 'top-picks', 'movies')
        addLog(jobId, 'info', `🔧 Checking Movies library "${config.moviesLibraryName}"...`)
        const moviesResult = await provider.createVirtualLibrary(
          apiKey,
          config.moviesLibraryName,
          moviesLibPath,
          'movies'
        )
        if (moviesResult.alreadyExists) {
          addLog(jobId, 'info', `✅ Movies library "${config.moviesLibraryName}" already exists`)
        } else {
          addLog(jobId, 'info', `✅ Movies library "${config.moviesLibraryName}" created`)
        }
      } catch (err) {
        addLog(jobId, 'error', `❌ Failed to ensure Movies library: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      // Ensure Top Picks series library exists
      try {
        const seriesLibPath = path.join(strmConfig.libraryPathPrefix, '..', 'top-picks', 'series')
        addLog(jobId, 'info', `🔧 Checking Series library "${config.seriesLibraryName}"...`)
        const seriesResult = await provider.createVirtualLibrary(
          apiKey,
          config.seriesLibraryName,
          seriesLibPath,
          'tvshows'
        )
        if (seriesResult.alreadyExists) {
          addLog(jobId, 'info', `✅ Series library "${config.seriesLibraryName}" already exists`)
        } else {
          addLog(jobId, 'info', `✅ Series library "${config.seriesLibraryName}" created`)
        }
      } catch (err) {
        addLog(jobId, 'error', `❌ Failed to ensure Series library: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      // Grant access to all users
      addLog(jobId, 'info', '👥 Granting access to all users...')
      const topPicksLibs = await getTopPicksLibraries()
      
      if (!topPicksLibs.movies) {
        addLog(jobId, 'warn', `⚠️ Movies library "${config.moviesLibraryName}" not found in Emby - permissions not set`)
      }
      if (!topPicksLibs.series) {
        addLog(jobId, 'warn', `⚠️ Series library "${config.seriesLibraryName}" not found in Emby - permissions not set`)
      }
      
      if (topPicksLibs.movies || topPicksLibs.series) {
        const accessResult = await grantTopPicksAccessToAllUsers(topPicksLibs.movies, topPicksLibs.series)
        addLog(jobId, 'info', `✅ Permissions updated: ${accessResult.updated} users granted access`)
        if (accessResult.alreadyHadAccess > 0) {
          addLog(jobId, 'info', `   ℹ️ ${accessResult.alreadyHadAccess} users already had access`)
        }
        if (accessResult.hasAllFolders > 0) {
          addLog(jobId, 'info', `   ℹ️ ${accessResult.hasAllFolders} users have access to all libraries`)
        }
        if (accessResult.failed > 0) {
          addLog(jobId, 'warn', `   ⚠️ ${accessResult.failed} users failed`)
        }
      } else {
        addLog(jobId, 'warn', '⚠️ No Top Picks libraries found - run Emby library scan first, then re-run this job')
      }

      // Refresh libraries
      addLog(jobId, 'info', '🔄 Triggering library refresh...')
      if (topPicksLibs.movies) {
        await provider.refreshLibrary(apiKey, topPicksLibs.movies.id)
        addLog(jobId, 'info', `🔄 Movies library refresh triggered`)
      }
      if (topPicksLibs.series) {
        await provider.refreshLibrary(apiKey, topPicksLibs.series.id)
        addLog(jobId, 'info', `🔄 Series library refresh triggered`)
      }
    }

    // Update last refreshed timestamp
    await updateTopPicksLastRefreshed()

    const result = {
      moviesCount: topMovies.length,
      seriesCount: topSeries.length,
      usersUpdated: 0, // Will be updated from accessResult
      jobId,
    }

    completeJob(jobId, result)
    addLog(jobId, 'info', `🎉 Top Picks refresh complete: ${result.moviesCount} movies, ${result.seriesCount} series`)

    return result
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    logger.error({ err }, 'Top Picks refresh failed')
    throw err
  }
}

