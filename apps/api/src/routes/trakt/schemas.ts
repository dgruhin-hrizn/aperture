/**
 * Trakt Integration OpenAPI Schemas
 * 
 * Trakt.tv integration for syncing ratings and watch history.
 * Admin-only endpoints for configuration, user endpoints for connecting accounts.
 */

export const traktSchemas = {
  // Trakt config
  TraktConfig: {
    type: 'object',
    description: 'Trakt API configuration (admin view)',
    properties: {
      configured: { type: 'boolean', description: 'Whether Trakt integration is configured' },
      clientId: { type: 'string', nullable: true, description: 'Masked client ID (first/last 4 chars shown)' },
      redirectUri: { type: 'string', nullable: true, description: 'OAuth redirect URI' },
      hasClientSecret: { type: 'boolean', description: 'Whether client secret is set' },
    },
    example: {
      configured: true,
      clientId: 'abc1...xyz9',
      redirectUri: 'http://localhost:3000/api/trakt/callback',
      hasClientSecret: true,
    },
  },

  // Trakt status
  TraktStatus: {
    type: 'object',
    description: 'User\'s Trakt connection status',
    properties: {
      traktConfigured: { type: 'boolean', description: 'Whether Trakt is configured system-wide' },
      connected: { type: 'boolean', description: 'Whether user has connected their Trakt account' },
      username: { type: 'string', nullable: true, description: 'Connected Trakt username' },
      syncedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Last sync timestamp' },
    },
    example: {
      traktConfigured: true,
      connected: true,
      username: 'moviefan123',
      syncedAt: '2024-01-15T10:30:00Z',
    },
  },

  // Sync result
  TraktSyncResult: {
    type: 'object',
    description: 'Result of a Trakt sync operation',
    properties: {
      success: { type: 'boolean' },
      moviesImported: { type: 'integer', description: 'Number of new movie ratings imported' },
      moviesUpdated: { type: 'integer', description: 'Number of existing movie ratings updated' },
      seriesImported: { type: 'integer', description: 'Number of new series ratings imported' },
      seriesUpdated: { type: 'integer', description: 'Number of existing series ratings updated' },
      message: { type: 'string' },
    },
    example: {
      success: true,
      moviesImported: 45,
      moviesUpdated: 12,
      seriesImported: 23,
      seriesUpdated: 5,
      message: 'Sync completed successfully',
    },
  },
} as const

// Route-specific schemas
export const getTraktConfigSchema = {
  tags: ['trakt'],
  summary: 'Get Trakt configuration',
  description: 'Get Trakt API configuration including client ID and redirect URI (admin only). Client secret is never exposed.',
  response: {
    200: { $ref: 'TraktConfig#' },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
}

export const updateTraktConfigSchema = {
  tags: ['trakt'],
  summary: 'Update Trakt configuration',
  description: 'Update Trakt API credentials (admin only). Get credentials from https://trakt.tv/oauth/applications',
  body: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'Trakt API client ID from your application settings' },
      clientSecret: { type: 'string', description: 'Trakt API client secret' },
      redirectUri: { type: 'string', description: 'OAuth redirect URI (must match Trakt app settings)', example: 'http://localhost:3000/api/trakt/callback' },
    },
    example: {
      clientId: 'your-client-id-from-trakt',
      clientSecret: 'your-client-secret',
      redirectUri: 'http://aperture.local:3000/api/trakt/callback',
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
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

export const getTraktStatusSchema = {
  tags: ['trakt'],
  summary: 'Get Trakt connection status',
  description: 'Get current user\'s Trakt connection status including username and last sync time.',
  response: {
    200: { $ref: 'TraktStatus#' },
    500: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
}

export const getTraktAuthUrlSchema = {
  tags: ['trakt'],
  summary: 'Get Trakt authorization URL',
  description: 'Get the OAuth authorization URL to redirect user to Trakt for account linking. User should be redirected to this URL.',
  response: {
    200: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Trakt OAuth authorization URL' },
      },
      example: {
        url: 'https://trakt.tv/oauth/authorize?client_id=xxx&redirect_uri=xxx&response_type=code',
      },
    },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Trakt integration not configured' },
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

export const traktCallbackSchema = {
  tags: ['trakt'],
  summary: 'Trakt OAuth callback',
  description: 'Handle OAuth callback from Trakt after user authorization. This endpoint is called by Trakt, not directly by the frontend.',
  security: [],
  querystring: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Authorization code from Trakt' },
      state: { type: 'string', description: 'State parameter for CSRF protection' },
    },
  },
  response: {
    302: {
      description: 'Redirects to frontend with success/error status',
    },
  },
}

export const disconnectTraktSchema = {
  tags: ['trakt'],
  summary: 'Disconnect Trakt',
  description: 'Disconnect Trakt from current user\'s account. This removes the OAuth tokens but keeps any synced ratings.',
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string', example: 'Trakt account disconnected' },
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

export const syncTraktSchema = {
  tags: ['trakt'],
  summary: 'Sync Trakt ratings',
  description: 'Sync ratings from Trakt for current user. Imports new ratings and updates existing ones. Requires Trakt account to be connected.',
  response: {
    200: { $ref: 'TraktSyncResult#' },
    400: {
      type: 'object',
      properties: {
        error: { type: 'string', example: 'Trakt account not connected' },
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
