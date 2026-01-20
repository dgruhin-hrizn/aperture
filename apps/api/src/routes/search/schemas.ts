/**
 * Search OpenAPI Schemas
 */

export const searchSchemas = {
  // Search result item
  SearchResult: {
    type: 'object',
    description: 'A single search result item (movie or series)',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier' },
      type: { type: 'string', enum: ['movie', 'series'], description: 'Media type' },
      title: { type: 'string', description: 'Title of the movie or series' },
      original_title: { type: 'string', nullable: true, description: 'Original language title' },
      year: { type: 'integer', nullable: true, description: 'Release year (movie) or first air year (series)' },
      genres: { type: 'array', items: { type: 'string' }, description: 'List of genres' },
      overview: { type: 'string', nullable: true, description: 'Plot summary' },
      poster_url: { type: 'string', nullable: true, description: 'URL to poster image' },
      community_rating: { type: 'number', nullable: true, description: 'Community rating (0-10)' },
      rt_critic_score: { type: 'integer', nullable: true, description: 'Rotten Tomatoes critic score (0-100)' },
      collection_name: { type: 'string', nullable: true, description: 'Movie collection/franchise name (movies only)' },
      network: { type: 'string', nullable: true, description: 'Network/streaming service (series only)' },
      text_rank: { type: 'number', description: 'Full-text search relevance score (higher is better)' },
      fuzzy_similarity: { type: 'number', description: 'Trigram similarity score for fuzzy matching (0-1)' },
      semantic_similarity: { type: 'number', nullable: true, description: 'AI semantic similarity score (0-1). Only present if semantic search is enabled.' },
      combined_score: { type: 'number', description: 'Weighted combined score used for ranking' },
    },
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'movie',
      title: 'The Matrix',
      original_title: null,
      year: 1999,
      genres: ['Action', 'Sci-Fi'],
      overview: 'A computer hacker learns about the true nature of reality.',
      poster_url: '/api/media/movie/123/poster',
      community_rating: 8.7,
      rt_critic_score: 83,
      collection_name: 'The Matrix Collection',
      network: null,
      text_rank: 0.95,
      fuzzy_similarity: 1.0,
      semantic_similarity: 0.92,
      combined_score: 0.94,
    },
  },

  // Search filters
  SearchFilters: {
    type: 'object',
    description: 'Applied search filters',
    properties: {
      genre: { type: 'string', description: 'Genre filter applied' },
      year: {
        type: 'object',
        properties: {
          min: { type: 'integer', description: 'Minimum year filter' },
          max: { type: 'integer', description: 'Maximum year filter' },
        },
      },
      minRtScore: { type: 'integer', description: 'Minimum Rotten Tomatoes score filter' },
      collection: { type: 'string', description: 'Collection filter (movies)' },
      network: { type: 'string', description: 'Network filter (series)' },
      type: { type: 'string', enum: ['movie', 'series', 'all'], description: 'Media type filter' },
    },
  },

  // Search response
  SearchResponse: {
    type: 'object',
    description: 'Search results with metadata',
    properties: {
      results: { type: 'array', items: { $ref: 'SearchResult#' }, description: 'Array of matching items, sorted by relevance' },
      total: { type: 'integer', description: 'Total number of matches' },
      query: { type: 'string', description: 'The search query that was executed' },
      filters: { $ref: 'SearchFilters#' },
    },
  },

  // Suggestion item
  SearchSuggestion: {
    type: 'object',
    description: 'Autocomplete suggestion',
    properties: {
      title: { type: 'string', description: 'Title of the suggested item' },
      type: { type: 'string', enum: ['movie', 'series'], description: 'Media type' },
      year: { type: 'integer', nullable: true, description: 'Release/first air year' },
      label: { type: 'string', description: 'Formatted label for display (e.g., "The Matrix (1999)")' },
    },
    example: {
      title: 'The Matrix',
      type: 'movie',
      year: 1999,
      label: 'The Matrix (1999)',
    },
  },

  // Filter options response
  SearchFilterOptions: {
    type: 'object',
    description: 'Available filter options for search UI',
    properties: {
      genres: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Genre name' },
            count: { type: 'integer', description: 'Number of items with this genre' },
          },
        },
        description: 'Available genres with counts',
      },
      collections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Collection name' },
            count: { type: 'integer', description: 'Number of movies in collection' },
          },
        },
        description: 'Available movie collections',
      },
      networks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Network name' },
            count: { type: 'integer', description: 'Number of series on network' },
          },
        },
        description: 'Available TV networks',
      },
      yearRange: {
        type: 'object',
        properties: {
          min: { type: 'integer', description: 'Earliest year in library', example: 1920 },
          max: { type: 'integer', description: 'Latest year in library', example: 2024 },
        },
        description: 'Year range for slider filters',
      },
    },
  },
} as const

// Route-specific schemas
export const searchSchema = {
  tags: ['search'],
  summary: 'Search media library',
  description: 'Unified search combining full-text search, fuzzy matching (typo-tolerant), and optional AI semantic search. Results are ranked by a weighted combination of all search methods.',
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string', description: 'Search query text', minLength: 1, example: 'matrix' },
      type: { type: 'string', enum: ['movie', 'series', 'all'], description: 'Filter by media type', default: 'all' },
      genre: { type: 'string', description: 'Filter by genre (exact match)', example: 'Action' },
      yearMin: { type: 'string', description: 'Minimum release year', example: '1990' },
      yearMax: { type: 'string', description: 'Maximum release year', example: '2024' },
      minRtScore: { type: 'string', description: 'Minimum Rotten Tomatoes critic score (0-100)', example: '70' },
      collection: { type: 'string', description: 'Filter by movie collection/franchise', example: 'The Matrix Collection' },
      network: { type: 'string', description: 'Filter by TV network', example: 'HBO' },
      limit: { type: 'string', description: 'Maximum results to return (1-100)', default: '50', example: '25' },
      semantic: { type: 'string', enum: ['true', 'false'], description: 'Enable AI semantic search for meaning-based matching. Requires embeddings.', default: 'false' },
    },
  },
}

export const searchSuggestionsSchema = {
  tags: ['search'],
  summary: 'Get search suggestions',
  description: 'Get autocomplete suggestions for a partial search query. Returns titles that match the input for use in search-as-you-type UI.',
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string', description: 'Partial search query', minLength: 1, example: 'mat' },
      limit: { type: 'string', description: 'Maximum suggestions to return (1-20)', default: '10', example: '5' },
    },
  },
}

export const searchFiltersSchema = {
  tags: ['search'],
  summary: 'Get search filter options',
  description: 'Get available filter options for building search UI including genres, collections, networks, and year ranges.',
}
