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
  fetchGenreStripDiscoverCandidates,
  enrichFullData,
  enrichBasicData,
  hasDiscoverySources,
  // Two-phase fetching (shared pool architecture)
  fetchGlobalCandidates,
  fetchPersonalizedCandidates,
  mergeWithPool,
  type DynamicFetchFilters,
  type GenreStripDiscoverFilters,
} from './sources.js'

// Filter
export {
  filterCandidates,
  getCandidateExclusionTmdbIds,
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
  countDiscoveryRequests,
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

// Browse: distinct people in library (actors + directors)
export {
  listPeopleForBrowse,
  type PersonBrowseRow,
  type ListPeopleBrowseOptions,
  type ListPeopleBrowseResult,
} from './peopleBrowse.js'

// TMDb credits vs library gap
export {
  getPersonCreditsGap,
  flattenCombinedCredits,
  flattenCombinedCreditsWithRoles,
  creditsRoleKindFromEntry,
  formatCreditsGapGroupLabel,
  type PersonCreditsGapOptions,
  type PersonCreditsGapRow,
  type PersonCreditsGapResult,
  type PersonCreditsGapGroup,
  type CreditsRoleKind,
} from './personCreditsGap.js'

// Person portrait push (media server item id from sync)
export { findPersonMediaServerItemIdForName } from './personPortraitPush.js'

