/**
 * Series Routes
 * 
 * TV series library and metadata endpoints.
 */
import type { FastifyPluginAsync } from 'fastify'
import {
  registerListHandler,
  registerDetailHandler,
  registerSimilarHandler,
  registerWatchStatsHandler,
  registerEpisodesHandler,
  registerFiltersHandlers,
} from './handlers/index.js'
import { seriesComponentSchemas } from './schemas.js'

const seriesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register component schemas for $ref resolution
  for (const [name, schema] of Object.entries(seriesComponentSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  // Register all series handlers
  registerListHandler(fastify)
  registerDetailHandler(fastify)
  registerSimilarHandler(fastify)
  registerWatchStatsHandler(fastify)
  registerEpisodesHandler(fastify)
  registerFiltersHandlers(fastify)
}

export default seriesRoutes
