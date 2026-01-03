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

// Re-export shared utility from movies
export { averageEmbeddings } from '../movies/embeddings.js'

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
  syncSeries,
  syncSeriesWatchHistoryForUser,
  syncSeriesWatchHistoryForAllUsers,
} from './sync.js'

