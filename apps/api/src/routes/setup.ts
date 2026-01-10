/**
 * Setup Routes
 * 
 * Public endpoints for first-run setup wizard.
 * These endpoints only work when the system is not yet configured.
 */

import type { FastifyPluginAsync } from 'fastify'
import {
  getMediaServerConfig,
  setMediaServerConfig,
  testMediaServerConnection,
  getMediaServerTypes,
  hasOpenAIApiKey,
  setOpenAIApiKey,
  testOpenAIConnection,
  getSystemSetting,
  setSystemSetting,
  type MediaServerType,
} from '@aperture/core'

interface SetupStatusResponse {
  needsSetup: boolean
  configured: {
    mediaServer: boolean
    openai: boolean
  }
}

interface MediaServerBody {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}

interface OpenAIBody {
  apiKey: string
}

interface TestMediaServerBody {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}

/**
 * Check if initial setup has been completed
 */
async function isSetupComplete(): Promise<boolean> {
  const setupComplete = await getSystemSetting('setup_complete')
  return setupComplete === 'true'
}

/**
 * Guard that ensures setup endpoints only work during initial setup
 */
async function requireSetupMode(): Promise<void> {
  const complete = await isSetupComplete()
  if (complete) {
    throw new Error('Setup has already been completed. Use the settings page to make changes.')
  }
}

const setupRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/setup/status
   * Check if setup is needed (public endpoint)
   */
  fastify.get<{ Reply: SetupStatusResponse }>(
    '/api/setup/status',
    async (_request, reply) => {
      const setupComplete = await isSetupComplete()
      const mediaServerConfig = await getMediaServerConfig()
      const hasOpenAI = await hasOpenAIApiKey()

      return reply.send({
        needsSetup: !setupComplete,
        configured: {
          mediaServer: mediaServerConfig.isConfigured,
          openai: hasOpenAI,
        },
      })
    }
  )

  /**
   * GET /api/setup/media-server-types
   * Get available media server types (public during setup)
   */
  fastify.get('/api/setup/media-server-types', async (_request, reply) => {
    const types = getMediaServerTypes()
    return reply.send({ types })
  })

  /**
   * POST /api/setup/media-server/test
   * Test media server connection (public during setup)
   */
  fastify.post<{ Body: TestMediaServerBody }>(
    '/api/setup/media-server/test',
    async (request, reply) => {
      const { type, baseUrl, apiKey } = request.body

      if (!type || !baseUrl || !apiKey) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Type, base URL, and API key are required' 
        })
      }

      const result = await testMediaServerConnection({ type, baseUrl, apiKey })
      return reply.send(result)
    }
  )

  /**
   * POST /api/setup/media-server
   * Save media server configuration (only during setup)
   */
  fastify.post<{ Body: MediaServerBody }>(
    '/api/setup/media-server',
    async (request, reply) => {
      try {
        await requireSetupMode()
      } catch (err) {
        return reply.status(403).send({ 
          error: err instanceof Error ? err.message : 'Setup already complete' 
        })
      }

      const { type, baseUrl, apiKey } = request.body

      if (!type || !baseUrl || !apiKey) {
        return reply.status(400).send({ 
          error: 'Type, base URL, and API key are required' 
        })
      }

      // Test connection first
      const testResult = await testMediaServerConnection({ type, baseUrl, apiKey })
      if (!testResult.success) {
        return reply.status(400).send({ 
          error: `Connection failed: ${testResult.error}` 
        })
      }

      // Save configuration
      await setMediaServerConfig({ type, baseUrl, apiKey })

      return reply.send({ 
        success: true, 
        serverName: testResult.serverName 
      })
    }
  )

  /**
   * POST /api/setup/openai/test
   * Test OpenAI connection (public during setup)
   */
  fastify.post<{ Body: OpenAIBody }>(
    '/api/setup/openai/test',
    async (request, reply) => {
      const { apiKey } = request.body

      if (!apiKey) {
        return reply.status(400).send({ 
          success: false, 
          error: 'API key is required' 
        })
      }

      // Temporarily test with the provided key
      const originalKey = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = apiKey
      
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (response.ok) {
          return reply.send({ success: true })
        } else {
          const data = await response.json().catch(() => ({})) as { error?: { message?: string } }
          return reply.send({ 
            success: false, 
            error: data.error?.message || `API returned status ${response.status}` 
          })
        }
      } catch (err) {
        return reply.send({ 
          success: false, 
          error: err instanceof Error ? err.message : 'Connection failed' 
        })
      } finally {
        // Restore original key
        if (originalKey) {
          process.env.OPENAI_API_KEY = originalKey
        } else {
          delete process.env.OPENAI_API_KEY
        }
      }
    }
  )

  /**
   * POST /api/setup/openai
   * Save OpenAI API key (only during setup)
   */
  fastify.post<{ Body: OpenAIBody }>(
    '/api/setup/openai',
    async (request, reply) => {
      try {
        await requireSetupMode()
      } catch (err) {
        return reply.status(403).send({ 
          error: err instanceof Error ? err.message : 'Setup already complete' 
        })
      }

      const { apiKey } = request.body

      if (!apiKey) {
        return reply.status(400).send({ error: 'API key is required' })
      }

      await setOpenAIApiKey(apiKey)

      return reply.send({ success: true })
    }
  )

  /**
   * POST /api/setup/complete
   * Mark setup as complete
   */
  fastify.post(
    '/api/setup/complete',
    async (_request, reply) => {
      // Verify media server is configured before completing
      const mediaServerConfig = await getMediaServerConfig()
      if (!mediaServerConfig.isConfigured) {
        return reply.status(400).send({ 
          error: 'Media server must be configured before completing setup' 
        })
      }

      await setSystemSetting('setup_complete', 'true', 'Initial setup has been completed')

      return reply.send({ success: true })
    }
  )
}

export default setupRoutes

