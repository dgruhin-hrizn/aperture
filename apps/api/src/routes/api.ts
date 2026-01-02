import type { FastifyPluginAsync } from 'fastify'

interface VersionResponse {
  name: string
  version: string
  environment: string
}

const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // API version endpoint
  fastify.get<{ Reply: VersionResponse }>('/api/version', async (_request, reply) => {
    return reply.send({
      name: 'Aperture',
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
    })
  })
}

export default apiRoutes

