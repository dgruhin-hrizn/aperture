// Shared types and config
export * from './types.js'
export * from './config.js'
export * from './storage.js'

// Movie recommendation exports
export {
  buildCanonicalText,
  embedMovies,
  storeEmbeddings,
  getMoviesWithoutEmbeddings,
  generateMissingEmbeddings,
  getMovieEmbedding,
  averageEmbeddings,
} from './movies/embeddings.js'

export {
  generateRecommendationsForUser,
  generateRecommendationsForAllUsers,
  clearUserRecommendations,
  clearAllRecommendations,
  clearAndRebuildAllRecommendations,
  regenerateUserRecommendations,
} from './movies/pipeline.js'

export {
  syncMovies,
  syncWatchHistoryForUser,
  syncWatchHistoryForAllUsers,
} from './movies/sync.js'

// Series recommendation exports
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
} from './series/embeddings.js'

export {
  generateSeriesRecommendationsForUser,
  generateSeriesRecommendationsForAllUsers,
  regenerateUserSeriesRecommendations,
  clearUserSeriesRecommendations,
  clearAllSeriesRecommendations,
  type SeriesUser,
  type SeriesCandidate,
  type SeriesPipelineConfig,
} from './series/pipeline.js'

export {
  syncSeries,
  syncSeriesWatchHistoryForUser,
  syncSeriesWatchHistoryForAllUsers,
} from './series/sync.js'
