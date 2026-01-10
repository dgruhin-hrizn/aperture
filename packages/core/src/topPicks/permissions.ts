/**
 * Top Picks Library Permissions
 * 
 * Manages granting all Emby users access to Top Picks libraries.
 */

import { createChildLogger } from '../lib/logger.js'
import { getMediaServerProvider } from '../media/index.js'
import { getTopPicksConfig } from './config.js'

const logger = createChildLogger('top-picks-permissions')

interface LibraryInfo {
  id: string
  guid: string
  name: string
}

/**
 * Grant all Emby users access to the Top Picks libraries
 * This makes the Top Picks libraries visible to everyone
 */
export async function grantTopPicksAccessToAllUsers(
  moviesLibrary: LibraryInfo | null,
  seriesLibrary: LibraryInfo | null
): Promise<{ updated: number; failed: number; alreadyHadAccess: number; hasAllFolders: number }> {
  const provider = await getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
  }

  // Get all users from the media server
  const mediaServerUsers = await provider.getUsers(apiKey)
  
  logger.info({ 
    userCount: mediaServerUsers.length,
    moviesLibrary: moviesLibrary?.name,
    seriesLibrary: seriesLibrary?.name,
  }, 'Granting Top Picks access to all users')

  let updated = 0
  let alreadyHadAccess = 0
  let hasAllFolders = 0
  let failed = 0

  for (const user of mediaServerUsers) {
    try {
      // Get user's current library access
      const currentAccess = await provider.getUserLibraryAccess(apiKey, user.id)
      
      // If user has access to all folders, no need to update
      if (currentAccess.enableAllFolders) {
        logger.debug({ userId: user.id, username: user.name }, 'User has access to all folders, skipping')
        hasAllFolders++
        continue
      }

      // Add Top Picks library GUIDs to user's enabled folders
      const newEnabledFolders = new Set(currentAccess.enabledFolders)
      
      if (moviesLibrary && moviesLibrary.guid) {
        newEnabledFolders.add(moviesLibrary.guid)
      }
      
      if (seriesLibrary && seriesLibrary.guid) {
        newEnabledFolders.add(seriesLibrary.guid)
      }

      // Update user's library access if there are changes
      const needsUpdate = newEnabledFolders.size !== currentAccess.enabledFolders.length ||
          !currentAccess.enabledFolders.every(f => newEnabledFolders.has(f))
      
      if (needsUpdate) {
        await provider.updateUserLibraryAccess(
          apiKey,
          user.id,
          Array.from(newEnabledFolders)
        )
        logger.info({ userId: user.id, username: user.name }, 'Updated library access for user')
        updated++
      } else {
        alreadyHadAccess++
      }
    } catch (err) {
      logger.error({ err, userId: user.id, username: user.name }, 'Failed to update library access')
      failed++
    }
  }

  logger.info({ 
    updated, 
    alreadyHadAccess, 
    hasAllFolders, 
    failed,
    total: mediaServerUsers.length 
  }, 'Top Picks access grant completed')
  
  return { updated, failed, alreadyHadAccess, hasAllFolders }
}

/**
 * Get the Top Picks libraries from the media server
 * Uses the configured library names from the database
 */
export async function getTopPicksLibraries(): Promise<{
  movies: LibraryInfo | null
  series: LibraryInfo | null
}> {
  const provider = await getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
  }

  // Get the configured library names from the database
  const config = await getTopPicksConfig()
  const { moviesLibraryName, seriesLibraryName } = config

  const libraries = await provider.getLibraries(apiKey)
  
  // Find libraries by exact name match (configured names)
  const moviesLibrary = libraries.find(lib => lib.name === moviesLibraryName && lib.collectionType === 'movies')
  const seriesLibrary = libraries.find(lib => lib.name === seriesLibraryName && lib.collectionType === 'tvshows')

  logger.debug({
    configuredMoviesName: moviesLibraryName,
    configuredSeriesName: seriesLibraryName,
    foundMovies: moviesLibrary?.name,
    foundSeries: seriesLibrary?.name,
  }, 'Looking for Top Picks libraries')

  return {
    movies: moviesLibrary ? { id: moviesLibrary.id, guid: moviesLibrary.guid, name: moviesLibrary.name } : null,
    series: seriesLibrary ? { id: seriesLibrary.id, guid: seriesLibrary.guid, name: seriesLibrary.name } : null,
  }
}

