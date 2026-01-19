/**
 * Jellyseerr Integration OpenAPI Schemas
 */

export const jellyseerrSchemas = {
  // Jellyseerr config
  JellyseerrConfig: {
    type: 'object',
    properties: {
      configured: { type: 'boolean' },
      enabled: { type: 'boolean' },
      url: { type: 'string' },
      hasApiKey: { type: 'boolean' },
    },
  },

  // Media status
  JellyseerrMediaStatus: {
    type: 'object',
    properties: {
      exists: { type: 'boolean' },
      status: { type: 'string' },
      requested: { type: 'boolean' },
      requestStatus: { type: 'string', nullable: true },
    },
  },

  // Status response
  JellyseerrStatusResponse: {
    type: 'object',
    properties: {
      jellyseerrStatus: { $ref: 'JellyseerrMediaStatus#' },
      apertureRequest: { type: 'object', nullable: true },
      canRequest: { type: 'boolean' },
    },
  },

  // TV Season info
  JellyseerrSeason: {
    type: 'object',
    properties: {
      seasonNumber: { type: 'integer' },
      episodeCount: { type: 'integer' },
      status: { type: 'string' },
    },
  },

  // TV details response
  JellyseerrTVDetails: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      numberOfSeasons: { type: 'integer' },
      seasons: { type: 'array', items: { $ref: 'JellyseerrSeason#' } },
    },
  },

  // Discovery request
  DiscoveryRequest: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      mediaType: { type: 'string', enum: ['movie', 'series'] },
      tmdbId: { type: 'integer' },
      title: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'submitted', 'approved', 'declined', 'available', 'failed'] },
      jellyseerrRequestId: { type: 'integer', nullable: true },
      discoveryCandidateId: { type: 'string', format: 'uuid', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  // Create request body
  CreateRequestBody: {
    type: 'object',
    required: ['tmdbId', 'mediaType', 'title'],
    properties: {
      tmdbId: { type: 'integer' },
      mediaType: { type: 'string', enum: ['movie', 'series'] },
      title: { type: 'string' },
      discoveryCandidateId: { type: 'string', format: 'uuid' },
      seasons: { type: 'array', items: { type: 'integer' }, description: 'Season numbers to request for series' },
    },
  },

  // Batch status request
  BatchStatusRequest: {
    type: 'object',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['tmdbId', 'mediaType'],
          properties: {
            tmdbId: { type: 'integer' },
            mediaType: { type: 'string', enum: ['movie', 'series'] },
          },
        },
      },
    },
  },

  // Test connection response
  JellyseerrTestResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      version: { type: 'string' },
    },
  },
} as const

// Route-specific schemas
export const getJellyseerrConfigSchema = {
  tags: ['jellyseerr'],
  summary: 'Get Jellyseerr configuration',
  description: 'Get Jellyseerr configuration (admin only)',
  response: {
    200: { $ref: 'JellyseerrConfig#' },
  },
}

export const updateJellyseerrConfigSchema = {
  tags: ['jellyseerr'],
  summary: 'Update Jellyseerr configuration',
  description: 'Update Jellyseerr configuration (admin only)',
  body: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      apiKey: { type: 'string' },
      enabled: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        configured: { type: 'boolean' },
        enabled: { type: 'boolean' },
      },
    },
  },
}

export const testJellyseerrSchema = {
  tags: ['jellyseerr'],
  summary: 'Test Jellyseerr connection',
  description: 'Test Jellyseerr connection (admin only)',
  body: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      apiKey: { type: 'string' },
    },
  },
  response: {
    200: { $ref: 'JellyseerrTestResponse#' },
  },
}

export const getMediaStatusSchema = {
  tags: ['jellyseerr'],
  summary: 'Get media status',
  description: 'Get media status from Jellyseerr',
  params: {
    type: 'object',
    required: ['mediaType', 'tmdbId'],
    properties: {
      mediaType: { type: 'string', enum: ['movie', 'tv'] },
      tmdbId: { type: 'string' },
    },
  },
  response: {
    200: { $ref: 'JellyseerrStatusResponse#' },
  },
}

export const getTVDetailsSchema = {
  tags: ['jellyseerr'],
  summary: 'Get TV show details',
  description: 'Get TV show details with season information for the season selection modal',
  params: {
    type: 'object',
    required: ['tmdbId'],
    properties: {
      tmdbId: { type: 'string' },
    },
  },
  response: {
    200: { $ref: 'JellyseerrTVDetails#' },
  },
}

export const createRequestSchema = {
  tags: ['jellyseerr'],
  summary: 'Create content request',
  description: 'Create a content request to Jellyseerr',
  body: { $ref: 'CreateRequestBody#' },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        apertureRequestId: { type: 'string', format: 'uuid' },
        jellyseerrRequestId: { type: 'integer' },
      },
    },
  },
}

export const getRequestsSchema = {
  tags: ['jellyseerr'],
  summary: 'Get user requests',
  description: 'Get content requests for the current user',
  querystring: {
    type: 'object',
    properties: {
      mediaType: { type: 'string', enum: ['movie', 'series'] },
      status: { type: 'string' },
      limit: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        requests: { type: 'array', items: { $ref: 'DiscoveryRequest#' } },
      },
    },
  },
}

export const batchStatusSchema = {
  tags: ['jellyseerr'],
  summary: 'Batch check status',
  description: 'Check Jellyseerr status for multiple items at once',
  body: { $ref: 'BatchStatusRequest#' },
  response: {
    200: {
      type: 'object',
      properties: {
        statuses: { type: 'object', additionalProperties: { $ref: 'JellyseerrMediaStatus#' } },
      },
    },
  },
}

export const getRequestStatusSchema = {
  tags: ['jellyseerr'],
  summary: 'Get request status',
  description: 'Get status of a specific content request',
  params: {
    type: 'object',
    required: ['requestId'],
    properties: {
      requestId: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        apertureStatus: { type: 'string' },
        jellyseerrStatus: { type: 'object', nullable: true },
      },
    },
  },
}
