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
  enrichBasicData,
  hasDiscoverySources,
  // Two-phase fetching (shared pool architecture)
  fetchGlobalCandidates,
  fetchPersonalizedCandidates,
  mergeWithPool,
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
  // Pool storage (shared candidates)
  upsertPoolCandidates,
  getPoolCandidates,
  getPoolCandidateByTmdbId,
  updatePoolCandidateEnrichment,
  getUnenrichedPoolCandidates,
  clearOldPoolEntries,
  poolCandidateToRaw,
} from './storage.js'

