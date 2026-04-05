/**
 * Seerr Integration Module
 * 
 * Provides API access to Seerr for content request management
 */

// Types
export * from './types.js'

// Provider functions
export {
  // Configuration
  getSeerrConfig,
  setSeerrConfig,
  isSeerrConfigured,
  testSeerrConnection,
  // Search & Media Info
  searchContent,
  getMovieDetails,
  getTVDetails,
  getMediaStatus,
  listAllSeerrUsers,
  resolveSeerrUserIdForProfile,
  // Request Management
  createRequest,
  getRequest,
  getRequestStatus,
  deleteRequest,
  // Batch Operations
  batchGetMediaStatus,
  // Radarr / Sonarr (request options UI)
  listRadarrServers,
  getRadarrServerDetails,
  listSonarrServers,
  getSonarrServerDetails,
} from './provider.js'

export {
  matchApertureProfileToSeerrUser,
  type ApertureUserProfileForSeerr,
} from './userMapping.js'

