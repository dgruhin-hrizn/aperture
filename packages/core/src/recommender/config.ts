import { createChildLogger } from '../lib/logger.js'
import { getRecommendationConfig } from '../lib/recommendationConfig.js'
import { FALLBACK_CONFIG, type PipelineConfig } from './types.js'

const logger = createChildLogger('recommender-config')

/**
 * Get configuration from database (with fallback)
 */
export async function loadConfig(): Promise<PipelineConfig> {
  try {
    const dbConfig = await getRecommendationConfig()
    return {
      maxCandidates: dbConfig.maxCandidates,
      selectedCount: dbConfig.selectedCount,
      similarityWeight: dbConfig.similarityWeight,
      noveltyWeight: dbConfig.noveltyWeight,
      ratingWeight: dbConfig.ratingWeight,
      diversityWeight: dbConfig.diversityWeight,
      recentWatchLimit: dbConfig.recentWatchLimit,
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load recommendation config from DB, using fallback')
    return FALLBACK_CONFIG
  }
}

