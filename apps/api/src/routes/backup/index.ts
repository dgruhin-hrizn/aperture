/**
 * Backup Routes
 *
 * Database backup and restore endpoints.
 * Most endpoints require admin authentication, except setup endpoints.
 */

import type { FastifyPluginAsync } from 'fastify'
import {
  registerConfigHandlers,
  registerOperationsHandlers,
  registerSetupHandlers,
} from './handlers/index.js'

const backupRoutes: FastifyPluginAsync = async (fastify) => {
  await registerConfigHandlers(fastify)
  await registerOperationsHandlers(fastify)
  await registerSetupHandlers(fastify)
}

export default backupRoutes
