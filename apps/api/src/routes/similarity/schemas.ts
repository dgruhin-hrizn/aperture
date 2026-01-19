/**
 * Similarity OpenAPI Schemas
 */

export const similaritySchemas = {
  // Graph node
  GraphNode: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      isSource: { type: 'boolean' },
      depth: { type: 'integer' },
    },
  },

  // Graph edge
  GraphEdge: {
    type: 'object',
    properties: {
      source: { type: 'string', format: 'uuid' },
      target: { type: 'string', format: 'uuid' },
      weight: { type: 'number' },
      connectionType: { type: 'string' },
    },
  },

  // Graph data response
  GraphData: {
    type: 'object',
    properties: {
      nodes: { type: 'array', items: { $ref: 'GraphNode#' } },
      edges: { type: 'array', items: { $ref: 'GraphEdge#' } },
    },
  },

  // Semantic search result
  SemanticSearchResult: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      type: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      year: { type: 'integer', nullable: true },
      posterUrl: { type: 'string', nullable: true },
      overview: { type: 'string', nullable: true },
      genres: { type: 'array', items: { type: 'string' } },
      similarity: { type: 'number', description: 'Cosine similarity score' },
    },
  },

  // Connection colors
  ConnectionColors: {
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        color: { type: 'string' },
        label: { type: 'string' },
      },
    },
  },
} as const

// Route-specific schemas
export const getSimilarMovieSchema = {
  tags: ['similarity'],
  summary: 'Get similar movies',
  description: 'Get similar movies for a given movie',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string', description: 'Max connections (default: 12)' },
      depth: { type: 'string', description: 'How many levels (1 = direct, 2 = spider out)' },
    },
  },
}

export const getSimilarSeriesSchema = {
  tags: ['similarity'],
  summary: 'Get similar series',
  description: 'Get similar series for a given series',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string' },
      depth: { type: 'string' },
    },
  },
}

export const getGraphSourceSchema = {
  tags: ['similarity'],
  summary: 'Get graph for source',
  description: 'Get graph data for a specific source (explore page)',
  params: {
    type: 'object',
    required: ['source'],
    properties: {
      source: { type: 'string', enum: ['ai-movies', 'ai-series', 'watching', 'top-movies', 'top-series'] },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'string' },
      crossMedia: { type: 'string', enum: ['true', 'false'] },
    },
  },
}

export const semanticSearchSchema = {
  tags: ['similarity'],
  summary: 'Semantic search',
  description: 'Semantic search across library content',
  querystring: {
    type: 'object',
    required: ['q'],
    properties: {
      q: { type: 'string', description: 'Search query' },
      type: { type: 'string', enum: ['movie', 'series', 'both'] },
      limit: { type: 'string' },
      graph: { type: 'string', enum: ['true', 'false'], description: 'Return graph data with connections' },
      hideWatched: { type: 'string', enum: ['true', 'false'] },
    },
  },
}

export const getColorsSchema = {
  tags: ['similarity'],
  summary: 'Get connection colors',
  description: 'Get the color scheme for connection types',
}

export const getValidationCacheStatsSchema = {
  tags: ['similarity'],
  summary: 'Get validation cache stats',
  description: 'Get statistics about the AI validation cache',
}
