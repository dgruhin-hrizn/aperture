import type { FastifyInstance } from 'fastify'
import {
  EmbyProvider,
  getMediaServerApiKey,
  getMediaServerProvider,
  getOutputPathConfig,
  queryOne,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'
import { validateOutputAccess, type OutputCheck } from '../outputValidation.js'

export async function registerValidationHandlers(fastify: FastifyInstance) {
  fastify.post<{ Body: { useSymlinks?: boolean } }>(
    '/api/setup/validate',
    { schema: setupSchemas.validate },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      const config = await getOutputPathConfig()
      const checks: OutputCheck[] = []
      let listDirectory: ((directory: string) => Promise<Array<{ Name: string }>>) | undefined
      try {
        const apiKey = await getMediaServerApiKey()
        if (!apiKey) throw new Error('Missing API key')
        const provider = await getMediaServerProvider()
        await provider.getLibraries(apiKey)
        checks.push({
          id: 'media-server',
          name: 'Media-server connection',
          description: 'Configured credentials can list libraries.',
          status: 'passed',
        })
        if (provider instanceof EmbyProvider)
          listDirectory = (directory) =>
            provider.fetch<Array<{ Name: string }>>(
              '/Environment/DirectoryContents?' +
                new URLSearchParams({
                  Path: directory,
                  IncludeFiles: 'true',
                  IncludeDirectories: 'false',
                }),
              apiKey,
              { method: 'POST', body: '{}', signal: AbortSignal.timeout(10_000) }
            )
      } catch {
        checks.push({
          id: 'media-server',
          name: 'Media-server connection',
          description: 'Cannot connect with the configured credentials.',
          status: 'failed',
          suggestion: 'Check the media-server address and API key.',
        })
      }
      const sample = await queryOne<{ path: string }>(
        'SELECT path FROM movies WHERE path IS NOT NULL ORDER BY id LIMIT 1'
      )
      checks.push(
        ...(await validateOutputAccess({
          root: '/aperture-libraries',
          mediaRoot: '/media',
          serverRoot: config.mediaServerLibrariesPath,
          useSymlinks: request.body?.useSymlinks ?? true,
          sampleMediaPath: sample?.path,
          listDirectory,
        }))
      )
      return reply.send({ checks, allPassed: checks.every((check) => check.status !== 'failed') })
    }
  )
}
