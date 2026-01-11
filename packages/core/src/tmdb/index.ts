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
} from './types.js'

// Constants
export { TMDB_IMAGE_BASE_URL, TMDB_API_BASE_URL } from './types.js'


