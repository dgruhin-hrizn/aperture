/**
 * User Settings Management
 * 
 * Per-user settings and preferences including custom library names.
 */

import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'

const logger = createChildLogger('user-settings')

export interface UserSettings {
  userId: string
  libraryName: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Get user settings, creating default if not exists
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  // Try to get existing settings
  let settings = await queryOne<{
    user_id: string
    library_name: string | null
    created_at: Date
    updated_at: Date
  }>(
    `SELECT user_id, library_name, created_at, updated_at
     FROM user_settings WHERE user_id = $1`,
    [userId]
  )

  // Create default settings if not exists
  if (!settings) {
    await query(
      `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [userId]
    )
    settings = await queryOne<{
      user_id: string
      library_name: string | null
      created_at: Date
      updated_at: Date
    }>(
      `SELECT user_id, library_name, created_at, updated_at
       FROM user_settings WHERE user_id = $1`,
      [userId]
    )
  }

  if (!settings) {
    // This shouldn't happen, but return defaults just in case
    return {
      userId,
      libraryName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  return {
    userId: settings.user_id,
    libraryName: settings.library_name,
    createdAt: settings.created_at,
    updatedAt: settings.updated_at,
  }
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  updates: { libraryName?: string | null }
): Promise<UserSettings> {
  // Ensure settings row exists
  await query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [userId]
  )

  // Update fields that were provided
  if (updates.libraryName !== undefined) {
    await query(
      `UPDATE user_settings SET library_name = $1, updated_at = NOW() WHERE user_id = $2`,
      [updates.libraryName || null, userId]
    )
    logger.info({ userId, libraryName: updates.libraryName }, 'Updated user library name')
  }

  return getUserSettings(userId)
}

/**
 * Get the default library name prefix from config
 */
export function getDefaultLibraryNamePrefix(): string {
  return process.env.AI_LIBRARY_NAME_PREFIX || 'AI Picks - '
}

