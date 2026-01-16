/**
 * AI Provider Capability Registry
 *
 * Tracks which providers and models support specific AI features like
 * tool calling, embeddings, streaming, and object generation.
 */

// ============================================================================
// Types
// ============================================================================

export interface ModelCapabilities {
  supportsToolCalling: boolean
  supportsToolStreaming: boolean
  supportsObjectGeneration: boolean
  supportsEmbeddings: boolean
}

export interface ModelMetadata {
  id: string
  name: string
  capabilities: ModelCapabilities

  // For embedding models
  embeddingDimensions?: number

  // Comparison info for UI
  description?: string
  quality?: 'budget' | 'standard' | 'premium'
  speed?: 'slow' | 'medium' | 'fast'
  costTier?: 'free' | 'low' | 'medium' | 'high'
  contextWindow?: string
  inputCostPerMillion?: number
  outputCostPerMillion?: number
  notes?: string
}

export interface ProviderMetadata {
  id: string
  name: string
  type: 'cloud' | 'self-hosted' | 'openai-compatible'
  website?: string
  logoPath?: string

  // Which functions this provider supports
  supportsEmbeddings: boolean
  supportsChat: boolean
  supportsTextGeneration: boolean
  supportsExploration: boolean

  // Required configuration
  requiresApiKey: boolean
  requiresBaseUrl: boolean
  defaultBaseUrl?: string

  // Available models
  embeddingModels: ModelMetadata[]
  chatModels: ModelMetadata[]
  textGenerationModels: ModelMetadata[]
  explorationModels: ModelMetadata[]
}

export type AIFunction = 'embeddings' | 'chat' | 'textGeneration' | 'exploration'

// ============================================================================
// Provider Registry
// ============================================================================

export const PROVIDERS: ProviderMetadata[] = [
  // -------------------------------------------------------------------------
  // Tier 1: Must-Have Providers
  // -------------------------------------------------------------------------
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    website: 'https://platform.openai.com',
    logoPath: '/openai.svg',
    supportsEmbeddings: true,
    supportsChat: true,
    supportsTextGeneration: true,
    supportsExploration: true,
    requiresApiKey: true,
    requiresBaseUrl: false,
    embeddingModels: [
      {
        id: 'text-embedding-3-large',
        name: 'text-embedding-3-large',
        description: 'Best quality embeddings. Captures nuanced semantic similarities.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: false,
          supportsEmbeddings: true,
        },
        embeddingDimensions: 3072,
        quality: 'premium',
        costTier: 'low',
        inputCostPerMillion: 0.13,
      },
      {
        id: 'text-embedding-3-small',
        name: 'text-embedding-3-small',
        description: 'Good balance of quality and cost. Suitable for most use cases.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: false,
          supportsEmbeddings: true,
        },
        embeddingDimensions: 1536,
        quality: 'standard',
        costTier: 'low',
        inputCostPerMillion: 0.02,
      },
    ],
    chatModels: [
      {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 Mini',
        description: 'Great balance of capability and cost. Recommended for most use cases.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'fast',
        costTier: 'low',
        contextWindow: '1M',
        inputCostPerMillion: 0.4,
        outputCostPerMillion: 1.6,
      },
      {
        id: 'gpt-4.1-nano',
        name: 'GPT-4.1 Nano',
        description: 'Fastest and cheapest. Good for simple queries.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'budget',
        speed: 'fast',
        costTier: 'low',
        contextWindow: '1M',
        inputCostPerMillion: 0.1,
        outputCostPerMillion: 0.4,
      },
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        description: 'Full GPT-4.1 model. Best quality, higher cost.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'medium',
        costTier: 'medium',
        contextWindow: '1M',
        inputCostPerMillion: 2.0,
        outputCostPerMillion: 8.0,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Multimodal model with vision capabilities.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'fast',
        costTier: 'medium',
        contextWindow: '128K',
        inputCostPerMillion: 2.5,
        outputCostPerMillion: 10.0,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Smaller GPT-4o. Good for simpler tasks.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'fast',
        costTier: 'low',
        contextWindow: '128K',
        inputCostPerMillion: 0.15,
        outputCostPerMillion: 0.6,
      },
      {
        id: 'o3-mini',
        name: 'o3 Mini',
        description: 'Reasoning model. Better at complex problems.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'slow',
        costTier: 'medium',
        contextWindow: '200K',
        inputCostPerMillion: 1.1,
        outputCostPerMillion: 4.4,
      },
    ],
    textGenerationModels: [], // Same as chat models, populated dynamically
    explorationModels: [], // Same as chat models, populated dynamically
  },

  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'cloud',
    website: 'https://console.anthropic.com',
    supportsEmbeddings: false,
    supportsChat: true,
    supportsTextGeneration: true,
    supportsExploration: true,
    requiresApiKey: true,
    requiresBaseUrl: false,
    embeddingModels: [],
    chatModels: [
      {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        description: 'Best balance of intelligence and speed. Excellent for complex reasoning.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'medium',
        costTier: 'medium',
        contextWindow: '200K',
        inputCostPerMillion: 3.0,
        outputCostPerMillion: 15.0,
      },
      {
        id: 'claude-haiku-3-5',
        name: 'Claude Haiku 3.5',
        description: 'Fast and efficient. Good for simpler tasks.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'fast',
        costTier: 'low',
        contextWindow: '200K',
        inputCostPerMillion: 0.8,
        outputCostPerMillion: 4.0,
      },
    ],
    textGenerationModels: [],
    explorationModels: [],
  },

  {
    id: 'ollama',
    name: 'Ollama',
    type: 'self-hosted',
    website: 'https://ollama.ai',
    supportsEmbeddings: true,
    supportsChat: true,
    supportsTextGeneration: true,
    supportsExploration: true,
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    embeddingModels: [
      {
        id: 'nomic-embed-text',
        name: 'Nomic Embed Text',
        description: 'Recommended. Good quality 768-dim embeddings.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: false,
          supportsEmbeddings: true,
        },
        embeddingDimensions: 768,
        quality: 'standard',
        costTier: 'free',
      },
      {
        id: 'mxbai-embed-large',
        name: 'mxbai Embed Large',
        description: 'Higher quality 1024-dim embeddings. More accurate.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: false,
          supportsEmbeddings: true,
        },
        embeddingDimensions: 1024,
        quality: 'standard',
        costTier: 'free',
      },
      {
        id: 'nomic-embed-text-v2-moe',
        name: 'Nomic Embed Text v2 MoE',
        description: 'Best for non-English content. 768-dim multilingual.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: false,
          supportsEmbeddings: true,
        },
        embeddingDimensions: 768,
        quality: 'standard',
        costTier: 'free',
      },
    ],
    chatModels: [
      {
        id: 'qwen3',
        name: 'Qwen 3',
        description: 'Recommended. Excellent tool calling and reasoning.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'medium',
        costTier: 'free',
        contextWindow: '128K',
      },
      {
        id: 'firefunction-v2',
        name: 'FireFunction v2',
        description: 'Specialized for function calling. GPT-4 level tools.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'medium',
        costTier: 'free',
        contextWindow: '8K',
      },
    ],
    textGenerationModels: [
      {
        id: 'llama3.2',
        name: 'Llama 3.2',
        description: 'Recommended. Latest Llama, fast and capable.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'medium',
        costTier: 'free',
        contextWindow: '128K',
      },
      {
        id: 'llama3.1',
        name: 'Llama 3.1',
        description: 'Proven and reliable. 8B/70B/405B sizes available.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'medium',
        costTier: 'free',
        contextWindow: '128K',
      },
      {
        id: 'gemma3',
        name: 'Gemma 3',
        description: 'Fast and efficient. Great for limited hardware.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'fast',
        costTier: 'free',
        contextWindow: '8K',
      },
      {
        id: 'phi4',
        name: 'Phi 4',
        description: 'Compact 14B model. Punches above its weight.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'fast',
        costTier: 'free',
        contextWindow: '16K',
      },
    ],
    explorationModels: [],
  },

  {
    id: 'openai-compatible',
    name: 'OpenAI-Compatible',
    type: 'openai-compatible',
    website: '',
    supportsEmbeddings: true,
    supportsChat: true,
    supportsTextGeneration: true,
    supportsExploration: true,
    requiresApiKey: false, // Optional
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:1234/v1',
    embeddingModels: [], // Discovered dynamically
    chatModels: [], // Discovered dynamically
    textGenerationModels: [],
    explorationModels: [],
    // Note: LM Studio, LocalAI, vLLM, text-generation-webui all use this
  },

  // -------------------------------------------------------------------------
  // Tier 2: Popular Cloud Alternatives
  // -------------------------------------------------------------------------
  {
    id: 'groq',
    name: 'Groq',
    type: 'cloud',
    website: 'https://console.groq.com',
    supportsEmbeddings: false,
    supportsChat: true,
    supportsTextGeneration: true,
    supportsExploration: true,
    requiresApiKey: true,
    requiresBaseUrl: false,
    embeddingModels: [],
    chatModels: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        description: 'Extremely fast inference. Free tier available.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'fast',
        costTier: 'free',
        contextWindow: '128K',
        notes: 'Free tier has rate limits',
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        description: 'Very fast, smaller model. Good for simple tasks.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'fast',
        costTier: 'free',
        contextWindow: '128K',
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        description: 'MoE model with good tool calling support.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'fast',
        costTier: 'free',
        contextWindow: '32K',
      },
    ],
    textGenerationModels: [],
    explorationModels: [],
  },

  {
    id: 'google',
    name: 'Google AI',
    type: 'cloud',
    website: 'https://aistudio.google.com',
    supportsEmbeddings: true,
    supportsChat: true,
    supportsTextGeneration: true,
    supportsExploration: true,
    requiresApiKey: true,
    requiresBaseUrl: false,
    embeddingModels: [
      {
        id: 'text-embedding-004',
        name: 'Text Embedding 004',
        description: 'Good for multilingual text.',
        capabilities: {
          supportsToolCalling: false,
          supportsToolStreaming: false,
          supportsObjectGeneration: false,
          supportsEmbeddings: true,
        },
        embeddingDimensions: 768,
        quality: 'standard',
        costTier: 'low',
        inputCostPerMillion: 0.00, // Free at time of implementation
      },
    ],
    chatModels: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Fast and multimodal. Good tool calling support.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'fast',
        costTier: 'low',
        contextWindow: '1M',
        inputCostPerMillion: 0.075,
        outputCostPerMillion: 0.3,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Most capable Gemini model.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'medium',
        costTier: 'medium',
        contextWindow: '2M',
        inputCostPerMillion: 1.25,
        outputCostPerMillion: 5.0,
      },
    ],
    textGenerationModels: [],
    explorationModels: [],
  },

  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'cloud',
    website: 'https://platform.deepseek.com',
    supportsEmbeddings: false,
    supportsChat: true,
    supportsTextGeneration: true,
    supportsExploration: true,
    requiresApiKey: true,
    requiresBaseUrl: false,
    embeddingModels: [],
    chatModels: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        description: 'Very cost effective. Good general purpose model.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'standard',
        speed: 'fast',
        costTier: 'low',
        contextWindow: '64K',
        inputCostPerMillion: 0.14,
        outputCostPerMillion: 0.28,
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        description: 'Strong reasoning capabilities.',
        capabilities: {
          supportsToolCalling: true,
          supportsToolStreaming: true,
          supportsObjectGeneration: true,
          supportsEmbeddings: false,
        },
        quality: 'premium',
        speed: 'slow',
        costTier: 'low',
        contextWindow: '64K',
        inputCostPerMillion: 0.55,
        outputCostPerMillion: 2.19,
      },
    ],
    textGenerationModels: [],
    explorationModels: [],
  },
]

// Populate textGenerationModels and explorationModels from chatModels (they're the same)
for (const provider of PROVIDERS) {
  if (provider.textGenerationModels.length === 0 && provider.chatModels.length > 0) {
    provider.textGenerationModels = [...provider.chatModels]
  }
  if (provider.explorationModels.length === 0 && provider.chatModels.length > 0) {
    provider.explorationModels = [...provider.chatModels]
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get provider metadata by ID
 */
export function getProvider(providerId: string): ProviderMetadata | undefined {
  return PROVIDERS.find((p) => p.id === providerId)
}

/**
 * Get model metadata by provider and model ID
 */
export function getModel(
  providerId: string,
  modelId: string,
  functionType: AIFunction
): ModelMetadata | undefined {
  const provider = getProvider(providerId)
  if (!provider) return undefined

  const models =
    functionType === 'embeddings'
      ? provider.embeddingModels
      : functionType === 'chat'
        ? provider.chatModels
        : functionType === 'exploration'
          ? provider.explorationModels
          : provider.textGenerationModels

  return models.find((m) => m.id === modelId)
}

/**
 * Get providers that support a specific function
 */
export function getProvidersForFunction(fn: AIFunction): ProviderMetadata[] {
  return PROVIDERS.filter((p) => {
    if (fn === 'embeddings') return p.supportsEmbeddings
    if (fn === 'chat') return p.supportsChat && p.chatModels.some((m) => m.capabilities.supportsToolCalling)
    if (fn === 'textGeneration') return p.supportsTextGeneration
    if (fn === 'exploration') return p.supportsExploration
    return false
  })
}

/**
 * Get models for a specific provider and function
 */
export function getModelsForFunction(providerId: string, fn: AIFunction): ModelMetadata[] {
  const provider = getProvider(providerId)
  if (!provider) return []

  if (fn === 'embeddings') {
    return provider.embeddingModels
  }
  if (fn === 'chat') {
    // Only models with tool calling for chat
    return provider.chatModels.filter((m) => m.capabilities.supportsToolCalling)
  }
  if (fn === 'textGeneration') {
    // Text generation doesn't require tool calling, so use textGenerationModels
    // or fall back to all chat models (many providers share the same models)
    return provider.textGenerationModels.length > 0
      ? provider.textGenerationModels
      : provider.chatModels
  }
  if (fn === 'exploration') {
    // Exploration needs structured output, prefer models with object generation
    return provider.explorationModels.length > 0
      ? provider.explorationModels.filter((m) => m.capabilities.supportsObjectGeneration)
      : provider.chatModels.filter((m) => m.capabilities.supportsObjectGeneration)
  }
  return []
}

/**
 * Validate that a provider/model combination supports required capabilities
 */
export function validateCapabilityForFeature(
  fn: AIFunction,
  providerId: string,
  modelId: string
): { supported: boolean; reason?: string } {
  const provider = getProvider(providerId)
  if (!provider) {
    return { supported: false, reason: `Unknown provider: ${providerId}` }
  }

  const model = getModel(providerId, modelId, fn)

  // Allow unknown models (user might have custom models)
  if (!model) {
    return { supported: true, reason: 'Unknown model - capabilities not verified' }
  }

  if (fn === 'embeddings' && !model.capabilities.supportsEmbeddings) {
    return { supported: false, reason: `${model.name} does not support embeddings` }
  }

  if (fn === 'chat' && !model.capabilities.supportsToolCalling) {
    return {
      supported: false,
      reason: `${model.name} does not support tool calling, which is required for the Chat Assistant`,
    }
  }

  return { supported: true }
}

/**
 * Get default model for a provider and function
 */
export function getDefaultModel(providerId: string, fn: AIFunction): string | undefined {
  const models = getModelsForFunction(providerId, fn)
  return models[0]?.id
}

/**
 * Check if a provider requires API key
 */
export function providerRequiresApiKey(providerId: string): boolean {
  const provider = getProvider(providerId)
  return provider?.requiresApiKey ?? true
}

/**
 * Check if a provider requires base URL
 */
export function providerRequiresBaseUrl(providerId: string): boolean {
  const provider = getProvider(providerId)
  return provider?.requiresBaseUrl ?? false
}

/**
 * Get default base URL for a provider
 */
export function getDefaultBaseUrl(providerId: string): string | undefined {
  const provider = getProvider(providerId)
  return provider?.defaultBaseUrl
}

/**
 * Get embedding dimensions for a model
 */
export function getEmbeddingDimensions(providerId: string, modelId: string): number | undefined {
  const model = getModel(providerId, modelId, 'embeddings')
  return model?.embeddingDimensions
}

/**
 * Pricing info for a configured function
 */
export interface FunctionPricing {
  provider: string
  providerName: string
  model: string
  modelName: string
  isLocalProvider: boolean
  inputCostPerMillion: number
  outputCostPerMillion: number
  embeddingDimensions?: number
}

/**
 * Get pricing info for a specific provider/model combination (sync version using hardcoded data)
 * @deprecated Use getPricingForModelAsync for dynamic pricing from Helicone API
 */
export function getPricingForModel(
  providerId: string,
  modelId: string,
  functionType: AIFunction
): FunctionPricing | null {
  const provider = getProvider(providerId)
  if (!provider) return null

  const model = getModel(providerId, modelId, functionType)
  const isLocalProvider = provider.type === 'self-hosted' || provider.type === 'openai-compatible'

  return {
    provider: providerId,
    providerName: provider.name,
    model: modelId,
    modelName: model?.name || modelId,
    isLocalProvider,
    // Local providers are free (no API costs)
    inputCostPerMillion: isLocalProvider ? 0 : (model?.inputCostPerMillion ?? 0),
    outputCostPerMillion: isLocalProvider ? 0 : (model?.outputCostPerMillion ?? 0),
    embeddingDimensions: model?.embeddingDimensions,
  }
}

/**
 * Get pricing info for a specific provider/model combination (async version with dynamic Helicone pricing)
 */
export async function getPricingForModelAsync(
  providerId: string,
  modelId: string,
  functionType: AIFunction
): Promise<FunctionPricing | null> {
  // Import dynamically to avoid circular dependencies
  const { findModelPricing } = await import('./pricing-cache.js')

  const provider = getProvider(providerId)
  if (!provider) return null

  const model = getModel(providerId, modelId, functionType)
  const isLocalProvider = provider.type === 'self-hosted' || provider.type === 'openai-compatible'

  // Try to get dynamic pricing from Helicone
  let inputCostPerMillion = 0
  let outputCostPerMillion = 0

  if (!isLocalProvider) {
    const dynamicPricing = await findModelPricing(providerId, modelId)
    if (dynamicPricing) {
      inputCostPerMillion = dynamicPricing.inputCostPerMillion
      outputCostPerMillion = dynamicPricing.outputCostPerMillion
    } else {
      // Fall back to hardcoded data
      inputCostPerMillion = model?.inputCostPerMillion ?? 0
      outputCostPerMillion = model?.outputCostPerMillion ?? 0
    }
  }

  return {
    provider: providerId,
    providerName: provider.name,
    model: modelId,
    modelName: model?.name || modelId,
    isLocalProvider,
    inputCostPerMillion,
    outputCostPerMillion,
    embeddingDimensions: model?.embeddingDimensions,
  }
}

