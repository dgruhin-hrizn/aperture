import type { FastifyPluginAsync } from 'fastify'
import {
  registerCrudHandlers,
  registerAiHandlers,
  registerPlaylistHandlers,
  registerSharesHandlers,
} from './handlers/index.js'

const channelsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register all handler modules
  registerCrudHandlers(fastify)
  registerAiHandlers(fastify)
  registerPlaylistHandlers(fastify)
  registerSharesHandlers(fastify)
}

export default channelsRoutes


