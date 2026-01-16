/**
 * Shows You Watch Library Management
 * 
 * Handles creation and management of per-user "Shows You Watch"
 * libraries in the media server.
 */

import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'
import { getConfig } from '../strm/config.js'
import { syncLibraryTypeImage } from '../uploads/mediaServerSync.js'

const logger = createChildLogger('watching-library')

/**
 * Get the watching library name for a user
 * Format: "Shows {displayName} Watches"
 */
export function getWatchingLibraryName(displayName: string): string {
  return `Shows ${displayName} Watches`
}

/**
 * Ensure a user's watching library exists in the media server
 */
export async function ensureUserWatchingLibrary(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ libraryId: string; libraryGuid: string; created: boolean; name: string }> {
  const config = await getConfig()
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Build user folder name (DisplayName_ID format for readability)
  const { getUserFolderName } = await import('../strm/filenames.js')
  const userFolder = getUserFolderName(displayName, providerUserId)

  const libraryName = getWatchingLibraryName(displayName)
  // Library path includes 'aperture-watching' subfolder for "Shows You Watch" library
  const libraryPath = path.join(config.libraryPathPrefix, 'aperture-watching', userFolder)

  logger.info({ userId, libraryName, libraryPath }, '📺 Checking watching library status...')

  // Check if we already have a record of this library in our database
  const dbRecord = await queryOne<{
    provider_library_id: string
    provider_library_guid: string
    name: string
  }>(
    `SELECT provider_library_id, provider_library_guid, name FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'watching'`,
    [userId]
  )

  // If library name changed, delete the old record so we create a new one
  if (dbRecord && dbRecord.name !== libraryName) {
    logger.info({ userId, oldName: dbRecord.name, newName: libraryName }, 'Watching library name changed, clearing old record')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'watching'`,
      [userId]
    )
  }

  // Check if the library actually exists in the media server
  const libraries = await provider.getLibraries(apiKey)
  const existingLib = libraries.find((lib) => lib.name === libraryName)

  if (existingLib) {
    logger.info({ libraryName, libraryId: existingLib.id }, '📺 Watching library exists in media server')

    // Ensure we have an up-to-date database record
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'watching'`,
      [userId]
    )
    await query(
      `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid, media_type, library_type)
       VALUES ($1, $2, $3, $4, $5, 'series', 'watching')`,
      [userId, libraryName, libraryPath, existingLib.id, existingLib.guid]
    )

    // Push global library image to this library
    await syncLibraryTypeImage('watching', existingLib.id)

    return {
      libraryId: existingLib.id,
      libraryGuid: existingLib.guid!,
      created: false,
      name: libraryName,
    }
  }

  // Library doesn't exist - create it
  logger.info({ userId, libraryName, libraryPath }, '📺 Creating watching library in media server...')

  if (dbRecord) {
    logger.info({ userId }, 'Clearing stale database record (library was deleted from media server)')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'watching'`,
      [userId]
    )
  }

  // Create as TV shows library type
  const result = await provider.createVirtualLibrary(apiKey, libraryName, libraryPath, 'tvshows')

  // Fetch the library again to get the GUID
  const newLibraries = await provider.getLibraries(apiKey)
  const newLib = newLibraries.find((lib) => lib.name === libraryName)
  const libraryGuid = newLib?.guid || result.libraryId

  // Store the mapping
  await query(
    `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid, media_type, library_type)
     VALUES ($1, $2, $3, $4, $5, 'series', 'watching')`,
    [userId, libraryName, libraryPath, result.libraryId, libraryGuid]
  )

  // Push global library image to this library
  await syncLibraryTypeImage('watching', result.libraryId)

  logger.info({ userId, libraryName, libraryId: result.libraryId, libraryGuid }, '✅ Watching library created')

  return { libraryId: result.libraryId, libraryGuid, created: true, name: libraryName }
}

/**
 * Refresh a user's watching library in the media server
 */
export async function refreshUserWatchingLibrary(userId: string): Promise<void> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const library = await queryOne<{ provider_library_id: string }>(
    `SELECT provider_library_id FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'watching'`,
    [userId]
  )

  if (!library?.provider_library_id) {
    logger.warn({ userId }, 'No watching library found to refresh')
    return
  }

  await provider.refreshLibrary(apiKey, library.provider_library_id)
  logger.info({ userId, libraryId: library.provider_library_id }, 'Watching library refreshed')
}

/**
 * Update user's library access permissions to include their watching library
 */
export async function updateUserWatchingLibraryPermissions(
  userId: string,
  providerUserId: string
): Promise<void> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Get user's watching library
  const library = await queryOne<{ provider_library_id: string; provider_library_guid: string }>(
    `SELECT provider_library_id, provider_library_guid FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'watching'`,
    [userId]
  )

  if (!library?.provider_library_guid) {
    logger.warn({ userId }, 'No watching library found for user')
    return
  }

  // Get the user's current library access from the media server
  const currentAccess = await provider.getUserLibraryAccess(apiKey, providerUserId)

  // If user has access to all folders, no need to modify permissions
  // but still set sort preference
  if (currentAccess.enableAllFolders) {
    logger.debug({ userId }, 'User has access to all folders, skipping permission update')
    // Set sort preference for this library (DateCreated descending)
    if (library.provider_library_id) {
      await provider.setLibrarySortPreference(apiKey, providerUserId, library.provider_library_id)
    }
    return
  }

  // Check if watching library is already in the user's allowed list
  if (currentAccess.enabledFolders.includes(library.provider_library_guid)) {
    logger.debug({ userId }, 'Watching library already in user permissions')
    return
  }

  // Add the watching library GUID to the user's existing permissions
  const updatedFolders = [...currentAccess.enabledFolders, library.provider_library_guid]

  await provider.updateUserLibraryAccess(apiKey, providerUserId, updatedFolders)
  logger.info({ userId, libraryGuid: library.provider_library_guid }, 'Added watching library to user permissions')

  // Set sort preference for this library (DateCreated descending)
  if (library.provider_library_id) {
    await provider.setLibrarySortPreference(apiKey, providerUserId, library.provider_library_id)
  }
}

/**
 * Get watching library info for a user
 */
export async function getUserWatchingLibraryInfo(userId: string): Promise<{
  libraryId: string
  libraryGuid: string
  name: string
  path: string
} | null> {
  const library = await queryOne<{
    provider_library_id: string
    provider_library_guid: string
    name: string
    path: string
  }>(
    `SELECT provider_library_id, provider_library_guid, name, path FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'watching'`,
    [userId]
  )

  if (!library) {
    return null
  }

  return {
    libraryId: library.provider_library_id,
    libraryGuid: library.provider_library_guid,
    name: library.name,
    path: library.path,
  }
}

