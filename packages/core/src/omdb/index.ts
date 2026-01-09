/**
 * OMDb Integration Module
 *
 * Provides access to OMDb API for:
 * - Rotten Tomatoes scores
 * - Metacritic scores
 * - Awards summaries
 */

// Client
export { omdbRequest } from './client.js'

// Ratings functions
export {
  extractRatingsData,
  getRatingsData,
  getRatingsDataBatch,
  getOMDbData,
} from './ratings.js'

// Types
export type {
  OMDbRating,
  OMDbMovieResponse,
  RatingsData,
} from './types.js'

// Constants
export { OMDB_API_BASE_URL } from './types.js'

