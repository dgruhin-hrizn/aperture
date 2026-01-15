/**
 * useAICapabilities - Hook for fetching and managing AI provider capabilities
 * 
 * Provides information about what AI features are available based on
 * the currently configured providers and models.
 */
import { useState, useEffect, useCallback } from 'react'

interface ModelCapabilities {
  supportsToolCalling: boolean
  supportsToolStreaming: boolean
  supportsObjectGeneration: boolean
  supportsEmbeddings: boolean
}

interface FunctionStatus {
  isConfigured: boolean
  provider: string | null
  model: string | null
  capabilities: ModelCapabilities | null
  embeddingDimensions?: number
}

interface AICapabilitiesStatus {
  embeddings: FunctionStatus
  chat: FunctionStatus
  textGeneration: FunctionStatus
  isFullyConfigured: boolean
  isAnyConfigured: boolean
}

interface AICapabilitiesResult {
  // Raw data
  capabilities: AICapabilitiesStatus | null
  
  // Loading/error state
  isLoading: boolean
  error: Error | null
  
  // Per-function status (convenience)
  embeddings: {
    configured: boolean
    provider: string | null
    model: string | null
    dimensions: number | null
  }
  chat: {
    configured: boolean
    provider: string | null
    model: string | null
    supportsTools: boolean
    supportsStreaming: boolean
  }
  textGeneration: {
    configured: boolean
    provider: string | null
    model: string | null
  }
  
  // Feature availability (derived from capabilities)
  features: {
    semanticSearch: boolean      // Requires embeddings
    chatWithTools: boolean       // Requires chat + tool calling
    basicChat: boolean           // Requires chat (any model)
    recommendations: boolean     // Requires embeddings + text generation
    explanations: boolean        // Requires text generation
    tasteSynopsis: boolean       // Requires text generation
  }
  
  // Human-readable limitations
  limitations: string[]
  
  // Helper booleans
  isFullyConfigured: boolean
  isAnyConfigured: boolean
  
  // Refresh function
  refresh: () => void
}

// Feature-level response from the user-accessible endpoint
interface AIFeaturesResponse {
  embeddings: {
    configured: boolean
    supportsEmbeddings: boolean
  }
  chat: {
    configured: boolean
    supportsToolCalling: boolean
    supportsStreaming: boolean
  }
  textGeneration: {
    configured: boolean
  }
  features: {
    semanticSearch: boolean
    chatWithTools: boolean
    basicChat: boolean
    recommendations: boolean
    explanations: boolean
  }
  isFullyConfigured: boolean
  isAnyConfigured: boolean
}

export function useAICapabilities(): AICapabilitiesResult {
  const [data, setData] = useState<AIFeaturesResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchCapabilities = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/settings/ai/features', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch AI capabilities')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCapabilities()
  }, [fetchCapabilities])

  // Build per-function convenience objects
  const embeddings = {
    configured: data?.embeddings.configured ?? false,
    provider: null as string | null, // Not exposed in features endpoint
    model: null as string | null,
    dimensions: null as number | null,
  }

  const chat = {
    configured: data?.chat.configured ?? false,
    provider: null as string | null,
    model: null as string | null,
    supportsTools: data?.chat.supportsToolCalling ?? false,
    supportsStreaming: data?.chat.supportsStreaming ?? false,
  }

  const textGeneration = {
    configured: data?.textGeneration.configured ?? false,
    provider: null as string | null,
    model: null as string | null,
  }

  // Derive feature availability from API response
  const features = {
    semanticSearch: data?.features.semanticSearch ?? false,
    chatWithTools: data?.features.chatWithTools ?? false,
    basicChat: data?.features.basicChat ?? false,
    recommendations: data?.features.recommendations ?? false,
    explanations: data?.features.explanations ?? false,
    tasteSynopsis: data?.textGeneration.configured ?? false,
  }

  // Build human-readable limitations
  const limitations: string[] = []
  
  if (!embeddings.configured) {
    limitations.push('Embeddings not configured - semantic search and AI recommendations unavailable')
  }
  
  if (!chat.configured) {
    limitations.push('Chat not configured - AI assistant unavailable')
  } else if (!chat.supportsTools) {
    limitations.push(`Chat model (${chat.model}) doesn't support tool calling - assistant cannot access your library`)
  }
  
  if (!textGeneration.configured) {
    limitations.push('Text generation not configured - explanations and taste profiles unavailable')
  }

  return {
    capabilities: null, // Full capabilities not available from features endpoint
    isLoading,
    error,
    embeddings,
    chat,
    textGeneration,
    features,
    limitations,
    isFullyConfigured: data?.isFullyConfigured ?? false,
    isAnyConfigured: data?.isAnyConfigured ?? false,
    refresh: fetchCapabilities,
  }
}

export type { AICapabilitiesStatus, FunctionStatus, ModelCapabilities, AICapabilitiesResult }

