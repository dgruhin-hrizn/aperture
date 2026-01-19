/**
 * API Keys OpenAPI Schemas
 * Note: The original file already has inline schemas, these are extracted for consistency
 */

export const apiKeysSchemas = {
  // API Key object
  ApiKey: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier for the API key' },
      userId: { type: 'string', format: 'uuid', description: 'ID of the user who owns the key' },
      name: { type: 'string', description: 'Descriptive name for the API key' },
      keyPrefix: { type: 'string', description: 'First 8 characters of the key for identification' },
      expiresAt: { type: 'string', format: 'date-time', nullable: true, description: 'Expiration date or null for never' },
      lastUsedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Last time the key was used' },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      revokedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Revocation timestamp if revoked' },
    },
  },

  // Expiration option
  ExpirationOption: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'Human-readable label' },
      days: { type: 'integer', nullable: true, description: 'Number of days until expiration, or null for never' },
    },
  },

  // Create API key request
  CreateApiKeyRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, description: 'Descriptive name for the key' },
      expiresInDays: { type: 'integer', minimum: 1, maximum: 365, nullable: true, description: 'Days until expiration, or null for never' },
    },
  },

  // Update API key request
  UpdateApiKeyRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, description: 'New name for the key' },
      expiresAt: { type: 'string', format: 'date-time', nullable: true, description: 'New expiration date' },
    },
  },

  // Created API key response (includes plaintext key)
  CreatedApiKeyResponse: {
    type: 'object',
    properties: {
      apiKey: { $ref: 'ApiKey#' },
      plaintextKey: { type: 'string', description: 'The API key - only shown once!' },
      message: { type: 'string' },
    },
  },

  // API keys list response
  ApiKeysListResponse: {
    type: 'object',
    properties: {
      keys: { type: 'array', items: { $ref: 'ApiKey#' } },
      expirationOptions: { type: 'array', items: { $ref: 'ExpirationOption#' } },
    },
  },
} as const

// Route-specific schemas
export const listApiKeysSchema = {
  tags: ['api-keys'],
  summary: 'List API keys',
  description: 'List all API keys for the current user. Admins can see all keys.',
  querystring: {
    type: 'object',
    properties: {
      includeRevoked: { type: 'string', enum: ['true', 'false'], description: 'Include revoked keys' },
    },
  },
  response: {
    200: { $ref: 'ApiKeysListResponse#' },
  },
}

export const createApiKeySchema = {
  tags: ['api-keys'],
  summary: 'Create API key',
  description: 'Create a new API key. The plaintext key is only returned once - make sure to save it.',
  body: { $ref: 'CreateApiKeyRequest#' },
  response: {
    201: { $ref: 'CreatedApiKeyResponse#' },
  },
}

export const getApiKeySchema = {
  tags: ['api-keys'],
  summary: 'Get API key',
  description: 'Get details about a specific API key',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'API key ID' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { apiKey: { $ref: 'ApiKey#' } },
    },
  },
}

export const updateApiKeySchema = {
  tags: ['api-keys'],
  summary: 'Update API key',
  description: 'Update an API key name or expiration date',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'API key ID' },
    },
  },
  body: { $ref: 'UpdateApiKeyRequest#' },
  response: {
    200: {
      type: 'object',
      properties: { apiKey: { $ref: 'ApiKey#' } },
    },
  },
}

export const deleteApiKeySchema = {
  tags: ['api-keys'],
  summary: 'Revoke or delete API key',
  description: 'Revoke an API key (soft delete) or permanently delete it',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'API key ID' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      permanent: { type: 'string', enum: ['true', 'false'], description: 'Permanently delete instead of revoke' },
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
  },
}

export const getExpirationOptionsSchema = {
  tags: ['api-keys'],
  summary: 'Get expiration options',
  description: 'Get the list of available expiration options for API key creation',
  response: {
    200: {
      type: 'object',
      properties: {
        options: { type: 'array', items: { $ref: 'ExpirationOption#' } },
      },
    },
  },
}
