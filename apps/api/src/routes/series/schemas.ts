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
  description: 'Get a paginated list of TV series with filtering and sorting options.',
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'string' as const, description: 'Page number (default: 1)' },
      pageSize: { type: 'string' as const, description: 'Items per page (max: 100, default: 50)' },
      search: { type: 'string' as const, description: 'Search by title' },
      genre: { type: 'string' as const, description: 'Filter by genre' },
      network: { type: 'string' as const, description: 'Filter by network (e.g., HBO, Netflix, AMC)' },
      status: { type: 'string' as const, description: 'Filter by status (Continuing, Ended)' },
      minRtScore: { type: 'string' as const, description: 'Minimum Rotten Tomatoes critic score (0-100)' },
      showAll: { type: 'string' as const, description: 'Include series from all libraries (true/false)' },
      hasAwards: { type: 'string' as const, description: 'Only series with awards (true/false)' },
      minYear: { type: 'string' as const, description: 'Minimum first air year' },
      maxYear: { type: 'string' as const, description: 'Maximum first air year' },
      contentRating: { type: 'string' as const, description: 'Filter by content rating (TV-G, TV-PG, TV-14, TV-MA)' },
      minSeasons: { type: 'string' as const, description: 'Minimum number of seasons' },
      maxSeasons: { type: 'string' as const, description: 'Maximum number of seasons' },
      minCommunityRating: { type: 'string' as const, description: 'Minimum community rating (0-10)' },
      minMetacritic: { type: 'string' as const, description: 'Minimum Metacritic score (0-100)' },
      sortBy: { 
        type: 'string' as const, 
        enum: ['title', 'year', 'rating', 'rtScore', 'metacritic', 'seasons', 'added'],
        description: 'Field to sort by'
      },
      sortOrder: { 
        type: 'string' as const, 
        enum: ['asc', 'desc'],
        description: 'Sort direction'
      },
    },
  },
  // Note: response schema removed to allow DB snake_case fields to pass through without serialization
}

// =============================================================================
// Get Series Detail Schema
// =============================================================================

export const getSeriesSchema = {
  tags: ['series'],
  summary: 'Get series by ID',
  description: 'Retrieve a single series with full metadata including cast, crew, ratings, and enrichment data from TMDb, OMDb, and MDBList.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Series ID' },
    },
    required: ['id'] as string[],
  },
  // Note: response schema removed to allow DB snake_case fields to pass through without serialization
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
  response: {
    200: {
      type: 'object' as const,
      description: 'Watch statistics for the series',
      properties: {
        currentlyWatching: { type: 'integer' as const, description: 'Users currently watching this series' },
        totalViewers: { type: 'integer' as const, description: 'Total users who have watched any episode' },
        completedViewers: { type: 'integer' as const, description: 'Users who have watched all episodes' },
        totalEpisodes: { type: 'integer' as const, description: 'Total episodes in the series' },
        totalEpisodePlays: { type: 'integer' as const, description: 'Total episode plays across all users' },
        favoritedEpisodes: { type: 'integer' as const, description: 'Total favorited episodes across all users' },
        firstWatched: { type: 'string' as const, format: 'date-time', nullable: true, description: 'When the series was first watched' },
        lastWatched: { type: 'string' as const, format: 'date-time', nullable: true, description: 'Most recent watch time' },
        averageUserRating: { type: 'number' as const, nullable: true, description: 'Average user rating (1-10)' },
        totalRatings: { type: 'integer' as const, description: 'Number of user ratings' },
        averageProgress: { type: 'integer' as const, description: 'Average completion percentage across viewers' },
        watchPercentage: { type: 'integer' as const, description: 'Percentage of users who have watched any episode' },
        totalUsers: { type: 'integer' as const, description: 'Total number of users in the system' },
      },
      example: {
        currentlyWatching: 12,
        totalViewers: 45,
        completedViewers: 28,
        totalEpisodes: 62,
        totalEpisodePlays: 2340,
        favoritedEpisodes: 89,
        firstWatched: '2022-05-10T14:30:00Z',
        lastWatched: '2024-01-15T21:45:00Z',
        averageUserRating: 9.2,
        totalRatings: 38,
        averageProgress: 76,
        watchPercentage: 90,
        totalUsers: 50,
      },
    },
  },
}

// =============================================================================
// Episodes Schema
// =============================================================================

export const episodesSchema = {
  tags: ['series'],
  summary: 'Get series episodes',
  description: 'Get all episodes for a series, grouped by season. Includes episode details like title, overview, ratings, and air dates.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Series ID' },
    },
    required: ['id'] as string[],
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        episodes: { 
          type: 'array' as const, 
          items: EpisodeRef,
          description: 'All episodes in order'
        },
        seasons: { 
          type: 'object' as const, 
          description: 'Episodes grouped by season number',
          additionalProperties: {
            type: 'array' as const,
            items: EpisodeRef
          }
        },
        totalEpisodes: { type: 'integer' as const, description: 'Total episode count' },
        seasonCount: { type: 'integer' as const, description: 'Number of seasons' },
      },
    },
  },
}

// =============================================================================
// Genres Schema
// =============================================================================

export const genresSchema = {
  tags: ['series'],
  summary: 'List series genres',
  description: 'Get all unique genres from the series library.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        genres: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'List of all unique genres',
          example: ['Action', 'Comedy', 'Drama', 'Sci-Fi & Fantasy', 'Crime', 'Documentary'],
        },
      },
    },
  },
}

// =============================================================================
// Networks Schema
// =============================================================================

export const networksSchema = {
  tags: ['series'],
  summary: 'List networks',
  description: 'Get all unique networks/streaming services from the series library.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        networks: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'List of all unique networks',
          example: ['HBO', 'Netflix', 'AMC', 'FX', 'Apple TV+', 'Prime Video'],
        },
      },
    },
  },
}

// =============================================================================
// Keywords Schema
// =============================================================================

export const keywordsSchema = {
  tags: ['series'],
  summary: 'List series keywords',
  description: 'Get the top 100 keywords from series metadata (sourced from TMDb enrichment). Keywords with only one series are excluded.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const, description: 'Keyword name' },
              count: { type: 'integer' as const, description: 'Number of series with this keyword' },
            },
          },
          description: 'List of keywords sorted by frequency',
          example: [
            { name: 'based on novel', count: 45 },
            { name: 'crime', count: 38 },
            { name: 'anthology', count: 22 },
          ],
        },
      },
    },
  },
}

// =============================================================================
// Content Ratings Schema
// =============================================================================

export const contentRatingsSchema = {
  tags: ['series'],
  summary: 'List content ratings',
  description: 'Get all unique content ratings (TV-G, TV-PG, TV-14, TV-MA, etc.) with series counts. Sorted by restrictiveness.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        contentRatings: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              rating: { type: 'string' as const, description: 'Content rating' },
              count: { type: 'integer' as const, description: 'Number of series with this rating' },
            },
          },
          example: [
            { rating: 'TV-MA', count: 156 },
            { rating: 'TV-14', count: 98 },
            { rating: 'TV-PG', count: 45 },
          ],
        },
      },
    },
  },
}

// =============================================================================
// Filter Ranges Schema
// =============================================================================

export const filterRangesSchema = {
  tags: ['series'],
  summary: 'Get filter ranges',
  description: 'Get min/max values for year, seasons, and rating filters. Useful for building filter UI sliders and range inputs.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        year: {
          type: 'object' as const,
          properties: {
            min: { type: 'integer' as const, description: 'Oldest series year', example: 1950 },
            max: { type: 'integer' as const, description: 'Newest series year', example: 2024 },
          },
        },
        seasons: {
          type: 'object' as const,
          properties: {
            min: { type: 'integer' as const, description: 'Minimum seasons', example: 1 },
            max: { type: 'integer' as const, description: 'Maximum seasons', example: 30 },
          },
        },
        rating: {
          type: 'object' as const,
          properties: {
            min: { type: 'number' as const, description: 'Lowest community rating', example: 1.0 },
            max: { type: 'number' as const, description: 'Highest community rating', example: 10.0 },
          },
        },
      },
    },
  },
}

// =============================================================================
// Similar Series Schema
// =============================================================================

export const similarSeriesSchema = {
  tags: ['similarity'],
  summary: 'Get similar series',
  description: 'Find series similar to the specified series using AI-powered semantic similarity based on embeddings. Results are ranked by similarity score.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Series ID' },
    },
    required: ['id'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      limit: { type: 'string' as const, description: 'Maximum results to return (default: 10, max: 50)' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        similar: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const, format: 'uuid' },
              title: { type: 'string' as const },
              year: { type: 'integer' as const, nullable: true },
              posterUrl: { type: 'string' as const, nullable: true },
              genres: { type: 'array' as const, items: { type: 'string' as const } },
              network: { type: 'string' as const, nullable: true },
              similarity: { type: 'number' as const, description: 'Similarity score from 0-1' },
            },
          },
          description: 'List of similar series with similarity scores'
        },
      },
    },
    404: ErrorRef,
  },
}
