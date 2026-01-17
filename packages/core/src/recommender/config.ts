import { createChildLogger } from '../lib/logger.js'
import { getRecommendationConfig } from '../lib/recommendationConfig.js'
import { getEffectiveAlgorithmConfig } from '../lib/userAlgorithmSettings.js'
import { FALLBACK_CONFIG, type PipelineConfig } from './types.js'

const logger = createChildLogger('recommender-config')

/**
 * Get movie configuration from database (with fallback)
 * 
 * @deprecated Use loadConfigForUser for user-specific config
 */
export async function loadConfig(): Promise<PipelineConfig> {
  try {
    const dbConfig = await getRecommendationConfig()
    return {
      maxCandidates: dbConfig.movie.maxCandidates,
      selectedCount: dbConfig.movie.selectedCount,
      similarityWeight: dbConfig.movie.similarityWeight,
      noveltyWeight: dbConfig.movie.noveltyWeight,
      ratingWeight: dbConfig.movie.ratingWeight,
      diversityWeight: dbConfig.movie.diversityWeight,
      recentWatchLimit: dbConfig.movie.recentWatchLimit,
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load movie recommendation config from DB, using fallback')
    return FALLBACK_CONFIG
  }
}

/**
 * Get series configuration from database (with fallback)
 * 
 * @deprecated Use loadConfigForUser for user-specific config
 */
export async function loadSeriesConfig(): Promise<PipelineConfig> {
  try {
    const dbConfig = await getRecommendationConfig()
    return {
      maxCandidates: dbConfig.series.maxCandidates,
      selectedCount: dbConfig.series.selectedCount,
      similarityWeight: dbConfig.series.similarityWeight,
      noveltyWeight: dbConfig.series.noveltyWeight,
      ratingWeight: dbConfig.series.ratingWeight,
      diversityWeight: dbConfig.series.diversityWeight,
      recentWatchLimit: dbConfig.series.recentWatchLimit,
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load series recommendation config from DB, using fallback')
    return {
      ...FALLBACK_CONFIG,
      selectedCount: 12, // Default series recommendation count
      recentWatchLimit: 100, // More episodes for taste profile
    }
  }
}

/**
 * Get configuration for a specific user
 * 
 * This is the preferred method - it automatically:
 * 1. Loads admin-configured defaults
 * 2. Applies user-specific overrides if enabled
 * 3. Falls back gracefully on errors
 * 
 * @param userId - The user ID to load config for
 * @param mediaType - 'movie' or 'series'
 */
export async function loadConfigForUser(
  userId: string,
  mediaType: 'movie' | 'series'
): Promise<PipelineConfig> {
  try {
    const config = await getEffectiveAlgorithmConfig(userId, mediaType)
    logger.debug({ userId, mediaType }, 'Loaded user-specific algorithm config')
    return config
  } catch (err) {
    logger.warn({ err, userId, mediaType }, 'Failed to load user config, falling back to defaults')
    // Fall back to basic load functions
    return mediaType === 'movie' ? loadConfig() : loadSeriesConfig()
  }
}
