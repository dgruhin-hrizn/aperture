import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { listEncoreConnections, createEncoreConnection, revokeEncoreConnection, ENCORE_READ_SCOPES } from '@aperture/core/encore'
import { requireAuth } from '../../../plugins/auth.js'
const endpoint = '/api/assistant/connections'
const createSchema = z.object({ name: z.string().trim().min(1).max(80), scopes: z.array(z.enum(['library:read', 'profile:read', 'schedules:read'])).min(1).default([...ENCORE_READ_SCOPES]), days: z.number().int().min(1).max(365).default(90) })
export function registerConnectionHandlers(app: FastifyInstance) {
  app.get(endpoint, { preHandler: requireAuth }, async (request) => ({ connections: await listEncoreConnections(request.user!.id), availableScopes: ENCORE_READ_SCOPES }))
  app.post(endpoint, { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid connection configuration' })
    const { name, scopes, days } = parsed.data
    return reply.code(201).send(await createEncoreConnection(request.user!.id, name, scopes, days))
  })
  app.delete<{ Params: { id: string } }>(`${endpoint}/:id`, { preHandler: requireAuth }, async (request, reply) => {
    if (!z.string().uuid().safeParse(request.params.id).success) return reply.code(400).send({ error: 'Invalid connection ID' })
    if (!await revokeEncoreConnection(request.user!.id, request.params.id)) return reply.code(404).send({ error: 'Connection not found' })
    return reply.code(204).send()
  })
}
