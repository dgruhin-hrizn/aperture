/**
 * Ratings OpenAPI Schemas
 */

// Schema references using Fastify format
const UserRatingRef = { $ref: 'UserRating#' }
const DislikedItemRef = { $ref: 'DislikedItem#' }

export const ratingsSchemas = {
  // User rating item
  UserRating: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      movie_id: { type: 'string', format: 'uuid', nullable: true },
      series_id: { type: 'string', format: 'uuid', nullable: true },
      rating: { type: 'integer', minimum: 1, maximum: 10 },
      source: { type: 'string', description: 'Source of rating (manual, trakt, etc.)' },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      poster_url: { type: 'string', nullable: true },
    },
  },

  // Disliked item
  DislikedItem: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      rating: { type: 'integer', minimum: 1, maximum: 3 },
    },
  },

  // Ratings list response
  RatingsListResponse: {
    type: 'object',
    properties: {
      ratings: { type: 'array', items: UserRatingRef },
      movies: { type: 'array', items: UserRatingRef },
      series: { type: 'array', items: UserRatingRef },
    },
  },

  // Disliked response
  DislikedResponse: {
    type: 'object',
    properties: {
      movies: { type: 'array', items: DislikedItemRef },
      series: { type: 'array', items: DislikedItemRef },
      totalCount: { type: 'integer' },
    },
  },

  // Single rating response
  SingleRatingResponse: {
    type: 'object',
    properties: {
      rating: { type: 'integer', nullable: true, minimum: 1, maximum: 10 },
      source: { type: 'string', nullable: true },
    },
  },

  // Bulk ratings request
  BulkRatingsRequest: {
    type: 'object',
    required: ['ratings'],
    properties: {
      ratings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            movieId: { type: 'string', format: 'uuid' },
            seriesId: { type: 'string', format: 'uuid' },
            rating: { type: 'integer', minimum: 1, maximum: 10 },
            source: { type: 'string' },
          },
        },
      },
    },
  },

  // Bulk ratings response
  BulkRatingsResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      inserted: { type: 'integer' },
      updated: { type: 'integer' },
      skipped: { type: 'integer' },
    },
  },
} as const

// Route-specific schemas with Fastify $ref format
export const getRatingsSchema = {
  tags: ['ratings'],
  summary: 'Get all ratings',
  description: 'Get all ratings for the current user',
}

export const getDislikedSchema = {
  tags: ['ratings'],
  summary: 'Get disliked items',
  description: 'Get all disliked items (rating <= 3) for the current user',
  querystring: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['movie', 'series', 'all'] },
    },
  },
}

export const getMovieRatingSchema = {
  tags: ['ratings'],
  summary: 'Get movie rating',
  description: 'Get rating for a specific movie',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
}

export const getSeriesRatingSchema = {
  tags: ['ratings'],
  summary: 'Get series rating',
  description: 'Get rating for a specific series',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
}

export const rateMovieSchema = {
  tags: ['ratings'],
  summary: 'Rate a movie',
  description: 'Rate a movie (1-10)',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    additionalProperties: true,
    required: ['rating'],
    properties: {
      rating: { type: 'integer', minimum: 1, maximum: 10 },
    },
  },
}

export const rateSeriesSchema = {
  tags: ['ratings'],
  summary: 'Rate a series',
  description: 'Rate a series (1-10)',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    additionalProperties: true,
    required: ['rating'],
    properties: {
      rating: { type: 'integer', minimum: 1, maximum: 10 },
    },
  },
}

export const deleteMovieRatingSchema = {
  tags: ['ratings'],
  summary: 'Delete movie rating',
  description: 'Remove rating for a movie',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
}

export const deleteSeriesRatingSchema = {
  tags: ['ratings'],
  summary: 'Delete series rating',
  description: 'Remove rating for a series',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
}

export const bulkRatingsSchema = {
  tags: ['ratings'],
  summary: 'Bulk upsert ratings',
  description: 'Bulk upsert ratings (used by Trakt sync)',
  body: { $ref: 'BulkRatingsRequest#' },
}
