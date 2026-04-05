/**
 * TMDb Integration Module
 *
 * Provides access to TMDb API for:
 * - Keywords (content themes and topics)
 * - Collections/Franchises (movie series groupings)
 * - Expanded Crew (cinematographers, composers, editors)
 */

// Client utilities
export {
  tmdbRequest,
  getImageUrl,
  findMovieByImdbId,
  findTVByImdbId,
  findTVByTvdbId,
  searchCompanyByName,
  getCompanyDetails,
  getNetworkDetails,
} from './client.js'

// Person (search, profile, combined credits, cache)
export {
  normalizePersonNameKey,
  searchPersonByName,
  getPersonCombinedCredits,
  getPersonTmdbCacheRow,
  upsertPersonTmdbCache,
  upsertPersonCombinedCreditsCache,
  resolveTmdbPersonProfileImageUrl,
  resolveTmdbPersonId,
  getCachedOrFetchCombinedCredits,
  COMBINED_CREDITS_CACHE_TTL_MS,
  type TmdbPersonSearchResult,
  type TmdbCombinedCreditsResponse,
  type TmdbCombinedCreditEntry,
  type ResolveTmdbPersonProfileResult,
} from './person.js'

// Client types
export type { ApiLogCallback } from './client.js'

// Movie functions
export {
  getMovieDetails,
  getMovieKeywords,
  getMovieCredits,
  getMovieEnrichmentData,
  getMovieEnrichmentByImdbId,
  getMovieEnrichmentByTmdbId,
} from './movies.js'

// Series functions
export {
  getTVDetails,
  getTVKeywords,
  getTVExternalIds,
  getTVCredits,
  getSeriesEnrichmentData,
  getSeriesEnrichmentByImdbId,
  getSeriesEnrichmentByTmdbId,
  getSeriesEnrichmentByTvdbId,
} from './series.js'

// Collection functions
export {
  getCollectionDetails,
  getCollectionData,
  getCollectionsData,
  collectionDetailsToCollectionData,
} from './collections.js'

// Collection DB cache (gap analysis, etc.)
export {
  upsertCollectionCache,
  getCachedCollectionDataBatch,
  fetchCollectionDataAndCache,
} from './collection-cache.js'

// Discovery functions (recommendations, similar, discover)
export {
  getMovieRecommendations,
  getSimilarMovies,
  discoverMovies,
  getMovieRecommendationsBatch,
  getSimilarMoviesBatch,
  getTVRecommendations,
  getSimilarTV,
  discoverTV,
  getTVRecommendationsBatch,
  getSimilarTVBatch,
  extractYear,
  normalizeMovieResult,
  normalizeTVResult,
  // Top Picks source functions
  getPopularMovies,
  getPopularMoviesBatch,
  getTrendingMovies,
  getTrendingMoviesBatch,
  getTopRatedMovies,
  getTopRatedMoviesBatch,
  getPopularTV,
  getPopularTVBatch,
  getTrendingTV,
  getTrendingTVBatch,
  getTopRatedTV,
  getTopRatedTVBatch,
} from './discover.js'

// Discovery types
export type { TrendingTimeWindow } from './discover.js'

// Types
export type {
  TMDbKeyword,
  TMDbGenre,
  TMDbCrewMember,
  TMDbCastMember,
  TMDbProductionCompany,
  TMDbNetwork,
  TMDbCollection,
  TMDbCollectionDetails,
  TMDbCollectionPart,
  TMDbMovieDetails,
  TMDbMovieKeywordsResponse,
  TMDbMovieCreditsResponse,
  TMDbTVDetails,
  TMDbTVKeywordsResponse,
  TMDbTVCreditsResponse,
  TMDbCompanySearchResult,
  TMDbCompanySearchResponse,
  TMDbCompanyDetails,
  TMDbNetworkDetails,
  ProductionCompanyData,
  NetworkData,
  MovieEnrichmentData,
  SeriesEnrichmentData,
  CollectionData,
  TMDbImageSize,
  // Discovery types
  TMDbMovieResult,
  TMDbTVResult,
  TMDbPaginatedResponse,
  TMDbMovieRecommendationsResponse,
  TMDbMovieSimilarResponse,
  TMDbMovieDiscoverResponse,
  TMDbTVRecommendationsResponse,
  TMDbTVSimilarResponse,
  TMDbTVDiscoverResponse,
  DiscoverMovieFilters,
  DiscoverTVFilters,
} from './types.js'

// Constants
export { TMDB_IMAGE_BASE_URL, TMDB_API_BASE_URL } from './types.js'


