/**
 * Search OpenAPI Schemas
 */

export const searchSchemas = {
  // Search result item
  SearchResult: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      original_title: { type: 'string', nullable: true },
      year: { type: 'integer', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      overview: { type: 'string', nullable: true },
      poster_url: { type: 'string', nullable: true },
      community_rating: { type: 'number', nullable: true },
      rt_critic_score: { type: 'integer', nullable: true },
      collection_name: { type: 'string', nullable: true, description: 'Movie collection name' },
      network: { type: 'string', nullable: true, description: 'Series network' },
      text_rank: { type: 'number', description: 'Full-text search score' },
      fuzzy_similarity: { type: 'number', description: 'Trigram similarity score' },
      semantic_similarity: { type: 'number', nullable: true, description: 'Semantic embedding similarity score' },
      combined_score: { type: 'number', description: 'Weighted combined search score' },
    },
  },

  // Search filters
  SearchFilters: {
    type: 'object',
    properties: {
      genre: { type: 'string' },
      year: {
        type: 'object',
        properties: {
          min: { type: 'integer' },
          max: { type: 'integer' },
        },
      },
      minRtScore: { type: 'integer' },
      collection: { type: 'string' },
      network: { type: 'string' },
      type: { type: 'string', enum: ['movie', 'series', 'all'] },
    },
  },

  // Search response
  SearchResponse: {
    type: 'object',
    properties: {
      results: { type: 'array', items: { $ref: 'SearchResult#' } },
      total: { type: 'integer' },
      query: { type: 'string' },
      filters: { $ref: 'SearchFilters#' },
    },
  },

  // Suggestion item
  SearchSuggestion: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: ['movie', 'series'] },
      year: { type: 'integer', nullable: true },
      label: { type: 'string', description: 'Formatted label with year' },
    },
  },

  // Filter options response
  SearchFilterOptions: {
    type: 'object',
    properties: {
      genres: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            count: { type: 'integer' },
          },
        },
      },
      collections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            count: { type: 'integer' },
          },
        },
      },
      networks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            count: { type: 'integer' },
          },
        },
      },
      yearRange: {
        type: 'object',
        properties: {
          min: { type: 'integer' },
          max: { type: 'integer' },
        },
      },
    },
  },
} as const

// Route-specific schemas
export const searchSchema = {
  tags: ['search'],
  summary: 'Search media library',
  description: 'Unified search combining full-text, fuzzy, and semantic search',
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string', description: 'Search query' },
      type: { type: 'string', enum: ['movie', 'series', 'all'], description: 'Filter by media type' },
      genre: { type: 'string', description: 'Filter by genre' },
      yearMin: { type: 'string', description: 'Minimum release year' },
      yearMax: { type: 'string', description: 'Maximum release year' },
      minRtScore: { type: 'string', description: 'Minimum Rotten Tomatoes score' },
      collection: { type: 'string', description: 'Filter by movie collection' },
      network: { type: 'string', description: 'Filter by TV network' },
      limit: { type: 'string', description: 'Maximum results (max 100)' },
      semantic: { type: 'string', enum: ['true', 'false'], description: 'Enable semantic search' },
    },
  },
  response: {
    200: { $ref: 'SearchResponse#' },
  },
}

export const searchSuggestionsSchema = {
  tags: ['search'],
  summary: 'Get search suggestions',
  description: 'Get search suggestions for autocomplete',
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string', description: 'Search query' },
      limit: { type: 'string', description: 'Maximum suggestions (max 20)' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        suggestions: { type: 'array', items: { $ref: 'SearchSuggestion#' } },
      },
    },
  },
}

export const searchFiltersSchema = {
  tags: ['search'],
  summary: 'Get search filter options',
  description: 'Get available filter options including genres, collections, networks, and year range',
  response: {
    200: { $ref: 'SearchFilterOptions#' },
  },
}
