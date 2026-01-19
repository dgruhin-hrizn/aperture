/**
 * Similarity OpenAPI Schemas
 * 
 * AI-powered semantic similarity features including similar content,
 * graph visualization, and semantic search.
 */

export const similaritySchemas = {
  // Graph node
  GraphNode: {
    type: 'object',
    description: 'A node in the similarity graph',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Media ID' },
      type: { type: 'string', enum: ['movie', 'series'], description: 'Media type' },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true, description: 'Release/first air year' },
      posterUrl: { type: 'string', nullable: true, description: 'Poster image URL' },
      genres: { type: 'array', items: { type: 'string' } },
      isSource: { type: 'boolean', description: 'Whether this is a source node (the item being explored)' },
      depth: { type: 'integer', description: 'Distance from source (0 = source, 1 = direct connection, etc.)' },
    },
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      posterUrl: '/api/media/movie/123/poster',
      genres: ['Action', 'Sci-Fi'],
      isSource: true,
      depth: 0,
    },
  },

  // Graph edge
  GraphEdge: {
    type: 'object',
    description: 'A connection between two nodes in the similarity graph',
    properties: {
      source: { type: 'string', format: 'uuid', description: 'Source node ID' },
      target: { type: 'string', format: 'uuid', description: 'Target node ID' },
      weight: { type: 'number', description: 'Connection strength (similarity score 0-1)' },
      connectionType: { type: 'string', description: 'Type of connection (e.g., "semantic", "genre", "director")' },
    },
    example: {
      source: '123e4567-e89b-12d3-a456-426614174000',
      target: '456e7890-e89b-12d3-a456-426614174001',
      weight: 0.85,
      connectionType: 'semantic',
    },
  },

  // Graph data response
  GraphData: {
    type: 'object',
    description: 'Complete graph data for visualization',
    properties: {
      nodes: { type: 'array', items: { $ref: 'GraphNode#' }, description: 'All nodes in the graph' },
      edges: { type: 'array', items: { $ref: 'GraphEdge#' }, description: 'All connections between nodes' },
    },
  },

  // Semantic search result
  SemanticSearchResult: {
    type: 'object',
    description: 'A result from semantic search',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      overview: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      similarity: { type: 'number', description: 'Cosine similarity score (0-1, higher is more relevant)' },
    },
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'movie',
      title: 'Inception',
      year: 2010,
      similarity: 0.92,
      genres: ['Action', 'Sci-Fi', 'Thriller'],
    },
  },

  // Connection colors
  ConnectionColors: {
    type: 'object',
    description: 'Color scheme for different connection types in the graph',
    additionalProperties: {
      type: 'object',
      properties: {
        color: { type: 'string', description: 'Hex color code' },
        label: { type: 'string', description: 'Human-readable label' },
      },
    },
    example: {
      semantic: { color: '#3B82F6', label: 'AI Similarity' },
      genre: { color: '#10B981', label: 'Shared Genre' },
      director: { color: '#F59E0B', label: 'Same Director' },
    },
  },
} as const

// Route-specific schemas
export const getSimilarMovieSchema = {
  tags: ['similarity'],
  summary: 'Get similar movies',
  description: 'Get movies similar to a given movie using AI semantic similarity. Returns graph data for visualization.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Movie ID to find similar content for' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Maximum connections per node', default: '12', example: '20' },
      depth: { type: 'string', description: 'Graph depth (1 = direct connections only, 2 = spider out to connections of connections)', default: '1', example: '2' },
    },
  },
  response: {
    200: { $ref: 'GraphData#' },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Movie not found or has no embeddings' },
      },
    },
  },
}

export const getSimilarSeriesSchema = {
  tags: ['similarity'],
  summary: 'Get similar series',
  description: 'Get series similar to a given series using AI semantic similarity. Returns graph data for visualization.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Series ID to find similar content for' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Maximum connections per node', default: '12', example: '20' },
      depth: { type: 'string', description: 'Graph depth (1 = direct, 2 = extended)', default: '1' },
    },
  },
  response: {
    200: { $ref: 'GraphData#' },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Series not found or has no embeddings' },
      },
    },
  },
}

export const getGraphSourceSchema = {
  tags: ['similarity'],
  summary: 'Get graph for source',
  description: 'Get graph data for a predefined source type. Used on the Explore page to show connections between content.',
  params: {
    type: 'object',
    required: ['source'],
    properties: {
      source: { 
        type: 'string', 
        enum: ['ai-movies', 'ai-series', 'watching', 'top-movies', 'top-series'],
        description: 'Source type: ai-movies/ai-series (recommendations), watching (currently watching), top-movies/top-series (top picks)'
      },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Maximum nodes to include', default: '20', example: '30' },
      crossMedia: { type: 'string', enum: ['true', 'false'], description: 'Include connections across media types (movies ↔ series)', default: 'false' },
    },
  },
  response: {
    200: { $ref: 'GraphData#' },
  },
}

export const semanticSearchSchema = {
  tags: ['similarity'],
  summary: 'Semantic search',
  description: 'Search library content using AI semantic understanding. Finds content by meaning rather than exact text matching. Requires embeddings to be generated.',
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string', description: 'Search query describing what you\'re looking for', example: 'movies about time travel and paradoxes' },
      type: { type: 'string', enum: ['movie', 'series', 'both'], description: 'Filter by media type', default: 'both' },
      limit: { type: 'string', description: 'Maximum results', default: '20', example: '50' },
      graph: { type: 'string', enum: ['true', 'false'], description: 'Return graph data showing connections between results', default: 'false' },
      hideWatched: { type: 'string', enum: ['true', 'false'], description: 'Exclude already-watched content', default: 'false' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        results: { type: 'array', items: { $ref: 'SemanticSearchResult#' } },
        graph: { $ref: 'GraphData#' },
        query: { type: 'string', description: 'The search query that was executed' },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Embeddings not configured' },
      },
    },
  },
}

export const getColorsSchema = {
  tags: ['similarity'],
  summary: 'Get connection colors',
  description: 'Get the color scheme used for different connection types in the similarity graph.',
  response: {
    200: { $ref: 'ConnectionColors#' },
  },
}

export const getValidationCacheStatsSchema = {
  tags: ['similarity'],
  summary: 'Get validation cache stats',
  description: 'Get statistics about the AI validation cache (admin only). Shows cache hit rates and memory usage.',
  response: {
    200: {
      type: 'object',
      properties: {
        size: { type: 'integer', description: 'Number of cached items' },
        hits: { type: 'integer', description: 'Cache hits' },
        misses: { type: 'integer', description: 'Cache misses' },
        hitRate: { type: 'number', description: 'Hit rate percentage' },
      },
    },
  },
}
