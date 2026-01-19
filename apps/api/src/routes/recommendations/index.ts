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

const recommendationsRoutes: FastifyPluginAsync = async (fastify) => {
  await registerMovieHandlers(fastify)
  await registerSeriesHandlers(fastify)
  await registerHistoryHandlers(fastify)
  await registerPreferencesHandlers(fastify)
}

export default recommendationsRoutes
