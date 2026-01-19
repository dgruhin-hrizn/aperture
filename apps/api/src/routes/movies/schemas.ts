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
  description: 'Get a paginated list of movies with filtering and sorting options.',
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'string' as const, description: 'Page number (default: 1)' },
      pageSize: { type: 'string' as const, description: 'Items per page (max: 100, default: 50)' },
      search: { type: 'string' as const, description: 'Search by title' },
      genre: { type: 'string' as const, description: 'Filter by genre' },
      collection: { type: 'string' as const, description: 'Filter by collection/franchise name' },
      minRtScore: { type: 'string' as const, description: 'Minimum Rotten Tomatoes critic score (0-100)' },
      showAll: { type: 'string' as const, description: 'Include movies from all libraries (true/false)' },
      hasAwards: { type: 'string' as const, description: 'Only movies with awards (true/false)' },
      minYear: { type: 'string' as const, description: 'Minimum release year' },
      maxYear: { type: 'string' as const, description: 'Maximum release year' },
      contentRating: { type: 'string' as const, description: 'Filter by content rating (G, PG, PG-13, R, etc.)' },
      minRuntime: { type: 'string' as const, description: 'Minimum runtime in minutes' },
      maxRuntime: { type: 'string' as const, description: 'Maximum runtime in minutes' },
      minCommunityRating: { type: 'string' as const, description: 'Minimum community rating (0-10)' },
      minMetacritic: { type: 'string' as const, description: 'Minimum Metacritic score (0-100)' },
      resolution: { type: 'string' as const, description: 'Filter by resolution (4K, 1080p, 720p, SD)' },
      sortBy: { 
        type: 'string' as const, 
        enum: ['title', 'year', 'releaseDate', 'rating', 'rtScore', 'metacritic', 'runtime', 'added'],
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
// Get Movie Detail Schema
// =============================================================================

export const getMovieSchema = {
  tags: ['movies'],
  summary: 'Get movie by ID',
  description: 'Retrieve a single movie with full metadata including cast, crew, ratings, and enrichment data from TMDb, OMDb, and MDBList.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Movie ID' },
    },
    required: ['id'] as string[],
  },
  // Note: response schema removed to allow DB snake_case fields to pass through without serialization
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
  response: {
    200: {
      type: 'object' as const,
      description: 'Watch statistics for the movie',
      properties: {
        totalWatchers: { type: 'integer' as const, description: 'Number of unique users who watched this movie' },
        totalPlays: { type: 'integer' as const, description: 'Total number of plays across all users' },
        favoritesCount: { type: 'integer' as const, description: 'Number of users who favorited this movie' },
        firstWatched: { type: 'string' as const, format: 'date-time', nullable: true, description: 'When the movie was first watched by any user' },
        lastWatched: { type: 'string' as const, format: 'date-time', nullable: true, description: 'Most recent watch time' },
        averageUserRating: { type: 'number' as const, nullable: true, description: 'Average user rating (1-10)' },
        totalRatings: { type: 'integer' as const, description: 'Number of user ratings' },
        watchPercentage: { type: 'integer' as const, description: 'Percentage of users who have watched this movie' },
        totalUsers: { type: 'integer' as const, description: 'Total number of users in the system' },
      },
      example: {
        totalWatchers: 42,
        totalPlays: 87,
        favoritesCount: 15,
        firstWatched: '2023-01-15T10:30:00Z',
        lastWatched: '2024-01-10T22:15:00Z',
        averageUserRating: 8.5,
        totalRatings: 35,
        watchPercentage: 84,
        totalUsers: 50,
      },
    },
  },
}

// =============================================================================
// Genres Schema
// =============================================================================

export const genresSchema = {
  tags: ['movies'],
  summary: 'List movie genres',
  description: 'Get all unique genres from the movie library.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        genres: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'List of all unique genres',
          example: ['Action', 'Adventure', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller'],
        },
      },
    },
  },
}

// =============================================================================
// Keywords Schema
// =============================================================================

export const keywordsSchema = {
  tags: ['movies'],
  summary: 'List movie keywords',
  description: 'Get the top 100 keywords from movie metadata (sourced from TMDb enrichment). Keywords with only one movie are excluded.',
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
              count: { type: 'integer' as const, description: 'Number of movies with this keyword' },
            },
          },
          description: 'List of keywords sorted by frequency',
          example: [
            { name: 'based on novel', count: 156 },
            { name: 'revenge', count: 98 },
            { name: 'dystopia', count: 67 },
          ],
        },
      },
    },
  },
}

// =============================================================================
// Collections Schema
// =============================================================================

export const collectionsSchema = {
  tags: ['movies'],
  summary: 'List movie collections',
  description: 'Get all movie collections/franchises (e.g., "The Matrix Collection", "Star Wars Collection") with movie counts.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        collections: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const, description: 'Collection/franchise name' },
              count: { type: 'integer' as const, description: 'Number of movies in this collection' },
            },
          },
          description: 'List of collections sorted by movie count',
          example: [
            { name: 'Marvel Cinematic Universe', count: 32 },
            { name: 'Star Wars Collection', count: 11 },
            { name: 'The Matrix Collection', count: 4 },
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
  tags: ['movies'],
  summary: 'List content ratings',
  description: 'Get all unique content ratings (G, PG, PG-13, R, NC-17, TV ratings) with movie counts. Sorted by restrictiveness.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        contentRatings: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              rating: { type: 'string' as const, description: 'Content rating (G, PG, PG-13, R, etc.)' },
              count: { type: 'integer' as const, description: 'Number of movies with this rating' },
            },
          },
          example: [
            { rating: 'PG-13', count: 245 },
            { rating: 'R', count: 198 },
            { rating: 'PG', count: 156 },
          ],
        },
      },
    },
  },
}

// =============================================================================
// Resolutions Schema
// =============================================================================

export const resolutionsSchema = {
  tags: ['movies'],
  summary: 'List video resolutions',
  description: 'Get video resolution categories (4K, 1080p, 720p, SD) with movie counts.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        resolutions: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              resolution: { type: 'string' as const, description: 'Resolution category' },
              count: { type: 'integer' as const, description: 'Number of movies at this resolution' },
            },
          },
          example: [
            { resolution: '4K', count: 89 },
            { resolution: '1080p', count: 456 },
            { resolution: '720p', count: 123 },
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
  tags: ['movies'],
  summary: 'Get filter ranges',
  description: 'Get min/max values for year, runtime, and rating filters. Useful for building filter UI sliders and range inputs.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        year: {
          type: 'object' as const,
          properties: {
            min: { type: 'integer' as const, description: 'Oldest movie year', example: 1920 },
            max: { type: 'integer' as const, description: 'Newest movie year', example: 2024 },
          },
        },
        runtime: {
          type: 'object' as const,
          properties: {
            min: { type: 'integer' as const, description: 'Shortest runtime in minutes', example: 60 },
            max: { type: 'integer' as const, description: 'Longest runtime in minutes', example: 210 },
          },
        },
        rating: {
          type: 'object' as const,
          properties: {
            min: { type: 'number' as const, description: 'Lowest community rating', example: 1.5 },
            max: { type: 'number' as const, description: 'Highest community rating', example: 10.0 },
          },
        },
      },
    },
  },
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
      page: { type: 'string' as const, description: 'Page number (default: 1)' },
      pageSize: { type: 'string' as const, description: 'Items per page (max: 50, default: 20)' },
      search: { type: 'string' as const, description: 'Search franchise names' },
      sortBy: { 
        type: 'string' as const, 
        enum: ['name', 'total', 'progress', 'unwatched'], 
        description: 'Sort field (default: total)' 
      },
      showCompleted: { type: 'string' as const, description: 'Include completed franchises (default: true)' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        franchises: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              name: { type: 'string' as const, description: 'Franchise/collection name' },
              posterUrl: { type: 'string' as const, nullable: true, description: 'Poster image URL' },
              totalMovies: { type: 'integer' as const, description: 'Total movies in franchise' },
              watchedMovies: { type: 'integer' as const, description: 'Movies watched by user' },
              unwatchedMovies: { type: 'integer' as const, description: 'Movies not yet watched' },
              progress: { type: 'integer' as const, description: 'Watch progress percentage (0-100)' },
              isComplete: { type: 'boolean' as const, description: 'Whether all movies have been watched' },
              movies: { 
                type: 'array' as const, 
                items: MovieRef,
                description: 'Individual movies in the franchise'
              },
            },
          },
        },
        total: { type: 'integer' as const, description: 'Total number of franchises' },
        page: { type: 'integer' as const, description: 'Current page' },
        pageSize: { type: 'integer' as const, description: 'Items per page' },
        stats: {
          type: 'object' as const,
          description: 'Aggregate statistics across all franchises',
          properties: {
            totalFranchises: { type: 'integer' as const },
            completedFranchises: { type: 'integer' as const },
            totalMovies: { type: 'integer' as const },
            watchedMovies: { type: 'integer' as const },
          },
        },
      },
    },
  },
}

// =============================================================================
// Similar Movies Schema
// =============================================================================

export const similarMoviesSchema = {
  tags: ['similarity'],
  summary: 'Get similar movies',
  description: 'Find movies similar to the specified movie using AI-powered semantic similarity based on embeddings. Results are ranked by similarity score.',
  params: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Movie ID' },
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
        similarMovies: {
          type: 'array' as const,
          items: SimilarMovieRef,
          description: 'List of similar movies with similarity scores'
        },
      },
    },
    404: ErrorRef,
  },
}
