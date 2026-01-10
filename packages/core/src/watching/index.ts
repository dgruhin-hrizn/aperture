/**
 * Shows You Watch Module
 * 
 * Handles per-user "Shows You Watch" library management,
 * including STRM file generation and media server integration.
 */

export {
  getWatchingLibraryName,
  ensureUserWatchingLibrary,
  refreshUserWatchingLibrary,
  updateUserWatchingLibraryPermissions,
  getUserWatchingLibraryInfo,
} from './library.js'

export {
  writeWatchingSeriesForUser,
  processWatchingForUser,
  processWatchingLibrariesForAllUsers,
} from './writer.js'

export {
  getUpcomingEpisodes,
  getUpcomingEpisodeForSeries,
  type UpcomingEpisode,
} from './upcomingEpisodes.js'

