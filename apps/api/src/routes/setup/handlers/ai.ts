/**
 * Setup Multi-Provider AI Configuration Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getFunctionConfig,
  setFunctionConfig,
  testProviderConnection,
  PROVIDERS,
  getProvidersForFunction,
  getModelsForFunctionWithCustom,
  getSystemSetting,
  setSystemSetting,
  addCustomModel,
  deleteCustomModel,
  VALID_EMBEDDING_DIMENSIONS,
  type AIFunction,
  type ProviderType,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'

export async function registerAIHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/setup/ai/providers
   * Get available AI providers for a specific function
   */
  fastify.get<{
    Querystring: { function?: string }
  }>(
    '/api/setup/ai/providers',
    { schema: setupSchemas.getAIProviders },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
    }
  )

  /**
   * GET /api/setup/ai/models
   * Get available models for a specific provider and function
   */
  fastify.get<{
    Querystring: { provider: string; function: string }
  }>(
    '/api/setup/ai/models',
    { schema: setupSchemas.getAIModels },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
    }
  )

  /**
   * POST /api/setup/ai/custom-models
   * Add a custom model for Ollama, OpenAI-compatible, or OpenRouter provider
   */
  fastify.post<{
    Body: { provider: string; function: string; modelId: string; embeddingDimensions?: number }
  }>(
    '/api/setup/ai/custom-models',
    { schema: setupSchemas.addCustomModel },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
    }
  )

  /**
   * DELETE /api/setup/ai/custom-models
   * Delete a custom model
   */
  fastify.delete<{
    Body: { provider: string; function: string; modelId: string }
  }>(
    '/api/setup/ai/custom-models',
    { schema: setupSchemas.deleteCustomModel },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
    }
  )

  /**
   * GET /api/setup/ai/credentials/:provider
   * Get credentials for a specific provider
   */
  fastify.get<{ Params: { provider: string } }>(
    '/api/setup/ai/credentials/:provider',
    { schema: setupSchemas.getAICredentials },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
    }
  )

  /**
   * GET /api/setup/ai/:function
   * Get configuration for a specific AI function
   */
  fastify.get<{ Params: { function: string } }>(
    '/api/setup/ai/:function',
    { schema: setupSchemas.getAIFunctionConfig },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      try {
        const fn = request.params.function as AIFunction

        if (!['embeddings', 'chat', 'textGeneration', 'exploration'].includes(fn)) {
          return reply.status(400).send({ error: 'Invalid function. Must be embeddings, chat, textGeneration, or exploration' })
        }

        const config = await getFunctionConfig(fn)
        return reply.send({ config })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get AI function config')
        return reply.status(500).send({ error: 'Failed to get AI function configuration' })
      }
    }
  )

  /**
   * POST /api/setup/ai/test
   * Test a specific provider/model configuration
   */
  fastify.post<{
    Body: {
      function: string
      provider: string
      model: string
      apiKey?: string
      baseUrl?: string
    }
  }>(
    '/api/setup/ai/test',
    { schema: setupSchemas.testAIProvider },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
    }
  )

  /**
   * PATCH /api/setup/ai/:function
   * Update configuration for a specific AI function
   */
  fastify.patch<{
    Params: { function: string }
    Body: { provider: string; model: string; apiKey?: string; baseUrl?: string }
  }>(
    '/api/setup/ai/:function',
    { schema: setupSchemas.updateAIFunctionConfig },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

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
    }
  )
}
