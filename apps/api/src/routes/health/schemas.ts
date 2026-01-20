/**
 * Health Check OpenAPI Schemas
 * 
 * Health, readiness, and liveness endpoints for monitoring.
 * All endpoints are public (no authentication required).
 */

export const healthSchemas = {
  // Health response
  HealthResponse: {
    type: 'object',
    description: 'Detailed health status',
    properties: {
      ok: { type: 'boolean', description: 'Overall health status (true if all components healthy)' },
      name: { type: 'string', description: 'Application name', example: 'aperture-api' },
      version: { type: 'string', description: 'API version', example: '0.6.1' },
      time: { type: 'string', format: 'date-time', description: 'Current server time (ISO 8601)' },
      database: {
        type: 'object',
        properties: {
          connected: { type: 'boolean', description: 'Database connection status' },
        },
      },
    },
    example: {
      ok: true,
      name: 'aperture-api',
      version: '0.6.1',
      time: '2024-01-15T10:30:00Z',
      database: { connected: true },
    },
  },

  // Readiness response
  ReadinessResponse: {
    type: 'object',
    description: 'Readiness probe response',
    properties: {
      ready: { type: 'boolean', description: 'Whether the app is ready to serve traffic' },
      reason: { type: 'string', description: 'Reason if not ready', nullable: true },
    },
  },

  // Liveness response
  LivenessResponse: {
    type: 'object',
    description: 'Liveness probe response',
    properties: {
      live: { type: 'boolean', description: 'Whether the app process is alive' },
    },
  },
} as const

// Route-specific schemas
export const healthCheckSchema = {
  tags: ['health'],
  summary: 'Health check',
  description: 'Comprehensive health check including database connectivity. Use for monitoring dashboards.',
  security: [],
  response: {
    200: { $ref: 'HealthResponse#' },
    503: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Database connection failed' },
      },
    },
  },
}

export const readyCheckSchema = {
  tags: ['health'],
  summary: 'Readiness check',
  description: 'Kubernetes readiness probe. Returns 200 when the app is ready to serve traffic, 503 otherwise.',
  security: [],
  response: {
    200: { $ref: 'ReadinessResponse#' },
    503: { $ref: 'ReadinessResponse#' },
  },
}

export const liveCheckSchema = {
  tags: ['health'],
  summary: 'Liveness check',
  description: 'Kubernetes liveness probe. Returns 200 if the process is alive. A failed liveness check typically triggers a container restart.',
  security: [],
  response: {
    200: { $ref: 'LivenessResponse#' },
  },
}
