import type { FastifyInstance } from 'fastify'
import {
  getStreamingDiscoveryEnabled,
  getStreamingDiscoveryProviderStrips,
  PARTNER_PROVIDER_TERMS_US,
  setStreamingDiscoveryEnabled,
  setStreamingDiscoveryProviderStrips,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'

export function registerStreamingDiscoverySettingsHandlers(fastify: FastifyInstance) {
  /**
   * Static US snapshot: Partner-shaped terms (technicalName, shortName, clearName).
   * For live per-country codes, use GET /api/discovery/streaming/providers.
   */
  fastify.get(
    '/api/settings/streaming-discovery/provider-terms-us',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      return reply.send({ terms: PARTNER_PROVIDER_TERMS_US })
    }
  )

  fastify.get(
    '/api/settings/streaming-discovery',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const [enabled, providerStrips] = await Promise.all([
        getStreamingDiscoveryEnabled(),
        getStreamingDiscoveryProviderStrips(),
      ])
      return reply.send({
        streamingDiscoveryEnabled: enabled,
        providerStrips,
      })
    }
  )

  fastify.patch<{
    Body: { streamingDiscoveryEnabled?: boolean; providerStrips?: string[] }
  }>('/api/settings/streaming-discovery', { preHandler: requireAdmin }, async (request, reply) => {
    const { streamingDiscoveryEnabled, providerStrips } = request.body || {}
    if (streamingDiscoveryEnabled !== undefined) {
      await setStreamingDiscoveryEnabled(streamingDiscoveryEnabled)
    }
    if (providerStrips !== undefined) {
      await setStreamingDiscoveryProviderStrips(providerStrips)
    }
    const [enabled, strips] = await Promise.all([
      getStreamingDiscoveryEnabled(),
      getStreamingDiscoveryProviderStrips(),
    ])
    return reply.send({
      streamingDiscoveryEnabled: enabled,
      providerStrips: strips,
    })
  })
}
