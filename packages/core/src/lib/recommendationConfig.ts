import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'

const logger = createChildLogger('recommendation-config')

export interface MediaTypeConfig {
  maxCandidates: number
  selectedCount: number
  recentWatchLimit: number
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
}

export interface RecommendationConfig {
  movie: MediaTypeConfig
  series: MediaTypeConfig
  updatedAt: Date
}

// Legacy interface for backward compatibility
export interface LegacyRecommendationConfig {
  maxCandidates: number
  selectedCount: number
  recentWatchLimit: number
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
  updatedAt: Date
}

interface RecommendationConfigRow {
  movie_max_candidates: number
  movie_selected_count: number
  movie_recent_watch_limit: number
  movie_similarity_weight: string
  movie_novelty_weight: string
  movie_rating_weight: string
  movie_diversity_weight: string
  series_max_candidates: number
  series_selected_count: number
  series_recent_watch_limit: number
  series_similarity_weight: string
  series_novelty_weight: string
  series_rating_weight: string
  series_diversity_weight: string
  updated_at: Date
}

// Default values
const MOVIE_DEFAULTS: MediaTypeConfig = {
  maxCandidates: 50000,
  selectedCount: 50,
  recentWatchLimit: 50,
  similarityWeight: 0.4,
  noveltyWeight: 0.2,
  ratingWeight: 0.2,
  diversityWeight: 0.2,
}

const SERIES_DEFAULTS: MediaTypeConfig = {
  maxCandidates: 50000,
  selectedCount: 12,
  recentWatchLimit: 100,
  similarityWeight: 0.4,
  noveltyWeight: 0.2,
  ratingWeight: 0.2,
  diversityWeight: 0.2,
}

/**
 * Get the full recommendation configuration (movies and series)
 */
export async function getRecommendationConfig(): Promise<RecommendationConfig> {
  const row = await queryOne<RecommendationConfigRow>(
    `SELECT 
      movie_max_candidates, movie_selected_count, movie_recent_watch_limit,
      movie_similarity_weight, movie_novelty_weight, movie_rating_weight, movie_diversity_weight,
      series_max_candidates, series_selected_count, series_recent_watch_limit,
      series_similarity_weight, series_novelty_weight, series_rating_weight, series_diversity_weight,
      updated_at
     FROM recommendation_config WHERE id = 1`
  )

  if (!row) {
    logger.warn('No recommendation config found, using defaults')
    return {
      movie: MOVIE_DEFAULTS,
      series: SERIES_DEFAULTS,
      updatedAt: new Date(),
    }
  }

  return {
    movie: {
      maxCandidates: row.movie_max_candidates,
      selectedCount: row.movie_selected_count,
      recentWatchLimit: row.movie_recent_watch_limit,
      similarityWeight: parseFloat(row.movie_similarity_weight),
      noveltyWeight: parseFloat(row.movie_novelty_weight),
      ratingWeight: parseFloat(row.movie_rating_weight),
      diversityWeight: parseFloat(row.movie_diversity_weight),
    },
    series: {
      maxCandidates: row.series_max_candidates,
      selectedCount: row.series_selected_count,
      recentWatchLimit: row.series_recent_watch_limit,
      similarityWeight: parseFloat(row.series_similarity_weight),
      noveltyWeight: parseFloat(row.series_novelty_weight),
      ratingWeight: parseFloat(row.series_rating_weight),
      diversityWeight: parseFloat(row.series_diversity_weight),
    },
    updatedAt: row.updated_at,
  }
}

/**
 * Get movie-only configuration (for backward compatibility)
 */
export async function getMovieRecommendationConfig(): Promise<LegacyRecommendationConfig> {
  const config = await getRecommendationConfig()
  return {
    ...config.movie,
    updatedAt: config.updatedAt,
  }
}

/**
 * Get series-only configuration
 */
export async function getSeriesRecommendationConfig(): Promise<LegacyRecommendationConfig> {
  const config = await getRecommendationConfig()
  return {
    ...config.series,
    updatedAt: config.updatedAt,
  }
}

/**
 * Update movie recommendation configuration
 */
export async function updateMovieRecommendationConfig(
  updates: Partial<MediaTypeConfig>
): Promise<RecommendationConfig> {
  const setClauses: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (updates.maxCandidates !== undefined) {
    setClauses.push(`movie_max_candidates = $${paramIndex++}`)
    values.push(updates.maxCandidates)
  }
  if (updates.selectedCount !== undefined) {
    setClauses.push(`movie_selected_count = $${paramIndex++}`)
    values.push(updates.selectedCount)
  }
  if (updates.recentWatchLimit !== undefined) {
    setClauses.push(`movie_recent_watch_limit = $${paramIndex++}`)
    values.push(updates.recentWatchLimit)
  }
  if (updates.similarityWeight !== undefined) {
    setClauses.push(`movie_similarity_weight = $${paramIndex++}`)
    values.push(updates.similarityWeight)
  }
  if (updates.noveltyWeight !== undefined) {
    setClauses.push(`movie_novelty_weight = $${paramIndex++}`)
    values.push(updates.noveltyWeight)
  }
  if (updates.ratingWeight !== undefined) {
    setClauses.push(`movie_rating_weight = $${paramIndex++}`)
    values.push(updates.ratingWeight)
  }
  if (updates.diversityWeight !== undefined) {
    setClauses.push(`movie_diversity_weight = $${paramIndex++}`)
    values.push(updates.diversityWeight)
  }

  if (setClauses.length === 0) {
    return getRecommendationConfig()
  }

  await query(
    `UPDATE recommendation_config SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = 1`,
    values
  )

  logger.info({ updates }, 'Movie recommendation config updated')
  return getRecommendationConfig()
}

/**
 * Update series recommendation configuration
 */
export async function updateSeriesRecommendationConfig(
  updates: Partial<MediaTypeConfig>
): Promise<RecommendationConfig> {
  const setClauses: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (updates.maxCandidates !== undefined) {
    setClauses.push(`series_max_candidates = $${paramIndex++}`)
    values.push(updates.maxCandidates)
  }
  if (updates.selectedCount !== undefined) {
    setClauses.push(`series_selected_count = $${paramIndex++}`)
    values.push(updates.selectedCount)
  }
  if (updates.recentWatchLimit !== undefined) {
    setClauses.push(`series_recent_watch_limit = $${paramIndex++}`)
    values.push(updates.recentWatchLimit)
  }
  if (updates.similarityWeight !== undefined) {
    setClauses.push(`series_similarity_weight = $${paramIndex++}`)
    values.push(updates.similarityWeight)
  }
  if (updates.noveltyWeight !== undefined) {
    setClauses.push(`series_novelty_weight = $${paramIndex++}`)
    values.push(updates.noveltyWeight)
  }
  if (updates.ratingWeight !== undefined) {
    setClauses.push(`series_rating_weight = $${paramIndex++}`)
    values.push(updates.ratingWeight)
  }
  if (updates.diversityWeight !== undefined) {
    setClauses.push(`series_diversity_weight = $${paramIndex++}`)
    values.push(updates.diversityWeight)
  }

  if (setClauses.length === 0) {
    return getRecommendationConfig()
  }

  await query(
    `UPDATE recommendation_config SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = 1`,
    values
  )

  logger.info({ updates }, 'Series recommendation config updated')
  return getRecommendationConfig()
}

/**
 * Legacy update function - updates movie config
 * @deprecated Use updateMovieRecommendationConfig instead
 */
export async function updateRecommendationConfig(
  updates: Partial<MediaTypeConfig>
): Promise<LegacyRecommendationConfig> {
  const config = await updateMovieRecommendationConfig(updates)
  return {
    ...config.movie,
    updatedAt: config.updatedAt,
  }
}

/**
 * Reset movie configuration to defaults
 */
export async function resetMovieRecommendationConfig(): Promise<RecommendationConfig> {
  await query(
    `UPDATE recommendation_config SET
      movie_max_candidates = $1,
      movie_selected_count = $2,
      movie_recent_watch_limit = $3,
      movie_similarity_weight = $4,
      movie_novelty_weight = $5,
      movie_rating_weight = $6,
      movie_diversity_weight = $7,
      updated_at = NOW()
     WHERE id = 1`,
    [
      MOVIE_DEFAULTS.maxCandidates,
      MOVIE_DEFAULTS.selectedCount,
      MOVIE_DEFAULTS.recentWatchLimit,
      MOVIE_DEFAULTS.similarityWeight,
      MOVIE_DEFAULTS.noveltyWeight,
      MOVIE_DEFAULTS.ratingWeight,
      MOVIE_DEFAULTS.diversityWeight,
    ]
  )

  logger.info('Movie recommendation config reset to defaults')
  return getRecommendationConfig()
}

/**
 * Reset series configuration to defaults
 */
export async function resetSeriesRecommendationConfig(): Promise<RecommendationConfig> {
  await query(
    `UPDATE recommendation_config SET
      series_max_candidates = $1,
      series_selected_count = $2,
      series_recent_watch_limit = $3,
      series_similarity_weight = $4,
      series_novelty_weight = $5,
      series_rating_weight = $6,
      series_diversity_weight = $7,
      updated_at = NOW()
     WHERE id = 1`,
    [
      SERIES_DEFAULTS.maxCandidates,
      SERIES_DEFAULTS.selectedCount,
      SERIES_DEFAULTS.recentWatchLimit,
      SERIES_DEFAULTS.similarityWeight,
      SERIES_DEFAULTS.noveltyWeight,
      SERIES_DEFAULTS.ratingWeight,
      SERIES_DEFAULTS.diversityWeight,
    ]
  )

  logger.info('Series recommendation config reset to defaults')
  return getRecommendationConfig()
}

/**
 * Legacy reset function - resets movie config
 * @deprecated Use resetMovieRecommendationConfig instead
 */
export async function resetRecommendationConfig(): Promise<LegacyRecommendationConfig> {
  const config = await resetMovieRecommendationConfig()
  return {
    ...config.movie,
    updatedAt: config.updatedAt,
  }
}
