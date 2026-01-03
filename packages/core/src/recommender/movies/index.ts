// Movie recommendation pipeline exports
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

export { getCandidates } from './candidates.js'
export { scoreCandidates } from './scoring.js'
export { applyDiversityAndSelect } from './selection.js'
export { getWatchHistory, buildTasteProfile, storeTasteProfile } from './taste.js'
export { generateExplanations, storeExplanations, type MovieForExplanation } from './explanations.js'

