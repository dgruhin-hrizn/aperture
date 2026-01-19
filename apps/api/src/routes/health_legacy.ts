import type { FastifyPluginAsync } from 'fastify'
import { healthCheck as dbHealthCheck } from '../lib/db.js'

interface HealthResponse {
  ok: boolean
  name: string
  version: string
  time: string
  database?: {
    connected: boolean
  }
}

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Basic health check
  fastify.get<{ Reply: HealthResponse }>(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Health check',
        description: 'Check if the API and database are healthy',
        security: [], // Public endpoint
        response: {
          200: {
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
          503: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              name: { type: 'string' },
              version: { type: 'string' },
              time: { type: 'string' },
              database: { type: 'object' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
    const dbConnected = await dbHealthCheck()

    const health: HealthResponse = {
      ok: dbConnected,
      name: 'Aperture',
      version: '0.6.0',
      time: new Date().toISOString(),
      database: {
        connected: dbConnected,
      },
    }

    const statusCode = health.ok ? 200 : 503
    return reply.status(statusCode).send(health)
  })

  // Readiness check (for Kubernetes/Docker)
  fastify.get(
    '/ready',
    {
      schema: {
        tags: ['health'],
        summary: 'Readiness check',
        description: 'Check if the application is ready to serve traffic (Kubernetes readiness probe)',
        security: [], // Public endpoint
        response: {
          200: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
            },
          },
          503: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
    const dbConnected = await dbHealthCheck()

    if (!dbConnected) {
      return reply.status(503).send({ ready: false, reason: 'Database not connected' })
    }

    return reply.send({ ready: true })
  })

  // Liveness check (for Kubernetes/Docker)
  fastify.get(
    '/live',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness check',
        description: 'Check if the application is alive (Kubernetes liveness probe)',
        security: [], // Public endpoint
        response: {
          200: {
            type: 'object',
            properties: {
              live: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({ live: true })
    }
  )
}

export default healthRoutes
