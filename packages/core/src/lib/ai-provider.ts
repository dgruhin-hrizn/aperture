/**
 * AI Provider Abstraction Layer
 *
 * Provides a unified interface for AI operations across different providers.
 * Supports per-function provider selection (embeddings, chat, text generation).
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { ollama, createOllama } from 'ollama-ai-provider'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createDeepSeek } from '@ai-sdk/deepseek'
import type { LanguageModel, EmbeddingModel } from 'ai'
import { getSystemSetting, setSystemSetting } from '../settings/systemSettings.js'
import { createChildLogger } from './logger.js'
import {
  getProvider,
  getModel,
  getDefaultModel,
  validateCapabilityForFeature,
  getEmbeddingDimensions,
  type AIFunction,
  type ModelCapabilities,
} from './ai-capabilities.js'

const logger = createChildLogger('ai-provider')

// ============================================================================
// Types
// ============================================================================

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'openai-compatible'
  | 'groq'
  | 'google'
  | 'deepseek'

export interface ProviderConfig {
  provider: ProviderType
  model: string
  apiKey?: string
  baseUrl?: string
}

export interface AIConfig {
  embeddings: ProviderConfig | null
  chat: ProviderConfig | null
  textGeneration: ProviderConfig | null
  migratedAt?: string
  migratedFrom?: string
}

export interface FunctionStatus {
  configured: boolean
  provider: ProviderType | null
  model: string | null
  capabilities: ModelCapabilities | null
}

export interface AICapabilitiesStatus {
  embeddings: FunctionStatus
  chat: FunctionStatus
  textGeneration: FunctionStatus
  features: {
    semanticSearch: boolean
    chatWithTools: boolean
    recommendations: boolean
    explanations: boolean
  }
  limitations: string[]
  isFullyConfigured: boolean
  isAnyConfigured: boolean
}

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Get the AI configuration from database
 */
export async function getAIConfig(): Promise<AIConfig> {
  // Try new config first
  const configJson = await getSystemSetting('ai_config')
  if (configJson) {
    try {
      return JSON.parse(configJson) as AIConfig
    } catch (e) {
      logger.error({ error: e }, 'Failed to parse ai_config')
    }
  }

  // Fallback: migrate from legacy settings
  const legacyKey = await getSystemSetting('openai_api_key')
  if (legacyKey) {
    logger.info('Migrating from legacy OpenAI configuration')
    const migratedConfig = await migrateFromLegacyOpenAI()
    return migratedConfig
  }

  // No config at all - return unconfigured state
  return { embeddings: null, chat: null, textGeneration: null }
}

/**
 * Save AI configuration to database
 */
export async function setAIConfig(config: AIConfig): Promise<void> {
  await setSystemSetting(
    'ai_config',
    JSON.stringify(config),
    'Per-function AI provider configuration (embeddings, chat, textGeneration)'
  )
  logger.info('AI configuration updated')

  // Clear cached providers
  cachedProviders.clear()
}

/**
 * Get configuration for a specific AI function
 */
export async function getFunctionConfig(fn: AIFunction): Promise<ProviderConfig | null> {
  const config = await getAIConfig()
  return config[fn] ?? null
}

/**
 * Set configuration for a specific AI function
 */
export async function setFunctionConfig(fn: AIFunction, providerConfig: ProviderConfig): Promise<void> {
  const config = await getAIConfig()
  config[fn] = providerConfig
  await setAIConfig(config)
}

/**
 * Migrate from legacy OpenAI-only configuration
 */
async function migrateFromLegacyOpenAI(): Promise<AIConfig> {
  const apiKey = await getSystemSetting('openai_api_key')
  const embeddingModel = (await getSystemSetting('embedding_model')) ?? 'text-embedding-3-large'
  const textGenModel = (await getSystemSetting('text_generation_model')) ?? 'gpt-4.1-mini'
  const chatModel = (await getSystemSetting('chat_assistant_model')) ?? 'gpt-4.1-nano'

  const config: AIConfig = {
    embeddings: apiKey
      ? {
          provider: 'openai',
          model: embeddingModel,
          apiKey,
        }
      : null,
    chat: apiKey
      ? {
          provider: 'openai',
          model: chatModel,
          apiKey,
        }
      : null,
    textGeneration: apiKey
      ? {
          provider: 'openai',
          model: textGenModel,
          apiKey,
        }
      : null,
    migratedAt: new Date().toISOString(),
    migratedFrom: 'openai_single_provider',
  }

  // Save migrated config
  await setAIConfig(config)

  return config
}

// ============================================================================
// Provider Factory
// ============================================================================

// Cache providers to avoid recreating them on every call
const cachedProviders = new Map<string, unknown>()

function getCacheKey(providerConfig: ProviderConfig): string {
  return `${providerConfig.provider}:${providerConfig.apiKey ?? ''}:${providerConfig.baseUrl ?? ''}`
}

/**
 * Create a provider instance based on configuration
 */
function createProviderInstance(providerConfig: ProviderConfig): unknown {
  const cacheKey = getCacheKey(providerConfig)
  const cached = cachedProviders.get(cacheKey)
  if (cached) return cached

  let instance: unknown

  switch (providerConfig.provider) {
    case 'openai':
      instance = createOpenAI({
        apiKey: providerConfig.apiKey,
        baseURL: providerConfig.baseUrl,
      })
      break

    case 'anthropic':
      instance = createAnthropic({
        apiKey: providerConfig.apiKey,
      })
      break

    case 'ollama':
      instance = providerConfig.baseUrl
        ? createOllama({ baseURL: providerConfig.baseUrl })
        : ollama
      break

    case 'openai-compatible':
      instance = createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: providerConfig.baseUrl ?? 'http://localhost:1234/v1',
        apiKey: providerConfig.apiKey,
      })
      break

    case 'groq':
      instance = createGroq({
        apiKey: providerConfig.apiKey,
      })
      break

    case 'google':
      instance = createGoogleGenerativeAI({
        apiKey: providerConfig.apiKey,
      })
      break

    case 'deepseek':
      instance = createDeepSeek({
        apiKey: providerConfig.apiKey,
      })
      break

    default:
      throw new Error(`Unknown provider: ${providerConfig.provider}`)
  }

  cachedProviders.set(cacheKey, instance)
  return instance
}

// ============================================================================
// Model Factory Functions
// ============================================================================

/**
 * Get an embedding model instance for the configured provider
 */
export async function getEmbeddingModelInstance(): Promise<EmbeddingModel<string>> {
  const config = await getFunctionConfig('embeddings')

  if (!config) {
    throw new Error(
      'Embedding provider is not configured. Please configure it in Settings > AI.'
    )
  }

  const provider = createProviderInstance(config)
  const modelId = config.model

  // Different providers have different APIs for embeddings
  switch (config.provider) {
    case 'openai':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (provider as any).embedding(modelId)

    case 'ollama':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (provider as any).textEmbeddingModel(modelId)

    case 'google':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (provider as any).textEmbeddingModel(modelId)

    case 'openai-compatible':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (provider as any).textEmbeddingModel(modelId)

    default:
      throw new Error(`Provider ${config.provider} does not support embeddings`)
  }
}

/**
 * Get a chat model instance (with tool calling) for the configured provider
 */
export async function getChatModelInstance(): Promise<LanguageModel> {
  const config = await getFunctionConfig('chat')

  if (!config) {
    throw new Error(
      'Chat provider is not configured. Please configure it in Settings > AI.'
    )
  }

  // Validate tool calling support
  const validation = validateCapabilityForFeature('chat', config.provider, config.model)
  if (!validation.supported) {
    logger.warn({ provider: config.provider, model: config.model, reason: validation.reason },
      'Chat model may not support tool calling')
  }

  const provider = createProviderInstance(config)
  const modelId = config.model

  // All providers use similar API for language models
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (provider as any)(modelId) as LanguageModel
}

/**
 * Get a text generation model instance for the configured provider
 */
export async function getTextGenerationModelInstance(): Promise<LanguageModel> {
  const config = await getFunctionConfig('textGeneration')

  if (!config) {
    throw new Error(
      'Text generation provider is not configured. Please configure it in Settings > AI.'
    )
  }

  const provider = createProviderInstance(config)
  const modelId = config.model

  // All providers use similar API for language models
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (provider as any)(modelId) as LanguageModel
}

// ============================================================================
// Capability Checking
// ============================================================================

/**
 * Get full capabilities status for all AI functions
 */
export async function getAICapabilitiesStatus(): Promise<AICapabilitiesStatus> {
  const config = await getAIConfig()

  const getFunctionStatus = (fn: AIFunction): FunctionStatus => {
    const fnConfig = config[fn]
    if (!fnConfig) {
      return {
        configured: false,
        provider: null,
        model: null,
        capabilities: null,
      }
    }

    const model = getModel(fnConfig.provider, fnConfig.model, fn)
    return {
      configured: true,
      provider: fnConfig.provider,
      model: fnConfig.model,
      capabilities: model?.capabilities ?? null,
    }
  }

  const embeddings = getFunctionStatus('embeddings')
  const chat = getFunctionStatus('chat')
  const textGeneration = getFunctionStatus('textGeneration')

  // Determine feature availability
  const features = {
    semanticSearch: embeddings.configured && (embeddings.capabilities?.supportsEmbeddings ?? false),
    chatWithTools: chat.configured && (chat.capabilities?.supportsToolCalling ?? false),
    recommendations: embeddings.configured && textGeneration.configured,
    explanations: textGeneration.configured,
  }

  // Build limitations list
  const limitations: string[] = []
  if (!embeddings.configured) {
    limitations.push('Embeddings not configured - semantic search and recommendations unavailable')
  }
  if (!chat.configured) {
    limitations.push('Chat not configured - AI assistant unavailable')
  } else if (!chat.capabilities?.supportsToolCalling) {
    limitations.push('Chat model does not support tool calling - assistant will work but cannot access your library')
  }
  if (!textGeneration.configured) {
    limitations.push('Text generation not configured - explanations and synopses unavailable')
  }

  return {
    embeddings,
    chat,
    textGeneration,
    features,
    limitations,
    isFullyConfigured: embeddings.configured && chat.configured && textGeneration.configured,
    isAnyConfigured: embeddings.configured || chat.configured || textGeneration.configured,
  }
}

/**
 * Check if a specific AI function is configured and available
 */
export async function isAIFunctionConfigured(fn: AIFunction): Promise<boolean> {
  const config = await getFunctionConfig(fn)
  return config !== null
}

/**
 * Check if any AI provider is configured
 */
export async function isAnyAIConfigured(): Promise<boolean> {
  const config = await getAIConfig()
  return config.embeddings !== null || config.chat !== null || config.textGeneration !== null
}

/**
 * Check if all AI functions are configured
 */
export async function isFullyConfigured(): Promise<boolean> {
  const config = await getAIConfig()
  return config.embeddings !== null && config.chat !== null && config.textGeneration !== null
}

/**
 * Get the embedding dimensions for the current embedding provider
 */
export async function getCurrentEmbeddingDimensions(): Promise<number | undefined> {
  const config = await getFunctionConfig('embeddings')
  if (!config) return undefined

  return getEmbeddingDimensions(config.provider, config.model)
}

// ============================================================================
// Connection Testing
// ============================================================================

/**
 * Test connection to a provider
 */
export async function testProviderConnection(
  providerConfig: ProviderConfig,
  fn: AIFunction
): Promise<{ success: boolean; error?: string }> {
  try {
    const provider = createProviderInstance(providerConfig)

    if (fn === 'embeddings') {
      // Test embedding
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (provider as any).embedding?.(providerConfig.model) ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (provider as any).textEmbeddingModel?.(providerConfig.model)

      if (!model) {
        return { success: false, error: 'Provider does not support embeddings' }
      }

      // Import embed from ai package
      const { embed } = await import('ai')
      await embed({
        model,
        value: 'test',
      })
    } else {
      // Test chat/text generation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (provider as any)(providerConfig.model) as LanguageModel

      // Import generateText from ai package
      const { generateText } = await import('ai')
      await generateText({
        model,
        prompt: 'Say "ok" and nothing else.',
        maxOutputTokens: 5,
      })
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ error, provider: providerConfig.provider }, 'Provider connection test failed')
    return { success: false, error: message }
  }
}

// ============================================================================
// Backwards Compatibility
// ============================================================================

/**
 * Get OpenAI API key (for backwards compatibility)
 * @deprecated Use getAIConfig() and access the provider config directly
 */
export async function getOpenAIApiKeyLegacy(): Promise<string | null> {
  // First check new config
  const config = await getAIConfig()
  if (config.embeddings?.provider === 'openai' && config.embeddings.apiKey) {
    return config.embeddings.apiKey
  }

  // Fall back to legacy setting
  return getSystemSetting('openai_api_key')
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  getProvider,
  getModel,
  getDefaultModel,
  validateCapabilityForFeature,
  getEmbeddingDimensions,
  getProvidersForFunction,
  getModelsForFunction,
  getPricingForModel,
  getPricingForModelAsync,
  PROVIDERS,
} from './ai-capabilities.js'

export type { AIFunction, ModelMetadata, ProviderMetadata, ModelCapabilities, FunctionPricing } from './ai-capabilities.js'

// Pricing cache exports
export {
  getPricingData,
  findModelPricing,
  refreshPricingCache,
  getPricingCacheStatus,
} from './pricing-cache.js'

