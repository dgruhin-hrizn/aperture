export {
  buildCanonicalText,
  embedMovies,
  storeEmbeddings,
  getMoviesWithoutEmbeddings,
  generateMissingEmbeddings,
  getMovieEmbedding,
  averageEmbeddings,
} from './embeddings.js'

export {
  generateRecommendationsForUser,
  generateRecommendationsForAllUsers,
  clearUserRecommendations,
  clearAllRecommendations,
  clearAndRebuildAllRecommendations,
  regenerateUserRecommendations,
} from './pipeline.js'

export {
  syncMovies,
  syncWatchHistoryForUser,
  syncWatchHistoryForAllUsers,
} from './sync.js'

