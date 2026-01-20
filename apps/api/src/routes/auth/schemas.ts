/**
 * Authentication OpenAPI Schemas
 */

export const authSchemas = {
  // Session user
  SessionUser: {
    type: 'object',
    description: 'Authenticated user session information',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique user identifier in Aperture' },
      username: { type: 'string', description: 'Username from media server' },
      displayName: { type: 'string', nullable: true, description: 'Display name (may differ from username)' },
      provider: { type: 'string', enum: ['emby', 'jellyfin'], description: 'Media server type' },
      providerUserId: { type: 'string', description: 'User ID in the media server' },
      isAdmin: { type: 'boolean', description: 'Whether user has admin privileges' },
      isEnabled: { type: 'boolean', description: 'Whether user account is enabled' },
      canManageWatchHistory: { type: 'boolean', description: 'Whether user can manage their watch history' },
      avatarUrl: { type: 'string', nullable: true, description: 'URL to user avatar image' },
    },
    example: {
      id: 'def4567-e89b-12d3-a456-426614174004',
      username: 'john_doe',
      displayName: 'John Doe',
      provider: 'jellyfin',
      providerUserId: 'abc123',
      isAdmin: false,
      isEnabled: true,
      canManageWatchHistory: true,
      avatarUrl: '/api/users/def4567/avatar',
    },
  },

  // Login request
  LoginRequest: {
    type: 'object',
    description: 'Credentials for authentication',
    required: ['username'],
    properties: {
      username: { type: 'string', description: 'Media server username', example: 'john_doe' },
      password: { type: 'string', description: 'Media server password. May be optional if passwordless login is enabled.', example: 'secret123' },
    },
  },

  // Login response
  LoginResponse: {
    type: 'object',
    description: 'Successful login response',
    properties: {
      user: { $ref: 'SessionUser#' },
    },
  },

  // User preferences
  UserPreferences: {
    type: 'object',
    description: 'User UI preferences stored in Aperture',
    properties: {
      sidebarCollapsed: { type: 'boolean', description: 'Whether the sidebar is collapsed' },
      viewModes: { 
        type: 'object', 
        additionalProperties: true,
        description: 'View mode preferences per page (grid/list)',
        example: { movies: 'grid', series: 'list' }
      },
      browseSort: { 
        type: 'object', 
        additionalProperties: true,
        description: 'Sort preferences for browse pages',
        example: { movies: { sortBy: 'title', sortOrder: 'asc' } }
      },
    },
  },

  // Filter preset
  FilterPreset: {
    type: 'object',
    description: 'Saved filter configuration for quick access',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Preset identifier' },
      name: { type: 'string', description: 'User-defined preset name', example: 'My Favorites' },
      type: { type: 'string', enum: ['movies', 'series'], description: 'Media type this preset applies to' },
      filters: { 
        type: 'object', 
        additionalProperties: true,
        description: 'Filter configuration object',
        example: { genre: 'Action', minYear: '2020', minRtScore: '80' }
      },
      createdAt: { type: 'string', format: 'date-time', description: 'When the preset was created' },
    },
  },
} as const

// Route-specific schemas
export const loginOptionsSchema = {
  tags: ['auth'],
  summary: 'Get login options',
  description: 'Get login configuration options. Use this before showing the login form to determine if password is required.',
  security: [],
}

export const loginSchema = {
  tags: ['auth'],
  summary: 'Login',
  description: 'Authenticate using media server credentials. On success, sets a session cookie and returns user info. Credentials are validated against the configured Emby/Jellyfin server.',
  security: [],
  body: { $ref: 'LoginRequest#' },
}

export const logoutSchema = {
  tags: ['auth'],
  summary: 'Logout',
  description: 'End the current session and clear the session cookie.',
}

export const getMeSchema = {
  tags: ['auth'],
  summary: 'Get current user',
  description: 'Get the currently authenticated user\'s information. Requires valid session.',
}

export const getPreferencesSchema = {
  tags: ['auth'],
  summary: 'Get user preferences',
  description: 'Get the current user\'s UI preferences including sidebar state, view modes, and sort settings.',
}

export const updatePreferencesSchema = {
  tags: ['auth'],
  summary: 'Update user preferences',
  description: 'Update the current user\'s UI preferences. Only provided fields are updated (partial update).',
  body: {
    type: 'object',
    additionalProperties: true,
    description: 'Preferences to update (partial)',
    properties: {
      sidebarCollapsed: { type: 'boolean', description: 'Whether the sidebar should be collapsed' },
      viewModes: { type: 'object', additionalProperties: true, description: 'View mode preferences per page' },
      browseSort: { type: 'object', additionalProperties: true, description: 'Sort preferences for browse pages' },
    },
  },
}

export const createFilterPresetSchema = {
  tags: ['auth'],
  summary: 'Create filter preset',
  description: 'Create a new saved filter preset for quick access when browsing.',
  body: {
    type: 'object',
    additionalProperties: true,
    required: ['name', 'type', 'filters'],
    properties: {
      name: { type: 'string', description: 'Preset name', minLength: 1, maxLength: 100, example: 'High Rated Action' },
      type: { type: 'string', enum: ['movies', 'series'], description: 'Media type this preset applies to' },
      filters: { type: 'object', additionalProperties: true, description: 'Filter configuration', example: { genre: 'Action', minRtScore: '80' } },
    },
  },
}

export const updateFilterPresetSchema = {
  tags: ['auth'],
  summary: 'Update filter preset',
  description: 'Update an existing filter preset. Only provided fields are updated.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Preset ID to update' },
    },
  },
  body: {
    type: 'object',
    additionalProperties: true,
    properties: {
      name: { type: 'string', description: 'New preset name', minLength: 1, maxLength: 100 },
      filters: { type: 'object', additionalProperties: true, description: 'New filter configuration' },
    },
  },
}

export const deleteFilterPresetSchema = {
  tags: ['auth'],
  summary: 'Delete filter preset',
  description: 'Delete a saved filter preset.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Preset ID to delete' },
    },
  },
}

export const authCheckSchema = {
  tags: ['auth'],
  summary: 'Check authentication',
  description: 'Check if the current request has a valid session. Returns user info if authenticated, null otherwise. Does not return an error for unauthenticated requests.',
  security: [],
}
