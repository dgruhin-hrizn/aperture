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
import { backupComponentSchemas } from './schemas.js'

const backupRoutes: FastifyPluginAsync = async (fastify) => {
  // Register component schemas for $ref usage
  for (const [name, schema] of Object.entries(backupComponentSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }
  
  await registerConfigHandlers(fastify)
  await registerOperationsHandlers(fastify)
  await registerSetupHandlers(fastify)
}

export default backupRoutes
