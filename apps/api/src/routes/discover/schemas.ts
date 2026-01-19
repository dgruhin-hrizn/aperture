/**
 * Discover (Person/Studio) OpenAPI Schemas
 */

export const discoverSchemas = {
  // Content item
  ContentItem: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      backdropUrl: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      communityRating: { type: 'number', nullable: true },
      role: { type: 'string', description: 'Actor\'s role in this content' },
    },
  },

  // Person stats
  PersonStats: {
    type: 'object',
    properties: {
      totalMovies: { type: 'integer' },
      totalSeries: { type: 'integer' },
      asActor: { type: 'integer' },
      asDirector: { type: 'integer' },
    },
  },

  // Person response
  PersonResponse: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      imageUrl: { type: 'string', nullable: true },
      movies: { type: 'array', items: { $ref: 'ContentItem#' } },
      series: { type: 'array', items: { $ref: 'ContentItem#' } },
      stats: { $ref: 'PersonStats#' },
    },
  },

  // Studio stats
  StudioStats: {
    type: 'object',
    properties: {
      totalMovies: { type: 'integer' },
      totalSeries: { type: 'integer' },
    },
  },

  // Studio response
  StudioResponse: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      imageUrl: { type: 'string', nullable: true },
      movies: { type: 'array', items: { $ref: 'ContentItem#' } },
      series: { type: 'array', items: { $ref: 'ContentItem#' } },
      stats: { $ref: 'StudioStats#' },
    },
  },
} as const

// Route-specific schemas
export const getPersonSchema = {
  tags: ['discovery'],
  summary: 'Get person filmography',
  description: 'Get all movies and series featuring a person (actor or director)',
  params: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', description: 'Person name (URL encoded)' },
    },
  },
}

export const getStudioSchema = {
  tags: ['discovery'],
  summary: 'Get studio content',
  description: 'Get all movies and series from a studio or network',
  params: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', description: 'Studio name (URL encoded)' },
    },
  },
}
