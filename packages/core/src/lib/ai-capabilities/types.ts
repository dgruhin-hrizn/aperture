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

  embeddingDimensions?: number

  description?: string
  quality?: 'budget' | 'standard' | 'premium'
  speed?: 'slow' | 'medium' | 'fast'
  costTier?: 'free' | 'low' | 'medium' | 'high'
  contextWindow?: string
  inputCostPerMillion?: number
  outputCostPerMillion?: number
  notes?: string

  isCustom?: boolean
}

export interface ProviderMetadata {
  id: string
  name: string
  type: 'cloud' | 'self-hosted' | 'openai-compatible'
  website?: string
  logoPath?: string

  supportsEmbeddings: boolean
  supportsChat: boolean
  supportsTextGeneration: boolean
  supportsExploration: boolean

  requiresApiKey: boolean
  requiresBaseUrl: boolean
  defaultBaseUrl?: string

  embeddingModels: ModelMetadata[]
  chatModels: ModelMetadata[]
  textGenerationModels: ModelMetadata[]
  explorationModels: ModelMetadata[]
}

export type AIFunction = 'embeddings' | 'chat' | 'textGeneration' | 'exploration'

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
