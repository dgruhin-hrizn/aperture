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
      tmdbFallbackImageUrl: {
        type: 'string',
        nullable: true,
        description: 'TMDb profile image when the media server has no portrait',
      },
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

  PersonBrowseRow: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      credits: { type: 'integer' },
      movieCredits: { type: 'integer' },
      seriesCredits: { type: 'integer' },
    },
  },

  PeopleListResponse: {
    type: 'object',
    properties: {
      people: { type: 'array', items: { $ref: 'PersonBrowseRow#' } },
      total: { type: 'integer' },
      page: { type: 'integer' },
      pageSize: { type: 'integer' },
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

export const getPeopleListSchema = {
  tags: ['discovery'],
  summary: 'List people in library',
  description:
    'Distinct actor and director names from synced movies and series, with library visibility matching Browse lists.',
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Optional case-insensitive name filter' },
      page: { type: 'string', description: '1-based page number' },
      pageSize: { type: 'string', description: 'Page size (max 50)' },
      sortBy: { type: 'string', enum: ['name', 'credits'], description: 'Sort field' },
      showAll: { type: 'string', enum: ['true', 'false'], description: 'Include disabled libraries' },
    },
  },
}
