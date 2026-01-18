/**
 * Discovery Module
 * 
 * Suggests content not in the user's library based on AI recommendations
 * and external integrations (TMDb, Trakt, MDBList)
 */

// Types
export * from './types.js'

// Pipeline
export {
  generateDiscoveryForUser,
  generateDiscoveryForAllUsers,
  regenerateUserDiscovery,
  getDiscoveryEnabledUsers,
} from './pipeline.js'

// Sources
export {
  fetchAllCandidates,
  fetchFilteredCandidates,
  enrichFullData,
  hasDiscoverySources,
  type DynamicFetchFilters,
} from './sources.js'

// Filter
export {
  filterCandidates,
  isInLibrary,
  hasWatched,
} from './filter.js'

// Scorer
export {
  scoreCandidates,
} from './scorer.js'

// Storage
export {
  createDiscoveryRun,
  updateDiscoveryRunStats,
  finalizeDiscoveryRun,
  getLatestDiscoveryRun,
  storeDiscoveryCandidates,
  getDiscoveryCandidates,
  getDiscoveryCandidateCount,
  clearDiscoveryCandidates,
  createDiscoveryRequest,
  updateDiscoveryRequestStatus,
  getDiscoveryRequests,
  hasExistingRequest,
} from './storage.js'

