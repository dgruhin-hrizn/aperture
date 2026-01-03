import { createChildLogger } from '../lib/logger.js'
import { getRecommendationConfig } from '../lib/recommendationConfig.js'
import { FALLBACK_CONFIG, type PipelineConfig } from './types.js'

const logger = createChildLogger('recommender-config')

/**
 * Get movie configuration from database (with fallback)
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
