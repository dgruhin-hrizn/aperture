/**
 * Movies OpenAPI Schemas
 * 
 * All OpenAPI/Swagger schema definitions for movie endpoints.
 * Imports shared schemas from config/openapi.ts for $ref resolution.
 */

import { schemas as globalSchemas } from '../../config/openapi.js'

// =============================================================================
// Export Component Schemas for Registration
// =============================================================================

// These schemas need to be registered with fastify.addSchema() for $ref to work
export const moviesComponentSchemas = {
  Movie: globalSchemas.Movie,
  MovieDetail: globalSchemas.MovieDetail,
  SimilarMovie: globalSchemas.SimilarMovie,
  Error: globalSchemas.Error,
}

// =============================================================================
// Schema References (for use in route schemas)
// Fastify uses $id + $ref pattern: register with $id, reference with $ref: 'name#'
// =============================================================================

const MovieRef = { $ref: 'Movie#' }
const SimilarMovieRef = { $ref: 'SimilarMovie#' }
const ErrorRef = { $ref: 'Error#' }

// =============================================================================
// List Movies Schema
// =============================================================================

export const listMoviesSchema = {
  tags: ['movies'],
  summary: 'List movies',
  description: 'Get a paginated list of movies with filtering and sorting options. By default, only movies from enabled libraries are returned unless `showAll=true`.',
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'string' as const, description: 'Page number', default: '1', example: '1' },
      pageSize: { type: 'string' as const, description: 'Items per page (1-100)', default: '50', example: '25' },
      search: { type: 'string' as const, description: 'Search by title (case-insensitive, partial match)', example: 'matrix' },
      genre: { type: 'string' as const, description: 'Filter by genre (exact match)', example: 'Action' },
      collection: { type: 'string' as const, description: 'Filter by collection/franchise name', example: 'The Matrix Collection' },
      minRtScore: { type: 'string' as const, description: 'Minimum Rotten Tomatoes critic score (0-100)', example: '75' },
      showAll: { type: 'string' as const, enum: ['true', 'false'], description: 'Include movies from all libraries, not just enabled ones', default: 'false' },
      hasAwards: { type: 'string' as const, enum: ['true', 'false'], description: 'Only movies with awards/nominations', default: 'false' },
      minYear: { type: 'string' as const, description: 'Minimum release year', example: '2000' },
      maxYear: { type: 'string' as const, description: 'Maximum release year', example: '2024' },
      contentRating: { type: 'string' as const, description: 'Filter by content rating. Can pass multiple comma-separated values.', example: 'PG-13,R' },
      minRuntime: { type: 'string' as const, description: 'Minimum runtime in minutes', example: '90' },
      maxRuntime: { type: 'string' as const, description: 'Maximum runtime in minutes', example: '180' },
      minCommunityRating: { type: 'string' as const, description: 'Minimum community rating (0-10)', example: '7.0' },
      minMetacritic: { type: 'string' as const, description: 'Minimum Metacritic score (0-100)', example: '70' },
      resolution: { type: 'string' as const, description: 'Filter by resolution. Can pass multiple comma-separated values.', example: '4K,1080p' },
      sortBy: { 
        type: 'string' as const, 
        enum: ['title', 'year', 'releaseDate', 'rating', 'rtScore', 'metacritic', 'runtime', 'added'],
        description: 'Field to sort by: title (alphabetical), year (release year), releaseDate (premiere date), rating (community rating), rtScore (Rotten Tomatoes), metacritic, runtime (duration), added (date added to library)',
        default: 'title'
      },
      sortOrder: { 
        type: 'string' as const, 
        enum: ['asc', 'desc'],
        description: 'Sort direction: asc (ascending/A-Z/oldest first) or desc (descending/Z-A/newest first)',
        default: 'asc'
      },
    },
  },
  // Note: Response schema intentionally omitted to allow snake_case DB fields (poster_url, etc.)
  // to pass through without Fastify serialization filtering them out
}

// =============================================================================
// Get Movie Detail Schema
// =============================================================================

export const getMovieSchema = {
  tags: ['movies'],
  summary: 'Get movie by ID',
  description: 'Retrieve a single movie with full metadata including cast, crew, ratings, and enrichment data from TMDb, OMDb, and MDBList. Returns 404 if movie not found.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Unique movie identifier (UUID)', example: '123e4567-e89b-12d3-a456-426614174000' },
    },
    required: ['id'] as string[],
  },
  // Note: Response schema intentionally omitted to allow snake_case DB fields (poster_url, etc.)
  // to pass through without Fastify serialization filtering them out
}

// =============================================================================
// Watch Stats Schema
// =============================================================================

export const watchStatsSchema = {
  tags: ['movies'],
  summary: 'Get movie watch statistics',
  description: 'Get comprehensive watch statistics for a movie including viewer counts, play counts, ratings, and distribution across users.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Movie ID' },
    },
    required: ['id'] as string[],
  },
}

// =============================================================================
// Genres Schema
// =============================================================================

export const genresSchema = {
  tags: ['movies'],
  summary: 'List movie genres',
  description: 'Get all unique genres from the movie library.',
}

// =============================================================================
// Keywords Schema
// =============================================================================

export const keywordsSchema = {
  tags: ['movies'],
  summary: 'List movie keywords',
  description: 'Get the top 100 keywords from movie metadata (sourced from TMDb enrichment). Keywords with only one movie are excluded.',
}

// =============================================================================
// Collections Schema
// =============================================================================

export const collectionsSchema = {
  tags: ['movies'],
  summary: 'List movie collections',
  description: 'Get all movie collections/franchises (e.g., "The Matrix Collection", "Star Wars Collection") with movie counts.',
}

// =============================================================================
// Content Ratings Schema
// =============================================================================

export const contentRatingsSchema = {
  tags: ['movies'],
  summary: 'List content ratings',
  description: 'Get all unique content ratings (G, PG, PG-13, R, NC-17, TV ratings) with movie counts. Sorted by restrictiveness.',
}

// =============================================================================
// Resolutions Schema
// =============================================================================

export const resolutionsSchema = {
  tags: ['movies'],
  summary: 'List video resolutions',
  description: 'Get video resolution categories (4K, 1080p, 720p, SD) with movie counts.',
}

// =============================================================================
// Filter Ranges Schema
// =============================================================================

export const filterRangesSchema = {
  tags: ['movies'],
  summary: 'Get filter ranges',
  description: 'Get min/max values for year, runtime, and rating filters. Useful for building filter UI sliders and range inputs.',
}

// =============================================================================
// Franchises Schema
// =============================================================================

export const franchisesSchema = {
  tags: ['movies'],
  summary: 'List franchises with progress',
  description: 'Get movie franchises/collections with watch progress for the current user. Includes unwatched counts, completion status, and individual movie details.',
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'string' as const, description: 'Page number', default: '1', example: '1' },
      pageSize: { type: 'string' as const, description: 'Items per page (1-50)', default: '20', example: '20' },
      search: { type: 'string' as const, description: 'Search franchise names (case-insensitive)', example: 'Marvel' },
      sortBy: { 
        type: 'string' as const, 
        enum: ['name', 'total', 'progress', 'unwatched'], 
        description: 'Sort field: name (alphabetical), total (most movies), progress (completion %), unwatched (most remaining)',
        default: 'total'
      },
      showCompleted: { type: 'string' as const, enum: ['true', 'false'], description: 'Include fully-watched franchises', default: 'true' },
    },
  },
}

// =============================================================================
// Similar Movies Schema
// =============================================================================

export const similarMoviesSchema = {
  tags: ['similarity'],
  summary: 'Get similar movies',
  description: 'Find movies similar to the specified movie using AI-powered semantic similarity based on embeddings. Results are ranked by similarity score (0-1, higher is more similar). Requires embeddings to be generated.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Source movie ID to find similar movies for', example: '123e4567-e89b-12d3-a456-426614174000' },
    },
    required: ['id'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      limit: { type: 'string' as const, description: 'Maximum results to return (1-50)', default: '10', example: '20' },
    },
  },
}
