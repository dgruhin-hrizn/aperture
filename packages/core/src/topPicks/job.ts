/**
 * Top Picks Refresh Job
 * 
 * Calculates popularity scores and generates outputs for Top Picks:
 * - Libraries (STRM files or symlinks)
 * - Collections (Box Sets)
 * - Playlists
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
import { writeTopPicksCollectionsAndPlaylists } from './collectionWriter.js'
import { grantTopPicksAccessToAllUsers, getTopPicksLibraries } from './permissions.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'
import { getConfig } from '../strm/config.js'
import { syncLibraryTypeImage } from '../uploads/mediaServerSync.js'
import { query } from '../lib/db.js'
import path from 'path'

/**
 * Minimal library info needed for collection creation
 */
interface LibraryInfo {
  id: string
  guid: string
  name: string
}

const logger = createChildLogger('top-picks-job')

/**
 * Store a Top Picks library ID in strm_libraries for exclusion filtering
 * Uses user_id = NULL to mark these as global/system libraries
 */
async function storeTopPicksLibrary(
  libraryId: string,
  name: string,
  libPath: string,
  mediaType: 'movies' | 'series'
): Promise<void> {
  // Check if this library is already stored
  const existing = await query<{ id: string }>(
    `SELECT id FROM strm_libraries WHERE provider_library_id = $1`,
    [libraryId]
  )

  if (existing.rows.length > 0) {
    // Update existing record
    await query(
      `UPDATE strm_libraries SET name = $1, path = $2, media_type = $3, updated_at = NOW()
       WHERE provider_library_id = $4`,
      [name, libPath, mediaType, libraryId]
    )
  } else {
    // Insert new record
    await query(
      `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, media_type)
       VALUES (NULL, $1, $2, $3, $4)`,
      [name, libPath, libraryId, mediaType]
    )
  }
}

export interface RefreshTopPicksResult {
  moviesCount: number
  seriesCount: number
  usersUpdated: number
  jobId: string
}

/**
 * Wait for a library scan to complete by polling its status
 * Returns true if scan completed, false if timed out
 */
async function waitForLibraryScan(
  libraryId: string,
  maxWaitMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<boolean> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()
  if (!apiKey) return false

  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const libraries = await provider.getLibraries(apiKey)
      const library = libraries.find(l => l.id === libraryId)
      
      if (library && (!library.refreshStatus || library.refreshStatus === 'Idle')) {
        return true
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    } catch (err) {
      logger.debug({ err }, 'Error checking library status')
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
  }
  
  return false // Timed out
}

/**
 * Refresh Top Picks libraries
 */
export async function refreshTopPicks(
  existingJobId?: string
): Promise<RefreshTopPicksResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'refresh-top-picks', 8)

  try {
    // Step 1: Check if Top Picks is enabled
    setJobStep(jobId, 0, 'Checking configuration')
    const config = await getTopPicksConfig()
    
    if (!config.isEnabled) {
      addLog(jobId, 'warn', '⚠️ Top Picks is disabled')
      completeJob(jobId, { moviesCount: 0, seriesCount: 0, usersUpdated: 0 })
      return { moviesCount: 0, seriesCount: 0, usersUpdated: 0, jobId }
    }

    addLog(jobId, 'info', `⚙️ Configuration loaded: Movies (${config.moviesTimeWindowDays}d, min ${config.moviesMinUniqueViewers} viewers), Series (${config.seriesTimeWindowDays}d, min ${config.seriesMinUniqueViewers} viewers)`)
    addLog(jobId, 'info', `📊 Weights: Viewers ${config.uniqueViewersWeight}, Plays ${config.playCountWeight}, Completion ${config.completionWeight}`)
    
    // Log output modes
    const movieOutputs = []
    if (config.moviesLibraryEnabled) movieOutputs.push('Library')
    if (config.moviesCollectionEnabled) movieOutputs.push('Collection')
    if (config.moviesPlaylistEnabled) movieOutputs.push('Playlist')
    
    const seriesOutputs = []
    if (config.seriesLibraryEnabled) seriesOutputs.push('Library')
    if (config.seriesCollectionEnabled) seriesOutputs.push('Collection')
    if (config.seriesPlaylistEnabled) seriesOutputs.push('Playlist')
    
    addLog(jobId, 'info', `🎬 Movies outputs: ${movieOutputs.join(', ') || 'None'}`)
    addLog(jobId, 'info', `📺 Series outputs: ${seriesOutputs.join(', ') || 'None'}`)

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

    // Track libraries created for progress (1 movie library + 1 series library = 2 max)
    let librariesCreated = 0
    const totalLibraries = (config.moviesLibraryEnabled ? 1 : 0) + (config.seriesLibraryEnabled ? 1 : 0)

    // Step 4: Write STRM files for movies (if library enabled)
    setJobStep(jobId, 3, 'Writing library files')
    
    if (config.moviesLibraryEnabled) {
      addLog(jobId, 'info', '📁 Writing Top Picks Movies library files...')
      const moviesResult = await writeTopPicksMovies(topMovies)
      addLog(jobId, 'info', `✅ Written ${moviesResult.written} movie files to ${moviesResult.localPath}`)
      librariesCreated++
      updateJobProgress(jobId, librariesCreated, undefined, `${librariesCreated}/${totalLibraries} libraries`)
    } else {
      addLog(jobId, 'info', '⏭️ Skipping movies library (disabled)')
    }

    // Step 5: Write STRM files for series (if library enabled)
    setJobStep(jobId, 4, 'Writing series library files')
    
    if (config.seriesLibraryEnabled) {
      addLog(jobId, 'info', '📁 Writing Top Picks Series library files...')
      const seriesResult = await writeTopPicksSeries(topSeries)
      addLog(jobId, 'info', `✅ Written ${seriesResult.written} series to ${seriesResult.localPath}`)
      librariesCreated++
      updateJobProgress(jobId, librariesCreated, undefined, `${librariesCreated}/${totalLibraries} libraries`)
    } else {
      addLog(jobId, 'info', '⏭️ Skipping series library (disabled)')
    }

    // Step 6: Manage library access and trigger refresh
    setJobStep(jobId, 5, 'Managing libraries and triggering refresh')
    
    const provider = await getMediaServerProvider()
    const apiKey = await getMediaServerApiKey()
    
    let moviesLib: LibraryInfo | null = null
    let seriesLib: LibraryInfo | null = null
    let moviesLibraryCreated = false
    let seriesLibraryCreated = false
    const libraryErrors: string[] = []
    
    if (apiKey && (config.moviesLibraryEnabled || config.seriesLibraryEnabled)) {
      const strmConfig = await getConfig()
      
      // Ensure Top Picks movies library exists (if enabled)
      if (config.moviesLibraryEnabled) {
        try {
          const moviesLibPath = path.join(strmConfig.libraryPathPrefix, 'top-picks-movies')
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
          moviesLibraryCreated = true
          // Store the library ID in strm_libraries for exclusion filtering
          // Use user_id = NULL for global Top Picks libraries
          await storeTopPicksLibrary(moviesResult.libraryId, config.moviesLibraryName, moviesLibPath, 'movies')
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          addLog(jobId, 'error', `❌ Failed to ensure Movies library: ${errorMsg}`)
          libraryErrors.push(`Movies library: ${errorMsg}`)
        }
      }

      // Ensure Top Picks series library exists (if enabled)
      if (config.seriesLibraryEnabled) {
        try {
          const seriesLibPath = path.join(strmConfig.libraryPathPrefix, 'top-picks-series')
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
          seriesLibraryCreated = true
          // Store the library ID in strm_libraries for exclusion filtering
          // Use user_id = NULL for global Top Picks libraries
          await storeTopPicksLibrary(seriesResult.libraryId, config.seriesLibraryName, seriesLibPath, 'series')
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          addLog(jobId, 'error', `❌ Failed to ensure Series library: ${errorMsg}`)
          libraryErrors.push(`Series library: ${errorMsg}`)
        }
      }

      // Get library references
      const topPicksLibs = await getTopPicksLibraries()
      moviesLib = config.moviesLibraryEnabled ? topPicksLibs.movies : null
      seriesLib = config.seriesLibraryEnabled ? topPicksLibs.series : null
      
      if (!moviesLib && config.moviesLibraryEnabled) {
        addLog(jobId, 'warn', `⚠️ Movies library "${config.moviesLibraryName}" not found in media server`)
      }
      if (!seriesLib && config.seriesLibraryEnabled) {
        addLog(jobId, 'warn', `⚠️ Series library "${config.seriesLibraryName}" not found in media server`)
      }
      
      // Push global library images
      if (moviesLib) {
        const movieImgResult = await syncLibraryTypeImage('top-picks-movies', moviesLib.id)
        if (movieImgResult.success && movieImgResult.itemId) {
          addLog(jobId, 'info', '🖼️ Movies library image synced')
        }
      }
      if (seriesLib) {
        const seriesImgResult = await syncLibraryTypeImage('top-picks-series', seriesLib.id)
        if (seriesImgResult.success && seriesImgResult.itemId) {
          addLog(jobId, 'info', '🖼️ Series library image synced')
        }
      }
      
      // Grant access to all users
      if (moviesLib || seriesLib) {
        addLog(jobId, 'info', '👥 Granting access to all users...')
        const accessResult = await grantTopPicksAccessToAllUsers(moviesLib, seriesLib)
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
      }

      // Trigger library refresh and wait for completion
      addLog(jobId, 'info', '🔄 Triggering library refresh...')
      
      if (moviesLib) {
        await provider.refreshLibrary(apiKey, moviesLib.id)
        addLog(jobId, 'info', `🔄 Movies library refresh triggered, waiting for scan...`)
      }
      if (seriesLib) {
        await provider.refreshLibrary(apiKey, seriesLib.id)
        addLog(jobId, 'info', `🔄 Series library refresh triggered, waiting for scan...`)
      }
      
      // Wait for scans to complete (need items to exist before creating collections)
      const hasCollectionOrPlaylist = 
        config.moviesCollectionEnabled || 
        config.seriesCollectionEnabled || 
        config.moviesPlaylistEnabled || 
        config.seriesPlaylistEnabled
      
      if (hasCollectionOrPlaylist) {
        setJobStep(jobId, 6, 'Waiting for library scan to complete')
        
        // Wait for scans (with timeout)
        if (moviesLib) {
          addLog(jobId, 'info', '⏳ Waiting for Movies library scan to complete...')
          const moviesComplete = await waitForLibraryScan(moviesLib.id, 60000)
          if (moviesComplete) {
            addLog(jobId, 'info', '✅ Movies library scan complete')
          } else {
            addLog(jobId, 'warn', '⚠️ Movies library scan timed out, collections may be incomplete')
          }
        }
        
        if (seriesLib) {
          addLog(jobId, 'info', '⏳ Waiting for Series library scan to complete...')
          const seriesComplete = await waitForLibraryScan(seriesLib.id, 60000)
          if (seriesComplete) {
            addLog(jobId, 'info', '✅ Series library scan complete')
          } else {
            addLog(jobId, 'warn', '⚠️ Series library scan timed out, collections may be incomplete')
          }
        }
      }
    } else if (!apiKey) {
      addLog(jobId, 'warn', '⚠️ MEDIA_SERVER_API_KEY not set - skipping library management')
    } else {
      addLog(jobId, 'info', '⏭️ Skipping library management (no libraries enabled)')
    }

    // Step 7: Create collections and playlists (AFTER library scan completes)
    setJobStep(jobId, 6, 'Creating collections and playlists')
    
    const hasCollectionOrPlaylist = 
      config.moviesCollectionEnabled || 
      config.seriesCollectionEnabled || 
      config.moviesPlaylistEnabled || 
      config.seriesPlaylistEnabled
    
    if (hasCollectionOrPlaylist) {
      addLog(jobId, 'info', '📦 Creating collections and playlists from Top Picks library items...')
      
      // Pass the library references so collections use items from Top Picks library
      const cpResults = await writeTopPicksCollectionsAndPlaylists(
        topMovies, 
        topSeries,
        moviesLib,
        seriesLib
      )
      
      if (cpResults.moviesCollection) {
        addLog(jobId, 'info', `✅ Movies collection created with ${cpResults.moviesCollection.itemCount} items`)
      }
      if (cpResults.seriesCollection) {
        addLog(jobId, 'info', `✅ Series collection created with ${cpResults.seriesCollection.itemCount} items`)
      }
      if (cpResults.moviesPlaylist) {
        addLog(jobId, 'info', `✅ Movies playlist created with ${cpResults.moviesPlaylist.itemCount} items`)
      }
      if (cpResults.seriesPlaylist) {
        addLog(jobId, 'info', `✅ Series playlist created with ${cpResults.seriesPlaylist.itemCount} items`)
      }
    } else {
      addLog(jobId, 'info', '⏭️ Skipping collections and playlists (all disabled)')
    }

    // Update last refreshed timestamp
    await updateTopPicksLastRefreshed()

    const result = {
      moviesCount: topMovies.length,
      seriesCount: topSeries.length,
      usersUpdated: 0,
      moviesLibraryCreated,
      seriesLibraryCreated,
      libraryErrors,
      jobId,
    }

    // If library creation was enabled but failed, throw an error so job shows as failed
    if (libraryErrors.length > 0) {
      const errorSummary = libraryErrors.join('; ')
      addLog(jobId, 'error', `🎬 Top Picks files created (${result.moviesCount} movies, ${result.seriesCount} series) but library creation failed: ${errorSummary}`)
      throw new Error(`Library creation failed: ${errorSummary}`)
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
