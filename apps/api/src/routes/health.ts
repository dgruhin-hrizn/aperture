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
  fastify.get<{ Reply: HealthResponse }>('/health', async (_request, reply) => {
    const dbConnected = await dbHealthCheck()

    const health: HealthResponse = {
      ok: dbConnected,
      name: 'Aperture',
      version: '0.5.3',
      time: new Date().toISOString(),
      database: {
        connected: dbConnected,
      },
    }

    const statusCode = health.ok ? 200 : 503
    return reply.status(statusCode).send(health)
  })

  // Readiness check (for Kubernetes/Docker)
  fastify.get('/ready', async (_request, reply) => {
    const dbConnected = await dbHealthCheck()

    if (!dbConnected) {
      return reply.status(503).send({ ready: false, reason: 'Database not connected' })
    }

    return reply.send({ ready: true })
  })

  // Liveness check (for Kubernetes/Docker)
  fastify.get('/live', async (_request, reply) => {
    return reply.send({ live: true })
  })
}

export default healthRoutes
