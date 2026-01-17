// Series recommendation pipeline exports
export {
  buildSeriesCanonicalText,
  buildEpisodeCanonicalText,
  embedSeries,
  embedEpisodes,
  storeSeriesEmbeddings,
  storeEpisodeEmbeddings,
  getSeriesWithoutEmbeddings,
  getEpisodesWithoutEmbeddings,
  generateMissingSeriesEmbeddings,
  getSeriesEmbedding,
  getEpisodeEmbedding,
  getSeriesEpisodeEmbeddings,
} from './embeddings.js'

export {
  generateSeriesRecommendationsForUser,
  generateSeriesRecommendationsForAllUsers,
  regenerateUserSeriesRecommendations,
  clearUserSeriesRecommendations,
  clearAllSeriesRecommendations,
  type SeriesUser,
  type SeriesCandidate,
  type SeriesPipelineConfig,
} from './pipeline.js'

export {
  storeSeriesEvidence,
  getSeriesOverviews,
  clearUserSeriesRecommendations as clearSeriesRecommendations,
  finalizeSeriesRun,
} from './storage.js'

export {
  generateSeriesExplanations,
  storeSeriesExplanations,
  type SeriesForExplanation,
  type SeriesExplanationResult,
} from './explanations.js'

export {
  syncSeries,
  syncSeriesWatchHistoryForUser,
  syncSeriesWatchHistoryForAllUsers,
} from './sync.js'

export {
  getUserSeriesRatings,
  getDislikedSeriesIds,
} from './taste.js'
