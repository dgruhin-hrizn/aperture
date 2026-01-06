import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import crypto from 'crypto'

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string
  }
}

const requestIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('requestId', '')

  fastify.addHook('onRequest', async (request) => {
    request.requestId =
      (request.headers['x-request-id'] as string) || crypto.randomUUID()
  })

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.requestId)
  })
}

export default fp(requestIdPlugin, {
  name: 'request-id',
})


