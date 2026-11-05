/**
 * Recommendations Routes
 *
 * User recommendation endpoints.
 * Requires authentication.
 */

import type { FastifyPluginAsync } from 'fastify'
import { getEmbyTonight } from '@aperture/core'
import { requireAuth } from '../../plugins/auth.js'
import {
  registerMovieHandlers,
  registerSeriesHandlers,
  registerHistoryHandlers,
  registerPreferencesHandlers,
} from './handlers/index.js'
import { recommendationComponentSchemas } from './schemas.js'
import { registerEmbyHomeHandlers } from './handlers/embyHome.js'

const recommendationsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register component schemas for $ref usage
  for (const [name, schema] of Object.entries(recommendationComponentSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }
  
  const tonightPath = '/api/recommendations/me/tonight'
  fastify.get(tonightPath, { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Sign in to Aperture first.' })
    try {
      return reply.header('Cache-Control', 'no-store').send(await getEmbyTonight(request.user.id))
    } catch (err) {
      request.log.warn({ err }, 'Could not load Tonight from Emby')
      return reply.code(502).send({ error: 'Could not load Tonight. Check your Emby connection or sign in again.' })
    }
  })
  fastify.post<{ Params: { itemId: string } }>(`${tonightPath}/:itemId/snooze`, {
    preHandler: requireAuth,
    schema: {
      params: {
        type: 'object',
        required: ['itemId'],
        properties: { itemId: { type: 'string', minLength: 1, maxLength: 100 } },
      },
    },
  }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Sign in to Aperture first.' })
    try {
      const result = await getEmbyTonight(request.user.id, request.params.itemId)
      if (result.status !== 'ready') return reply.code(409).send({ error: 'Refresh Tonight to see your current picks.' })
      return reply.header('Cache-Control', 'no-store').send(result)
    } catch (err) {
      request.log.warn({ err }, 'Could not snooze Tonight pick')
      return reply.code(502).send({ error: 'Could not snooze this pick.' })
    }
  })

  await registerMovieHandlers(fastify)
  await registerSeriesHandlers(fastify)
  await registerHistoryHandlers(fastify)
  await registerPreferencesHandlers(fastify)
  await registerEmbyHomeHandlers(fastify)
}

export default recommendationsRoutes
