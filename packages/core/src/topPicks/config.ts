/**
 * Top Picks Configuration Management
 * 
 * Manages the configuration for global Top Picks libraries
 * based on aggregated watch history from all users.
 */

import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('top-picks-config')

export interface TopPicksConfig {
  isEnabled: boolean
  timeWindowDays: number
  moviesCount: number
  seriesCount: number
  // Popularity weights (should sum to 1.0)
  uniqueViewersWeight: number
  playCountWeight: number
  completionWeight: number
  // Refresh schedule
  refreshCron: string
  lastRefreshedAt: Date | null
  // Library names
  moviesLibraryName: string
  seriesLibraryName: string
  // Minimum viewers threshold
  minUniqueViewers: number
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

interface TopPicksConfigRow {
  id: number
  is_enabled: boolean
  time_window_days: number
  movies_count: number
  series_count: number
  unique_viewers_weight: string
  play_count_weight: string
  completion_weight: string
  refresh_cron: string
  last_refreshed_at: Date | null
  movies_library_name: string
  series_library_name: string
  min_unique_viewers: number
  created_at: Date
  updated_at: Date
}

/**
 * Get current Top Picks configuration
 */
export async function getTopPicksConfig(): Promise<TopPicksConfig> {
  const row = await queryOne<TopPicksConfigRow>(`
    SELECT * FROM top_picks_config WHERE id = 1
  `)

  if (!row) {
    // Return defaults if no config exists
    return {
      isEnabled: false,
      timeWindowDays: 30,
      moviesCount: 10,
      seriesCount: 10,
      uniqueViewersWeight: 0.5,
      playCountWeight: 0.3,
      completionWeight: 0.2,
      refreshCron: '0 6 * * *',
      lastRefreshedAt: null,
      moviesLibraryName: 'Top Picks - Movies',
      seriesLibraryName: 'Top Picks - Series',
      minUniqueViewers: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  return mapRowToConfig(row)
}

/**
 * Update Top Picks configuration
 */
export async function updateTopPicksConfig(
  updates: Partial<Omit<TopPicksConfig, 'createdAt' | 'updatedAt' | 'lastRefreshedAt'>>
): Promise<TopPicksConfig> {
  logger.info({ updates }, 'Updating Top Picks config')

  const setClauses: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (updates.isEnabled !== undefined) {
    setClauses.push(`is_enabled = $${paramIndex++}`)
    values.push(updates.isEnabled)
  }
  if (updates.timeWindowDays !== undefined) {
    setClauses.push(`time_window_days = $${paramIndex++}`)
    values.push(updates.timeWindowDays)
  }
  if (updates.moviesCount !== undefined) {
    setClauses.push(`movies_count = $${paramIndex++}`)
    values.push(updates.moviesCount)
  }
  if (updates.seriesCount !== undefined) {
    setClauses.push(`series_count = $${paramIndex++}`)
    values.push(updates.seriesCount)
  }
  if (updates.uniqueViewersWeight !== undefined) {
    setClauses.push(`unique_viewers_weight = $${paramIndex++}`)
    values.push(updates.uniqueViewersWeight)
  }
  if (updates.playCountWeight !== undefined) {
    setClauses.push(`play_count_weight = $${paramIndex++}`)
    values.push(updates.playCountWeight)
  }
  if (updates.completionWeight !== undefined) {
    setClauses.push(`completion_weight = $${paramIndex++}`)
    values.push(updates.completionWeight)
  }
  if (updates.refreshCron !== undefined) {
    setClauses.push(`refresh_cron = $${paramIndex++}`)
    values.push(updates.refreshCron)
  }
  if (updates.moviesLibraryName !== undefined) {
    setClauses.push(`movies_library_name = $${paramIndex++}`)
    values.push(updates.moviesLibraryName)
  }
  if (updates.seriesLibraryName !== undefined) {
    setClauses.push(`series_library_name = $${paramIndex++}`)
    values.push(updates.seriesLibraryName)
  }
  if (updates.minUniqueViewers !== undefined) {
    setClauses.push(`min_unique_viewers = $${paramIndex++}`)
    values.push(updates.minUniqueViewers)
  }

  if (setClauses.length === 0) {
    return getTopPicksConfig()
  }

  setClauses.push('updated_at = NOW()')

  const result = await queryOne<TopPicksConfigRow>(`
    UPDATE top_picks_config
    SET ${setClauses.join(', ')}
    WHERE id = 1
    RETURNING *
  `, values)

  if (!result) {
    throw new Error('Failed to update Top Picks config')
  }

  logger.info('Top Picks config updated successfully')
  return mapRowToConfig(result)
}

/**
 * Update the last refreshed timestamp
 */
export async function updateTopPicksLastRefreshed(): Promise<void> {
  await query(`
    UPDATE top_picks_config
    SET last_refreshed_at = NOW(), updated_at = NOW()
    WHERE id = 1
  `)
  logger.info('Top Picks last_refreshed_at updated')
}

/**
 * Reset Top Picks configuration to defaults
 */
export async function resetTopPicksConfig(): Promise<TopPicksConfig> {
  logger.info('Resetting Top Picks config to defaults')

  const result = await queryOne<TopPicksConfigRow>(`
    UPDATE top_picks_config
    SET
      is_enabled = false,
      time_window_days = 30,
      movies_count = 10,
      series_count = 10,
      unique_viewers_weight = 0.50,
      play_count_weight = 0.30,
      completion_weight = 0.20,
      refresh_cron = '0 6 * * *',
      movies_library_name = 'Top Picks - Movies',
      series_library_name = 'Top Picks - Series',
      min_unique_viewers = 2,
      updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `)

  if (!result) {
    throw new Error('Failed to reset Top Picks config')
  }

  return mapRowToConfig(result)
}

function mapRowToConfig(row: TopPicksConfigRow): TopPicksConfig {
  return {
    isEnabled: row.is_enabled,
    timeWindowDays: row.time_window_days,
    moviesCount: row.movies_count,
    seriesCount: row.series_count,
    uniqueViewersWeight: parseFloat(row.unique_viewers_weight),
    playCountWeight: parseFloat(row.play_count_weight),
    completionWeight: parseFloat(row.completion_weight),
    refreshCron: row.refresh_cron,
    lastRefreshedAt: row.last_refreshed_at,
    moviesLibraryName: row.movies_library_name,
    seriesLibraryName: row.series_library_name,
    minUniqueViewers: row.min_unique_viewers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

