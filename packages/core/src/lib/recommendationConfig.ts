import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'

const logger = createChildLogger('recommendation-config')

export interface RecommendationConfig {
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
  max_candidates: number
  selected_count: number
  recent_watch_limit: number
  similarity_weight: string // NUMERIC comes as string
  novelty_weight: string
  rating_weight: string
  diversity_weight: string
  updated_at: Date
}

// Default values (used if DB row doesn't exist yet)
const DEFAULTS: Omit<RecommendationConfig, 'updatedAt'> = {
  maxCandidates: 50000,
  selectedCount: 50,
  recentWatchLimit: 50,
  similarityWeight: 0.4,
  noveltyWeight: 0.2,
  ratingWeight: 0.2,
  diversityWeight: 0.2,
}

/**
 * Get the current recommendation configuration
 */
export async function getRecommendationConfig(): Promise<RecommendationConfig> {
  const row = await queryOne<RecommendationConfigRow>(
    `SELECT max_candidates, selected_count, recent_watch_limit,
            similarity_weight, novelty_weight, rating_weight, diversity_weight,
            updated_at
     FROM recommendation_config WHERE id = 1`
  )

  if (!row) {
    // Return defaults if no config exists (shouldn't happen after migration)
    logger.warn('No recommendation config found, using defaults')
    return {
      ...DEFAULTS,
      updatedAt: new Date(),
    }
  }

  return {
    maxCandidates: row.max_candidates,
    selectedCount: row.selected_count,
    recentWatchLimit: row.recent_watch_limit,
    similarityWeight: parseFloat(row.similarity_weight),
    noveltyWeight: parseFloat(row.novelty_weight),
    ratingWeight: parseFloat(row.rating_weight),
    diversityWeight: parseFloat(row.diversity_weight),
    updatedAt: row.updated_at,
  }
}

/**
 * Update the recommendation configuration
 */
export async function updateRecommendationConfig(
  updates: Partial<Omit<RecommendationConfig, 'updatedAt'>>
): Promise<RecommendationConfig> {
  const setClauses: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (updates.maxCandidates !== undefined) {
    setClauses.push(`max_candidates = $${paramIndex++}`)
    values.push(updates.maxCandidates)
  }
  if (updates.selectedCount !== undefined) {
    setClauses.push(`selected_count = $${paramIndex++}`)
    values.push(updates.selectedCount)
  }
  if (updates.recentWatchLimit !== undefined) {
    setClauses.push(`recent_watch_limit = $${paramIndex++}`)
    values.push(updates.recentWatchLimit)
  }
  if (updates.similarityWeight !== undefined) {
    setClauses.push(`similarity_weight = $${paramIndex++}`)
    values.push(updates.similarityWeight)
  }
  if (updates.noveltyWeight !== undefined) {
    setClauses.push(`novelty_weight = $${paramIndex++}`)
    values.push(updates.noveltyWeight)
  }
  if (updates.ratingWeight !== undefined) {
    setClauses.push(`rating_weight = $${paramIndex++}`)
    values.push(updates.ratingWeight)
  }
  if (updates.diversityWeight !== undefined) {
    setClauses.push(`diversity_weight = $${paramIndex++}`)
    values.push(updates.diversityWeight)
  }

  if (setClauses.length === 0) {
    return getRecommendationConfig()
  }

  await query(
    `UPDATE recommendation_config SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = 1`,
    values
  )

  logger.info({ updates }, 'Recommendation config updated')

  return getRecommendationConfig()
}

/**
 * Reset configuration to defaults
 */
export async function resetRecommendationConfig(): Promise<RecommendationConfig> {
  await query(
    `UPDATE recommendation_config SET
      max_candidates = $1,
      selected_count = $2,
      recent_watch_limit = $3,
      similarity_weight = $4,
      novelty_weight = $5,
      rating_weight = $6,
      diversity_weight = $7,
      updated_at = NOW()
     WHERE id = 1`,
    [
      DEFAULTS.maxCandidates,
      DEFAULTS.selectedCount,
      DEFAULTS.recentWatchLimit,
      DEFAULTS.similarityWeight,
      DEFAULTS.noveltyWeight,
      DEFAULTS.ratingWeight,
      DEFAULTS.diversityWeight,
    ]
  )

  logger.info('Recommendation config reset to defaults')

  return getRecommendationConfig()
}

