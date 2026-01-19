/**
 * Discovery OpenAPI Schemas
 */

export const discoverySchemas = {
  // Discovery run info
  DiscoveryRun: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      mediaType: { type: 'string', enum: ['movie', 'series'] },
      status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
      candidatesGenerated: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      completedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  // Discovery candidate
  DiscoveryCandidate: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      runId: { type: 'string', format: 'uuid', nullable: true },
      userId: { type: 'string', format: 'uuid' },
      mediaType: { type: 'string', enum: ['movie', 'series'] },
      tmdbId: { type: 'integer' },
      imdbId: { type: 'string', nullable: true },
      rank: { type: 'integer' },
      finalScore: { type: 'number' },
      similarityScore: { type: 'number' },
      popularityScore: { type: 'number' },
      recencyScore: { type: 'number' },
      sourceScore: { type: 'number' },
      source: { type: 'string' },
      sourceMediaId: { type: 'string', nullable: true },
      title: { type: 'string' },
      originalTitle: { type: 'string', nullable: true },
      originalLanguage: { type: 'string', nullable: true },
      releaseYear: { type: 'integer', nullable: true },
      posterPath: { type: 'string', nullable: true },
      backdropPath: { type: 'string', nullable: true },
      overview: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      voteAverage: { type: 'number', nullable: true },
      voteCount: { type: 'integer', nullable: true },
      scoreBreakdown: { type: 'object', additionalProperties: true },
      castMembers: { type: 'array', items: { type: 'string' } },
      directors: { type: 'array', items: { type: 'string' } },
      runtimeMinutes: { type: 'integer', nullable: true },
      tagline: { type: 'string', nullable: true },
      isEnriched: { type: 'boolean' },
      isDynamic: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  // Pagination info
  DiscoveryPagination: {
    type: 'object',
    properties: {
      total: { type: 'integer' },
      limit: { type: 'integer' },
      offset: { type: 'integer' },
      hasMore: { type: 'boolean' },
    },
  },

  // Discovery response
  DiscoveryResponse: {
    type: 'object',
    properties: {
      run: { $ref: 'DiscoveryRun#' },
      candidates: { type: 'array', items: { $ref: 'DiscoveryCandidate#' } },
      pagination: { $ref: 'DiscoveryPagination#' },
    },
  },

  // Discovery status response
  DiscoveryStatusResponse: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      requestEnabled: { type: 'boolean' },
      movieRun: { $ref: 'DiscoveryRun#' },
      seriesRun: { $ref: 'DiscoveryRun#' },
      movieCount: { type: 'integer' },
      seriesCount: { type: 'integer' },
    },
  },

  // Prerequisites response
  DiscoveryPrerequisitesResponse: {
    type: 'object',
    properties: {
      ready: { type: 'boolean' },
      jellyseerrConfigured: { type: 'boolean' },
      enabledUserCount: { type: 'integer' },
      enabledUsernames: { type: 'array', items: { type: 'string' } },
      message: { type: 'string', nullable: true },
    },
  },
} as const

// Route-specific schemas
export const getDiscoveryMoviesSchema = {
  tags: ['discovery'],
  summary: 'Get movie discovery suggestions',
  description: 'Get discovery suggestions for movies not in the library',
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Maximum results (max 100)' },
      offset: { type: 'string', description: 'Pagination offset' },
      languages: { type: 'string', description: 'Comma-separated ISO 639-1 language codes' },
      includeUnknownLanguage: { type: 'string', enum: ['true', 'false'] },
      genres: { type: 'string', description: 'Comma-separated TMDb genre IDs' },
      yearStart: { type: 'string', description: 'Minimum release year' },
      yearEnd: { type: 'string', description: 'Maximum release year' },
      minSimilarity: { type: 'string', description: 'Minimum similarity score (0-1)' },
    },
  },
}

export const getDiscoverySeriesSchema = {
  tags: ['discovery'],
  summary: 'Get series discovery suggestions',
  description: 'Get discovery suggestions for series not in the library',
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string' },
      offset: { type: 'string' },
      languages: { type: 'string' },
      includeUnknownLanguage: { type: 'string', enum: ['true', 'false'] },
      genres: { type: 'string' },
      yearStart: { type: 'string' },
      yearEnd: { type: 'string' },
      minSimilarity: { type: 'string' },
    },
  },
}

export const refreshDiscoverySchema = {
  tags: ['discovery'],
  summary: 'Refresh discovery suggestions',
  description: 'Trigger regeneration of discovery suggestions',
}

export const expandDiscoverySchema = {
  tags: ['discovery'],
  summary: 'Expand discovery candidates',
  description: 'Dynamically fetch additional candidates when filters reduce results below target',
  params: {
    type: 'object',
    required: ['mediaType'],
    properties: {
      mediaType: { type: 'string', enum: ['movies', 'series'] },
    },
  },
  body: {
    type: 'object',
    properties: {
      languages: { type: 'array', items: { type: 'string' } },
      genreIds: { type: 'array', items: { type: 'integer' } },
      yearStart: { type: 'integer' },
      yearEnd: { type: 'integer' },
      excludeTmdbIds: { type: 'array', items: { type: 'integer' } },
      targetCount: { type: 'integer' },
    },
  },
}

export const getDiscoveryStatusSchema = {
  tags: ['discovery'],
  summary: 'Get discovery status',
  description: 'Get discovery status for the current user',
}

export const getDiscoveryPrerequisitesSchema = {
  tags: ['discovery'],
  summary: 'Check discovery prerequisites',
  description: 'Check if discovery feature prerequisites are met (admin only)',
}
