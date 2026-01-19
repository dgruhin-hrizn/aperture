/**
 * Integration Settings Handlers (TMDb, OMDb, Studio Logos, OpenAI Legacy)
 * 
 * Endpoints:
 * - GET /api/settings/tmdb - Get TMDb config
 * - PATCH /api/settings/tmdb - Update TMDb config
 * - POST /api/settings/tmdb/test - Test TMDb connection
 * - GET /api/settings/omdb - Get OMDb config
 * - PATCH /api/settings/omdb - Update OMDb config
 * - POST /api/settings/omdb/test - Test OMDb connection
 * - GET /api/settings/studio-logos - Get studio logos config
 * - PATCH /api/settings/studio-logos - Update studio logos config
 * - GET /api/settings/openai - Get OpenAI config (legacy)
 * - PATCH /api/settings/openai - Update OpenAI config (legacy)
 * - POST /api/settings/openai/test - Test OpenAI connection (legacy)
 */
import type { FastifyInstance } from 'fastify'
import {
  getTMDbConfig,
  setTMDbConfig,
  testTMDbConnection,
  getOMDbConfig,
  setOMDbConfig,
  testOMDbConnection,
  getStudioLogosConfig,
  setStudioLogosConfig,
  getStudioLogoStats,
  hasOpenAIApiKey,
  setOpenAIApiKey,
  testOpenAIConnection,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import {
  tmdbConfigSchema,
  updateTmdbConfigSchema,
  testTmdbSchema,
  omdbConfigSchema,
  updateOmdbConfigSchema,
  testOmdbSchema,
  studioLogosConfigSchema,
  updateStudioLogosConfigSchema,
  openaiConfigSchema,
  updateOpenaiConfigSchema,
  testOpenaiSchema,
} from '../schemas.js'

export function registerIntegrationHandlers(fastify: FastifyInstance) {
  // =========================================================================
  // TMDb API Settings
  // =========================================================================

  /**
   * GET /api/settings/tmdb
   */
  fastify.get('/api/settings/tmdb', { preHandler: requireAdmin, schema: tmdbConfigSchema }, async (_request, reply) => {
    try {
      const config = await getTMDbConfig()
      return reply.send({
        hasApiKey: config.hasApiKey,
        enabled: config.enabled,
        isConfigured: config.hasApiKey,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get TMDb config')
      return reply.status(500).send({ error: 'Failed to get TMDb configuration' })
    }
  })

  /**
   * PATCH /api/settings/tmdb
   */
  fastify.patch<{
    Body: { apiKey?: string; enabled?: boolean }
  }>('/api/settings/tmdb', { preHandler: requireAdmin, schema: updateTmdbConfigSchema }, async (request, reply) => {
    try {
      const { apiKey, enabled } = request.body

      if (apiKey !== undefined && apiKey !== '' && typeof apiKey !== 'string') {
        return reply.status(400).send({ error: 'Invalid API key format' })
      }

      const config = await setTMDbConfig({ apiKey, enabled })

      return reply.send({
        hasApiKey: config.hasApiKey,
        enabled: config.enabled,
        isConfigured: config.hasApiKey,
        message: 'TMDb configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save TMDb config')
      return reply.status(500).send({ error: 'Failed to save TMDb configuration' })
    }
  })

  /**
   * POST /api/settings/tmdb/test
   */
  fastify.post<{
    Body?: { apiKey?: string }
  }>('/api/settings/tmdb/test', { preHandler: requireAdmin, schema: testTmdbSchema }, async (request, reply) => {
    try {
      const apiKey = request.body?.apiKey
      const result = await testTMDbConnection(apiKey)
      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test TMDb connection')
      return reply.status(500).send({ error: 'Failed to test TMDb connection' })
    }
  })

  // =========================================================================
  // OMDb API Settings
  // =========================================================================

  /**
   * GET /api/settings/omdb
   */
  fastify.get('/api/settings/omdb', { preHandler: requireAdmin, schema: omdbConfigSchema }, async (_request, reply) => {
    try {
      const config = await getOMDbConfig()
      return reply.send({
        hasApiKey: config.hasApiKey,
        enabled: config.enabled,
        isConfigured: config.hasApiKey,
        paidTier: config.paidTier,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get OMDb config')
      return reply.status(500).send({ error: 'Failed to get OMDb configuration' })
    }
  })

  /**
   * PATCH /api/settings/omdb
   */
  fastify.patch<{
    Body: { apiKey?: string; enabled?: boolean; paidTier?: boolean }
  }>('/api/settings/omdb', { preHandler: requireAdmin, schema: updateOmdbConfigSchema }, async (request, reply) => {
    try {
      const { apiKey, enabled, paidTier } = request.body

      if (apiKey !== undefined && apiKey !== '' && typeof apiKey !== 'string') {
        return reply.status(400).send({ error: 'Invalid API key format' })
      }

      const config = await setOMDbConfig({ apiKey, enabled, paidTier })

      return reply.send({
        hasApiKey: config.hasApiKey,
        enabled: config.enabled,
        isConfigured: config.hasApiKey,
        paidTier: config.paidTier,
        message: 'OMDb configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save OMDb config')
      return reply.status(500).send({ error: 'Failed to save OMDb configuration' })
    }
  })

  /**
   * POST /api/settings/omdb/test
   */
  fastify.post<{
    Body?: { apiKey?: string }
  }>('/api/settings/omdb/test', { preHandler: requireAdmin, schema: testOmdbSchema }, async (request, reply) => {
    try {
      const apiKey = request.body?.apiKey
      const result = await testOMDbConnection(apiKey)
      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test OMDb connection')
      return reply.status(500).send({ error: 'Failed to test OMDb connection' })
    }
  })

  // =========================================================================
  // Studio Logos Configuration
  // =========================================================================

  /**
   * GET /api/settings/studio-logos
   */
  fastify.get('/api/settings/studio-logos', { preHandler: requireAdmin, schema: studioLogosConfigSchema }, async (_request, reply) => {
    try {
      const [config, stats] = await Promise.all([
        getStudioLogosConfig(),
        getStudioLogoStats(),
      ])

      return reply.send({
        pushToEmby: config.pushToEmby,
        stats: {
          studios: stats.studios,
          networks: stats.networks,
          pushedToEmby: stats.pushedToEmby,
        },
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get studio logos config')
      return reply.status(500).send({ error: 'Failed to get studio logos configuration' })
    }
  })

  /**
   * PATCH /api/settings/studio-logos
   */
  fastify.patch<{
    Body: { pushToEmby?: boolean }
  }>('/api/settings/studio-logos', { preHandler: requireAdmin, schema: updateStudioLogosConfigSchema }, async (request, reply) => {
    try {
      const { pushToEmby } = request.body

      const config = await setStudioLogosConfig({ pushToEmby })

      return reply.send({
        pushToEmby: config.pushToEmby,
        message: 'Studio logos configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save studio logos config')
      return reply.status(500).send({ error: 'Failed to save studio logos configuration' })
    }
  })

  // =========================================================================
  // OpenAI Legacy Settings
  // =========================================================================

  /**
   * GET /api/settings/openai
   */
  fastify.get('/api/settings/openai', { preHandler: requireAdmin, schema: openaiConfigSchema }, async (_request, reply) => {
    try {
      const hasKey = await hasOpenAIApiKey()
      return reply.send({
        hasApiKey: hasKey,
        isConfigured: hasKey,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get OpenAI config')
      return reply.status(500).send({ error: 'Failed to get OpenAI configuration' })
    }
  })

  /**
   * PATCH /api/settings/openai
   */
  fastify.patch<{
    Body: { apiKey: string }
  }>('/api/settings/openai', { preHandler: requireAdmin, schema: updateOpenaiConfigSchema }, async (request, reply) => {
    try {
      const { apiKey } = request.body

      if (!apiKey || typeof apiKey !== 'string') {
        return reply.status(400).send({ error: 'API key is required' })
      }

      if (!apiKey.startsWith('sk-')) {
        return reply.status(400).send({ error: 'Invalid API key format. OpenAI keys start with sk-' })
      }

      await setOpenAIApiKey(apiKey)

      return reply.send({
        success: true,
        hasApiKey: true,
        isConfigured: true,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save OpenAI API key')
      return reply.status(500).send({ error: 'Failed to save OpenAI API key' })
    }
  })

  /**
   * POST /api/settings/openai/test
   */
  fastify.post('/api/settings/openai/test', { preHandler: requireAdmin, schema: testOpenaiSchema }, async (_request, reply) => {
    try {
      const result = await testOpenAIConnection()
      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test OpenAI connection')
      return reply.status(500).send({ error: 'Failed to test OpenAI connection' })
    }
  })
}
