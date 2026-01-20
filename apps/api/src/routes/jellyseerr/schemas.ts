/**
 * Jellyseerr Integration OpenAPI Schemas
 * 
 * Integration with Jellyseerr/Overseerr for content requests.
 * Allows users to request movies/series not in their library.
 */

export const jellyseerrSchemas = {
  // Jellyseerr config
  JellyseerrConfig: {
    type: 'object',
    description: 'Jellyseerr integration configuration',
    properties: {
      configured: { type: 'boolean', description: 'Whether Jellyseerr is configured' },
      enabled: { type: 'boolean', description: 'Whether Jellyseerr integration is enabled' },
      url: { type: 'string', description: 'Jellyseerr base URL' },
      hasApiKey: { type: 'boolean', description: 'Whether API key is set' },
    },
    example: {
      configured: true,
      enabled: true,
      url: 'http://192.168.1.100:5055',
      hasApiKey: true,
    },
  },

  // Media status
  JellyseerrMediaStatus: {
    type: 'object',
    description: 'Status of a media item in Jellyseerr',
    properties: {
      exists: { type: 'boolean', description: 'Whether the media exists in Jellyseerr database' },
      status: { 
        type: 'string', 
        enum: ['unknown', 'pending', 'processing', 'partially_available', 'available'],
        description: 'Current availability status: unknown (not tracked), pending (requested), processing (downloading), partially_available (some seasons), available (fully available)'
      },
      requested: { type: 'boolean', description: 'Whether there is an active request' },
      requestStatus: { 
        type: 'string', 
        nullable: true,
        enum: ['pending_approval', 'approved', 'declined', 'available'],
        description: 'Request status if requested'
      },
    },
    example: {
      exists: true,
      status: 'pending',
      requested: true,
      requestStatus: 'pending_approval',
    },
  },

  // Status response
  JellyseerrStatusResponse: {
    type: 'object',
    description: 'Combined status from Jellyseerr and Aperture',
    properties: {
      jellyseerrStatus: { $ref: 'JellyseerrMediaStatus#' },
      apertureRequest: { 
        type: 'object', 
        nullable: true,
        description: 'Aperture-tracked request if exists'
      },
      canRequest: { type: 'boolean', description: 'Whether user can create a new request' },
    },
  },

  // TV Season info
  JellyseerrSeason: {
    type: 'object',
    description: 'Season information from Jellyseerr',
    properties: {
      seasonNumber: { type: 'integer', description: 'Season number (0 = specials)' },
      episodeCount: { type: 'integer', description: 'Number of episodes in season' },
      status: { 
        type: 'string',
        enum: ['unknown', 'pending', 'processing', 'partially_available', 'available'],
        description: 'Season availability status'
      },
    },
  },

  // TV details response
  JellyseerrTVDetails: {
    type: 'object',
    description: 'TV show details with season breakdown',
    properties: {
      id: { type: 'integer', description: 'TMDb ID' },
      name: { type: 'string', description: 'Show name' },
      numberOfSeasons: { type: 'integer', description: 'Total number of seasons' },
      seasons: { type: 'array', items: { $ref: 'JellyseerrSeason#' }, description: 'Season details' },
    },
  },

  // Discovery request
  DiscoveryRequest: {
    type: 'object',
    description: 'Content request tracked by Aperture',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Aperture request ID' },
      userId: { type: 'string', format: 'uuid', description: 'User who made the request' },
      mediaType: { type: 'string', enum: ['movie', 'series'], description: 'Type of media' },
      tmdbId: { type: 'integer', description: 'TMDb ID of the content' },
      title: { type: 'string', description: 'Content title' },
      status: { 
        type: 'string', 
        enum: ['pending', 'submitted', 'approved', 'declined', 'available', 'failed'],
        description: 'Request status: pending (not yet sent), submitted (sent to Jellyseerr), approved (accepted), declined (rejected), available (downloaded), failed (error)'
      },
      jellyseerrRequestId: { type: 'integer', nullable: true, description: 'Jellyseerr request ID if submitted' },
      discoveryCandidateId: { type: 'string', format: 'uuid', nullable: true, description: 'Discovery candidate that triggered this request' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: 'abc12345-e89b-12d3-a456-426614174001',
      mediaType: 'movie',
      tmdbId: 550,
      title: 'Fight Club',
      status: 'approved',
      jellyseerrRequestId: 42,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    },
  },

  // Create request body
  CreateRequestBody: {
    type: 'object',
    description: 'Body for creating a content request',
    required: ['tmdbId', 'mediaType', 'title'],
    properties: {
      tmdbId: { type: 'integer', description: 'TMDb ID of the content to request' },
      mediaType: { type: 'string', enum: ['movie', 'series'], description: 'Type of media' },
      title: { type: 'string', description: 'Content title (for display purposes)' },
      discoveryCandidateId: { type: 'string', format: 'uuid', description: 'Optional: link to discovery candidate' },
      seasons: { type: 'array', items: { type: 'integer' }, description: 'Season numbers to request (series only). If omitted, requests all seasons.' },
    },
    example: {
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
    },
  },

  // Batch status request
  BatchStatusRequest: {
    type: 'object',
    description: 'Request to check status of multiple items',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['tmdbId', 'mediaType'],
          properties: {
            tmdbId: { type: 'integer', description: 'TMDb ID' },
            mediaType: { type: 'string', enum: ['movie', 'series'], description: 'Media type' },
          },
        },
        description: 'Array of items to check',
      },
    },
    example: {
      items: [
        { tmdbId: 550, mediaType: 'movie' },
        { tmdbId: 1396, mediaType: 'series' },
      ],
    },
  },

  // Test connection response
  JellyseerrTestResponse: {
    type: 'object',
    description: 'Result of Jellyseerr connection test',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      version: { type: 'string', description: 'Jellyseerr version if successful' },
    },
    example: {
      success: true,
      message: 'Connection successful',
      version: '1.7.0',
    },
  },
} as const

// Route-specific schemas
export const getJellyseerrConfigSchema = {
  tags: ['jellyseerr'],
  summary: 'Get Jellyseerr configuration',
  description: 'Get Jellyseerr integration configuration (admin only). API key is not exposed.',
  response: {
    200: { $ref: 'JellyseerrConfig#' },
  },
}

export const updateJellyseerrConfigSchema = {
  tags: ['jellyseerr'],
  summary: 'Update Jellyseerr configuration',
  description: 'Update Jellyseerr integration settings (admin only). Get API key from Jellyseerr Settings > General.',
  body: {
    type: 'object',
    additionalProperties: true,
    properties: {
      url: { type: 'string', description: 'Jellyseerr base URL (e.g., http://localhost:5055)', example: 'http://192.168.1.100:5055' },
      apiKey: { type: 'string', description: 'Jellyseerr API key' },
      enabled: { type: 'boolean', description: 'Enable/disable integration' },
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
  description: 'Test Jellyseerr API connection with provided or saved credentials (admin only).',
  body: {
    type: 'object',
    additionalProperties: true,
    properties: {
      url: { type: 'string', description: 'Jellyseerr URL to test (optional, uses saved if not provided)' },
      apiKey: { type: 'string', description: 'API key to test (optional, uses saved if not provided)' },
    },
  },
  response: {
    200: { $ref: 'JellyseerrTestResponse#' },
  },
}

export const getMediaStatusSchema = {
  tags: ['jellyseerr'],
  summary: 'Get media status',
  description: 'Get availability and request status for a specific media item from Jellyseerr.',
  params: {
    type: 'object',
    required: ['mediaType', 'tmdbId'],
    properties: {
      mediaType: { type: 'string', enum: ['movie', 'tv'], description: 'Media type (note: use "tv" not "series" for Jellyseerr API)' },
      tmdbId: { type: 'string', description: 'TMDb ID' },
    },
  },
  response: {
    200: { $ref: 'JellyseerrStatusResponse#' },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Media not found' },
      },
    },
  },
}

export const getTVDetailsSchema = {
  tags: ['jellyseerr'],
  summary: 'Get TV show details',
  description: 'Get TV show details with season information. Used for the season selection modal when requesting series.',
  params: {
    type: 'object',
    required: ['tmdbId'],
    properties: {
      tmdbId: { type: 'string', description: 'TMDb ID of the TV show' },
    },
  },
  response: {
    200: { $ref: 'JellyseerrTVDetails#' },
  },
}

export const createRequestSchema = {
  tags: ['jellyseerr'],
  summary: 'Create content request',
  description: 'Create a content request to Jellyseerr. For series, you can optionally specify which seasons to request.',
  body: { $ref: 'CreateRequestBody#' },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        apertureRequestId: { type: 'string', format: 'uuid', description: 'Aperture tracking ID' },
        jellyseerrRequestId: { type: 'integer', description: 'Jellyseerr request ID' },
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Request already exists' },
      },
    },
  },
}

export const getRequestsSchema = {
  tags: ['jellyseerr'],
  summary: 'Get user requests',
  description: 'Get content requests for the current user. Optionally filter by media type or status.',
  querystring: {
    type: 'object',
    properties: {
      mediaType: { type: 'string', enum: ['movie', 'series'], description: 'Filter by media type' },
      status: { type: 'string', enum: ['pending', 'submitted', 'approved', 'declined', 'available', 'failed'], description: 'Filter by status' },
      limit: { type: 'string', description: 'Maximum results', default: '50', example: '25' },
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
  description: 'Check Jellyseerr status for multiple items at once. More efficient than individual calls for lists.',
  body: { $ref: 'BatchStatusRequest#' },
  response: {
    200: {
      type: 'object',
      properties: {
        statuses: { 
          type: 'object', 
          additionalProperties: { $ref: 'JellyseerrMediaStatus#' },
          description: 'Map of "mediaType-tmdbId" to status'
        },
      },
      example: {
        statuses: {
          'movie-550': { exists: true, status: 'available', requested: false },
          'series-1396': { exists: true, status: 'partially_available', requested: true, requestStatus: 'approved' },
        },
      },
    },
  },
}

export const getRequestStatusSchema = {
  tags: ['jellyseerr'],
  summary: 'Get request status',
  description: 'Get detailed status of a specific content request including Jellyseerr status.',
  params: {
    type: 'object',
    required: ['requestId'],
    properties: {
      requestId: { type: 'string', format: 'uuid', description: 'Aperture request ID' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        apertureStatus: { type: 'string', description: 'Aperture tracking status' },
        jellyseerrStatus: { type: 'object', nullable: true, description: 'Full Jellyseerr status if available' },
      },
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Request not found' },
      },
    },
  },
}
