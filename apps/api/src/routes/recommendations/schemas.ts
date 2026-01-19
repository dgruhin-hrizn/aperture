/**
 * Recommendations OpenAPI Schemas
 */

// =============================================================================
// Movie Recommendations Schemas
// =============================================================================

const getMovieRecommendations = {
  tags: ['recommendations'],
  summary: 'Get movie recommendations',
  description: 'Get user\'s latest movie recommendations.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
    },
    required: ['userId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      runId: { type: 'string' as const },
    },
  },
}

const regenerateMovieRecommendations = {
  tags: ['recommendations'],
  summary: 'Regenerate movie recommendations',
  description: 'Regenerate movie recommendations for a user.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
    },
    required: ['userId'] as string[],
  },
}

const getMovieInsights = {
  tags: ['recommendations'],
  summary: 'Get movie insights',
  description: 'Get detailed AI recommendation insights for a specific movie.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
      movieId: { type: 'string' as const },
    },
    required: ['userId', 'movieId'] as string[],
  },
}

// =============================================================================
// Series Recommendations Schemas
// =============================================================================

const getSeriesRecommendations = {
  tags: ['recommendations'],
  summary: 'Get series recommendations',
  description: 'Get user\'s latest series recommendations.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
    },
    required: ['userId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      runId: { type: 'string' as const },
    },
  },
}

const regenerateSeriesRecommendations = {
  tags: ['recommendations'],
  summary: 'Regenerate series recommendations',
  description: 'Regenerate series recommendations for a user.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
    },
    required: ['userId'] as string[],
  },
}

// =============================================================================
// History & Evidence Schemas
// =============================================================================

const getHistory = {
  tags: ['recommendations'],
  summary: 'Get recommendation history',
  description: 'Get user\'s recommendation run history.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
    },
    required: ['userId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      limit: { type: 'string' as const },
    },
  },
}

const getEvidence = {
  tags: ['recommendations'],
  summary: 'Get recommendation evidence',
  description: 'Get evidence for why a movie was recommended.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
      candidateId: { type: 'string' as const },
    },
    required: ['userId', 'candidateId'] as string[],
  },
}

// =============================================================================
// Preferences Schemas
// =============================================================================

const getPreferences = {
  tags: ['recommendations'],
  summary: 'Get preferences',
  description: 'Get user\'s recommendation preferences.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
    },
    required: ['userId'] as string[],
  },
}

const updatePreferences = {
  tags: ['recommendations'],
  summary: 'Update preferences',
  description: 'Update user\'s recommendation preferences.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const },
    },
    required: ['userId'] as string[],
  },
  body: {
    type: 'object' as const,
    properties: {
      includeWatched: { type: 'boolean' as const },
      preferredGenres: { type: 'array' as const, items: { type: 'string' as const } },
      excludedGenres: { type: 'array' as const, items: { type: 'string' as const } },
      noveltyWeight: { type: 'number' as const },
      ratingWeight: { type: 'number' as const },
    },
  },
}

// =============================================================================
// Export all schemas
// =============================================================================

export const recommendationSchemas = {
  getMovieRecommendations,
  regenerateMovieRecommendations,
  getMovieInsights,
  getSeriesRecommendations,
  regenerateSeriesRecommendations,
  getHistory,
  getEvidence,
  getPreferences,
  updatePreferences,
}
