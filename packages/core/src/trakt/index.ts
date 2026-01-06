/**
 * Trakt integration module
 * Provides OAuth authentication and ratings sync with Trakt.tv
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

