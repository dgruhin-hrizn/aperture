/**
 * Authentication OpenAPI Schemas
 */

export const authSchemas = {
  // Session user
  SessionUser: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      username: { type: 'string' },
      displayName: { type: 'string', nullable: true },
      provider: { type: 'string', enum: ['emby', 'jellyfin'] },
      providerUserId: { type: 'string' },
      isAdmin: { type: 'boolean' },
      isEnabled: { type: 'boolean' },
      canManageWatchHistory: { type: 'boolean' },
      avatarUrl: { type: 'string', nullable: true },
    },
  },

  // Login request
  LoginRequest: {
    type: 'object',
    required: ['username'],
    properties: {
      username: { type: 'string' },
      password: { type: 'string' },
    },
  },

  // Login response
  LoginResponse: {
    type: 'object',
    properties: {
      user: { $ref: 'SessionUser#' },
    },
  },

  // User preferences
  UserPreferences: {
    type: 'object',
    properties: {
      sidebarCollapsed: { type: 'boolean' },
      viewModes: { type: 'object', additionalProperties: true },
      browseSort: { type: 'object', additionalProperties: true },
    },
  },

  // Filter preset
  FilterPreset: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      type: { type: 'string', enum: ['movies', 'series'] },
      filters: { type: 'object', additionalProperties: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
} as const

// Route-specific schemas
export const loginOptionsSchema = {
  tags: ['auth'],
  summary: 'Get login options',
  description: 'Get login options including whether passwordless login is allowed',
  security: [],
}

export const loginSchema = {
  tags: ['auth'],
  summary: 'Login',
  description: 'Authenticate with media server credentials',
  security: [],
}

export const logoutSchema = {
  tags: ['auth'],
  summary: 'Logout',
  description: 'End current session',
}

export const getMeSchema = {
  tags: ['auth'],
  summary: 'Get current user',
  description: 'Get current authenticated user info',
}

export const getPreferencesSchema = {
  tags: ['auth'],
  summary: 'Get user preferences',
  description: 'Get current user\'s UI preferences',
}

export const updatePreferencesSchema = {
  tags: ['auth'],
  summary: 'Update user preferences',
  description: 'Update current user\'s UI preferences',
}

export const createFilterPresetSchema = {
  tags: ['auth'],
  summary: 'Create filter preset',
  description: 'Create a new filter preset for browsing',
}

export const updateFilterPresetSchema = {
  tags: ['auth'],
  summary: 'Update filter preset',
  description: 'Update an existing filter preset',
}

export const deleteFilterPresetSchema = {
  tags: ['auth'],
  summary: 'Delete filter preset',
  description: 'Delete a filter preset',
}

export const authCheckSchema = {
  tags: ['auth'],
  summary: 'Check authentication',
  description: 'Check if user is authenticated (returns null if not)',
  security: [],
}
