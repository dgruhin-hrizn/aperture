/**
 * Setup Libraries Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getMediaServerConfig,
  getMediaServerProvider,
  getMediaServerApiKey,
  getLibraryConfigs,
  syncLibraryConfigsFromProvider,
  setLibraryEnabled,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'

interface SetLibrariesBody {
  libraries: Array<{ providerLibraryId: string; isEnabled: boolean }>
}

export async function registerLibrariesHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/setup/libraries
   * Fetch libraries from media server and sync into local library_config table
   */
  fastify.get(
    '/api/setup/libraries',
    { schema: setupSchemas.getLibraries },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const msConfig = await getMediaServerConfig()
      if (!msConfig.isConfigured || !msConfig.apiKey) {
        return reply.status(400).send({ error: 'Media server must be configured first' })
      }

      const provider = await getMediaServerProvider()
      const apiKey = await getMediaServerApiKey()
      if (!apiKey) return reply.status(400).send({ error: 'Media server API key missing' })

      const libs = await provider.getLibraries(apiKey)
      await syncLibraryConfigsFromProvider(
        libs.map((l) => ({ id: l.id, name: l.name, collectionType: l.collectionType }))
      )

      // Exclude Aperture-created libraries from selection
      const configs = await getLibraryConfigs(true)
      return reply.send({ libraries: configs })
    }
  )

  /**
   * POST /api/setup/libraries
   * Enable/disable libraries in local config (used to scope initial sync/jobs)
   */
  fastify.post<{ Body: SetLibrariesBody }>(
    '/api/setup/libraries',
    { schema: setupSchemas.setLibraries },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const body = request.body
      if (!body?.libraries || !Array.isArray(body.libraries)) {
        return reply.status(400).send({ error: 'libraries array is required' })
      }

      const results = []
      for (const lib of body.libraries) {
        const updated = await setLibraryEnabled(lib.providerLibraryId, lib.isEnabled)
        results.push(updated)
      }

      // Exclude Aperture-created libraries from response
      return reply.send({ success: true, libraries: await getLibraryConfigs(true) })
    }
  )
}
