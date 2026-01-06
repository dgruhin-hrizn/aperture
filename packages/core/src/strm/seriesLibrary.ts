/**
 * Series Library Management
 * 
 * Handles creation and management of per-user TV series recommendation
 * libraries in the media server.
 */

import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getConfig } from './config.js'
import type { StrmConfig } from './types.js'

const logger = createChildLogger('strm-series-library')

/**
 * Get the custom series library name for a user, or fall back to default
 */
export async function getUserSeriesLibraryName(
  userId: string,
  displayName: string,
  config: StrmConfig
): Promise<string> {
  const settings = await queryOne<{ series_library_name: string | null }>(
    `SELECT series_library_name FROM user_settings WHERE user_id = $1`,
    [userId]
  )

  if (settings?.series_library_name) {
    return settings.series_library_name
  }

  // Fall back to default with "TV" suffix
  return `${config.libraryNamePrefix}${displayName} TV`
}

/**
 * Ensure a user's AI TV library exists in the media server
 */
export async function ensureUserSeriesLibrary(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ libraryId: string; libraryGuid: string; created: boolean; name: string }> {
  const config = getConfig()
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const libraryName = await getUserSeriesLibraryName(userId, displayName, config)
  // Use separate base path for TV series (aperture-tv instead of aperture)
  const libraryPath = path.join(
    config.libraryPathPrefix.replace('/aperture', '/aperture-tv'),
    providerUserId
  )

  logger.info({ userId, libraryName, libraryPath }, '📺 Checking series library status...')

  // Check if we already have a record of this library in our database
  const dbRecord = await queryOne<{
    provider_library_id: string
    provider_library_guid: string
    name: string
  }>(
    `SELECT provider_library_id, provider_library_guid, name FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'series'`,
    [userId]
  )

  // If library name changed, delete the old record so we create a new one
  if (dbRecord && dbRecord.name !== libraryName) {
    logger.info({ userId, oldName: dbRecord.name, newName: libraryName }, 'Series library name changed, clearing old record')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'series'`,
      [userId]
    )
  }

  // Check if the library actually exists in the media server
  const libraries = await provider.getLibraries(apiKey)
  const existingLib = libraries.find((lib) => lib.name === libraryName)

  if (existingLib) {
    logger.info({ libraryName, libraryId: existingLib.id }, '📺 Series library exists in media server')

    // Ensure we have an up-to-date database record
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'series'`,
      [userId]
    )
    await query(
      `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid, library_type)
       VALUES ($1, $2, $3, $4, $5, 'series')`,
      [userId, libraryName, libraryPath, existingLib.id, existingLib.guid]
    )

    return {
      libraryId: existingLib.id,
      libraryGuid: existingLib.guid!,
      created: false,
      name: libraryName,
    }
  }

  // Library doesn't exist - create it
  logger.info({ userId, libraryName, libraryPath }, '📺 Creating virtual TV library in media server...')

  if (dbRecord) {
    logger.info({ userId }, 'Clearing stale database record (library was deleted from media server)')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'series'`,
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
    `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid, library_type)
     VALUES ($1, $2, $3, $4, $5, 'series')`,
    [userId, libraryName, libraryPath, result.libraryId, libraryGuid]
  )

  logger.info({ userId, libraryName, libraryId: result.libraryId, libraryGuid }, '✅ Virtual TV library created')

  return { libraryId: result.libraryId, libraryGuid, created: true, name: libraryName }
}

/**
 * Refresh a user's AI TV library in the media server
 */
export async function refreshUserSeriesLibrary(userId: string): Promise<void> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const library = await queryOne<{ provider_library_id: string }>(
    `SELECT provider_library_id FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'series'`,
    [userId]
  )

  if (!library?.provider_library_id) {
    logger.warn({ userId }, 'No series library found to refresh')
    return
  }

  await provider.refreshLibrary(apiKey, library.provider_library_id)
  logger.info({ userId, libraryId: library.provider_library_id }, 'Series library refreshed')
}

/**
 * Update user's library access permissions to include their AI TV library
 */
export async function updateUserSeriesLibraryPermissions(
  userId: string,
  providerUserId: string
): Promise<void> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Get user's AI series library GUID
  const library = await queryOne<{ provider_library_guid: string }>(
    `SELECT provider_library_guid FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'series'`,
    [userId]
  )

  if (!library?.provider_library_guid) {
    logger.warn({ userId }, 'No AI series library found for user')
    return
  }

  // Get the user's current library access from the media server
  const currentAccess = await provider.getUserLibraryAccess(apiKey, providerUserId)

  // If user has access to all folders, no need to modify
  if (currentAccess.enableAllFolders) {
    logger.debug({ userId }, 'User has access to all folders, skipping permission update')
    return
  }

  // Check if AI series library is already in the user's allowed list
  if (currentAccess.enabledFolders.includes(library.provider_library_guid)) {
    logger.debug({ userId }, 'AI series library already in user permissions')
    return
  }

  // Add the AI series library GUID to the user's existing permissions
  const updatedFolders = [...currentAccess.enabledFolders, library.provider_library_guid]

  await provider.updateUserLibraryAccess(apiKey, providerUserId, updatedFolders)
  logger.info({ userId, libraryGuid: library.provider_library_guid }, 'Added AI series library to user permissions')
}


