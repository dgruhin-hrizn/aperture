/**
 * Series Library Management
 * 
 * Handles creation and management of per-user TV series recommendation
 * libraries in the media server.
 */

import path from 'path'
import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getMediaServerProvider } from '../../media/index.js'
import { getMediaServerApiKey } from '../../settings/systemSettings.js'
import { getConfig } from '../config.js'
import { getEffectiveLibraryTitle } from '../../lib/userSettings.js'
import { syncLibraryTypeImage } from '../../uploads/mediaServerSync.js'
import type { SeriesRecommendationGroup } from '../../recommender/series/groups.js'
import type { StrmConfig } from '../types.js'

const logger = createChildLogger('strm-series-library')

/**
 * Get the custom series library name for a user, or fall back to default template
 */
export async function getUserSeriesLibraryName(
  userId: string,
  displayName: string,
  _config: StrmConfig
): Promise<string> {
  return getEffectiveLibraryTitle(userId, displayName, 'series')
}

/**
 * Ensure a user's AI TV library exists in the media server
 */
export async function ensureUserSeriesLibrary(
  userId: string,
  providerUserId: string,
  displayName: string,
  group: SeriesRecommendationGroup | null = null
): Promise<{ libraryId: string; libraryGuid: string; created: boolean; name: string }> {
  const config = await getConfig()
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Build user folder name (DisplayName_ID format for readability)
  const { getUserFolderName } = await import('../filenames.js')
  const userFolder = getUserFolderName(displayName, providerUserId)

  const baseName = await getUserSeriesLibraryName(userId, displayName, config)
  const libraryName = group ? `${baseName} – ${group.name}` : baseName
  const groupId = group?.id ?? null
  const outputFolder = group ? `${userId}-group-${group.id}` : userFolder
  // Library path includes 'aperture-tv' subfolder for AI series recommendations
  const libraryPath = path.join(config.libraryPathPrefix, 'aperture-tv', outputFolder)

  logger.info({ userId, libraryName, libraryPath }, '📺 Checking series library status...')

  // Check if we already have a record of this library in our database
  const dbRecord = await queryOne<{
    provider_library_id: string
    provider_library_guid: string
    name: string
  }>(
    `SELECT provider_library_id, provider_library_guid, name FROM strm_libraries
     WHERE user_id = $1 AND media_type = 'series'
       AND series_group_id IS NOT DISTINCT FROM $2::uuid`,
    [userId, groupId]
  )

  const libraries = await provider.getLibraries(apiKey)
  const existingLib = libraries.find((lib) => lib.name.toLowerCase() === libraryName.toLowerCase())
  if (existingLib && provider.type === 'emby' && existingLib.id !== dbRecord?.provider_library_id
    && !existingLib.locations?.includes(libraryPath)) {
    throw new Error(`Emby already has an unrelated library named ${libraryName}`)
  }

  // If the managed name changed, remove only the library we previously created.
  if (dbRecord && dbRecord.name !== libraryName && !existingLib) {
    const previous = libraries.find((lib) => lib.id === dbRecord.provider_library_id)
    if (previous) await provider.deleteVirtualLibrary(apiKey, previous.name)
    logger.info({ userId, oldName: dbRecord.name, newName: libraryName }, 'Series library name changed, clearing old record')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND media_type = 'series'
       AND series_group_id IS NOT DISTINCT FROM $2::uuid`,
      [userId, groupId]
    )
  }

  if (existingLib) {
    logger.info({ libraryName, libraryId: existingLib.id }, '📺 Series library exists in media server')

    // Ensure we have an up-to-date database record
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND media_type = 'series'
       AND series_group_id IS NOT DISTINCT FROM $2::uuid`,
      [userId, groupId]
    )
    await query(
      `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid, media_type, series_group_id)
       VALUES ($1, $2, $3, $4, $5, 'series', $6)`,
      [userId, existingLib.name, libraryPath, existingLib.id, existingLib.guid, groupId]
    )

    // Push global library image to this library
    await syncLibraryTypeImage('ai-recs-series', existingLib.id)

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
      `DELETE FROM strm_libraries WHERE user_id = $1 AND media_type = 'series'
       AND series_group_id IS NOT DISTINCT FROM $2::uuid`,
      [userId, groupId]
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
    `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid, media_type, series_group_id)
     VALUES ($1, $2, $3, $4, $5, 'series', $6)`,
    [userId, libraryName, libraryPath, result.libraryId, libraryGuid, groupId]
  )

  // Push global library image to this library
  await syncLibraryTypeImage('ai-recs-series', result.libraryId)

  logger.info({ userId, libraryName, libraryId: result.libraryId, libraryGuid }, '✅ Virtual TV library created')

  return { libraryId: result.libraryId, libraryGuid, created: true, name: libraryName }
}

/**
 * Refresh a user's AI TV library in the media server
 * Also hides library items from Continue Watching for all users
 */
export async function refreshUserSeriesLibrary(userId: string, groupId: string | null = null): Promise<void> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const library = await queryOne<{ provider_library_id: string }>(
    `SELECT provider_library_id FROM strm_libraries
     WHERE user_id = $1 AND media_type = 'series'
       AND series_group_id IS NOT DISTINCT FROM $2::uuid`,
    [userId, groupId]
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
  providerUserId: string,
  groupId: string | null = null
): Promise<void> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Get user's AI series library
  const library = await queryOne<{ provider_library_id: string; provider_library_guid: string }>(
    `SELECT provider_library_id, provider_library_guid FROM strm_libraries
     WHERE user_id = $1 AND media_type = 'series'
       AND series_group_id IS NOT DISTINCT FROM $2::uuid`,
    [userId, groupId]
  )

  if (!library?.provider_library_guid) {
    logger.warn({ userId }, 'No AI series library found for user')
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

  // Check if AI series library is already in the user's allowed list
  if (currentAccess.enabledFolders.includes(library.provider_library_guid)) {
    logger.debug({ userId }, 'AI series library already in user permissions')
    return
  }

  // Add the AI series library GUID to the user's existing permissions
  const updatedFolders = [...currentAccess.enabledFolders, library.provider_library_guid]

  await provider.updateUserLibraryAccess(apiKey, providerUserId, updatedFolders)
  logger.info({ userId, libraryGuid: library.provider_library_guid }, 'Added AI series library to user permissions')

  // Set sort preference for this library (DateCreated descending)
  if (library.provider_library_id) {
    await provider.setLibrarySortPreference(apiKey, providerUserId, library.provider_library_id)
  }
}

