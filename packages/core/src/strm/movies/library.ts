import path from 'path'
import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getMediaServerProvider } from '../../media/index.js'
import { getConfig } from '../config.js'
import { getEffectiveLibraryTitle } from '../../lib/userSettings.js'
import { syncLibraryTypeImage } from '../../uploads/mediaServerSync.js'
import type { StrmConfig } from '../types.js'

const logger = createChildLogger('strm-library')

/**
 * Get the custom library name for a user, or fall back to default template
 */
export async function getUserLibraryName(userId: string, displayName: string, _config: StrmConfig): Promise<string> {
  return getEffectiveLibraryTitle(userId, displayName, 'movies')
}

/**
 * Ensure a user's AI library exists in the media server
 */
export async function ensureUserLibrary(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ libraryId: string; libraryGuid: string; created: boolean; name: string }> {
  const config = getConfig()
  const provider = await getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const libraryName = await getUserLibraryName(userId, displayName, config)
  const libraryPath = path.join(config.libraryPathPrefix, providerUserId)

  logger.info({ userId, libraryName, libraryPath }, '📚 Checking library status...')

  // Check if we already have a record of this library in our database
  const dbRecord = await queryOne<{ 
    provider_library_id: string
    provider_library_guid: string
    name: string 
  }>(
    `SELECT provider_library_id, provider_library_guid, name FROM strm_libraries
     WHERE user_id = $1 AND channel_id IS NULL`,
    [userId]
  )

  // If library name changed, delete the old record so we create a new one
  if (dbRecord && dbRecord.name !== libraryName) {
    logger.info({ userId, oldName: dbRecord.name, newName: libraryName }, 'Library name changed, clearing old record')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND channel_id IS NULL`,
      [userId]
    )
  }

  // ALWAYS check if the library actually exists in the media server
  // (User may have deleted it manually from Emby)
  const libraries = await provider.getLibraries(apiKey)
  const existingLib = libraries.find((lib) => lib.name === libraryName)

  if (existingLib) {
    logger.info({ libraryName, libraryId: existingLib.id }, '📚 Library exists in media server')
    
    // Ensure we have an up-to-date database record
    // Delete any existing record first, then insert fresh
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND channel_id IS NULL`,
      [userId]
    )
    await query(
      `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, libraryName, libraryPath, existingLib.id, existingLib.guid]
    )

    // Push global library image to this library
    await syncLibraryTypeImage('ai-recs-movies', existingLib.id)

    return { libraryId: existingLib.id, libraryGuid: existingLib.guid!, created: false, name: libraryName }
  }

  // Library doesn't exist in media server - need to create it
  logger.info({ userId, libraryName, libraryPath }, '📚 Creating virtual library in media server...')

  // If we had a stale database record, delete it
  if (dbRecord) {
    logger.info({ userId }, 'Clearing stale database record (library was deleted from media server)')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND channel_id IS NULL`,
      [userId]
    )
  }

  const result = await provider.createVirtualLibrary(apiKey, libraryName, libraryPath, 'movies')

  // Fetch the library again to get the GUID
  const newLibraries = await provider.getLibraries(apiKey)
  const newLib = newLibraries.find((lib) => lib.name === libraryName)
  const libraryGuid = newLib?.guid || result.libraryId

  // Store the mapping with both ID and GUID
  await query(
    `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, libraryName, libraryPath, result.libraryId, libraryGuid]
  )

  // Push global library image to this library
  await syncLibraryTypeImage('ai-recs-movies', result.libraryId)

  logger.info({ userId, libraryName, libraryId: result.libraryId, libraryGuid }, '✅ Virtual library created')

  return { libraryId: result.libraryId, libraryGuid, created: true, name: libraryName }
}

/**
 * Refresh a user's AI library in the media server
 */
export async function refreshUserLibrary(userId: string): Promise<void> {
  const provider = await getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const library = await queryOne<{ provider_library_id: string }>(
    `SELECT provider_library_id FROM strm_libraries
     WHERE user_id = $1 AND channel_id IS NULL`,
    [userId]
  )

  if (!library?.provider_library_id) {
    logger.warn({ userId }, 'No library found to refresh')
    return
  }

  await provider.refreshLibrary(apiKey, library.provider_library_id)
  logger.info({ userId, libraryId: library.provider_library_id }, 'Library refreshed')
}

/**
 * Update user's library access permissions
 * Adds the AI Picks library to the user's existing library access
 */
export async function updateUserLibraryPermissions(
  userId: string,
  providerUserId: string
): Promise<void> {
  const provider = await getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Get user's AI library GUID from our database
  const library = await queryOne<{ provider_library_guid: string }>(
    `SELECT provider_library_guid FROM strm_libraries
     WHERE user_id = $1 AND channel_id IS NULL`,
    [userId]
  )

  if (!library?.provider_library_guid) {
    logger.warn({ userId }, 'No AI library found for user')
    return
  }

  // Get the user's current library access from the media server
  const currentAccess = await provider.getUserLibraryAccess(apiKey, providerUserId)
  
  // If user has access to all folders, no need to modify
  if (currentAccess.enableAllFolders) {
    logger.debug({ userId }, 'User has access to all folders, skipping permission update')
    return
  }

  // Check if AI library is already in the user's allowed list
  if (currentAccess.enabledFolders.includes(library.provider_library_guid)) {
    logger.debug({ userId }, 'AI library already in user permissions')
    return
  }

  // Add the AI library GUID to the user's existing permissions
  const updatedFolders = [...currentAccess.enabledFolders, library.provider_library_guid]

  await provider.updateUserLibraryAccess(apiKey, providerUserId, updatedFolders)
  logger.info({ userId, libraryGuid: library.provider_library_guid }, 'Added AI library to user permissions')
}

