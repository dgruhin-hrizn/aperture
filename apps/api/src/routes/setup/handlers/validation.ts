/**
 * Setup Validation Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getMediaServerApiKey,
  getMediaServerProvider,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'

interface ValidationCheck {
  id: string
  name: string
  description: string
  status: 'passed' | 'failed'
  error?: string
  suggestion?: string
}

interface ValidateBody {
  useSymlinks?: boolean
}

export async function registerValidationHandlers(fastify: FastifyInstance) {
  /**
   * POST /api/setup/validate
   * Run validation checks to ensure the setup is correct.
   */
  fastify.post<{ Body: ValidateBody }>(
    '/api/setup/validate',
    { schema: setupSchemas.validate },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const { useSymlinks = true } = request.body || {}
      const checks: ValidationCheck[] = []

      const fs = await import('fs/promises')
      const path = await import('path')

      // Check 1: Write access to /aperture-libraries
      const writeCheck: ValidationCheck = {
        id: 'write-access',
        name: 'Write Access',
        description: 'Can write to /aperture-libraries/',
        status: 'passed',
      }
      try {
        const testDir = '/aperture-libraries/.aperture-test'
        await fs.mkdir(testDir, { recursive: true })
        await fs.writeFile(path.join(testDir, 'test.txt'), 'test')
        await fs.rm(testDir, { recursive: true })
      } catch (err) {
        writeCheck.status = 'failed'
        writeCheck.error = err instanceof Error ? err.message : 'Unknown error'
        writeCheck.suggestion =
          'Mount /aperture-libraries in your docker-compose.yml. Example: /mnt/user/Media/ApertureLibraries:/aperture-libraries'
      }
      checks.push(writeCheck)

      // Check 2: Read access to /media
      const readCheck: ValidationCheck = {
        id: 'media-access',
        name: 'Media Access',
        description: 'Can read from /media/',
        status: 'passed',
      }
      try {
        const stats = await fs.stat('/media')
        if (!stats.isDirectory()) {
          throw new Error('/media is not a directory')
        }
        await fs.readdir('/media')
      } catch (err) {
        readCheck.status = 'failed'
        readCheck.error = err instanceof Error ? err.message : 'Unknown error'
        readCheck.suggestion =
          'Mount your media folder in docker-compose.yml. Example: /mnt/user/Media:/media:ro'
      }
      checks.push(readCheck)

      // Check 3: Symlink support (if symlinks enabled)
      if (useSymlinks) {
        const symlinkCheck: ValidationCheck = {
          id: 'symlink-support',
          name: 'Symlink Support',
          description: 'Can create symlinks from /aperture-libraries to /media',
          status: 'passed',
        }
        try {
          const findTestFile = async (dir: string, depth = 0): Promise<string | null> => {
            if (depth > 3) return null
            try {
              const entries = await fs.readdir(dir, { withFileTypes: true })
              for (const entry of entries) {
                if (entry.isFile()) {
                  return path.join(dir, entry.name)
                }
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                  const found = await findTestFile(path.join(dir, entry.name), depth + 1)
                  if (found) return found
                }
              }
            } catch {
              // Skip inaccessible directories
            }
            return null
          }

          const testFile = await findTestFile('/media')
          if (!testFile) {
            symlinkCheck.status = 'failed'
            symlinkCheck.error = 'No files found in /media to test symlink'
            symlinkCheck.suggestion =
              'Ensure your media folder contains files and is properly mounted'
          } else {
            const testSymlink = '/aperture-libraries/.aperture-test-symlink'
            try {
              await fs.symlink(testFile, testSymlink)
              await fs.unlink(testSymlink)
            } catch (err) {
              symlinkCheck.status = 'failed'
              symlinkCheck.error = err instanceof Error ? err.message : 'Unknown error'
              symlinkCheck.suggestion =
                'Your system may not support symlinks. Switch to STRM files in the previous step, or check Docker permissions.'
            }
          }
        } catch (err) {
          symlinkCheck.status = 'failed'
          symlinkCheck.error = err instanceof Error ? err.message : 'Unknown error'
          symlinkCheck.suggestion =
            'Check that both /aperture-libraries and /media are properly mounted'
        }
        checks.push(symlinkCheck)
      }

      // Check 4: Media server connectivity
      const mediaServerCheck: ValidationCheck = {
        id: 'media-server',
        name: 'Media Server',
        description: 'Can connect to your media server',
        status: 'passed',
      }
      try {
        const apiKey = await getMediaServerApiKey()
        if (!apiKey) {
          throw new Error('Media server not configured')
        }
        const provider = await getMediaServerProvider()
        await provider.getLibraries(apiKey)
      } catch (err) {
        mediaServerCheck.status = 'failed'
        mediaServerCheck.error = err instanceof Error ? err.message : 'Unknown error'
        mediaServerCheck.suggestion =
          'Check your media server is running and the connection details are correct'
      }
      checks.push(mediaServerCheck)

      const allPassed = checks.every((c) => c.status === 'passed')

      return reply.send({ checks, allPassed })
    }
  )
}
