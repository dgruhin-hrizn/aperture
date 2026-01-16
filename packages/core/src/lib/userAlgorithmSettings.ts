/**
 * User Algorithm Settings
 *
 * Allows end users to override admin-set recommendation algorithm weights.
 * Settings are stored in user_preferences.settings JSONB under 'algorithmSettings'.
 */

import { createChildLogger } from './logger.js'
import { query, queryOne } from './db.js'
import { getRecommendationConfig } from './recommendationConfig.js'
import type { PipelineConfig } from '../recommender/types.js'

const logger = createChildLogger('user-algorithm-settings')

/**
 * User's custom algorithm settings for a media type
 */
export interface UserAlgorithmWeights {
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
  recentWatchLimit: number
}

/**
 * Complete user algorithm settings structure
 */
export interface UserAlgorithmSettings {
  enabled: boolean
  movie?: Partial<UserAlgorithmWeights>
  series?: Partial<UserAlgorithmWeights>
}

/**
 * Default weights (matches admin defaults)
 */
const DEFAULT_WEIGHTS: UserAlgorithmWeights = {
  similarityWeight: 0.4,
  noveltyWeight: 0.2,
  ratingWeight: 0.2,
  diversityWeight: 0.2,
  recentWatchLimit: 50,
}

/**
 * Get user's custom algorithm settings
 */
export async function getUserAlgorithmSettings(userId: string): Promise<UserAlgorithmSettings | null> {
  const result = await queryOne<{ settings: { algorithmSettings?: UserAlgorithmSettings } | null }>(
    `SELECT settings FROM user_preferences WHERE user_id = $1`,
    [userId]
  )

  if (!result?.settings?.algorithmSettings) {
    return null
  }

  return result.settings.algorithmSettings
}

/**
 * Save user's custom algorithm settings
 */
export async function setUserAlgorithmSettings(
  userId: string,
  settings: UserAlgorithmSettings
): Promise<void> {
  // Ensure user_preferences row exists
  await query(
    `INSERT INTO user_preferences (user_id, settings)
     VALUES ($1, '{}')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  )

  // Update the algorithmSettings in the JSONB settings column
  await query(
    `UPDATE user_preferences 
     SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('algorithmSettings', $2::jsonb),
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId, JSON.stringify(settings)]
  )

  logger.info({ userId, enabled: settings.enabled }, 'Updated user algorithm settings')
}

/**
 * Reset user's algorithm settings to admin defaults
 */
export async function resetUserAlgorithmSettings(userId: string): Promise<void> {
  await query(
    `UPDATE user_preferences 
     SET settings = settings - 'algorithmSettings',
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  )

  logger.info({ userId }, 'Reset user algorithm settings to defaults')
}

/**
 * Get the effective algorithm config for a user
 * 
 * Priority:
 * 1. User's custom settings (if enabled)
 * 2. Admin-configured defaults
 * 3. Fallback defaults
 */
export async function getEffectiveAlgorithmConfig(
  userId: string,
  mediaType: 'movie' | 'series'
): Promise<PipelineConfig> {
  // Start with admin defaults
  let adminConfig: PipelineConfig
  try {
    const dbConfig = await getRecommendationConfig()
    adminConfig = {
      maxCandidates: mediaType === 'movie' ? dbConfig.movie.maxCandidates : dbConfig.series.maxCandidates,
      selectedCount: mediaType === 'movie' ? dbConfig.movie.selectedCount : dbConfig.series.selectedCount,
      similarityWeight: mediaType === 'movie' ? dbConfig.movie.similarityWeight : dbConfig.series.similarityWeight,
      noveltyWeight: mediaType === 'movie' ? dbConfig.movie.noveltyWeight : dbConfig.series.noveltyWeight,
      ratingWeight: mediaType === 'movie' ? dbConfig.movie.ratingWeight : dbConfig.series.ratingWeight,
      diversityWeight: mediaType === 'movie' ? dbConfig.movie.diversityWeight : dbConfig.series.diversityWeight,
      recentWatchLimit: mediaType === 'movie' ? dbConfig.movie.recentWatchLimit : dbConfig.series.recentWatchLimit,
    }
  } catch {
    logger.warn('Failed to load admin config, using fallback defaults')
    adminConfig = {
      maxCandidates: 50000,
      selectedCount: 12,
      ...DEFAULT_WEIGHTS,
    }
  }

  // Check for user overrides
  const userSettings = await getUserAlgorithmSettings(userId)
  
  // If user has no custom settings or they're disabled, use admin config
  if (!userSettings || !userSettings.enabled) {
    return adminConfig
  }

  // Get user's media-type-specific overrides
  const userOverrides = mediaType === 'movie' ? userSettings.movie : userSettings.series
  
  // Merge user overrides with admin config (use raw values)
  const rawWeights = {
    similarityWeight: userOverrides?.similarityWeight ?? adminConfig.similarityWeight,
    noveltyWeight: userOverrides?.noveltyWeight ?? adminConfig.noveltyWeight,
    ratingWeight: userOverrides?.ratingWeight ?? adminConfig.ratingWeight,
    diversityWeight: userOverrides?.diversityWeight ?? adminConfig.diversityWeight,
    recentWatchLimit: userOverrides?.recentWatchLimit ?? adminConfig.recentWatchLimit,
  }
  
  // Normalize the weights so they sum to 1.0
  const normalizedWeights = normalizeWeights(rawWeights)
  
  const effectiveConfig: PipelineConfig = {
    maxCandidates: adminConfig.maxCandidates, // User can't override this
    selectedCount: adminConfig.selectedCount, // User can't override this
    ...normalizedWeights,
  }

  logger.debug(
    { userId, mediaType, rawWeights, effectiveConfig },
    'Computed effective algorithm config for user (normalized)'
  )

  return effectiveConfig
}

/**
 * Normalize weights so they sum to 1.0
 * Users can set any values they want, and we'll normalize on the backend
 */
export function normalizeWeights(weights: Partial<UserAlgorithmWeights>): UserAlgorithmWeights {
  const similarity = weights.similarityWeight ?? DEFAULT_WEIGHTS.similarityWeight
  const novelty = weights.noveltyWeight ?? DEFAULT_WEIGHTS.noveltyWeight
  const rating = weights.ratingWeight ?? DEFAULT_WEIGHTS.ratingWeight
  const diversity = weights.diversityWeight ?? DEFAULT_WEIGHTS.diversityWeight
  
  const sum = similarity + novelty + rating + diversity
  
  // Avoid division by zero
  if (sum === 0) {
    return DEFAULT_WEIGHTS
  }
  
  return {
    similarityWeight: similarity / sum,
    noveltyWeight: novelty / sum,
    ratingWeight: rating / sum,
    diversityWeight: diversity / sum,
    recentWatchLimit: weights.recentWatchLimit ?? DEFAULT_WEIGHTS.recentWatchLimit,
  }
}

/**
 * Get admin default config for display purposes
 */
export async function getAdminDefaultConfig(mediaType: 'movie' | 'series'): Promise<UserAlgorithmWeights> {
  try {
    const dbConfig = await getRecommendationConfig()
    const config = mediaType === 'movie' ? dbConfig.movie : dbConfig.series
    return {
      similarityWeight: config.similarityWeight,
      noveltyWeight: config.noveltyWeight,
      ratingWeight: config.ratingWeight,
      diversityWeight: config.diversityWeight,
      recentWatchLimit: config.recentWatchLimit,
    }
  } catch {
    return DEFAULT_WEIGHTS
  }
}

/**
 * Calculate smart diversity adjustment based on user's taste profile
 * 
 * - Focused taste (score < 0.3): Reduce diversity weight by 30%
 * - Balanced taste (0.3-0.6): Use default
 * - Eclectic taste (score > 0.6): Increase diversity weight by 20%
 * 
 * Only applies if user hasn't set a custom diversity weight.
 */
export async function getSmartDiversityWeight(
  userId: string,
  mediaType: 'movie' | 'series',
  baseDiversityWeight: number
): Promise<number> {
  try {
    // Check if user has custom settings
    const userSettings = await getUserAlgorithmSettings(userId)
    if (userSettings?.enabled) {
      const userOverrides = mediaType === 'movie' ? userSettings.movie : userSettings.series
      if (userOverrides?.diversityWeight !== undefined) {
        // User has explicitly set diversity weight, don't auto-adjust
        return userOverrides.diversityWeight
      }
    }

    // Get user's taste diversity score
    const { analyzeMovieTaste, analyzeSeriesTaste } = await import('./tasteAnalyzer.js')
    const analysis = mediaType === 'movie' 
      ? await analyzeMovieTaste(userId)
      : await analyzeSeriesTaste(userId)

    const diversityScore = analysis.diversity.score

    let adjustedWeight = baseDiversityWeight

    if (diversityScore < 0.3) {
      // Focused taste - reduce diversity (they know what they like)
      adjustedWeight = baseDiversityWeight * 0.7
      logger.debug(
        { userId, mediaType, diversityScore, adjustment: 'reduced' },
        'Applied focused taste diversity adjustment'
      )
    } else if (diversityScore > 0.6) {
      // Eclectic taste - increase diversity (they enjoy variety)
      adjustedWeight = baseDiversityWeight * 1.2
      logger.debug(
        { userId, mediaType, diversityScore, adjustment: 'increased' },
        'Applied eclectic taste diversity adjustment'
      )
    }

    return adjustedWeight
  } catch (err) {
    logger.warn({ err, userId, mediaType }, 'Failed to calculate smart diversity, using default')
    return baseDiversityWeight
  }
}

