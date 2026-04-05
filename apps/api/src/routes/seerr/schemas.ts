/**
 * Seerr Integration OpenAPI Schemas
 * 
 * Integration with Seerr/Overseerr for content requests.
 * Allows users to request movies/series not in their library.
 */

export const seerrSchemas = {
  // Seerr config
  SeerrConfig: {
    type: 'object',
    description: 'Seerr integration configuration',
    properties: {
      configured: { type: 'boolean', description: 'Whether Seerr is configured' },
      enabled: { type: 'boolean', description: 'Whether Seerr integration is enabled' },
      url: { type: 'string', description: 'Seerr base URL' },
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
  SeerrMediaStatus: {
    type: 'object',
    description: 'Status of a media item in Seerr',
    properties: {
      exists: { type: 'boolean', description: 'Whether the media exists in Seerr database' },
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
  SeerrStatusResponse: {
    type: 'object',
    description: 'Combined status from Seerr and Aperture',
    properties: {
      seerrStatus: { $ref: 'SeerrMediaStatus#' },
      apertureRequest: { 
        type: 'object', 
        nullable: true,
        description: 'Aperture-tracked request if exists'
      },
      canRequest: { type: 'boolean', description: 'Whether user can create a new request' },
    },
  },

  // TV Season info
  SeerrSeason: {
    type: 'object',
    description: 'Season information from Seerr',
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
  SeerrTVDetails: {
    type: 'object',
    description: 'TV show details with season breakdown',
    properties: {
      id: { type: 'integer', description: 'TMDb ID' },
      name: { type: 'string', description: 'Show name' },
      numberOfSeasons: { type: 'integer', description: 'Total number of seasons' },
      seasons: { type: 'array', items: { $ref: 'SeerrSeason#' }, description: 'Season details' },
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
        description: 'Request status: pending (not yet sent), submitted (sent to Seerr), approved (accepted), declined (rejected), available (downloaded), failed (error)'
      },
      seerrRequestId: { type: 'integer', nullable: true, description: 'Seerr request ID if submitted' },
      discoveryCandidateId: { type: 'string', format: 'uuid', nullable: true, description: 'Discovery candidate that triggered this request' },
      source: { type: 'string', enum: ['discovery', 'gap_analysis'], description: 'Where the request was created' },
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
      seerrRequestId: 42,
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
      rootFolder: { type: 'string', description: 'Radarr/Sonarr root folder path (optional)' },
      profileId: { type: 'integer', description: 'Quality profile id (optional)' },
      serverId: { type: 'integer', description: 'Radarr or Sonarr server id when multiple instances exist (optional)' },
      languageProfileId: { type: 'integer', description: 'Sonarr language profile id for TV (optional)' },
      is4k: { type: 'boolean', description: 'Request via 4K Radarr/Sonarr server path (optional)' },
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
  SeerrTestResponse: {
    type: 'object',
    description: 'Result of Seerr connection test',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      version: { type: 'string', description: 'Seerr version if successful' },
    },
    example: {
      success: true,
      message: 'Connection successful',
      version: '1.7.0',
    },
  },
} as const

// Route-specific schemas
export const getSeerrConfigSchema = {
  tags: ['seerr'],
  summary: 'Get Seerr configuration',
  description: 'Get Seerr integration configuration (admin only). API key is not exposed.',
}

export const updateSeerrConfigSchema = {
  tags: ['seerr'],
  summary: 'Update Seerr configuration',
  description: 'Update Seerr integration settings (admin only). Get API key from Seerr Settings > General.',
  body: {
    type: 'object',
    additionalProperties: true,
    properties: {
      url: { type: 'string', description: 'Seerr base URL (e.g., http://localhost:5055)', example: 'http://192.168.1.100:5055' },
      apiKey: { type: 'string', description: 'Seerr API key' },
      enabled: { type: 'boolean', description: 'Enable/disable integration' },
    },
  },
}

export const testSeerrSchema = {
  tags: ['seerr'],
  summary: 'Test Seerr connection',
  description: 'Test Seerr API connection with provided or saved credentials (admin only).',
  body: {
    type: 'object',
    additionalProperties: true,
    properties: {
      url: { type: 'string', description: 'Seerr URL to test (optional, uses saved if not provided)' },
      apiKey: { type: 'string', description: 'API key to test (optional, uses saved if not provided)' },
    },
  },
}

export const getMediaStatusSchema = {
  tags: ['seerr'],
  summary: 'Get media status',
  description: 'Get availability and request status for a specific media item from Seerr.',
  params: {
    type: 'object',
    required: ['mediaType', 'tmdbId'],
    properties: {
      mediaType: { type: 'string', enum: ['movie', 'tv'], description: 'Media type (note: use "tv" not "series" for Seerr API)' },
      tmdbId: { type: 'string', description: 'TMDb ID' },
    },
  },
}

export const getTVDetailsSchema = {
  tags: ['seerr'],
  summary: 'Get TV show details',
  description: 'Get TV show details with season information. Used for the season selection modal when requesting series.',
  params: {
    type: 'object',
    required: ['tmdbId'],
    properties: {
      tmdbId: { type: 'string', description: 'TMDb ID of the TV show' },
    },
  },
}

export const createRequestSchema = {
  tags: ['seerr'],
  summary: 'Create content request',
  description: 'Create a content request to Seerr. For series, you can optionally specify which seasons to request.',
  body: { $ref: 'CreateRequestBody#' },
}

export const listRadarrServiceSchema = {
  tags: ['seerr'],
  summary: 'List Radarr servers',
  description: 'Proxy to Seerr GET /service/radarr for request UI (root folders and profiles per server).',
}

export const getRadarrServiceSchema = {
  tags: ['seerr'],
  summary: 'Radarr server profiles and root folders',
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', description: 'Radarr server id' } },
  },
}

export const listSonarrServiceSchema = {
  tags: ['seerr'],
  summary: 'List Sonarr servers',
  description: 'Proxy to Seerr GET /service/sonarr for request UI.',
}

export const getSonarrServiceSchema = {
  tags: ['seerr'],
  summary: 'Sonarr server profiles and root folders',
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', description: 'Sonarr server id' } },
  },
}

export const getRequestsSchema = {
  tags: ['seerr'],
  summary: 'Get user requests',
  description: 'Get content requests for the current user. Optionally filter by media type or status.',
  querystring: {
    type: 'object',
    properties: {
      mediaType: { type: 'string', enum: ['movie', 'series'], description: 'Filter by media type' },
      status: { type: 'string', enum: ['pending', 'submitted', 'approved', 'declined', 'available', 'failed'], description: 'Filter by status' },
      limit: { type: 'string', description: 'Maximum results', default: '50', example: '25' },
      source: { type: 'string', enum: ['discovery', 'gap_analysis'], description: 'Filter by origin (Discovery vs Gap Analysis)' },
    },
  },
}

export const batchStatusSchema = {
  tags: ['seerr'],
  summary: 'Batch check status',
  description: 'Check Seerr status for multiple items at once. More efficient than individual calls for lists.',
  body: { $ref: 'BatchStatusRequest#' },
}

export const getRequestStatusSchema = {
  tags: ['seerr'],
  summary: 'Get request status',
  description: 'Get detailed status of a specific content request including Seerr status.',
  params: {
    type: 'object',
    required: ['requestId'],
    properties: {
      requestId: { type: 'string', format: 'uuid', description: 'Aperture request ID' },
    },
  },
}
