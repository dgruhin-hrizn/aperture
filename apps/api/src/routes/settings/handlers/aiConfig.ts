/**
 * Multi-Provider AI Configuration Handlers
 * 
 * This is the largest handler file covering all AI configuration endpoints.
 * 
 * Endpoints:
 * - GET /api/settings/ai - Get full AI configuration
 * - PUT /api/settings/ai - Update full AI configuration
 * - GET /api/settings/ai/capabilities - Get AI capabilities status (admin)
 * - GET /api/settings/ai/features - Get AI features (user accessible)
 * - GET /api/settings/ai/credentials - Get AI provider credentials status
 * - GET /api/settings/ai/credentials/:provider - Get specific provider credentials
 * - PUT /api/settings/ai/credentials/:provider - Save provider credentials
 * - GET /api/settings/ai/providers - Get available providers
 * - GET /api/settings/ai/models - Get available models for provider
 * - POST /api/settings/ai/custom-models - Add custom model
 * - DELETE /api/settings/ai/custom-models - Delete custom model
 * - GET /api/settings/ai/pricing - Get AI pricing
 * - GET /api/settings/ai/pricing/status - Get pricing cache status
 * - POST /api/settings/ai/pricing/refresh - Refresh pricing cache
 * - GET /api/settings/ai/embeddings/sets - List embedding sets
 * - DELETE /api/settings/ai/embeddings/sets/:model - Delete embedding set
 * - POST /api/settings/ai/embeddings/clear - Clear all embeddings
 * - GET /api/settings/ai/embeddings/legacy - Check legacy embeddings
 * - DELETE /api/settings/ai/embeddings/legacy - Drop legacy embeddings
 * - POST /api/settings/ai/test - Test AI provider
 * - PATCH /api/settings/ai/:function - Update function config
 */
import type { FastifyInstance } from 'fastify'
import {
  getAIConfig,
  setAIConfig,
  getFunctionConfig,
  setFunctionConfig,
  getAICapabilitiesStatus,
  VALID_EMBEDDING_DIMENSIONS,
  checkLegacyEmbeddingsExist,
  dropLegacyEmbeddingTables,
  testProviderConnection,
  PROVIDERS,
  getProvidersForFunction,
  getModelsForFunctionWithCustom,
  getPricingForModelAsync,
  refreshPricingCache,
  getPricingCacheStatus,
  addCustomModel,
  deleteCustomModel,
  getSystemSetting,
  setSystemSetting,
  type AIFunction,
  type ProviderType,
} from '@aperture/core'
import { query } from '../../../lib/db.js'
import { requireAdmin, requireAuth } from '../../../plugins/auth.js'
import {
  aiConfigSchema,
  aiCapabilitiesSchema,
  aiFeaturesSchema,
  aiCredentialsSchema,
  updateAiCredentialSchema,
  aiProvidersSchema,
  aiModelsSchema,
  testAiProviderSchema,
  addCustomModelSchema,
  deleteCustomModelSchema,
  embeddingSetsSchema,
  deleteEmbeddingSetSchema,
  clearAllEmbeddingsSchema,
  legacyEmbeddingsSchema,
  deleteLegacyEmbeddingsSchema,
  aiPricingSchema,
  aiPricingStatusSchema,
  refreshAiPricingSchema,
} from '../schemas.js'

export function registerAiConfigHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/ai
   */
  fastify.get('/api/settings/ai', { preHandler: requireAdmin, schema: aiConfigSchema }, async (_request, reply) => {
    try {
      const config = await getAIConfig()
      const capabilities = await getAICapabilitiesStatus()
      return reply.send({ config, capabilities })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI config')
      return reply.status(500).send({ error: 'Failed to get AI configuration' })
    }
  })

  /**
   * PUT /api/settings/ai
   */
  fastify.put<{
    Body: {
      embeddings?: { provider: ProviderType; model: string; apiKey?: string; baseUrl?: string }
      chat?: { provider: ProviderType; model: string; apiKey?: string; baseUrl?: string }
      textGeneration?: { provider: ProviderType; model: string; apiKey?: string; baseUrl?: string }
      exploration?: { provider: ProviderType; model: string; apiKey?: string; baseUrl?: string }
    }
  }>('/api/settings/ai', { preHandler: requireAdmin, schema: { tags: ['settings'] } }, async (request, reply) => {
    try {
      const currentConfig = await getAIConfig()
      const updates = request.body

      const newConfig = {
        embeddings: updates.embeddings
          ? { ...currentConfig.embeddings, ...updates.embeddings }
          : currentConfig.embeddings,
        chat: updates.chat ? { ...currentConfig.chat, ...updates.chat } : currentConfig.chat,
        textGeneration: updates.textGeneration
          ? { ...currentConfig.textGeneration, ...updates.textGeneration }
          : currentConfig.textGeneration,
        exploration: updates.exploration
          ? { ...currentConfig.exploration, ...updates.exploration }
          : currentConfig.exploration,
      }

      await setAIConfig(newConfig)
      const capabilities = await getAICapabilitiesStatus()
      return reply.send({ config: newConfig, capabilities })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update AI config')
      return reply.status(500).send({ error: 'Failed to update AI configuration' })
    }
  })

  /**
   * GET /api/settings/ai/capabilities
   */
  fastify.get('/api/settings/ai/capabilities', { preHandler: requireAdmin, schema: aiCapabilitiesSchema }, async (_request, reply) => {
    try {
      const capabilities = await getAICapabilitiesStatus()
      return reply.send(capabilities)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI capabilities')
      return reply.status(500).send({ error: 'Failed to get AI capabilities' })
    }
  })

  /**
   * GET /api/settings/ai/features
   */
  fastify.get('/api/settings/ai/features', { preHandler: requireAuth, schema: aiFeaturesSchema }, async (_request, reply) => {
    try {
      const capabilities = await getAICapabilitiesStatus()
      
      return reply.send({
        embeddings: {
          configured: capabilities.embeddings.configured,
          supportsEmbeddings: capabilities.embeddings.capabilities?.supportsEmbeddings ?? false,
        },
        chat: {
          configured: capabilities.chat.configured,
          supportsToolCalling: capabilities.chat.capabilities?.supportsToolCalling ?? false,
          supportsStreaming: capabilities.chat.capabilities?.supportsToolStreaming ?? false,
        },
        textGeneration: {
          configured: capabilities.textGeneration.configured,
        },
        exploration: {
          configured: capabilities.exploration.configured,
        },
        features: {
          semanticSearch: capabilities.embeddings.configured,
          chatWithTools: capabilities.chat.configured && (capabilities.chat.capabilities?.supportsToolCalling ?? false),
          basicChat: capabilities.chat.configured,
          recommendations: capabilities.embeddings.configured && capabilities.textGeneration.configured,
          explanations: capabilities.textGeneration.configured,
          exploration: capabilities.exploration.configured && capabilities.embeddings.configured,
        },
        isFullyConfigured: capabilities.isFullyConfigured,
        isAnyConfigured: capabilities.isAnyConfigured,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI features')
      return reply.status(500).send({ error: 'Failed to get AI features' })
    }
  })

  /**
   * GET /api/settings/ai/credentials
   */
  fastify.get('/api/settings/ai/credentials', { preHandler: requireAdmin, schema: aiCredentialsSchema }, async (_request, reply) => {
    try {
      const credentialsJson = await getSystemSetting('ai_provider_credentials')
      const credentials = credentialsJson ? JSON.parse(credentialsJson) : {}
      
      const maskedCredentials: Record<string, { hasApiKey: boolean; baseUrl?: string }> = {}
      for (const [provider, creds] of Object.entries(credentials)) {
        const c = creds as { apiKey?: string; baseUrl?: string }
        maskedCredentials[provider] = {
          hasApiKey: !!c.apiKey,
          baseUrl: c.baseUrl,
        }
      }
      
      return reply.send({ credentials: maskedCredentials })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI credentials')
      return reply.status(500).send({ error: 'Failed to get AI credentials' })
    }
  })

  /**
   * GET /api/settings/ai/credentials/:provider
   */
  fastify.get<{ Params: { provider: string } }>('/api/settings/ai/credentials/:provider', { preHandler: requireAdmin, schema: { tags: ['settings'] } }, async (request, reply) => {
    try {
      const { provider } = request.params
      const credentialsJson = await getSystemSetting('ai_provider_credentials')
      const credentials = credentialsJson ? JSON.parse(credentialsJson) : {}
      const providerCreds = credentials[provider] || {}
      
      return reply.send({
        provider,
        apiKey: providerCreds.apiKey || '',
        baseUrl: providerCreds.baseUrl || '',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get provider credentials')
      return reply.status(500).send({ error: 'Failed to get provider credentials' })
    }
  })

  /**
   * PUT /api/settings/ai/credentials/:provider
   */
  fastify.put<{ 
    Params: { provider: string }
    Body: { apiKey?: string; baseUrl?: string }
  }>('/api/settings/ai/credentials/:provider', { preHandler: requireAdmin, schema: updateAiCredentialSchema }, async (request, reply) => {
    try {
      const { provider } = request.params
      const { apiKey, baseUrl } = request.body
      
      const credentialsJson = await getSystemSetting('ai_provider_credentials')
      const credentials = credentialsJson ? JSON.parse(credentialsJson) : {}
      
      credentials[provider] = {
        ...(credentials[provider] || {}),
        ...(apiKey !== undefined && { apiKey }),
        ...(baseUrl !== undefined && { baseUrl }),
      }
      
      if (!credentials[provider].apiKey && !credentials[provider].baseUrl) {
        delete credentials[provider]
      }
      
      await setSystemSetting('ai_provider_credentials', JSON.stringify(credentials), 'Stored credentials for AI providers')
      
      return reply.send({ success: true, provider })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to save provider credentials')
      return reply.status(500).send({ error: 'Failed to save provider credentials' })
    }
  })

  /**
   * GET /api/settings/ai/providers
   */
  fastify.get<{
    Querystring: { function?: string }
  }>('/api/settings/ai/providers', { preHandler: requireAdmin, schema: aiProvidersSchema }, async (request, reply) => {
    try {
      const fn = request.query.function as AIFunction | undefined

      if (fn) {
        const providers = await getProvidersForFunction(fn)
        return reply.send({ providers })
      }

      return reply.send({ providers: PROVIDERS })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI providers')
      return reply.status(500).send({ error: 'Failed to get AI providers' })
    }
  })

  /**
   * GET /api/settings/ai/models
   */
  fastify.get<{
    Querystring: { provider: string; function: string }
  }>('/api/settings/ai/models', { preHandler: requireAdmin, schema: aiModelsSchema }, async (request, reply) => {
    try {
      const { provider, function: fn } = request.query

      if (!provider || !fn) {
        return reply.status(400).send({ error: 'provider and function are required' })
      }

      const models = await getModelsForFunctionWithCustom(provider as ProviderType, fn as AIFunction)
      return reply.send({ models })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI models')
      return reply.status(500).send({ error: 'Failed to get AI models' })
    }
  })

  /**
   * POST /api/settings/ai/custom-models
   */
  fastify.post<{
    Body: { provider: string; function: string; modelId: string; embeddingDimensions?: number }
  }>('/api/settings/ai/custom-models', { preHandler: requireAdmin, schema: addCustomModelSchema }, async (request, reply) => {
    try {
      const { provider, function: fn, modelId, embeddingDimensions } = request.body

      if (!provider || !fn || !modelId) {
        return reply.status(400).send({ error: 'provider, function, and modelId are required' })
      }

      if (provider !== 'ollama' && provider !== 'openai-compatible' && provider !== 'openrouter' && provider !== 'huggingface') {
        return reply.status(400).send({ error: 'Custom models are only supported for ollama, openai-compatible, openrouter, and huggingface providers' })
      }

      if (fn === 'embeddings') {
        if (!embeddingDimensions) {
          return reply.status(400).send({ error: 'embeddingDimensions is required for embedding models' })
        }
        if (!VALID_EMBEDDING_DIMENSIONS.includes(embeddingDimensions as typeof VALID_EMBEDDING_DIMENSIONS[number])) {
          return reply.status(400).send({ 
            error: `Invalid embedding dimensions. Supported: ${VALID_EMBEDDING_DIMENSIONS.join(', ')}` 
          })
        }
      }

      const customModel = await addCustomModel(
        provider as 'ollama' | 'openai-compatible' | 'openrouter' | 'huggingface',
        fn as AIFunction,
        modelId,
        fn === 'embeddings' ? embeddingDimensions : undefined
      )

      return reply.send({ success: true, model: customModel })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to add custom model')
      return reply.status(500).send({ error: 'Failed to add custom model' })
    }
  })

  /**
   * DELETE /api/settings/ai/custom-models
   */
  fastify.delete<{
    Body: { provider: string; function: string; modelId: string }
  }>('/api/settings/ai/custom-models', { preHandler: requireAdmin, schema: deleteCustomModelSchema }, async (request, reply) => {
    try {
      const { provider, function: fn, modelId } = request.body

      if (!provider || !fn || !modelId) {
        return reply.status(400).send({ error: 'provider, function, and modelId are required' })
      }

      if (provider !== 'ollama' && provider !== 'openai-compatible' && provider !== 'openrouter' && provider !== 'huggingface') {
        return reply.status(400).send({ error: 'Custom models are only supported for ollama, openai-compatible, openrouter, and huggingface providers' })
      }

      const deleted = await deleteCustomModel(
        provider as 'ollama' | 'openai-compatible' | 'openrouter' | 'huggingface',
        fn as AIFunction,
        modelId
      )

      if (!deleted) {
        return reply.status(404).send({ error: 'Custom model not found' })
      }

      return reply.send({ success: true })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete custom model')
      return reply.status(500).send({ error: 'Failed to delete custom model' })
    }
  })

  /**
   * GET /api/settings/ai/pricing
   */
  fastify.get('/api/settings/ai/pricing', { preHandler: requireAdmin, schema: aiPricingSchema }, async (_request, reply) => {
    try {
      const aiConfig = await getAIConfig()

      const [embeddingsPricing, chatPricing, textGenerationPricing, explorationPricing] = await Promise.all([
        aiConfig.embeddings
          ? getPricingForModelAsync(aiConfig.embeddings.provider, aiConfig.embeddings.model, 'embeddings')
          : null,
        aiConfig.chat
          ? getPricingForModelAsync(aiConfig.chat.provider, aiConfig.chat.model, 'chat')
          : null,
        aiConfig.textGeneration
          ? getPricingForModelAsync(aiConfig.textGeneration.provider, aiConfig.textGeneration.model, 'textGeneration')
          : null,
        aiConfig.exploration
          ? getPricingForModelAsync(aiConfig.exploration.provider, aiConfig.exploration.model, 'exploration')
          : null,
      ])

      return reply.send({
        embeddings: embeddingsPricing,
        chat: chatPricing,
        textGeneration: textGenerationPricing,
        exploration: explorationPricing,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get AI pricing')
      return reply.status(500).send({ error: 'Failed to get AI pricing' })
    }
  })

  /**
   * GET /api/settings/ai/pricing/status
   */
  fastify.get('/api/settings/ai/pricing/status', { preHandler: requireAdmin, schema: aiPricingStatusSchema }, async (_request, reply) => {
    try {
      const status = await getPricingCacheStatus()
      return reply.send(status)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get pricing cache status')
      return reply.status(500).send({ error: 'Failed to get pricing cache status' })
    }
  })

  /**
   * POST /api/settings/ai/pricing/refresh
   */
  fastify.post('/api/settings/ai/pricing/refresh', { preHandler: requireAdmin, schema: refreshAiPricingSchema }, async (_request, reply) => {
    try {
      await refreshPricingCache()
      const status = await getPricingCacheStatus()
      return reply.send({ success: true, status })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to refresh pricing cache')
      return reply.status(500).send({ error: 'Failed to refresh pricing cache' })
    }
  })

  /**
   * GET /api/settings/ai/embeddings/sets
   */
  fastify.get('/api/settings/ai/embeddings/sets', { preHandler: requireAdmin, schema: embeddingSetsSchema }, async (_request, reply) => {
    try {
      const movieUnions = VALID_EMBEDDING_DIMENSIONS.map(d => 
        `SELECT model, COUNT(*)::int as count, ${d} as dimensions FROM embeddings_${d} GROUP BY model`
      ).join(' UNION ALL ')
      
      const seriesUnions = VALID_EMBEDDING_DIMENSIONS.map(d => 
        `SELECT model, COUNT(*)::int as count, ${d} as dimensions FROM series_embeddings_${d} GROUP BY model`
      ).join(' UNION ALL ')
      
      const episodeUnions = VALID_EMBEDDING_DIMENSIONS.map(d => 
        `SELECT model, COUNT(*)::int as count, ${d} as dimensions FROM episode_embeddings_${d} GROUP BY model`
      ).join(' UNION ALL ')
      
      const movieSets = await query<{ model: string; count: number; dimensions: number }>(`${movieUnions}`)
      const seriesSets = await query<{ model: string; count: number; dimensions: number }>(`${seriesUnions}`)
      const episodeSets = await query<{ model: string; count: number; dimensions: number }>(`${episodeUnions}`)
      
      const setsMap = new Map<string, { model: string; dimensions: number; movieCount: number; seriesCount: number; episodeCount: number; totalCount: number }>()
      
      for (const row of movieSets.rows) {
        const existing = setsMap.get(row.model) || { model: row.model, dimensions: row.dimensions, movieCount: 0, seriesCount: 0, episodeCount: 0, totalCount: 0 }
        existing.movieCount += row.count
        existing.totalCount += row.count
        setsMap.set(row.model, existing)
      }
      
      for (const row of seriesSets.rows) {
        const existing = setsMap.get(row.model) || { model: row.model, dimensions: row.dimensions, movieCount: 0, seriesCount: 0, episodeCount: 0, totalCount: 0 }
        existing.seriesCount += row.count
        existing.totalCount += row.count
        setsMap.set(row.model, existing)
      }
      
      for (const row of episodeSets.rows) {
        const existing = setsMap.get(row.model) || { model: row.model, dimensions: row.dimensions, movieCount: 0, seriesCount: 0, episodeCount: 0, totalCount: 0 }
        existing.episodeCount += row.count
        existing.totalCount += row.count
        setsMap.set(row.model, existing)
      }
      
      const aiConfig = await getAIConfig()
      const currentModel = aiConfig.embeddings ? `${aiConfig.embeddings.provider}:${aiConfig.embeddings.model}` : null
      
      const sets = Array.from(setsMap.values()).map(set => ({
        ...set,
        isActive: set.model === currentModel,
      })).sort((a, b) => {
        if (a.isActive && !b.isActive) return -1
        if (!a.isActive && b.isActive) return 1
        return b.totalCount - a.totalCount
      })
      
      return reply.send({
        sets,
        currentModel,
        totalSets: sets.length,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get embedding sets')
      return reply.status(500).send({ error: 'Failed to get embedding sets' })
    }
  })

  /**
   * DELETE /api/settings/ai/embeddings/sets/:model
   */
  fastify.delete<{ Params: { model: string } }>('/api/settings/ai/embeddings/sets/:model', { preHandler: requireAdmin, schema: deleteEmbeddingSetSchema }, async (request, reply) => {
    const { model } = request.params
    const decodedModel = decodeURIComponent(model)
    
    try {
      const aiConfig = await getAIConfig()
      const currentModel = aiConfig.embeddings ? `${aiConfig.embeddings.provider}:${aiConfig.embeddings.model}` : null
      
      if (decodedModel === currentModel) {
        return reply.status(400).send({ error: 'Cannot delete the active embedding set. Switch to a different model first.' })
      }
      
      let movieCount = 0
      let seriesCount = 0
      let episodeCount = 0
      
      for (const dim of VALID_EMBEDDING_DIMENSIONS) {
        const movieResult = await query(`DELETE FROM embeddings_${dim} WHERE model = $1`, [decodedModel])
        const seriesResult = await query(`DELETE FROM series_embeddings_${dim} WHERE model = $1`, [decodedModel])
        const episodeResult = await query(`DELETE FROM episode_embeddings_${dim} WHERE model = $1`, [decodedModel])
        
        movieCount += movieResult.rowCount || 0
        seriesCount += seriesResult.rowCount || 0
        episodeCount += episodeResult.rowCount || 0
      }
      
      const totalDeleted = movieCount + seriesCount + episodeCount
      
      fastify.log.info({ model: decodedModel, totalDeleted }, 'Deleted embedding set')
      return reply.send({ 
        success: true, 
        message: `Deleted embedding set for ${decodedModel}`,
        deleted: {
          movies: movieCount,
          series: seriesCount,
          episodes: episodeCount,
        }
      })
    } catch (err) {
      fastify.log.error({ err, model: decodedModel }, 'Failed to delete embedding set')
      return reply.status(500).send({ error: 'Failed to delete embedding set' })
    }
  })

  /**
   * POST /api/settings/ai/embeddings/clear
   */
  fastify.post('/api/settings/ai/embeddings/clear', { preHandler: requireAdmin, schema: clearAllEmbeddingsSchema }, async (_request, reply) => {
    try {
      for (const dim of VALID_EMBEDDING_DIMENSIONS) {
        await query(`TRUNCATE embeddings_${dim}`)
        await query(`TRUNCATE series_embeddings_${dim}`)
        await query(`TRUNCATE episode_embeddings_${dim}`)
      }
      
      fastify.log.info('All embeddings cleared from dimension tables')
      return reply.send({ success: true, message: 'All embeddings cleared' })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to clear embeddings')
      return reply.status(500).send({ error: 'Failed to clear embeddings' })
    }
  })

  /**
   * GET /api/settings/ai/embeddings/legacy
   */
  fastify.get('/api/settings/ai/embeddings/legacy', { preHandler: requireAdmin, schema: legacyEmbeddingsSchema }, async (_request, reply) => {
    try {
      const legacyInfo = await checkLegacyEmbeddingsExist()
      return reply.send(legacyInfo)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to check legacy embeddings')
      return reply.status(500).send({ error: 'Failed to check legacy embeddings' })
    }
  })

  /**
   * DELETE /api/settings/ai/embeddings/legacy
   */
  fastify.delete('/api/settings/ai/embeddings/legacy', { preHandler: requireAdmin, schema: deleteLegacyEmbeddingsSchema }, async (_request, reply) => {
    try {
      const legacyInfo = await checkLegacyEmbeddingsExist()
      if (!legacyInfo.exists) {
        return reply.status(404).send({ error: 'No legacy embedding tables found' })
      }
      
      await dropLegacyEmbeddingTables()
      
      fastify.log.info({ tables: legacyInfo.tables }, 'Legacy embedding tables dropped')
      return reply.send({ 
        success: true, 
        message: 'Legacy embedding tables dropped',
        droppedTables: legacyInfo.tables,
        totalRowsDeleted: legacyInfo.totalRows
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to drop legacy embeddings')
      return reply.status(500).send({ error: 'Failed to drop legacy embeddings' })
    }
  })

  /**
   * POST /api/settings/ai/test
   */
  fastify.post<{
    Body: {
      function: string
      provider: string
      model: string
      apiKey?: string
      baseUrl?: string
    }
  }>('/api/settings/ai/test', { preHandler: requireAdmin, schema: testAiProviderSchema }, async (request, reply) => {
    try {
      const { function: fn, provider, model, apiKey, baseUrl } = request.body

      if (!fn || !provider || !model) {
        return reply.status(400).send({ error: 'function, provider, and model are required' })
      }

      let testApiKey = apiKey
      let testBaseUrl = baseUrl
      if (!testApiKey || !testBaseUrl) {
        const savedConfig = await getFunctionConfig(fn as AIFunction)
        if (savedConfig && savedConfig.provider === provider) {
          testApiKey = testApiKey || savedConfig.apiKey
          testBaseUrl = testBaseUrl || savedConfig.baseUrl
        }
      }

      const result = await testProviderConnection(
        {
          provider: provider as ProviderType,
          model,
          apiKey: testApiKey,
          baseUrl: testBaseUrl,
        },
        fn as AIFunction
      )

      return reply.send(result)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to test AI provider')
      return reply.status(500).send({ error: 'Failed to test AI provider' })
    }
  })

  /**
   * PATCH /api/settings/ai/:function
   */
  fastify.patch<{
    Params: { function: string }
    Body: { provider: string; model: string; apiKey?: string; baseUrl?: string }
  }>('/api/settings/ai/:function', { preHandler: requireAdmin, schema: { tags: ['settings'] } }, async (request, reply) => {
    try {
      const fn = request.params.function as AIFunction
      const { provider, model, apiKey, baseUrl } = request.body

      if (!['embeddings', 'chat', 'textGeneration', 'exploration'].includes(fn)) {
        return reply.status(400).send({ error: 'Invalid function. Must be embeddings, chat, textGeneration, or exploration' })
      }

      if (apiKey || baseUrl) {
        const credentialsJson = await getSystemSetting('ai_provider_credentials')
        const credentials = credentialsJson ? JSON.parse(credentialsJson) : {}
        
        credentials[provider] = {
          ...(credentials[provider] || {}),
          ...(apiKey && { apiKey }),
          ...(baseUrl && { baseUrl }),
        }
        
        await setSystemSetting('ai_provider_credentials', JSON.stringify(credentials), 'Stored credentials for AI providers')
      }

      await setFunctionConfig(fn, {
        provider: provider as ProviderType,
        model,
        apiKey,
        baseUrl,
      })

      const config = await getFunctionConfig(fn)
      return reply.send({ config })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update AI function config')
      return reply.status(500).send({ error: 'Failed to update AI function configuration' })
    }
  })
}
