import type { FastifyInstance, FastifyReply } from 'fastify'
import type { SessionUser } from '../../../../plugins/auth.js'

export function requireSelfOrAdmin(
  id: string,
  currentUser: SessionUser,
  reply: FastifyReply
): boolean {
  if (id !== currentUser.id && !currentUser.isAdmin) {
    reply.status(403).send({ error: 'Forbidden' })
    return false
  }
  return true
}

export async function streamSseGenerator<T>(
  fastify: FastifyInstance,
  reply: FastifyReply,
  userId: string,
  generator: AsyncGenerator<string, T, unknown>,
  options: {
    errorLogMessage: string
    errorResponseMessage: string
  }
): Promise<void> {
  try {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    let result = await generator.next()
    while (!result.done) {
      if (typeof result.value === 'string') {
        reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: result.value })}\n\n`)
      }
      result = await generator.next()
    }

    const stats = result.value
    reply.raw.write(`data: ${JSON.stringify({ type: 'done', stats })}\n\n`)
    reply.raw.end()
  } catch (error) {
    fastify.log.error({ error, userId }, options.errorLogMessage)
    if (reply.raw.headersSent) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate' })}\n\n`)
      reply.raw.end()
    } else {
      reply.status(500).send({ error: options.errorResponseMessage })
    }
  }
}
