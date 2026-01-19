import type { FastifyPluginAsync } from 'fastify'
import { healthCheck as dbHealthCheck } from '../../lib/db.js'
import { healthSchemas, healthCheckSchema, readyCheckSchema, liveCheckSchema } from './schemas.js'

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
  // Register schemas
  for (const [name, schema] of Object.entries(healthSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  // Basic health check
  fastify.get<{ Reply: HealthResponse }>(
    '/health',
    { schema: healthCheckSchema },
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
    { schema: readyCheckSchema },
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
    { schema: liveCheckSchema },
    async (_request, reply) => {
      return reply.send({ live: true })
    }
  )
}

export default healthRoutes
