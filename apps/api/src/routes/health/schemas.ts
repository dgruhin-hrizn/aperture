/**
 * Health Check OpenAPI Schemas
 */

export const healthSchemas = {
  // Health response
  HealthResponse: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', description: 'Overall health status' },
      name: { type: 'string', description: 'Application name' },
      version: { type: 'string', description: 'API version' },
      time: { type: 'string', format: 'date-time', description: 'Current server time' },
      database: {
        type: 'object',
        properties: {
          connected: { type: 'boolean', description: 'Database connection status' },
        },
      },
    },
  },

  // Readiness response
  ReadinessResponse: {
    type: 'object',
    properties: {
      ready: { type: 'boolean' },
      reason: { type: 'string' },
    },
  },

  // Liveness response
  LivenessResponse: {
    type: 'object',
    properties: {
      live: { type: 'boolean' },
    },
  },
} as const

// Route-specific schemas
export const healthCheckSchema = {
  tags: ['health'],
  summary: 'Health check',
  description: 'Check if the API and database are healthy',
  security: [],
}

export const readyCheckSchema = {
  tags: ['health'],
  summary: 'Readiness check',
  description: 'Check if the application is ready to serve traffic (Kubernetes readiness probe)',
  security: [],
}

export const liveCheckSchema = {
  tags: ['health'],
  summary: 'Liveness check',
  description: 'Check if the application is alive (Kubernetes liveness probe)',
  security: [],
}
