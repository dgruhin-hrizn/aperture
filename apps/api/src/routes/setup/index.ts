/**
 * Setup Routes
 *
 * Public endpoints for first-run setup wizard.
 * These endpoints only work when the system is not yet configured.
 */

import type { FastifyPluginAsync } from 'fastify'
import {
  registerStatusHandlers,
  registerMediaServerHandlers,
  registerLibrariesHandlers,
  registerOutputHandlers,
  registerValidationHandlers,
  registerUsersHandlers,
  registerOpenAIHandlers,
  registerJobsHandlers,
  registerTopPicksHandlers,
  registerAIHandlers,
  registerAdminHandlers,
} from './handlers/index.js'

const setupRoutes: FastifyPluginAsync = async (fastify) => {
  // Register all handler groups
  await registerStatusHandlers(fastify)
  await registerMediaServerHandlers(fastify)
  await registerLibrariesHandlers(fastify)
  await registerOutputHandlers(fastify)
  await registerValidationHandlers(fastify)
  await registerUsersHandlers(fastify)
  await registerOpenAIHandlers(fastify)
  await registerJobsHandlers(fastify)
  await registerTopPicksHandlers(fastify)
  await registerAIHandlers(fastify)
  await registerAdminHandlers(fastify)
}

export default setupRoutes
