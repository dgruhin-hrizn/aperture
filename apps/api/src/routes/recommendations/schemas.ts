/**
 * Recommendations OpenAPI Schemas
 * 
 * AI-powered personalized recommendations using semantic similarity.
 */

// =============================================================================
// Component Schemas
// =============================================================================

// Media item schema (movie or series nested object)
const MediaItemSchema = {
  type: 'object' as const,
  description: 'Movie or series details',
  properties: {
    id: { type: 'string' as const, format: 'uuid', description: 'Media ID' },
    title: { type: 'string' as const, description: 'Title' },
    year: { type: 'integer' as const, nullable: true, description: 'Release year' },
    poster_url: { type: 'string' as const, nullable: true, description: 'Poster image URL' },
    genres: { type: 'array' as const, items: { type: 'string' as const }, description: 'Genre list' },
    community_rating: { type: 'number' as const, nullable: true, description: 'Community rating' },
    overview: { type: 'string' as const, nullable: true, description: 'Overview/description' },
  },
}

export const recommendationComponentSchemas = {
  // Recommendation candidate
  RecommendationCandidate: {
    type: 'object' as const,
    description: 'A recommended movie or series with scoring details',
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Recommendation candidate ID' },
      movie_id: { type: 'string' as const, format: 'uuid', nullable: true, description: 'Movie ID (if movie recommendation)' },
      series_id: { type: 'string' as const, format: 'uuid', nullable: true, description: 'Series ID (if series recommendation)' },
      rank: { type: 'integer' as const, description: 'Position in recommendation list (1 = best)' },
      selected_rank: { type: 'integer' as const, nullable: true, description: 'Position in selected list' },
      is_selected: { type: 'boolean' as const, description: 'Whether this candidate was selected for the final list' },
      final_score: { type: 'number' as const, description: 'Combined recommendation score (0-1)' },
      similarity_score: { type: 'number' as const, nullable: true, description: 'Semantic similarity to user preferences (0-1)' },
      novelty_score: { type: 'number' as const, nullable: true, description: 'How different from recently watched (0-1)' },
      rating_score: { type: 'number' as const, nullable: true, description: 'Community/critic rating score (0-1)' },
      diversity_score: { type: 'number' as const, nullable: true, description: 'Genre diversity contribution (0-1)' },
      score_breakdown: { type: 'object' as const, additionalProperties: true, description: 'Detailed score breakdown' },
      run_id: { type: 'string' as const, format: 'uuid', description: 'Run ID' },
      movie: MediaItemSchema,
      series: MediaItemSchema,
    },
  },

  // Recommendation run
  RecommendationRun: {
    type: 'object' as const,
    description: 'A recommendation generation run',
    properties: {
      id: { type: 'string' as const, format: 'uuid', description: 'Run ID' },
      user_id: { type: 'string' as const, format: 'uuid', description: 'User ID' },
      run_type: { type: 'string' as const, description: 'Type of run (scheduled, manual, etc.)' },
      media_type: { type: 'string' as const, enum: ['movie', 'series'], description: 'Media type' },
      candidate_count: { type: 'integer' as const, description: 'Number of candidates evaluated' },
      selected_count: { type: 'integer' as const, description: 'Number of recommendations selected' },
      total_candidates: { type: 'integer' as const, description: 'Total number of candidates' },
      duration_ms: { type: 'integer' as const, nullable: true, description: 'Run duration in milliseconds' },
      status: { type: 'string' as const, enum: ['running', 'completed', 'failed'], description: 'Run status' },
      error_message: { type: 'string' as const, nullable: true, description: 'Error message if failed' },
      created_at: { type: 'string' as const, format: 'date-time', description: 'When the run started' },
    },
  },

  // Recommendation preferences
  RecommendationPreferences: {
    type: 'object' as const,
    description: 'User recommendation algorithm preferences',
    properties: {
      includeWatched: { type: 'boolean' as const, description: 'Include already-watched content in recommendations' },
      preferredGenres: { type: 'array' as const, items: { type: 'string' as const }, description: 'Genres to prioritize' },
      excludedGenres: { type: 'array' as const, items: { type: 'string' as const }, description: 'Genres to exclude' },
      noveltyWeight: { type: 'number' as const, description: 'Weight for novelty score (0-1)' },
      ratingWeight: { type: 'number' as const, description: 'Weight for rating score (0-1)' },
    },
  },
} as const

// =============================================================================
// Movie Recommendations Schemas
// =============================================================================

const getMovieRecommendations = {
  tags: ['recommendations'],
  summary: 'Get movie recommendations',
  description: 'Get the user\'s latest movie recommendations. Returns the most recent recommendation run results. Admins can query any user; regular users can only query themselves.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID to get recommendations for', example: 'def4567-e89b-12d3-a456-426614174004' },
    },
    required: ['userId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      runId: { type: 'string' as const, format: 'uuid', description: 'Specific run ID to retrieve (optional, defaults to latest)' },
    },
  },
}

const regenerateMovieRecommendations = {
  tags: ['recommendations'],
  summary: 'Regenerate movie recommendations',
  description: 'Trigger a new recommendation generation for movies. This runs the AI recommendation algorithm using the user\'s watch history and preferences. Requires embeddings to be generated.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID to regenerate recommendations for' },
    },
    required: ['userId'] as string[],
  },
}

const getMovieInsights = {
  tags: ['recommendations'],
  summary: 'Get movie insights',
  description: 'Get detailed AI-generated insights explaining why a specific movie was recommended. Includes score breakdown and similar movies from watch history.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID' },
      movieId: { type: 'string' as const, format: 'uuid', description: 'Movie ID to get insights for' },
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
  description: 'Get the user\'s latest series recommendations. Returns the most recent recommendation run results. Admins can query any user; regular users can only query themselves.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID to get recommendations for' },
    },
    required: ['userId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      runId: { type: 'string' as const, format: 'uuid', description: 'Specific run ID to retrieve (optional, defaults to latest)' },
    },
  },
}

const regenerateSeriesRecommendations = {
  tags: ['recommendations'],
  summary: 'Regenerate series recommendations',
  description: 'Trigger a new recommendation generation for series. This runs the AI recommendation algorithm using the user\'s watch history and preferences. Requires embeddings to be generated.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID to regenerate recommendations for' },
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
  description: 'Get the user\'s recommendation run history showing past recommendation generations with their status and timing.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID' },
    },
    required: ['userId'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      limit: { type: 'string' as const, description: 'Maximum runs to return', default: '10', example: '20' },
    },
  },
}

const getEvidence = {
  tags: ['recommendations'],
  summary: 'Get recommendation evidence',
  description: 'Get detailed evidence for why a specific item was recommended, including the movies/series from watch history that contributed to its score.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID' },
      candidateId: { type: 'string' as const, format: 'uuid', description: 'Recommendation candidate ID' },
    },
    required: ['userId', 'candidateId'] as string[],
  },
}

// =============================================================================
// Preferences Schemas
// =============================================================================

const getPreferences = {
  tags: ['recommendations'],
  summary: 'Get recommendation preferences',
  description: 'Get the user\'s recommendation algorithm preferences including genre preferences and weight settings.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID' },
    },
    required: ['userId'] as string[],
  },
}

const updatePreferences = {
  tags: ['recommendations'],
  summary: 'Update recommendation preferences',
  description: 'Update the user\'s recommendation algorithm preferences. Changes take effect on the next recommendation generation.',
  params: {
    type: 'object' as const,
    properties: {
      userId: { type: 'string' as const, format: 'uuid', description: 'User ID' },
    },
    required: ['userId'] as string[],
  },
  body: {
    type: 'object' as const,
    additionalProperties: true,
    description: 'Preferences to update (partial)',
    properties: {
      includeWatched: { type: 'boolean' as const, description: 'Include already-watched content in recommendations' },
      preferredGenres: { type: 'array' as const, items: { type: 'string' as const }, description: 'Genres to prioritize', example: ['Sci-Fi', 'Thriller'] },
      excludedGenres: { type: 'array' as const, items: { type: 'string' as const }, description: 'Genres to exclude', example: ['Horror'] },
      noveltyWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for novelty score (0-1)', example: 0.3 },
      ratingWeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Weight for rating score (0-1)', example: 0.2 },
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
