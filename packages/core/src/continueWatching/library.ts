/**
 * Continue Watching Library Management
 * 
 * Handles creation and management of per-user "Continue Watching"
 * libraries in the media server.
 */

import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'
import { getConfig } from '../strm/config.js'

const logger = createChildLogger('continue-watching-library')

/**
 * Apply merge tags to library name template
 */
function applyMergeTags(template: string, displayName: string, providerUserId: string): string {
  return template
    .replace(/\{\{username\}\}/gi, displayName)
    .replace(/\{\{userid\}\}/gi, providerUserId)
}

/**
 * Get the continue watching library name for a user
 * Uses the configured template with merge tags
 */
export async function getContinueWatchingLibraryName(
  displayName: string,
  providerUserId: string
): Promise<string> {
  const config = await getContinueWatchingConfig()
  const template = config?.libraryName || "{{username}}'s Continue Watching"
  return applyMergeTags(template, displayName, providerUserId)
}

/**
 * Ensure a user's continue watching library exists in the media server
 */
export async function ensureUserContinueWatchingLibrary(
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

  const libraryName = await getContinueWatchingLibraryName(displayName, providerUserId)
  // Library path includes 'aperture-continue-watching' subfolder
  const libraryPath = path.join(config.libraryPathPrefix, 'aperture-continue-watching', userFolder)

  logger.info({ userId, libraryName, libraryPath }, '📺 Checking continue watching library status...')

  // Check if we already have a record of this library in our database
  const dbRecord = await queryOne<{
    provider_library_id: string
    provider_library_guid: string
    name: string
  }>(
    `SELECT provider_library_id, provider_library_guid, name FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'continue-watching'`,
    [userId]
  )

  // If library name changed, delete the old record so we create a new one
  if (dbRecord && dbRecord.name !== libraryName) {
    logger.info({ userId, oldName: dbRecord.name, newName: libraryName }, 'Continue watching library name changed, clearing old record')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'continue-watching'`,
      [userId]
    )
  }

  // Check if the library actually exists in the media server
  const libraries = await provider.getLibraries(apiKey)
  const existingLib = libraries.find((lib) => lib.name === libraryName)

  if (existingLib) {
    logger.info({ libraryName, libraryId: existingLib.id }, '📺 Continue watching library exists in media server')

    // Ensure we have an up-to-date database record
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'continue-watching'`,
      [userId]
    )
    await query(
      `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid, media_type, library_type)
       VALUES ($1, $2, $3, $4, $5, 'movies', 'continue-watching')`,
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
  logger.info({ userId, libraryName, libraryPath }, '📺 Creating continue watching library in media server...')

  if (dbRecord) {
    logger.info({ userId }, 'Clearing stale database record (library was deleted from media server)')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND library_type = 'continue-watching'`,
      [userId]
    )
  }

  // Create as movies library type (mixed content will still work)
  const result = await provider.createVirtualLibrary(apiKey, libraryName, libraryPath, 'movies')

  // Fetch the library again to get the GUID
  const newLibraries = await provider.getLibraries(apiKey)
  const newLib = newLibraries.find((lib) => lib.name === libraryName)
  const libraryGuid = newLib?.guid || result.libraryId

  // Store the mapping
  await query(
    `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid, media_type, library_type)
     VALUES ($1, $2, $3, $4, $5, 'movies', 'continue-watching')`,
    [userId, libraryName, libraryPath, result.libraryId, libraryGuid]
  )

  logger.info({ userId, libraryName, libraryId: result.libraryId, libraryGuid }, '✅ Continue watching library created')

  return { libraryId: result.libraryId, libraryGuid, created: true, name: libraryName }
}

/**
 * Refresh a user's continue watching library in the media server
 */
export async function refreshUserContinueWatchingLibrary(userId: string): Promise<void> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const library = await queryOne<{ provider_library_id: string }>(
    `SELECT provider_library_id FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'continue-watching'`,
    [userId]
  )

  if (!library?.provider_library_id) {
    logger.warn({ userId }, 'No continue watching library found to refresh')
    return
  }

  await provider.refreshLibrary(apiKey, library.provider_library_id)
  logger.info({ userId, libraryId: library.provider_library_id }, 'Continue watching library refreshed')
}

/**
 * Update user's library access permissions to include their continue watching library
 */
export async function updateUserContinueWatchingLibraryPermissions(
  userId: string,
  providerUserId: string
): Promise<void> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Get user's continue watching library
  const library = await queryOne<{ provider_library_id: string; provider_library_guid: string }>(
    `SELECT provider_library_id, provider_library_guid FROM strm_libraries
     WHERE user_id = $1 AND library_type = 'continue-watching'`,
    [userId]
  )

  if (!library?.provider_library_guid) {
    logger.warn({ userId }, 'No continue watching library found for user')
    return
  }

  // Get the user's current library access from the media server
  const currentAccess = await provider.getUserLibraryAccess(apiKey, providerUserId)

  // If user has access to all folders, no need to modify permissions
  if (currentAccess.enableAllFolders) {
    logger.debug({ userId }, 'User has access to all folders, skipping permission update')
    // Set sort preference for this library (DateCreated descending for most recent first)
    if (library.provider_library_id) {
      await provider.setLibrarySortPreference(apiKey, providerUserId, library.provider_library_id, 'DateCreated', 'Descending')
    }
    return
  }

  // Check if continue watching library is already in the user's allowed list
  if (currentAccess.enabledFolders.includes(library.provider_library_guid)) {
    logger.debug({ userId }, 'Continue watching library already in user permissions')
    return
  }

  // Add the continue watching library GUID to the user's existing permissions
  const updatedFolders = [...currentAccess.enabledFolders, library.provider_library_guid]

  await provider.updateUserLibraryAccess(apiKey, providerUserId, updatedFolders)
  logger.info({ userId, libraryGuid: library.provider_library_guid }, 'Added continue watching library to user permissions')

  // Set sort preference for this library (DateCreated descending for most recent first)
  if (library.provider_library_id) {
    await provider.setLibrarySortPreference(apiKey, providerUserId, library.provider_library_id, 'DateCreated', 'Descending')
  }
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
