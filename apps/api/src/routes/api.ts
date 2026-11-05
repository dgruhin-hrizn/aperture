import type { FastifyPluginAsync } from 'fastify'
import { asSchema } from 'ai'
import { z } from 'zod'
import { APP_VERSION } from '../lib/appVersion.js'

const versionResponse = z.object({
  name: z.literal('Aperture'),
  version: z.string().min(1),
  environment: z.string().min(1),
})

const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // API version endpoint
  const schema = await asSchema(versionResponse).jsonSchema
  fastify.get<{ Reply: z.infer<typeof versionResponse> }>(
    '/api/version',
    { schema: { response: { 200: schema } } },
    async (_request, reply) => {
      return reply.send({
        name: 'Aperture',
        version: APP_VERSION,
        environment: process.env.NODE_ENV || 'development',
      })
    }
  )
}

export default apiRoutes
