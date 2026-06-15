import type { ModelMetadata, ProviderMetadata } from './types.js'
import anthropic from './data/anthropic.json' with { type: 'json' }
import deepseek from './data/deepseek.json' with { type: 'json' }
import google from './data/google.json' with { type: 'json' }
import groq from './data/groq.json' with { type: 'json' }
import huggingface from './data/huggingface.json' with { type: 'json' }
import ollama from './data/ollama.json' with { type: 'json' }
import openai from './data/openai.json' with { type: 'json' }
import openaiCompatible from './data/openai-compatible.json' with { type: 'json' }
import openrouter from './data/openrouter.json' with { type: 'json' }

const RAW_PROVIDERS = [
  openai,
  anthropic,
  ollama,
  openaiCompatible,
  groq,
  google,
  deepseek,
  openrouter,
  huggingface,
] as const

function isModelMetadata(value: unknown): value is ModelMetadata {
  if (!value || typeof value !== 'object') return false
  const model = value as Record<string, unknown>
  if (typeof model.id !== 'string' || typeof model.name !== 'string') return false
  const capabilities = model.capabilities
  if (!capabilities || typeof capabilities !== 'object') return false
  const caps = capabilities as Record<string, unknown>
  return (
    typeof caps.supportsToolCalling === 'boolean' &&
    typeof caps.supportsToolStreaming === 'boolean' &&
    typeof caps.supportsObjectGeneration === 'boolean' &&
    typeof caps.supportsEmbeddings === 'boolean'
  )
}

function isProviderMetadata(value: unknown): value is ProviderMetadata {
  if (!value || typeof value !== 'object') return false
  const provider = value as Record<string, unknown>
  if (typeof provider.id !== 'string' || typeof provider.name !== 'string') return false
  if (typeof provider.type !== 'string') return false
  const modelLists = [
    provider.embeddingModels,
    provider.chatModels,
    provider.textGenerationModels,
    provider.explorationModels,
  ]
  return modelLists.every((list) => Array.isArray(list) && list.every(isModelMetadata))
}

function normalizeProvider(provider: ProviderMetadata): ProviderMetadata {
  const normalized = { ...provider }

  if (normalized.textGenerationModels.length === 0 && normalized.chatModels.length > 0) {
    normalized.textGenerationModels = [...normalized.chatModels]
  }
  if (normalized.explorationModels.length === 0 && normalized.chatModels.length > 0) {
    normalized.explorationModels = [...normalized.chatModels]
  }

  return normalized
}

export function loadProviders(): ProviderMetadata[] {
  const providers: ProviderMetadata[] = []

  for (const raw of RAW_PROVIDERS) {
    if (!isProviderMetadata(raw)) {
      throw new Error(`Invalid provider metadata for entry: ${JSON.stringify(raw)}`)
    }
    providers.push(normalizeProvider(raw))
  }

  return providers
}
