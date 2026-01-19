/**
 * Recommendations Routes
 *
 * User recommendation endpoints.
 * Requires authentication.
 */

import type { FastifyPluginAsync } from 'fastify'
import {
  registerMovieHandlers,
  registerSeriesHandlers,
  registerHistoryHandlers,
  registerPreferencesHandlers,
} from './handlers/index.js'
import { recommendationComponentSchemas } from './schemas.js'

const recommendationsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register component schemas for $ref usage
  for (const [name, schema] of Object.entries(recommendationComponentSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }
  
  await registerMovieHandlers(fastify)
  await registerSeriesHandlers(fastify)
  await registerHistoryHandlers(fastify)
  await registerPreferencesHandlers(fastify)
}

export default recommendationsRoutes
