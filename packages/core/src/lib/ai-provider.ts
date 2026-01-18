/**
 * AI Provider Abstraction Layer
 *
 * Provides a unified interface for AI operations across different providers.
 * Supports per-function provider selection (embeddings, chat, text generation).
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { ollama, createOllama } from 'ai-sdk-ollama'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createHuggingFace } from '@ai-sdk/huggingface'
import type { LanguageModel, EmbeddingModel } from 'ai'
import { getSystemSetting, setSystemSetting } from '../settings/systemSettings.js'
import { createChildLogger } from './logger.js'
import {
  getProvider,
  getModel,
  getDefaultModel,
  validateCapabilityForFeature,
  getEmbeddingDimensions,
  getModelsForFunction,
  type AIFunction,
  type ModelCapabilities,
  type ModelMetadata,
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
  | 'openrouter'
  | 'huggingface'

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
  exploration: ProviderConfig | null
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
  exploration: FunctionStatus
  features: {
    semanticSearch: boolean
    chatWithTools: boolean
    recommendations: boolean
    explanations: boolean
    exploration: boolean
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
  return { embeddings: null, chat: null, textGeneration: null, exploration: null }
}

/**
 * Save AI configuration to database
 */
export async function setAIConfig(config: AIConfig): Promise<void> {
  await setSystemSetting(
    'ai_config',
    JSON.stringify(config),
    'Per-function AI provider configuration (embeddings, chat, textGeneration, exploration)'
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
    exploration: apiKey
      ? {
          provider: 'openai',
          model: 'gpt-4.1-mini', // Good default for JSON generation
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
      // Extended timeout for slow local inference (5 minutes)
      // Ollama on CPU or with large models can take several minutes to respond
      const ollamaFetch: typeof fetch = (url, options) => {
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(300000), // 5 minute timeout
        })
      }

      instance = createOllama({
        baseURL: providerConfig.baseUrl ?? 'http://localhost:11434',
        fetch: ollamaFetch,
      })
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

      case 'openrouter':
        instance = createOpenRouter({
          apiKey: providerConfig.apiKey,
        })
        break

      case 'huggingface':
        instance = createHuggingFace({
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
      return (provider as any).embedding(modelId)

    case 'google':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (provider as any).textEmbeddingModel(modelId)

    case 'openai-compatible':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (provider as any).textEmbeddingModel(modelId)

    case 'openrouter':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (provider as any).embedding(modelId)

    case 'huggingface':
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

/**
 * Get an exploration model instance for the configured provider
 * Used for semantic graph generation from conceptual inputs
 */
export async function getExplorationModelInstance(): Promise<LanguageModel> {
  const config = await getFunctionConfig('exploration')

  if (!config) {
    throw new Error(
      'Exploration provider is not configured. Please configure it in Settings > AI.'
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
  const exploration = getFunctionStatus('exploration')

  // Determine feature availability
  const features = {
    semanticSearch: embeddings.configured && (embeddings.capabilities?.supportsEmbeddings ?? false),
    chatWithTools: chat.configured && (chat.capabilities?.supportsToolCalling ?? false),
    recommendations: embeddings.configured && textGeneration.configured,
    explanations: textGeneration.configured,
    exploration: exploration.configured && embeddings.configured,
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
  if (!exploration.configured) {
    limitations.push('Exploration not configured - Explore page graph generation may not work optimally')
  }

  return {
    embeddings,
    chat,
    textGeneration,
    exploration,
    features,
    limitations,
    isFullyConfigured: embeddings.configured && chat.configured && textGeneration.configured && exploration.configured,
    isAnyConfigured: embeddings.configured || chat.configured || textGeneration.configured || exploration.configured,
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

  // First try built-in models
  const builtInDimensions = getEmbeddingDimensions(config.provider, config.model)
  if (builtInDimensions) return builtInDimensions

  // Check custom models from database
  const customModels = await getCustomModels(config.provider, 'embeddings')
  const customModel = customModels.find(m => m.modelId === config.model)
  if (customModel?.embeddingDimensions) {
    return customModel.embeddingDimensions
  }

  return undefined
}

/**
 * Get the active embedding model ID (in format "provider:model")
 * Used by queries to filter embeddings by the currently configured model
 */
export async function getActiveEmbeddingModelId(): Promise<string | null> {
  const config = await getFunctionConfig('embeddings')
  if (!config) return null
  return `${config.provider}:${config.model}`
}

// ============================================================================
// Multi-Dimension Embedding Table Helpers
// ============================================================================

/**
 * Valid embedding dimensions supported by the system.
 * Each dimension has a corresponding table (e.g., embeddings_768, embeddings_3072)
 */
export const VALID_EMBEDDING_DIMENSIONS = [256, 384, 512, 768, 1024, 1536, 3072, 4096] as const

export type ValidEmbeddingDimension = (typeof VALID_EMBEDDING_DIMENSIONS)[number]

/**
 * Get the table suffix for a given embedding dimension
 * @throws Error if dimension is not supported
 */
export function getEmbeddingTableSuffix(dimensions: number): string {
  if (!VALID_EMBEDDING_DIMENSIONS.includes(dimensions as ValidEmbeddingDimension)) {
    throw new Error(
      `Unsupported embedding dimension: ${dimensions}. ` +
        `Supported dimensions: ${VALID_EMBEDDING_DIMENSIONS.join(', ')}`
    )
  }
  return `_${dimensions}`
}

/**
 * Get the full table name for the current embedding model's dimension
 * @param baseTable - Base table name ('embeddings', 'series_embeddings', 'episode_embeddings')
 * @returns Full table name like 'embeddings_768' or 'series_embeddings_3072'
 * @throws Error if no embedding model is configured or dimensions are unknown
 */
export async function getActiveEmbeddingTableName(
  baseTable: 'embeddings' | 'series_embeddings' | 'episode_embeddings'
): Promise<string> {
  const dims = await getCurrentEmbeddingDimensions()
  if (!dims) {
    throw new Error('No embedding model configured or dimensions unknown')
  }
  return `${baseTable}${getEmbeddingTableSuffix(dims)}`
}

// ============================================================================
// Legacy Embedding Table Helpers
// ============================================================================

export interface LegacyEmbeddingsInfo {
  exists: boolean
  tables: Array<{
    name: string
    rowCount: number
  }>
  totalRows: number
}

const LEGACY_TABLE_NAMES = ['embeddings_legacy', 'series_embeddings_legacy', 'episode_embeddings_legacy']

/**
 * Check if legacy embedding tables exist (from before multi-dimension migration)
 */
export async function checkLegacyEmbeddingsExist(): Promise<LegacyEmbeddingsInfo> {
  const { query } = await import('./db.js')

  const tablesInfo: Array<{ name: string; rowCount: number }> = []

  for (const tableName of LEGACY_TABLE_NAMES) {
    // Check if table exists
    const existsResult = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    )

    if (existsResult.rows[0]?.exists) {
      // Get row count
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${tableName}`
      )
      tablesInfo.push({
        name: tableName,
        rowCount: parseInt(countResult.rows[0]?.count || '0', 10),
      })
    }
  }

  return {
    exists: tablesInfo.length > 0,
    tables: tablesInfo,
    totalRows: tablesInfo.reduce((sum, t) => sum + t.rowCount, 0),
  }
}

/**
 * Drop all legacy embedding tables
 * @throws Error if drop fails
 */
export async function dropLegacyEmbeddingTables(): Promise<void> {
  const { query } = await import('./db.js')

  for (const tableName of LEGACY_TABLE_NAMES) {
    await query(`DROP TABLE IF EXISTS ${tableName} CASCADE`)
    logger.info({ table: tableName }, 'Dropped legacy embedding table')
  }
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
        maxOutputTokens: 20,
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
// Custom Models (Ollama & OpenAI-Compatible)
// ============================================================================

/**
 * Custom model stored in the database
 */
export interface CustomModel {
  id: number
  provider: 'ollama' | 'openai-compatible' | 'openrouter' | 'huggingface'
  functionType: AIFunction
  modelId: string
  embeddingDimensions?: number  // Only for embeddings function
  createdAt: Date
}

/**
 * Get custom models for a specific provider and function
 */
export async function getCustomModels(
  providerId: string,
  fn: AIFunction
): Promise<CustomModel[]> {
  // Only Ollama, OpenAI-compatible, and OpenRouter support custom models
  if (providerId !== 'ollama' && providerId !== 'openai-compatible' && providerId !== 'openrouter') {
    return []
  }

  const { query } = await import('./db.js')
  
  const result = await query<{
    id: number
    provider: 'ollama' | 'openai-compatible' | 'openrouter' | 'huggingface'
    function_type: string
    model_id: string
    embedding_dimensions: number | null
    created_at: Date
  }>(
    `SELECT id, provider, function_type, model_id, embedding_dimensions, created_at 
     FROM custom_ai_models 
     WHERE provider = $1 AND function_type = $2
     ORDER BY model_id`,
    [providerId, fn]
  )

  return result.rows.map(row => ({
    id: row.id,
    provider: row.provider,
    functionType: row.function_type as AIFunction,
    modelId: row.model_id,
    embeddingDimensions: row.embedding_dimensions ?? undefined,
    createdAt: row.created_at,
  }))
}

/**
 * Add a custom model for Ollama, OpenAI-compatible, OpenRouter, or HuggingFace provider
 */
export async function addCustomModel(
  providerId: 'ollama' | 'openai-compatible' | 'openrouter' | 'huggingface',
  fn: AIFunction,
  modelId: string,
  embeddingDimensions?: number
): Promise<CustomModel> {
  const { queryOne } = await import('./db.js')
  
  const result = await queryOne<{
    id: number
    provider: 'ollama' | 'openai-compatible' | 'openrouter' | 'huggingface'
    function_type: string
    model_id: string
    embedding_dimensions: number | null
    created_at: Date
  }>(
    `INSERT INTO custom_ai_models (provider, function_type, model_id, embedding_dimensions)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, function_type, model_id) DO UPDATE SET 
       model_id = EXCLUDED.model_id,
       embedding_dimensions = EXCLUDED.embedding_dimensions
     RETURNING id, provider, function_type, model_id, embedding_dimensions, created_at`,
    [providerId, fn, modelId, embeddingDimensions ?? null]
  )

  if (!result) {
    throw new Error('Failed to add custom model')
  }

  logger.info({ provider: providerId, function: fn, model: modelId, embeddingDimensions }, 'Added custom AI model')

  return {
    id: result.id,
    provider: result.provider,
    functionType: result.function_type as AIFunction,
    modelId: result.model_id,
    embeddingDimensions: result.embedding_dimensions ?? undefined,
    createdAt: result.created_at,
  }
}

/**
 * Delete a custom model
 */
export async function deleteCustomModel(
  providerId: 'ollama' | 'openai-compatible' | 'openrouter' | 'huggingface',
  fn: AIFunction,
  modelId: string
): Promise<boolean> {
  const { query } = await import('./db.js')
  
  const result = await query(
    `DELETE FROM custom_ai_models 
     WHERE provider = $1 AND function_type = $2 AND model_id = $3`,
    [providerId, fn, modelId]
  )

  const deleted = (result.rowCount ?? 0) > 0
  if (deleted) {
    logger.info({ provider: providerId, function: fn, model: modelId }, 'Deleted custom AI model')
  }
  return deleted
}

/**
 * Get models for a provider/function including custom models from the database.
 * Use this instead of getModelsForFunction when you need custom models included.
 */
export async function getModelsForFunctionWithCustom(
  providerId: string,
  fn: AIFunction
): Promise<ModelMetadata[]> {
  // Get built-in models
  const builtInModels = getModelsForFunction(providerId, fn)

  // Get custom models from database (only for ollama and openai-compatible)
  const customModels = await getCustomModels(providerId, fn)

  // Convert custom models to ModelMetadata format
  const customModelMetadata: ModelMetadata[] = customModels.map(cm => ({
    id: cm.modelId,
    name: cm.modelId, // Use the model ID as the name
    description: 'Custom model',
    capabilities: {
      supportsToolCalling: fn === 'chat', // Assume custom chat models support tools
      supportsToolStreaming: fn === 'chat',
      supportsObjectGeneration: fn !== 'embeddings',
      supportsEmbeddings: fn === 'embeddings',
    },
    quality: 'standard' as const,
    costTier: 'free' as const,
    // Include embedding dimensions for custom embedding models
    embeddingDimensions: cm.embeddingDimensions,
    // Mark as custom for UI
    isCustom: true,
  }))

  // Return built-in models first, then custom models
  return [...builtInModels, ...customModelMetadata]
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

