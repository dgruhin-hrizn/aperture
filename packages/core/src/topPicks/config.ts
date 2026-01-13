/**
 * Top Picks Configuration Management
 * 
 * Manages the configuration for global Top Picks libraries
 * based on aggregated watch history from all users.
 */

import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('top-picks-config')

export type PopularitySource = 'local' | 'mdblist' | 'hybrid'

export interface TopPicksConfig {
  isEnabled: boolean
  // Movies-specific settings
  moviesPopularitySource: PopularitySource
  moviesTimeWindowDays: number
  moviesMinUniqueViewers: number
  moviesUseAllMatches: boolean
  moviesCount: number
  // Series-specific settings
  seriesPopularitySource: PopularitySource
  seriesTimeWindowDays: number
  seriesMinUniqueViewers: number
  seriesUseAllMatches: boolean
  seriesCount: number
  // Popularity weights (should sum to 1.0) - shared for Local/Hybrid calculations
  uniqueViewersWeight: number
  playCountWeight: number
  completionWeight: number
  // Refresh schedule
  refreshCron: string
  lastRefreshedAt: Date | null
  // Library names
  moviesLibraryName: string
  seriesLibraryName: string
  // Output format settings (separate for movies and series)
  moviesUseSymlinks: boolean
  seriesUseSymlinks: boolean
  // Movies output modes
  moviesLibraryEnabled: boolean
  moviesCollectionEnabled: boolean
  moviesPlaylistEnabled: boolean
  // Series output modes
  seriesLibraryEnabled: boolean
  seriesCollectionEnabled: boolean
  seriesPlaylistEnabled: boolean
  // Collection/Playlist names
  moviesCollectionName: string
  seriesCollectionName: string
  // MDBList list selections (used when source is mdblist or hybrid)
  mdblistMoviesListId: number | null
  mdblistSeriesListId: number | null
  mdblistMoviesListName: string | null
  mdblistSeriesListName: string | null
  // MDBList sort order (score, score_average, imdbrating, imdbvotes, imdbpopular, tmdbpopular, rtomatoes, metacritic)
  mdblistMoviesSort: string
  mdblistSeriesSort: string
  // Hybrid mode weights
  hybridLocalWeight: number
  hybridMdblistWeight: number
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

interface TopPicksConfigRow {
  id: number
  is_enabled: boolean
  // Movies-specific settings
  movies_popularity_source: string | null
  movies_time_window_days: number
  movies_min_unique_viewers: number
  movies_use_all_matches: boolean
  movies_count: number
  // Series-specific settings
  series_popularity_source: string | null
  series_time_window_days: number
  series_min_unique_viewers: number
  series_use_all_matches: boolean
  series_count: number
  // Shared weights
  unique_viewers_weight: string
  play_count_weight: string
  completion_weight: string
  refresh_cron: string
  last_refreshed_at: Date | null
  movies_library_name: string
  series_library_name: string
  // Output format settings
  movies_use_symlinks: boolean
  series_use_symlinks: boolean
  // Movies output modes
  movies_library_enabled: boolean
  movies_collection_enabled: boolean
  movies_playlist_enabled: boolean
  // Series output modes
  series_library_enabled: boolean
  series_collection_enabled: boolean
  series_playlist_enabled: boolean
  // Collection/Playlist names
  movies_collection_name: string
  series_collection_name: string
  // MDBList list selections
  mdblist_movies_list_id: number | null
  mdblist_series_list_id: number | null
  mdblist_movies_list_name: string | null
  mdblist_series_list_name: string | null
  mdblist_movies_sort: string | null
  mdblist_series_sort: string | null
  hybrid_local_weight: string | null
  hybrid_mdblist_weight: string | null
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
      // Movies-specific defaults
      moviesPopularitySource: 'local' as PopularitySource,
      moviesTimeWindowDays: 30,
      moviesMinUniqueViewers: 2,
      moviesUseAllMatches: false,
      moviesCount: 10,
      // Series-specific defaults
      seriesPopularitySource: 'local' as PopularitySource,
      seriesTimeWindowDays: 30,
      seriesMinUniqueViewers: 2,
      seriesUseAllMatches: false,
      seriesCount: 10,
      // Shared weights
      uniqueViewersWeight: 0.5,
      playCountWeight: 0.3,
      completionWeight: 0.2,
      refreshCron: '0 6 * * *',
      lastRefreshedAt: null,
      moviesLibraryName: 'Top Picks - Movies',
      seriesLibraryName: 'Top Picks - Series',
      moviesUseSymlinks: true,
      seriesUseSymlinks: true,
      moviesLibraryEnabled: true,
      moviesCollectionEnabled: false,
      moviesPlaylistEnabled: false,
      seriesLibraryEnabled: true,
      seriesCollectionEnabled: false,
      seriesPlaylistEnabled: false,
      moviesCollectionName: 'Top Picks - Movies',
      seriesCollectionName: 'Top Picks - Series',
      mdblistMoviesListId: null,
      mdblistSeriesListId: null,
      mdblistMoviesListName: null,
      mdblistSeriesListName: null,
      mdblistMoviesSort: 'score',
      mdblistSeriesSort: 'score',
      hybridLocalWeight: 0.5,
      hybridMdblistWeight: 0.5,
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
  // Movies-specific settings
  if (updates.moviesPopularitySource !== undefined) {
    setClauses.push(`movies_popularity_source = $${paramIndex++}`)
    values.push(updates.moviesPopularitySource)
  }
  if (updates.moviesTimeWindowDays !== undefined) {
    setClauses.push(`movies_time_window_days = $${paramIndex++}`)
    values.push(updates.moviesTimeWindowDays)
  }
  if (updates.moviesMinUniqueViewers !== undefined) {
    setClauses.push(`movies_min_unique_viewers = $${paramIndex++}`)
    values.push(updates.moviesMinUniqueViewers)
  }
  if (updates.moviesUseAllMatches !== undefined) {
    setClauses.push(`movies_use_all_matches = $${paramIndex++}`)
    values.push(updates.moviesUseAllMatches)
  }
  if (updates.moviesCount !== undefined) {
    setClauses.push(`movies_count = $${paramIndex++}`)
    values.push(updates.moviesCount)
  }
  // Series-specific settings
  if (updates.seriesPopularitySource !== undefined) {
    setClauses.push(`series_popularity_source = $${paramIndex++}`)
    values.push(updates.seriesPopularitySource)
  }
  if (updates.seriesTimeWindowDays !== undefined) {
    setClauses.push(`series_time_window_days = $${paramIndex++}`)
    values.push(updates.seriesTimeWindowDays)
  }
  if (updates.seriesMinUniqueViewers !== undefined) {
    setClauses.push(`series_min_unique_viewers = $${paramIndex++}`)
    values.push(updates.seriesMinUniqueViewers)
  }
  if (updates.seriesUseAllMatches !== undefined) {
    setClauses.push(`series_use_all_matches = $${paramIndex++}`)
    values.push(updates.seriesUseAllMatches)
  }
  if (updates.seriesCount !== undefined) {
    setClauses.push(`series_count = $${paramIndex++}`)
    values.push(updates.seriesCount)
  }
  // Shared weights
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
  if (updates.moviesUseSymlinks !== undefined) {
    setClauses.push(`movies_use_symlinks = $${paramIndex++}`)
    values.push(updates.moviesUseSymlinks)
  }
  if (updates.seriesUseSymlinks !== undefined) {
    setClauses.push(`series_use_symlinks = $${paramIndex++}`)
    values.push(updates.seriesUseSymlinks)
  }
  if (updates.moviesLibraryEnabled !== undefined) {
    setClauses.push(`movies_library_enabled = $${paramIndex++}`)
    values.push(updates.moviesLibraryEnabled)
  }
  if (updates.moviesCollectionEnabled !== undefined) {
    setClauses.push(`movies_collection_enabled = $${paramIndex++}`)
    values.push(updates.moviesCollectionEnabled)
  }
  if (updates.moviesPlaylistEnabled !== undefined) {
    setClauses.push(`movies_playlist_enabled = $${paramIndex++}`)
    values.push(updates.moviesPlaylistEnabled)
  }
  if (updates.seriesLibraryEnabled !== undefined) {
    setClauses.push(`series_library_enabled = $${paramIndex++}`)
    values.push(updates.seriesLibraryEnabled)
  }
  if (updates.seriesCollectionEnabled !== undefined) {
    setClauses.push(`series_collection_enabled = $${paramIndex++}`)
    values.push(updates.seriesCollectionEnabled)
  }
  if (updates.seriesPlaylistEnabled !== undefined) {
    setClauses.push(`series_playlist_enabled = $${paramIndex++}`)
    values.push(updates.seriesPlaylistEnabled)
  }
  if (updates.moviesCollectionName !== undefined) {
    setClauses.push(`movies_collection_name = $${paramIndex++}`)
    values.push(updates.moviesCollectionName)
  }
  if (updates.seriesCollectionName !== undefined) {
    setClauses.push(`series_collection_name = $${paramIndex++}`)
    values.push(updates.seriesCollectionName)
  }
  // MDBList list selections
  if (updates.mdblistMoviesListId !== undefined) {
    setClauses.push(`mdblist_movies_list_id = $${paramIndex++}`)
    values.push(updates.mdblistMoviesListId)
  }
  if (updates.mdblistSeriesListId !== undefined) {
    setClauses.push(`mdblist_series_list_id = $${paramIndex++}`)
    values.push(updates.mdblistSeriesListId)
  }
  if (updates.mdblistMoviesListName !== undefined) {
    setClauses.push(`mdblist_movies_list_name = $${paramIndex++}`)
    values.push(updates.mdblistMoviesListName)
  }
  if (updates.mdblistSeriesListName !== undefined) {
    setClauses.push(`mdblist_series_list_name = $${paramIndex++}`)
    values.push(updates.mdblistSeriesListName)
  }
  if (updates.mdblistMoviesSort !== undefined) {
    setClauses.push(`mdblist_movies_sort = $${paramIndex++}`)
    values.push(updates.mdblistMoviesSort)
  }
  if (updates.mdblistSeriesSort !== undefined) {
    setClauses.push(`mdblist_series_sort = $${paramIndex++}`)
    values.push(updates.mdblistSeriesSort)
  }
  if (updates.hybridLocalWeight !== undefined) {
    setClauses.push(`hybrid_local_weight = $${paramIndex++}`)
    values.push(updates.hybridLocalWeight)
  }
  if (updates.hybridMdblistWeight !== undefined) {
    setClauses.push(`hybrid_mdblist_weight = $${paramIndex++}`)
    values.push(updates.hybridMdblistWeight)
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
      -- Movies-specific settings
      movies_popularity_source = 'local',
      movies_time_window_days = 30,
      movies_min_unique_viewers = 2,
      movies_use_all_matches = false,
      movies_count = 10,
      -- Series-specific settings
      series_popularity_source = 'local',
      series_time_window_days = 30,
      series_min_unique_viewers = 2,
      series_use_all_matches = false,
      series_count = 10,
      -- Shared settings
      unique_viewers_weight = 0.50,
      play_count_weight = 0.30,
      completion_weight = 0.20,
      refresh_cron = '0 6 * * *',
      movies_library_name = 'Top Picks - Movies',
      series_library_name = 'Top Picks - Series',
      movies_use_symlinks = true,
      series_use_symlinks = true,
      movies_library_enabled = true,
      movies_collection_enabled = false,
      movies_playlist_enabled = false,
      series_library_enabled = true,
      series_collection_enabled = false,
      series_playlist_enabled = false,
      movies_collection_name = 'Top Picks - Movies',
      series_collection_name = 'Top Picks - Series',
      mdblist_movies_list_id = NULL,
      mdblist_series_list_id = NULL,
      mdblist_movies_list_name = NULL,
      mdblist_series_list_name = NULL,
      mdblist_movies_sort = 'score',
      mdblist_series_sort = 'score',
      hybrid_local_weight = 0.50,
      hybrid_mdblist_weight = 0.50,
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
  // Validate popularity sources
  const validSources: PopularitySource[] = ['local', 'mdblist', 'hybrid']
  const moviesPopularitySource = validSources.includes(row.movies_popularity_source as PopularitySource)
    ? (row.movies_popularity_source as PopularitySource)
    : 'local'
  const seriesPopularitySource = validSources.includes(row.series_popularity_source as PopularitySource)
    ? (row.series_popularity_source as PopularitySource)
    : 'local'

  return {
    isEnabled: row.is_enabled,
    // Movies-specific settings
    moviesPopularitySource,
    moviesTimeWindowDays: row.movies_time_window_days,
    moviesMinUniqueViewers: row.movies_min_unique_viewers,
    moviesUseAllMatches: row.movies_use_all_matches ?? false,
    moviesCount: row.movies_count,
    // Series-specific settings
    seriesPopularitySource,
    seriesTimeWindowDays: row.series_time_window_days,
    seriesMinUniqueViewers: row.series_min_unique_viewers,
    seriesUseAllMatches: row.series_use_all_matches ?? false,
    seriesCount: row.series_count,
    // Shared weights
    uniqueViewersWeight: parseFloat(row.unique_viewers_weight),
    playCountWeight: parseFloat(row.play_count_weight),
    completionWeight: parseFloat(row.completion_weight),
    refreshCron: row.refresh_cron,
    lastRefreshedAt: row.last_refreshed_at,
    moviesLibraryName: row.movies_library_name,
    seriesLibraryName: row.series_library_name,
    moviesUseSymlinks: row.movies_use_symlinks ?? true,
    seriesUseSymlinks: row.series_use_symlinks ?? true,
    moviesLibraryEnabled: row.movies_library_enabled,
    moviesCollectionEnabled: row.movies_collection_enabled,
    moviesPlaylistEnabled: row.movies_playlist_enabled,
    seriesLibraryEnabled: row.series_library_enabled,
    seriesCollectionEnabled: row.series_collection_enabled,
    seriesPlaylistEnabled: row.series_playlist_enabled,
    moviesCollectionName: row.movies_collection_name,
    seriesCollectionName: row.series_collection_name,
    mdblistMoviesListId: row.mdblist_movies_list_id,
    mdblistSeriesListId: row.mdblist_series_list_id,
    mdblistMoviesListName: row.mdblist_movies_list_name,
    mdblistSeriesListName: row.mdblist_series_list_name,
    mdblistMoviesSort: row.mdblist_movies_sort || 'score',
    mdblistSeriesSort: row.mdblist_series_sort || 'score',
    hybridLocalWeight: row.hybrid_local_weight ? parseFloat(row.hybrid_local_weight) : 0.5,
    hybridMdblistWeight: row.hybrid_mdblist_weight ? parseFloat(row.hybrid_mdblist_weight) : 0.5,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

