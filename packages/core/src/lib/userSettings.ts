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
  settingsJson: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type ViewMode = 'grid' | 'list'

export interface PageViewModes {
  discovery?: ViewMode
  topPicks?: ViewMode
  watchHistory?: ViewMode
  watching?: ViewMode
  browse?: ViewMode
  recommendations?: ViewMode
}

export interface UserUiPreferences {
  sidebarCollapsed?: boolean
  viewModes?: PageViewModes
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
    settings_json: Record<string, unknown>
    created_at: Date
    updated_at: Date
  }>(
    `SELECT user_id, library_name, series_library_name, settings_json, created_at, updated_at
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
      settings_json: Record<string, unknown>
      created_at: Date
      updated_at: Date
    }>(
      `SELECT user_id, library_name, series_library_name, settings_json, created_at, updated_at
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
      settingsJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  return {
    userId: settings.user_id,
    libraryName: settings.library_name,
    seriesLibraryName: settings.series_library_name,
    settingsJson: settings.settings_json || {},
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

// ============================================================================
// Library Title Template Processing
// ============================================================================

export interface TitleTemplateContext {
  username: string
  type: 'Movies' | 'TV Series'
  count?: number
  date?: string
}

/**
 * Process a library title template by replacing merge tags with actual values
 * 
 * Supported tags:
 * - {{username}} - User's display name
 * - {{type}} - Media type ('Movies' or 'TV Series')
 * - {{count}} - Number of recommendations (optional)
 * - {{date}} - Date of last recommendation run (optional)
 */
export function processLibraryTitle(template: string, context: TitleTemplateContext): string {
  return template
    .replace(/\{\{username\}\}/gi, context.username)
    .replace(/\{\{type\}\}/gi, context.type)
    .replace(/\{\{count\}\}/gi, context.count !== undefined ? String(context.count) : '')
    .replace(/\{\{date\}\}/gi, context.date || '')
    // Clean up any leftover empty segments (e.g., "Title -  " becomes "Title")
    .replace(/\s+-\s*$/g, '')
    .replace(/\s+\(\s*\)/g, '')
    .trim()
}

/**
 * Get the effective library title for a user
 * 
 * Priority:
 * 1. User's custom library name (if set)
 * 2. Global template with merge tags replaced
 */
export async function getEffectiveLibraryTitle(
  userId: string,
  displayName: string,
  mediaType: 'movies' | 'series',
  count?: number
): Promise<string> {
  // Check for user's custom library name
  const settings = await getUserSettings(userId)
  
  if (mediaType === 'movies' && settings.libraryName) {
    return settings.libraryName
  }
  
  if (mediaType === 'series' && settings.seriesLibraryName) {
    return settings.seriesLibraryName
  }
  
  // Use global template
  const { getLibraryTitleConfig } = await import('../settings/systemSettings.js')
  const titleConfig = await getLibraryTitleConfig()
  
  const template = mediaType === 'movies' 
    ? titleConfig.moviesTemplate 
    : titleConfig.seriesTemplate
  
  const context: TitleTemplateContext = {
    username: displayName,
    type: mediaType === 'movies' ? 'Movies' : 'TV Series',
    count,
    date: new Date().toISOString().split('T')[0],
  }
  
  return processLibraryTitle(template, context)
}

// ============================================================================
// UI Preferences (stored in settings_json)
// ============================================================================

/**
 * Get user UI preferences from settings_json
 */
export async function getUserUiPreferences(userId: string): Promise<UserUiPreferences> {
  const settings = await getUserSettings(userId)
  return (settings.settingsJson?.ui as UserUiPreferences) || {}
}

/**
 * Update user UI preferences (merges with existing preferences)
 */
export async function updateUserUiPreferences(
  userId: string,
  preferences: Partial<UserUiPreferences>
): Promise<UserUiPreferences> {
  // Ensure settings row exists
  await query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [userId]
  )

  // Get current settings_json
  const settings = await getUserSettings(userId)
  const currentUi = (settings.settingsJson?.ui as UserUiPreferences) || {}
  
  // Merge new preferences
  const updatedUi = { ...currentUi, ...preferences }
  const updatedSettingsJson = { ...settings.settingsJson, ui: updatedUi }

  // Update the settings_json column
  await query(
    `UPDATE user_settings SET settings_json = $1, updated_at = NOW() WHERE user_id = $2`,
    [JSON.stringify(updatedSettingsJson), userId]
  )

  logger.info({ userId, preferences }, 'Updated user UI preferences')
  return updatedUi
}

