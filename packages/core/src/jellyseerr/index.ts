/**
 * Jellyseerr Integration Module
 * 
 * Provides API access to Jellyseerr for content request management
 */

// Types
export * from './types.js'

// Provider functions
export {
  // Configuration
  getJellyseerrConfig,
  setJellyseerrConfig,
  isJellyseerrConfigured,
  testJellyseerrConnection,
  // Search & Media Info
  searchContent,
  getMovieDetails,
  getTVDetails,
  getMediaStatus,
  // Request Management
  createRequest,
  getRequest,
  getRequestStatus,
  deleteRequest,
  // Batch Operations
  batchGetMediaStatus,
} from './provider.js'

