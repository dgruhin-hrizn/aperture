/**
 * Continue Watching Module
 * 
 * Provides deduplicated "Continue Watching" functionality by:
 * 1. Polling Emby/Jellyfin Resume API
 * 2. Filtering out Aperture-created libraries
 * 3. Filtering out admin-excluded libraries
 * 4. Deduplicating by provider ID (TMDB/IMDB)
 * 5. Writing to per-user virtual libraries (STRM/symlinks)
 */

export {
  syncContinueWatchingForUser,
  syncContinueWatchingForAllUsers,
  filterAndDeduplicate,
  type ContinueWatchingItem,
} from './sync.js'

export {
  writeContinueWatchingForUser,
  processContinueWatchingForUser,
  processContinueWatchingForAllUsers,
} from './writer.js'

export {
  getContinueWatchingLibraryName,
  ensureUserContinueWatchingLibrary,
  refreshUserContinueWatchingLibrary,
  updateUserContinueWatchingLibraryPermissions,
} from './library.js'
