/**
 * Setup Media Server Handlers
 */

import type { FastifyInstance } from 'fastify'
import dgram from 'dgram'
import {
  getMediaServerTypes,
  getMediaServerConfig,
  setMediaServerConfig,
  testMediaServerConnection,
  getSystemSetting,
  setSystemSetting,
  type MediaServerType,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'

interface DiscoveredServer {
  id: string
  name: string
  address: string
  type: 'emby' | 'jellyfin'
}

interface MediaServerBody {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}

interface TestMediaServerBody {
  type: MediaServerType
  baseUrl: string
  apiKey: string
}

export async function registerMediaServerHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/setup/media-server-types
   * Get available media server types (public during setup)
   */
  fastify.get(
    '/api/setup/media-server-types',
    { schema: setupSchemas.getMediaServerTypes },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      const types = getMediaServerTypes()
      return reply.send({ types })
    }
  )

  /**
   * GET /api/setup/discover-servers
   * Discover Emby/Jellyfin servers on the local network via UDP broadcast.
   */
  fastify.get(
    '/api/setup/discover-servers',
    { schema: setupSchemas.discoverServers },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const DISCOVERY_PORT = 7359
      const DISCOVERY_TIMEOUT = 3000

      const discoveredServers: DiscoveredServer[] = []
      const seenIds = new Set<string>()

      const discoverType = (message: string, serverType: 'emby' | 'jellyfin'): Promise<void> => {
        return new Promise((resolve) => {
          const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

          const cleanup = () => {
            try {
              socket.close()
            } catch {
              // Ignore close errors
            }
          }

          socket.on('error', (err) => {
            fastify.log.debug({ err, serverType }, 'Discovery socket error')
            cleanup()
            resolve()
          })

          socket.on('message', (msg) => {
            try {
              const response = JSON.parse(msg.toString())
              if (response.Id && response.Address && !seenIds.has(response.Id)) {
                seenIds.add(response.Id)
                discoveredServers.push({
                  id: response.Id,
                  name: response.Name || `${serverType} Server`,
                  address: response.Address,
                  type: serverType,
                })
              }
            } catch {
              // Ignore non-JSON responses
            }
          })

          socket.bind(() => {
            try {
              socket.setBroadcast(true)
              const buffer = Buffer.from(message)
              socket.send(buffer, 0, buffer.length, DISCOVERY_PORT, '255.255.255.255', (err) => {
                if (err) {
                  fastify.log.debug({ err, serverType }, 'Discovery send error')
                }
              })
            } catch (err) {
              fastify.log.debug({ err, serverType }, 'Discovery broadcast setup error')
            }
          })

          setTimeout(() => {
            cleanup()
            resolve()
          }, DISCOVERY_TIMEOUT)
        })
      }

      try {
        await Promise.all([
          discoverType('Who is EmbyServer?', 'emby'),
          discoverType('Who is JellyfinServer?', 'jellyfin'),
        ])

        return reply.send({ servers: discoveredServers })
      } catch (err) {
        fastify.log.error({ err }, 'Server discovery failed')
        return reply.send({ servers: [], error: 'Discovery failed' })
      }
    }
  )

  /**
   * POST /api/setup/media-server/test
   * Test media server connection (public during setup)
   */
  fastify.post<{ Body: TestMediaServerBody }>(
    '/api/setup/media-server/test',
    { schema: setupSchemas.testMediaServer },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      const { type, baseUrl, apiKey } = request.body

      if (!type || !baseUrl || !apiKey) {
        return reply.status(400).send({
          success: false,
          error: 'Type, base URL, and API key are required',
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
    { schema: setupSchemas.saveMediaServer },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const { type, baseUrl, apiKey } = request.body

      if (!type || !baseUrl || !apiKey) {
        return reply.status(400).send({
          error: 'Type, base URL, and API key are required',
        })
      }

      const testResult = await testMediaServerConnection({ type, baseUrl, apiKey })
      if (!testResult.success) {
        return reply.status(400).send({
          error: `Connection failed: ${testResult.error}`,
        })
      }

      await setMediaServerConfig({ type, baseUrl, apiKey })

      return reply.send({
        success: true,
        serverName: testResult.serverName,
      })
    }
  )

  /**
   * GET /api/setup/media-server/security
   * Get media server security settings (allow passwordless login)
   */
  fastify.get(
    '/api/setup/media-server/security',
    { schema: setupSchemas.getMediaServerSecurity },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
   * POST /api/setup/media-server/security
   * Update media server security settings (allow passwordless login)
   */
  fastify.post<{
    Body: {
      allowPasswordlessLogin?: boolean
    }
  }>(
    '/api/setup/media-server/security',
    { schema: setupSchemas.updateMediaServerSecurity },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
    }
  )
}
