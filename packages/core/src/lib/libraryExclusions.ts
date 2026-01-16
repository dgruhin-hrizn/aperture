/**
 * Library Exclusions Module
 *
 * Allows users to exclude specific libraries from their watch history analysis,
 * preventing content from those libraries (e.g., "Kids Movies") from affecting
 * their taste profile, recommendations, and watcher identity.
 */

import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'

const logger = createChildLogger('library-exclusions')

export interface AccessibleLibrary {
  id: string
  name: string
  collectionType: string | null
  isExcluded: boolean
}

interface SettingsRow {
  settings: Record<string, unknown>
}

/**
 * Get the list of library IDs that a user has excluded from watch history
 */
export async function getUserExcludedLibraries(userId: string): Promise<string[]> {
  const result = await queryOne<SettingsRow>(
    `SELECT settings FROM user_preferences WHERE user_id = $1`,
    [userId]
  )

  if (!result?.settings) {
    return []
  }

  const excludedIds = result.settings.excludedLibraryIds
  if (Array.isArray(excludedIds)) {
    return excludedIds.filter((id): id is string => typeof id === 'string')
  }

  return []
}

/**
 * Set the list of library IDs that a user wants to exclude from watch history
 */
export async function setUserExcludedLibraries(
  userId: string,
  excludedLibraryIds: string[]
): Promise<void> {
  logger.info({ userId, excludedCount: excludedLibraryIds.length }, 'Setting excluded libraries')

  // Ensure user_preferences record exists and update settings
  await query(
    `INSERT INTO user_preferences (user_id, settings)
     VALUES ($1, jsonb_build_object('excludedLibraryIds', $2::jsonb))
     ON CONFLICT (user_id) DO UPDATE SET
       settings = COALESCE(user_preferences.settings, '{}'::jsonb) || 
                  jsonb_build_object('excludedLibraryIds', $2::jsonb),
       updated_at = NOW()`,
    [userId, JSON.stringify(excludedLibraryIds)]
  )
}

/**
 * Get all libraries accessible to a user, excluding Aperture-created ones
 * Returns libraries from library_config that are not in strm_libraries
 */
export async function getUserAccessibleLibraries(userId: string): Promise<AccessibleLibrary[]> {
  // Get user's excluded library IDs
  const excludedIds = await getUserExcludedLibraries(userId)
  const excludedSet = new Set(excludedIds)

  // Get all libraries from library_config, excluding Aperture-created ones
  const result = await query<{
    provider_library_id: string
    name: string
    collection_type: string
  }>(
    `SELECT lc.provider_library_id, lc.name, lc.collection_type
     FROM library_config lc
     WHERE lc.provider_library_id NOT IN (
       SELECT DISTINCT provider_library_id 
       FROM strm_libraries 
       WHERE provider_library_id IS NOT NULL
     )
     AND lc.name NOT LIKE '%AI Picks%'
     AND lc.name NOT LIKE '%Top Picks%'
     AND lc.name NOT LIKE '%Aperture Picks%'
     ORDER BY lc.name ASC`
  )

  return result.rows.map((row) => ({
    id: row.provider_library_id,
    name: row.name,
    collectionType: row.collection_type,
    isExcluded: excludedSet.has(row.provider_library_id),
  }))
}

/**
 * Check if a specific library is excluded for a user
 */
export async function isLibraryExcluded(userId: string, libraryId: string): Promise<boolean> {
  const excluded = await getUserExcludedLibraries(userId)
  return excluded.includes(libraryId)
}

/**
 * Get IDs of all Aperture-created libraries (AI Picks, Top Picks, etc.)
 * These are automatically excluded from the accessible libraries list
 */
export async function getApertureLibraryIds(): Promise<string[]> {
  const result = await query<{ provider_library_id: string }>(
    `SELECT DISTINCT provider_library_id 
     FROM strm_libraries 
     WHERE provider_library_id IS NOT NULL`
  )

  return result.rows.map((row) => row.provider_library_id)
}

/**
 * Toggle a library's exclusion status
 */
export async function toggleLibraryExclusion(
  userId: string,
  libraryId: string,
  exclude: boolean
): Promise<void> {
  const currentExcluded = await getUserExcludedLibraries(userId)

  let newExcluded: string[]
  if (exclude) {
    // Add to exclusion list if not already there
    newExcluded = currentExcluded.includes(libraryId)
      ? currentExcluded
      : [...currentExcluded, libraryId]
  } else {
    // Remove from exclusion list
    newExcluded = currentExcluded.filter((id) => id !== libraryId)
  }

  await setUserExcludedLibraries(userId, newExcluded)
}

