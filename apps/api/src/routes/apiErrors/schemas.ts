/**
 * API Errors OpenAPI Schemas
 * 
 * Tracks errors from external API integrations (OpenAI, TMDb, etc.)
 * for admin monitoring and troubleshooting.
 */

export const apiErrorsSchemas = {
  // API Error
  ApiError: {
    type: 'object',
    description: 'An error from an external API provider',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Error record ID' },
      provider: { 
        type: 'string', 
        enum: ['openai', 'tmdb', 'trakt', 'mdblist', 'omdb'],
        description: 'Which API provider had the error'
      },
      errorType: { type: 'string', description: 'Error classification (rate_limit, auth_error, etc.)' },
      errorCode: { type: 'string', nullable: true, description: 'Provider-specific error code' },
      httpStatus: { type: 'integer', nullable: true, description: 'HTTP status code if applicable' },
      message: { type: 'string', description: 'Error message' },
      resetAt: { type: 'string', format: 'date-time', nullable: true, description: 'When rate limit resets (for rate limit errors)' },
      actionUrl: { type: 'string', nullable: true, description: 'URL for resolution (e.g., billing page)' },
      createdAt: { type: 'string', format: 'date-time', description: 'When the error occurred' },
    },
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      provider: 'openai',
      errorType: 'rate_limit',
      httpStatus: 429,
      message: 'Rate limit exceeded',
      resetAt: '2024-01-15T11:00:00Z',
      createdAt: '2024-01-15T10:30:00Z',
    },
  },

  // Error summary
  ErrorSummary: {
    type: 'object',
    description: 'Summary of active API errors',
    properties: {
      total: { type: 'integer', description: 'Total number of active errors' },
      byProvider: {
        type: 'object',
        additionalProperties: { type: 'integer' },
        description: 'Error count per provider',
        example: { openai: 2, tmdb: 1 },
      },
      hasCritical: { type: 'boolean', description: 'Whether any errors require immediate attention' },
    },
  },
} as const

// Route-specific schemas
export const getErrorsSchema = {
  tags: ['api-errors'],
  summary: 'Get all errors',
  description: 'Get all active (non-dismissed) API errors. Admin only.',
}

export const getErrorSummarySchema = {
  tags: ['api-errors'],
  summary: 'Get error summary',
  description: 'Get a summary of active errors for dashboard display. Admin only.',
}

export const getProviderErrorsSchema = {
  tags: ['api-errors'],
  summary: 'Get provider errors',
  description: 'Get active errors for a specific provider. Admin only.',
  params: {
    type: 'object',
    required: ['provider'],
    properties: {
      provider: { 
        type: 'string', 
        enum: ['openai', 'tmdb', 'trakt', 'mdblist', 'omdb'],
        description: 'Provider to get errors for'
      },
    },
  },
}

export const dismissErrorSchema = {
  tags: ['api-errors'],
  summary: 'Dismiss error',
  description: 'Dismiss a specific error (mark as acknowledged). Admin only.',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Error ID to dismiss' },
    },
  },
}

export const dismissProviderErrorsSchema = {
  tags: ['api-errors'],
  summary: 'Dismiss all provider errors',
  description: 'Dismiss all active errors for a specific provider. Admin only.',
  params: {
    type: 'object',
    required: ['provider'],
    properties: {
      provider: { type: 'string', enum: ['openai', 'tmdb', 'trakt', 'mdblist', 'omdb'] },
    },
  },
}

export const cleanupErrorsSchema = {
  tags: ['api-errors'],
  summary: 'Cleanup old errors',
  description: 'Permanently delete old dismissed errors from the database. Admin only.',
}
