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
 */
export async function getLibraryConfigs(): Promise<LibraryConfig[]> {
  const result = await query<LibraryConfigRow>(
    'SELECT * FROM library_config ORDER BY name ASC'
  )

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
 * Get enabled library IDs for use in sync operations
 * Returns null if no libraries are configured (meaning "use all")
 */
export async function getEnabledLibraryIds(): Promise<string[] | null> {
  const result = await query<{ provider_library_id: string }>(
    'SELECT provider_library_id FROM library_config WHERE is_enabled = true'
  )

  // If no libraries are configured, return null (use all libraries)
  if (result.rows.length === 0) {
    // Check if there are ANY library configs
    const totalCount = await queryOne<{ count: string }>(
      'SELECT COUNT(*) FROM library_config'
    )
    
    if (!totalCount || parseInt(totalCount.count, 10) === 0) {
      // No libraries configured at all - use all libraries
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

