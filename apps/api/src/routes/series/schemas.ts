/**
 * Series OpenAPI Schemas
 * 
 * All OpenAPI/Swagger schema definitions for series endpoints.
 * Imports shared schemas from config/openapi.ts for $ref resolution.
 */

import { schemas as globalSchemas } from '../../config/openapi.js'

// =============================================================================
// Export Component Schemas for Registration
// =============================================================================

// These schemas need to be registered with fastify.addSchema() for $ref to work
export const seriesComponentSchemas = {
  Series: globalSchemas.Series,
  Episode: globalSchemas.Episode,
  Error: globalSchemas.Error,
}

// =============================================================================
// Schema References (for use in route schemas)
// Fastify uses $id + $ref pattern: register with $id, reference with $ref: 'name#'
// =============================================================================

const SeriesRef = { $ref: 'Series#' }
const EpisodeRef = { $ref: 'Episode#' }
const ErrorRef = { $ref: 'Error#' }

// =============================================================================
// List Series Schema
// =============================================================================

export const listSeriesSchema = {
  tags: ['series'],
  summary: 'List series',
  description: 'Get a paginated list of TV series with filtering and sorting options. By default, only series from enabled libraries are returned unless `showAll=true`.',
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'string' as const, description: 'Page number', default: '1', example: '1' },
      pageSize: { type: 'string' as const, description: 'Items per page (1-100)', default: '50', example: '25' },
      search: { type: 'string' as const, description: 'Search by title (case-insensitive, partial match)', example: 'breaking' },
      genre: { type: 'string' as const, description: 'Filter by genre (exact match)', example: 'Drama' },
      network: { type: 'string' as const, description: 'Filter by network/streaming service', example: 'HBO' },
      status: { type: 'string' as const, enum: ['Continuing', 'Ended'], description: 'Filter by series status' },
      minRtScore: { type: 'string' as const, description: 'Minimum Rotten Tomatoes critic score (0-100)', example: '80' },
      showAll: { type: 'string' as const, enum: ['true', 'false'], description: 'Include series from all libraries, not just enabled ones', default: 'false' },
      hasAwards: { type: 'string' as const, enum: ['true', 'false'], description: 'Only series with awards/nominations', default: 'false' },
      minYear: { type: 'string' as const, description: 'Minimum first air year', example: '2010' },
      maxYear: { type: 'string' as const, description: 'Maximum first air year', example: '2024' },
      contentRating: { type: 'string' as const, description: 'Filter by content rating. Can pass multiple comma-separated values.', example: 'TV-MA,TV-14' },
      minSeasons: { type: 'string' as const, description: 'Minimum number of seasons', example: '2' },
      maxSeasons: { type: 'string' as const, description: 'Maximum number of seasons', example: '10' },
      minCommunityRating: { type: 'string' as const, description: 'Minimum community rating (0-10)', example: '8.0' },
      minMetacritic: { type: 'string' as const, description: 'Minimum Metacritic score (0-100)', example: '75' },
      sortBy: { 
        type: 'string' as const, 
        enum: ['title', 'year', 'rating', 'rtScore', 'metacritic', 'seasons', 'added'],
        description: 'Field to sort by: title (alphabetical), year (first air year), rating (community rating), rtScore (Rotten Tomatoes), metacritic, seasons (season count), added (date added)',
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
}

// =============================================================================
// Get Series Detail Schema
// =============================================================================

export const getSeriesSchema = {
  tags: ['series'],
  summary: 'Get series by ID',
  description: 'Retrieve a single series with full metadata including cast, crew, ratings, seasons, and enrichment data from TMDb, OMDb, and MDBList. Returns 404 if series not found.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Unique series identifier (UUID)', example: '789e4567-e89b-12d3-a456-426614174002' },
    },
    required: ['id'] as string[],
  },
}

// =============================================================================
// Watch Stats Schema
// =============================================================================

export const watchStatsSchema = {
  tags: ['series'],
  summary: 'Get series watch statistics',
  description: 'Get comprehensive watch statistics for a series including viewer counts, episode plays, completion rates, and ratings across all users.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Series ID' },
    },
    required: ['id'] as string[],
  },
}

// =============================================================================
// Episodes Schema
// =============================================================================

export const episodesSchema = {
  tags: ['series'],
  summary: 'Get series episodes',
  description: 'Get all episodes for a series, grouped by season. Includes episode details like title, overview, ratings, air dates, and watch progress.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Series ID to get episodes for', example: '789e4567-e89b-12d3-a456-426614174002' },
    },
    required: ['id'] as string[],
  },
}

// =============================================================================
// Genres Schema
// =============================================================================

export const genresSchema = {
  tags: ['series'],
  summary: 'List series genres',
  description: 'Get all unique genres from the series library.',
}

// =============================================================================
// Networks Schema
// =============================================================================

export const networksSchema = {
  tags: ['series'],
  summary: 'List networks',
  description: 'Get all unique networks/streaming services from the series library.',
}

// =============================================================================
// Keywords Schema
// =============================================================================

export const keywordsSchema = {
  tags: ['series'],
  summary: 'List series keywords',
  description: 'Get the top 100 keywords from series metadata (sourced from TMDb enrichment). Keywords with only one series are excluded.',
}

// =============================================================================
// Content Ratings Schema
// =============================================================================

export const contentRatingsSchema = {
  tags: ['series'],
  summary: 'List content ratings',
  description: 'Get all unique content ratings (TV-G, TV-PG, TV-14, TV-MA, etc.) with series counts. Sorted by restrictiveness.',
}

// =============================================================================
// Filter Ranges Schema
// =============================================================================

export const filterRangesSchema = {
  tags: ['series'],
  summary: 'Get filter ranges',
  description: 'Get min/max values for year, seasons, and rating filters. Useful for building filter UI sliders and range inputs.',
}

// =============================================================================
// Similar Series Schema
// =============================================================================

export const similarSeriesSchema = {
  tags: ['similarity'],
  summary: 'Get similar series',
  description: 'Find series similar to the specified series using AI-powered semantic similarity based on embeddings. Results are ranked by similarity score (0-1, higher is more similar). Requires embeddings to be generated.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Source series ID to find similar series for', example: '789e4567-e89b-12d3-a456-426614174002' },
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
