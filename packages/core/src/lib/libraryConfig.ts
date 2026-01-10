import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'

const logger = createChildLogger('library-config')

export interface LibraryConfig {
  id: string
  providerLibraryId: string
  name: string
  collectionType: string
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

interface LibraryConfigRow {
  id: string
  provider_library_id: string
  name: string
  collection_type: string
  is_enabled: boolean
  created_at: Date
  updated_at: Date
}

/**
 * Get all library configurations
 * Optionally exclude Aperture-created libraries (tracked in strm_libraries table)
 */
export async function getLibraryConfigs(excludeApertureLibraries = false): Promise<LibraryConfig[]> {
  let sql = 'SELECT * FROM library_config'
  
  if (excludeApertureLibraries) {
    // Exclude all Aperture-created libraries:
    // 1. By provider_library_id (tracked in strm_libraries)
    // 2. By name pattern (fallback for libraries created before ID tracking)
    sql += ` WHERE provider_library_id NOT IN (
        SELECT DISTINCT provider_library_id FROM strm_libraries WHERE provider_library_id IS NOT NULL
      )
      AND name NOT LIKE '%AI Picks%'
      AND name NOT LIKE '%Top Picks%'
      AND name NOT LIKE '%Aperture Picks%'`
  }
  
  sql += ' ORDER BY name ASC'
  
  const result = await query<LibraryConfigRow>(sql)
  return result.rows.map(mapRowToConfig)
}

/**
 * Get only enabled library configurations
 */
export async function getEnabledLibraryConfigs(): Promise<LibraryConfig[]> {
  const result = await query<LibraryConfigRow>(
    'SELECT * FROM library_config WHERE is_enabled = true ORDER BY name ASC'
  )

  return result.rows.map(mapRowToConfig)
}

/**
 * Get enabled library IDs for use in sync operations (movies only)
 * Returns null if no libraries are configured (meaning "use all")
 */
export async function getEnabledLibraryIds(): Promise<string[] | null> {
  const result = await query<{ provider_library_id: string }>(
    "SELECT provider_library_id FROM library_config WHERE is_enabled = true AND collection_type = 'movies'"
  )

  // If no libraries are configured, return null (use all libraries)
  if (result.rows.length === 0) {
    // Check if there are ANY movie library configs
    const totalCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*) FROM library_config WHERE collection_type = 'movies'"
    )
    
    if (!totalCount || parseInt(totalCount.count, 10) === 0) {
      // No movie libraries configured at all - use all libraries
      return null
    }
    
    // Libraries exist but none are enabled - return empty array (sync nothing)
    return []
  }

  return result.rows.map((r) => r.provider_library_id)
}

/**
 * Get enabled TV library IDs for use in sync operations
 * Returns null if no TV libraries are configured (meaning "use all")
 */
export async function getEnabledTvLibraryIds(): Promise<string[] | null> {
  const result = await query<{ provider_library_id: string }>(
    "SELECT provider_library_id FROM library_config WHERE is_enabled = true AND collection_type = 'tvshows'"
  )

  // If no libraries are configured, return null (use all TV libraries)
  if (result.rows.length === 0) {
    // Check if there are ANY TV library configs
    const totalCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*) FROM library_config WHERE collection_type = 'tvshows'"
    )
    
    if (!totalCount || parseInt(totalCount.count, 10) === 0) {
      // No TV libraries configured at all - use all TV libraries
      return null
    }
    
    // Libraries exist but none are enabled - return empty array (sync nothing)
    return []
  }

  return result.rows.map((r) => r.provider_library_id)
}

/**
 * Upsert a library configuration
 */
export async function upsertLibraryConfig(
  providerLibraryId: string,
  name: string,
  collectionType: string,
  isEnabled: boolean
): Promise<LibraryConfig> {
  const result = await queryOne<LibraryConfigRow>(
    `INSERT INTO library_config (provider_library_id, name, collection_type, is_enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider_library_id) DO UPDATE SET
       name = EXCLUDED.name,
       collection_type = EXCLUDED.collection_type,
       is_enabled = EXCLUDED.is_enabled,
       updated_at = NOW()
     RETURNING *`,
    [providerLibraryId, name, collectionType, isEnabled]
  )

  if (!result) {
    throw new Error('Failed to upsert library config')
  }

  logger.info(
    { providerLibraryId, name, isEnabled },
    'Library config upserted'
  )

  return mapRowToConfig(result)
}

/**
 * Set enabled status for a library
 */
export async function setLibraryEnabled(
  providerLibraryId: string,
  isEnabled: boolean
): Promise<LibraryConfig | null> {
  const result = await queryOne<LibraryConfigRow>(
    `UPDATE library_config 
     SET is_enabled = $2, updated_at = NOW()
     WHERE provider_library_id = $1
     RETURNING *`,
    [providerLibraryId, isEnabled]
  )

  if (!result) {
    return null
  }

  logger.info(
    { providerLibraryId, isEnabled },
    'Library enabled status updated'
  )

  return mapRowToConfig(result)
}

/**
 * Sync library configs from media server
 * This creates entries for any new libraries and updates names
 * but preserves existing enabled/disabled status
 */
export async function syncLibraryConfigsFromProvider(
  libraries: Array<{ id: string; name: string; collectionType: string }>
): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0

  for (const lib of libraries) {
    const existing = await queryOne<LibraryConfigRow>(
      'SELECT * FROM library_config WHERE provider_library_id = $1',
      [lib.id]
    )

    if (existing) {
      // Update name if changed
      if (existing.name !== lib.name) {
        await query(
          `UPDATE library_config SET name = $2, updated_at = NOW() WHERE provider_library_id = $1`,
          [lib.id, lib.name]
        )
        updated++
      }
    } else {
      // Create new entry - default to disabled
      await query(
        `INSERT INTO library_config (provider_library_id, name, collection_type, is_enabled)
         VALUES ($1, $2, $3, false)`,
        [lib.id, lib.name, lib.collectionType]
      )
      added++
    }
  }

  logger.info({ added, updated }, 'Library configs synced from provider')
  return { added, updated }
}

function mapRowToConfig(row: LibraryConfigRow): LibraryConfig {
  return {
    id: row.id,
    providerLibraryId: row.provider_library_id,
    name: row.name,
    collectionType: row.collection_type,
    isEnabled: row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

