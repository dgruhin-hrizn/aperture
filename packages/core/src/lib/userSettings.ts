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
  seriesLibraryName: string | null
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
    series_library_name: string | null
    created_at: Date
    updated_at: Date
  }>(
    `SELECT user_id, library_name, series_library_name, created_at, updated_at
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
      series_library_name: string | null
      created_at: Date
      updated_at: Date
    }>(
      `SELECT user_id, library_name, series_library_name, created_at, updated_at
       FROM user_settings WHERE user_id = $1`,
      [userId]
    )
  }

  if (!settings) {
    // This shouldn't happen, but return defaults just in case
    return {
      userId,
      libraryName: null,
      seriesLibraryName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  return {
    userId: settings.user_id,
    libraryName: settings.library_name,
    seriesLibraryName: settings.series_library_name,
    createdAt: settings.created_at,
    updatedAt: settings.updated_at,
  }
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  updates: { libraryName?: string | null; seriesLibraryName?: string | null }
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

  if (updates.seriesLibraryName !== undefined) {
    await query(
      `UPDATE user_settings SET series_library_name = $1, updated_at = NOW() WHERE user_id = $2`,
      [updates.seriesLibraryName || null, userId]
    )
    logger.info({ userId, seriesLibraryName: updates.seriesLibraryName }, 'Updated user series library name')
  }

  return getUserSettings(userId)
}

/**
 * Get the default library name prefix from config
 */
export function getDefaultLibraryNamePrefix(): string {
  return process.env.AI_LIBRARY_NAME_PREFIX || 'AI Picks - '
}

// ============================================================================
// AI Explanation Settings (Per-User)
// ============================================================================

export interface UserAiExplanationSettings {
  overrideAllowed: boolean
  enabled: boolean | null // null means use global default
}

/**
 * Get a user's AI explanation settings
 */
export async function getUserAiExplanationSettings(userId: string): Promise<UserAiExplanationSettings> {
  const row = await queryOne<{
    ai_explanation_override_allowed: boolean
    ai_explanation_enabled: boolean | null
  }>(
    `SELECT ai_explanation_override_allowed, ai_explanation_enabled FROM users WHERE id = $1`,
    [userId]
  )

  return {
    overrideAllowed: row?.ai_explanation_override_allowed ?? false,
    enabled: row?.ai_explanation_enabled ?? null,
  }
}

/**
 * Update a user's AI explanation settings (admin only - sets override_allowed)
 */
export async function setUserAiExplanationOverride(
  userId: string,
  overrideAllowed: boolean
): Promise<void> {
  await query(
    `UPDATE users SET ai_explanation_override_allowed = $1, updated_at = NOW() WHERE id = $2`,
    [overrideAllowed, userId]
  )
  logger.info({ userId, overrideAllowed }, 'Updated user AI explanation override setting')
}

/**
 * Update a user's AI explanation preference (user choice, only works if override is allowed)
 */
export async function setUserAiExplanationPreference(
  userId: string,
  enabled: boolean | null
): Promise<void> {
  // First check if override is allowed for this user
  const settings = await getUserAiExplanationSettings(userId)
  if (!settings.overrideAllowed) {
    throw new Error('AI explanation override not allowed for this user')
  }

  await query(
    `UPDATE users SET ai_explanation_enabled = $1, updated_at = NOW() WHERE id = $2`,
    [enabled, userId]
  )
  logger.info({ userId, enabled }, 'Updated user AI explanation preference')
}

/**
 * Get effective AI explanation setting for a user
 * Three-tier logic: Global default -> Admin grants override -> User chooses
 */
export async function getEffectiveAiExplanationSetting(userId: string): Promise<boolean> {
  // Import here to avoid circular dependency
  const { getAiExplanationConfig } = await import('../settings/systemSettings.js')
  
  // Get global config
  const globalConfig = await getAiExplanationConfig()
  
  // If global override is not allowed, use global setting
  if (!globalConfig.userOverrideAllowed) {
    return globalConfig.enabled
  }
  
  // Check if this user has override permission
  const userSettings = await getUserAiExplanationSettings(userId)
  
  // If user doesn't have override permission, use global
  if (!userSettings.overrideAllowed) {
    return globalConfig.enabled
  }
  
  // User has override permission - use their preference if set, otherwise global
  if (userSettings.enabled !== null) {
    return userSettings.enabled
  }
  
  return globalConfig.enabled
}

