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
  
  fastify.get('/api/recommendations/me/tonight', { preHandler: requireAuth }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Sign in to Aperture first.' })
    try {
      return reply.header('Cache-Control', 'no-store').send(await getEmbyTonight(request.user.id))
    } catch (err) {
      request.log.warn({ err }, 'Could not load Tonight from Emby')
      return reply.code(502).send({ error: 'Could not load Tonight. Check your Emby connection or sign in again.' })
    }
  })

  await registerMovieHandlers(fastify)
  await registerSeriesHandlers(fastify)
  await registerHistoryHandlers(fastify)
  await registerPreferencesHandlers(fastify)
  await registerEmbyHomeHandlers(fastify)
}

export default recommendationsRoutes
