/**
 * Trakt Integration OpenAPI Schemas
 */

export const traktSchemas = {
  // Trakt config
  TraktConfig: {
    type: 'object',
    properties: {
      configured: { type: 'boolean' },
      clientId: { type: 'string', nullable: true, description: 'Masked client ID' },
      redirectUri: { type: 'string', nullable: true },
      hasClientSecret: { type: 'boolean' },
    },
  },

  // Trakt status
  TraktStatus: {
    type: 'object',
    properties: {
      traktConfigured: { type: 'boolean' },
      connected: { type: 'boolean' },
      username: { type: 'string', nullable: true },
      syncedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  // Sync result
  TraktSyncResult: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      moviesImported: { type: 'integer' },
      moviesUpdated: { type: 'integer' },
      seriesImported: { type: 'integer' },
      seriesUpdated: { type: 'integer' },
      message: { type: 'string' },
    },
  },
} as const

// Route-specific schemas
export const getTraktConfigSchema = {
  tags: ['trakt'],
  summary: 'Get Trakt configuration',
  description: 'Get Trakt configuration (admin only)',
}

export const updateTraktConfigSchema = {
  tags: ['trakt'],
  summary: 'Update Trakt configuration',
  description: 'Update Trakt configuration (admin only)',
  body: {
    type: 'object',
    properties: {
      clientId: { type: 'string' },
      clientSecret: { type: 'string' },
      redirectUri: { type: 'string' },
    },
  },
}

export const getTraktStatusSchema = {
  tags: ['trakt'],
  summary: 'Get Trakt status',
  description: 'Get current user\'s Trakt connection status',
}

export const getTraktAuthUrlSchema = {
  tags: ['trakt'],
  summary: 'Get Trakt auth URL',
  description: 'Get Trakt OAuth authorization URL',
}

export const traktCallbackSchema = {
  tags: ['trakt'],
  summary: 'Trakt OAuth callback',
  description: 'Handle OAuth callback from Trakt',
  security: [],
}

export const disconnectTraktSchema = {
  tags: ['trakt'],
  summary: 'Disconnect Trakt',
  description: 'Disconnect Trakt from current user\'s account',
}

export const syncTraktSchema = {
  tags: ['trakt'],
  summary: 'Sync Trakt ratings',
  description: 'Sync ratings from Trakt for current user',
}
