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
} from './collections.js'

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


