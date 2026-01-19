/**
 * Movies Routes
 * 
 * Movie library and metadata endpoints.
 */
import type { FastifyPluginAsync } from 'fastify'
import {
  registerListHandler,
  registerDetailHandler,
  registerSimilarHandler,
  registerWatchStatsHandler,
  registerFiltersHandlers,
  registerFranchisesHandler,
} from './handlers/index.js'
import { moviesComponentSchemas } from './schemas.js'

const moviesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register component schemas for $ref resolution
  for (const [name, schema] of Object.entries(moviesComponentSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  // Register all movie handlers
  registerListHandler(fastify)
  registerDetailHandler(fastify)
  registerSimilarHandler(fastify)
  registerWatchStatsHandler(fastify)
  registerFiltersHandlers(fastify)
  registerFranchisesHandler(fastify)
}

export default moviesRoutes
