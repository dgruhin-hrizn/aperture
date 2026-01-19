/**
 * API Errors OpenAPI Schemas
 */

export const apiErrorsSchemas = {
  // API Error
  ApiError: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      provider: { type: 'string', enum: ['openai', 'tmdb', 'trakt', 'mdblist', 'omdb'] },
      errorType: { type: 'string' },
      errorCode: { type: 'string', nullable: true },
      httpStatus: { type: 'integer', nullable: true },
      message: { type: 'string' },
      resetAt: { type: 'string', format: 'date-time', nullable: true },
      actionUrl: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  // Error summary
  ErrorSummary: {
    type: 'object',
    properties: {
      total: { type: 'integer' },
      byProvider: {
        type: 'object',
        additionalProperties: { type: 'integer' },
      },
      hasCritical: { type: 'boolean' },
    },
  },
} as const

// Route-specific schemas
export const getErrorsSchema = {
  tags: ['api-errors'],
  summary: 'Get all errors',
  description: 'Get all active API errors for display',
}

export const getErrorSummarySchema = {
  tags: ['api-errors'],
  summary: 'Get error summary',
  description: 'Get error summary for dashboard display',
}

export const getProviderErrorsSchema = {
  tags: ['api-errors'],
  summary: 'Get provider errors',
  description: 'Get active errors for a specific provider',
  params: {
    type: 'object',
    required: ['provider'],
    properties: {
      provider: { type: 'string', enum: ['openai', 'tmdb', 'trakt', 'mdblist', 'omdb'] },
    },
  },
}

export const dismissErrorSchema = {
  tags: ['api-errors'],
  summary: 'Dismiss error',
  description: 'Dismiss a specific error',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
}

export const dismissProviderErrorsSchema = {
  tags: ['api-errors'],
  summary: 'Dismiss all provider errors',
  description: 'Dismiss all errors for a provider',
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
  description: 'Clean up old dismissed errors (admin only)',
}
