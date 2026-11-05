import type { FastifyInstance } from 'fastify'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { authenticateEncoreConnection } from '@aperture/core/encore'
import { createApertureMcpServer } from './server.js'
const windows = new Map<string, { at: number; count: number }>()
export function registerMcpHandler(app: FastifyInstance) {
  app.all('/mcp', { bodyLimit: 256_000 }, async (request, reply) => {
    const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]
    const principal = token ? await authenticateEncoreConnection(token) : null
    if (!principal) return reply.code(401).header('WWW-Authenticate', 'Bearer realm="Aperture MCP"').send({ error: 'An active Aperture MCP connection token is required' })
    const now = Date.now()
    if (windows.size > 1000) for (const [id, window] of windows) if (now - window.at > 60_000) windows.delete(id)
    const window = windows.get(principal.id)
    if (window && now - window.at < 60_000) {
      if (++window.count > 90) return reply.code(429).header('Retry-After', '60').send({ error: 'Connection request limit reached' })
    } else windows.set(principal.id, { at: now, count: 1 })
    const handler = createMcpHandler(() => createApertureMcpServer(principal.user_id, principal.scopes, principal.id))
    reply.hijack()
    await toNodeHandler(handler)(request.raw, reply.raw, request.body)
  })
}
