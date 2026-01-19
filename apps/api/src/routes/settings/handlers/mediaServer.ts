/**
 * Media Server Settings Handlers
 * 
 * Endpoints:
 * - GET /api/settings/media-server - Public info for play buttons
 * - GET /api/settings/media-server/config - Admin config
 * - PATCH /api/settings/media-server/config - Update config
 * - GET /api/settings/media-server/security - Security settings
 * - PATCH /api/settings/media-server/security - Update security
 * - POST /api/settings/media-server/test - Test connection
 */
import type { FastifyInstance } from 'fastify'
import {
  createMediaServerProvider,
  getMediaServerConfig,
  setMediaServerConfig,
  testMediaServerConnection,
  getMediaServerTypes,
  getSystemSetting,
  setSystemSetting,
  type MediaServerType,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import {
  mediaServerInfoSchema,
  mediaServerConfigSchema,
  updateMediaServerConfigSchema,
  mediaServerSecuritySchema,
  updateMediaServerSecuritySchema,
  testMediaServerSchema,
} from '../schemas.js'

export function registerMediaServerHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/media-server
   * Get media server info for frontend (URL for play links)
   */
  fastify.get('/api/settings/media-server', { schema: mediaServerInfoSchema }, async (_request, reply) => {
    const config = await getMediaServerConfig()
    const baseUrl = config.baseUrl || ''
    const serverType = config.type || 'emby'
    const apiKey = config.apiKey || ''

    let serverId = ''
    let serverName = ''

    if (baseUrl && apiKey && config.type) {
      try {
        const provider = createMediaServerProvider(config.type, baseUrl)
        if ('getServerInfo' in provider) {
          const info = await (
            provider as { getServerInfo: (key: string) => Promise<{ id: string; name: string }> }
          ).getServerInfo(apiKey)
          serverId = info.id
          serverName = info.name
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Could not fetch media server info')
      }
    }

    return reply.send({
      baseUrl,
      type: serverType,
      serverId,
      serverName,
      webClientUrl: baseUrl ? `${baseUrl}/web/index.html` : '',
      isConfigured: config.isConfigured,
    })
  })

  /**
   * GET /api/settings/media-server/config
   */
  fastify.get(
    '/api/settings/media-server/config',
    { preHandler: requireAdmin, schema: mediaServerConfigSchema },
    async (_request, reply) => {
      try {
        const config = await getMediaServerConfig()
        const serverTypes = getMediaServerTypes()

        return reply.send({
          config: {
            type: config.type,
            baseUrl: config.baseUrl,
            hasApiKey: !!config.apiKey,
            isConfigured: config.isConfigured,
          },
          serverTypes,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get media server config')
        return reply.status(500).send({ error: 'Failed to get media server configuration' })
      }
    }
  )

  /**
   * PATCH /api/settings/media-server/config
   */
  fastify.patch<{
    Body: {
      type?: MediaServerType
      baseUrl?: string
      apiKey?: string
    }
  }>('/api/settings/media-server/config', { preHandler: requireAdmin, schema: updateMediaServerConfigSchema }, async (request, reply) => {
    try {
      const { type, baseUrl, apiKey } = request.body

      if (type !== undefined) {
        const validTypes = getMediaServerTypes().map(
          (t: { id: MediaServerType; name: string }) => t.id
        )
        if (!validTypes.includes(type)) {
          return reply.status(400).send({
            error: `Invalid server type. Valid options: ${validTypes.join(', ')}`,
          })
        }
      }

      if (baseUrl !== undefined && baseUrl !== '') {
        try {
          new URL(baseUrl)
        } catch {
          return reply.status(400).send({ error: 'Invalid base URL format' })
        }
      }

      const config = await setMediaServerConfig({ type, baseUrl, apiKey })

      return reply.send({
        config: {
          type: config.type,
          baseUrl: config.baseUrl,
          hasApiKey: !!config.apiKey,
          isConfigured: config.isConfigured,
        },
        message: 'Media server configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update media server config')
      return reply.status(500).send({ error: 'Failed to update media server configuration' })
    }
  })

  /**
   * GET /api/settings/media-server/security
   */
  fastify.get(
    '/api/settings/media-server/security',
    { preHandler: requireAdmin, schema: mediaServerSecuritySchema },
    async (_request, reply) => {
      try {
        const allowPasswordlessLogin = await getSystemSetting('allow_passwordless_login')
        return reply.send({
          allowPasswordlessLogin: allowPasswordlessLogin === 'true',
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get media server security settings')
        return reply.status(500).send({ error: 'Failed to get security settings' })
      }
    }
  )

  /**
   * PATCH /api/settings/media-server/security
   */
  fastify.patch<{
    Body: {
      allowPasswordlessLogin?: boolean
    }
  }>('/api/settings/media-server/security', { preHandler: requireAdmin, schema: updateMediaServerSecuritySchema }, async (request, reply) => {
    try {
      const { allowPasswordlessLogin } = request.body

      if (allowPasswordlessLogin !== undefined) {
        await setSystemSetting(
          'allow_passwordless_login',
          String(allowPasswordlessLogin),
          'Allow users with no password on their media server account to log in'
        )
      }

      return reply.send({
        allowPasswordlessLogin: allowPasswordlessLogin ?? false,
        message: 'Security settings updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update media server security settings')
      return reply.status(500).send({ error: 'Failed to update security settings' })
    }
  })

  /**
   * POST /api/settings/media-server/test
   */
  fastify.post<{
    Body: {
      type?: MediaServerType
      baseUrl?: string
      apiKey?: string
      useSavedCredentials?: boolean
    }
  }>('/api/settings/media-server/test', { preHandler: requireAdmin, schema: testMediaServerSchema }, async (request, reply) => {
    try {
      const { type, baseUrl, apiKey, useSavedCredentials } = request.body

      let testType = type
      let testBaseUrl = baseUrl
      let testApiKey = apiKey

      if (useSavedCredentials) {
        const savedConfig = await getMediaServerConfig()
        testType = type || (savedConfig.type as MediaServerType) || undefined
        testBaseUrl = baseUrl || savedConfig.baseUrl || undefined
        testApiKey = apiKey || savedConfig.apiKey || undefined
      }

      if (!testType || !testBaseUrl || !testApiKey) {
        return reply.status(400).send({ error: 'type, baseUrl, and apiKey are required' })
      }

      const validTypes = getMediaServerTypes().map((t) => t.id)
      if (!validTypes.includes(testType)) {
        return reply.status(400).send({
          error: `Invalid server type. Valid options: ${validTypes.join(', ')}`,
        })
      }

      const result = await testMediaServerConnection({
        type: testType,
        baseUrl: testBaseUrl,
        apiKey: testApiKey,
      })

      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test media server connection')
      return reply.status(500).send({ error: 'Failed to test connection' })
    }
  })
}
