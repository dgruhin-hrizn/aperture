// ============================================================================
// PERFORMANCE TUNING CONSTANTS
// ============================================================================
// These values are optimized for local Emby/Jellyfin servers which have no rate limits.

/** Number of series to fetch per API request */
export const SERIES_PAGE_SIZE = 500

/** Number of episodes to fetch per API request */
export const EPISODE_PAGE_SIZE = 1000

/** Number of concurrent API requests for fetching pages */
export const PARALLEL_FETCHES = 4

/** Number of items to batch insert/update in a single DB operation */
export const DB_BATCH_SIZE = 100

