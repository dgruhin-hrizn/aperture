/**
 * Trakt integration module
 * Provides OAuth authentication, ratings sync, and content discovery with Trakt.tv
 */

export * from './types.js'
export {
  getTraktConfig,
  setTraktConfig,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshTokens,
  getTraktUser,
  getTraktRatings,
  storeUserTraktTokens,
  getUserTraktTokens,
  disconnectTrakt,
  syncTraktRatings,
  isTraktConfigured,
  getUserTraktStatus,
  pushRatingToTrakt,
  removeRatingFromTrakt,
} from './provider.js'

// Discovery functions
export {
  getTrendingMovies,
  getPopularMovies,
  getMostWatchedMovies,
  getAnticipatedMovies,
  getRecommendedMovies,
  getRelatedMovies,
  getTrendingShows,
  getPopularShows,
  getMostWatchedShows,
  getAnticipatedShows,
  getRecommendedShows,
  getRelatedShows,
  extractMovieTmdbId,
  extractShowTmdbId,
  normalizeTraktMovie,
  normalizeTraktShow,
} from './discover.js'

