/**
 * Shows You Watch Module
 *
 * Per-user list in `user_watching_series`, upcoming episode helpers,
 * and bidirectional sync with media server series favorites (Emby/Jellyfin).
 */

export {
  getUpcomingEpisodes,
  getUpcomingEpisodeForSeries,
  type UpcomingEpisode,
} from './upcomingEpisodes.js'

export {
  reconcileWatchingFavoritesForUser,
  favoriteWatchingSeriesOnMediaServer,
  unfavoriteWatchingSeriesOnMediaServer,
  processWatchingFavoritesForAllUsers,
  type ReconcileWatchingFavoritesResult,
} from './favoriteSync.js'
