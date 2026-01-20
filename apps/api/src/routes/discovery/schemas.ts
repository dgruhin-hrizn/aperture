/**
 * Discovery OpenAPI Schemas
 * 
 * Discovery feature for finding content not in your library.
 * Uses AI similarity to suggest movies/series based on your taste.
 */

export const discoverySchemas = {
  // Discovery run info
  DiscoveryRun: {
    type: 'object',
    description: 'Information about a discovery generation run',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Run ID' },
      userId: { type: 'string', format: 'uuid', description: 'User ID' },
      mediaType: { type: 'string', enum: ['movie', 'series'], description: 'Type of content discovered' },
      status: { 
        type: 'string', 
        enum: ['pending', 'running', 'completed', 'failed'],
        description: 'Run status'
      },
      candidatesGenerated: { type: 'integer', description: 'Number of candidates found' },
      createdAt: { type: 'string', format: 'date-time' },
      completedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  // Discovery candidate
  DiscoveryCandidate: {
    type: 'object',
    description: 'A discovery suggestion (content not in library)',
    properties: {
      id: { type: 'string', description: 'Candidate ID' },
      runId: { type: 'string', format: 'uuid', nullable: true, description: 'Discovery run that generated this' },
      userId: { type: 'string', format: 'uuid' },
      mediaType: { type: 'string', enum: ['movie', 'series'] },
      tmdbId: { type: 'integer', description: 'TMDb ID for requesting/looking up' },
      imdbId: { type: 'string', nullable: true, description: 'IMDb ID' },
      rank: { type: 'integer', description: 'Position in discovery list' },
      finalScore: { type: 'number', description: 'Combined discovery score (0-1)' },
      similarityScore: { type: 'number', description: 'AI similarity to your taste (0-1)' },
      popularityScore: { type: 'number', description: 'TMDb popularity score (normalized 0-1)' },
      recencyScore: { type: 'number', description: 'How recent the content is (0-1)' },
      sourceScore: { type: 'number', description: 'Quality of the recommendation source (0-1)' },
      source: { type: 'string', description: 'How this was discovered (e.g., "similar_to_watched", "tmdb_recommendations")' },
      sourceMediaId: { type: 'string', nullable: true, description: 'ID of the media that led to this suggestion' },
      title: { type: 'string' },
      originalTitle: { type: 'string', nullable: true },
      originalLanguage: { type: 'string', nullable: true, description: 'ISO 639-1 language code' },
      releaseYear: { type: 'integer', nullable: true },
      posterPath: { type: 'string', nullable: true, description: 'TMDb poster path' },
      backdropPath: { type: 'string', nullable: true, description: 'TMDb backdrop path' },
      overview: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      voteAverage: { type: 'number', nullable: true, description: 'TMDb vote average' },
      voteCount: { type: 'integer', nullable: true },
      scoreBreakdown: { type: 'object', additionalProperties: true, description: 'Detailed score components' },
      castMembers: { type: 'array', items: { type: 'string' }, description: 'Top cast members' },
      directors: { type: 'array', items: { type: 'string' } },
      runtimeMinutes: { type: 'integer', nullable: true },
      tagline: { type: 'string', nullable: true },
      isEnriched: { type: 'boolean', description: 'Whether detailed TMDb data has been fetched' },
      isDynamic: { type: 'boolean', description: 'Whether this was dynamically generated (vs. from a run)' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  // Pagination info
  DiscoveryPagination: {
    type: 'object',
    description: 'Pagination metadata',
    properties: {
      total: { type: 'integer', description: 'Total candidates available' },
      limit: { type: 'integer', description: 'Items per page' },
      offset: { type: 'integer', description: 'Current offset' },
      hasMore: { type: 'boolean', description: 'Whether more items exist' },
    },
  },

  // Discovery response
  DiscoveryResponse: {
    type: 'object',
    description: 'Discovery results with pagination',
    properties: {
      run: { $ref: 'DiscoveryRun#' },
      candidates: { type: 'array', items: { $ref: 'DiscoveryCandidate#' } },
      pagination: { $ref: 'DiscoveryPagination#' },
    },
  },

  // Discovery status response
  DiscoveryStatusResponse: {
    type: 'object',
    description: 'Discovery feature status for current user',
    properties: {
      enabled: { type: 'boolean', description: 'Whether discovery is enabled' },
      requestEnabled: { type: 'boolean', description: 'Whether content requests are enabled (Jellyseerr)' },
      movieRun: { $ref: 'DiscoveryRun#' },
      seriesRun: { $ref: 'DiscoveryRun#' },
      movieCount: { type: 'integer', description: 'Number of movie candidates' },
      seriesCount: { type: 'integer', description: 'Number of series candidates' },
    },
  },

  // Prerequisites response
  DiscoveryPrerequisitesResponse: {
    type: 'object',
    description: 'Discovery feature prerequisites check',
    properties: {
      ready: { type: 'boolean', description: 'Whether all prerequisites are met' },
      jellyseerrConfigured: { type: 'boolean', description: 'Whether Jellyseerr is configured (for requests)' },
      enabledUserCount: { type: 'integer', description: 'Number of users with discovery enabled' },
      enabledUsernames: { type: 'array', items: { type: 'string' }, description: 'Usernames with discovery enabled' },
      message: { type: 'string', nullable: true, description: 'Status message or error' },
    },
  },
} as const

// Route-specific schemas
export const getDiscoveryMoviesSchema = {
  tags: ['discovery'],
  summary: 'Get movie discovery suggestions',
  description: 'Get discovery suggestions for movies not in your library. Results are AI-powered based on your watch history and preferences.',
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Maximum results (1-100)', default: '50', example: '25' },
      offset: { type: 'string', description: 'Pagination offset', default: '0', example: '50' },
      languages: { type: 'string', description: 'Filter by original language (comma-separated ISO 639-1 codes)', example: 'en,es,fr' },
      includeUnknownLanguage: { type: 'string', enum: ['true', 'false'], description: 'Include content with unknown language', default: 'true' },
      genres: { type: 'string', description: 'Filter by TMDb genre IDs (comma-separated)', example: '28,12,878' },
      yearStart: { type: 'string', description: 'Minimum release year', example: '2000' },
      yearEnd: { type: 'string', description: 'Maximum release year', example: '2024' },
      minSimilarity: { type: 'string', description: 'Minimum similarity score (0-1)', example: '0.5' },
    },
  },
  response: {
    200: { $ref: 'DiscoveryResponse#' },
  },
}

export const getDiscoverySeriesSchema = {
  tags: ['discovery'],
  summary: 'Get series discovery suggestions',
  description: 'Get discovery suggestions for TV series not in your library. Results are AI-powered based on your watch history and preferences.',
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Maximum results (1-100)', default: '50', example: '25' },
      offset: { type: 'string', description: 'Pagination offset', default: '0' },
      languages: { type: 'string', description: 'Filter by original language (comma-separated ISO 639-1 codes)', example: 'en,ko,ja' },
      includeUnknownLanguage: { type: 'string', enum: ['true', 'false'], description: 'Include content with unknown language', default: 'true' },
      genres: { type: 'string', description: 'Filter by TMDb genre IDs (comma-separated)', example: '18,10765' },
      yearStart: { type: 'string', description: 'Minimum first air year', example: '2015' },
      yearEnd: { type: 'string', description: 'Maximum first air year', example: '2024' },
      minSimilarity: { type: 'string', description: 'Minimum similarity score (0-1)', example: '0.5' },
    },
  },
  response: {
    200: { $ref: 'DiscoveryResponse#' },
  },
}

export const refreshDiscoverySchema = {
  tags: ['discovery'],
  summary: 'Refresh discovery suggestions',
  description: 'Trigger regeneration of discovery suggestions for the current user. This runs the discovery algorithm to find new content.',
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        movieRunId: { type: 'string', format: 'uuid', nullable: true },
        seriesRunId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
}

export const expandDiscoverySchema = {
  tags: ['discovery'],
  summary: 'Expand discovery candidates',
  description: 'Dynamically fetch additional candidates when filters reduce results below target count. Used internally by the UI.',
  params: {
    type: 'object',
    required: ['mediaType'],
    properties: {
      mediaType: { type: 'string', enum: ['movies', 'series'], description: 'Media type to expand' },
    },
  },
  body: {
    type: 'object',
    additionalProperties: true,
    properties: {
      languages: { type: 'array', items: { type: 'string' }, description: 'Language filter' },
      genreIds: { type: 'array', items: { type: 'integer' }, description: 'TMDb genre IDs' },
      yearStart: { type: 'integer', description: 'Minimum year' },
      yearEnd: { type: 'integer', description: 'Maximum year' },
      excludeTmdbIds: { type: 'array', items: { type: 'integer' }, description: 'TMDb IDs to exclude (already shown)' },
      targetCount: { type: 'integer', description: 'Target number of results', example: 50 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        candidates: { type: 'array', items: { $ref: 'DiscoveryCandidate#' } },
        generated: { type: 'integer', description: 'Number of new candidates generated' },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    403: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
}

export const getDiscoveryStatusSchema = {
  tags: ['discovery'],
  summary: 'Get discovery status',
  description: 'Get discovery feature status for the current user including run info and candidate counts.',
  response: {
    200: { $ref: 'DiscoveryStatusResponse#' },
  },
}

export const getDiscoveryPrerequisitesSchema = {
  tags: ['discovery'],
  summary: 'Check discovery prerequisites',
  description: 'Check if discovery feature prerequisites are met (admin only). Returns status of Jellyseerr config and enabled users.',
  response: {
    200: { $ref: 'DiscoveryPrerequisitesResponse#' },
  },
}
