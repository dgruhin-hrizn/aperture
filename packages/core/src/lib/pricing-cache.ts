/**
 * Pricing Cache Service
 *
 * Fetches and caches LLM pricing data from the Helicone API.
 * Pricing is refreshed daily and persisted to the database.
 *
 * Source: https://www.helicone.ai/api/llm-costs
 */

import { getSystemSetting, setSystemSetting } from '../settings/systemSettings.js'
import { createChildLogger } from './logger.js'

const logger = createChildLogger('pricing-cache')

const HELICONE_API_URL = 'https://www.helicone.ai/api/llm-costs'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CACHE_KEY = 'llm_pricing_cache'

// ============================================================================
// Types
// ============================================================================

export interface HeliconeModelPricing {
  provider: string
  model: string
  operator: 'equals' | 'startsWith' | 'includes'
  input_cost_per_1m: number
  output_cost_per_1m: number
  prompt_cache_write_per_1m?: number
  prompt_cache_read_per_1m?: number
  show_in_playground?: boolean
}

interface HeliconeResponse {
  metadata: {
    total_models: number
    note: string
  }
  data: HeliconeModelPricing[]
}

interface CachedPricing {
  fetchedAt: number
  data: HeliconeModelPricing[]
}

// ============================================================================
// Provider Name Mapping
// ============================================================================

// Map our internal provider IDs to Helicone provider names
const PROVIDER_MAP: Record<string, string[]> = {
  openai: ['OPENAI', 'VERCEL'], // Vercel uses openai/ prefix
  anthropic: ['ANTHROPIC'],
  google: ['GOOGLE', 'GOOGLE_AI_STUDIO'],
  groq: ['GROQ'],
  deepseek: ['DEEPSEEK'],
  // Self-hosted providers don't have API costs
  ollama: [],
  'openai-compatible': [],
}

// Map our model IDs to potential Helicone model patterns
const MODEL_ALIASES: Record<string, string[]> = {
  // OpenAI
  'gpt-4.1-mini': ['gpt-4.1-mini', 'openai/gpt-4.1-mini'],
  'gpt-4.1-nano': ['gpt-4.1-nano', 'openai/gpt-4.1-nano'],
  'gpt-4.1': ['gpt-4.1', 'openai/gpt-4.1'],
  'gpt-4o': ['gpt-4o', 'openai/gpt-4o'],
  'gpt-4o-mini': ['gpt-4o-mini', 'openai/gpt-4o-mini'],
  'o3-mini': ['o3-mini', 'openai/o3-mini'],
  'text-embedding-3-large': ['text-embedding-3-large'],
  'text-embedding-3-small': ['text-embedding-3-small'],
  // Anthropic
  'claude-sonnet-4-5': ['claude-sonnet-4-5', 'claude-3-5-sonnet', 'claude-sonnet-4-5-20250929'],
  'claude-haiku-3-5': ['claude-3-5-haiku', 'claude-haiku-4-5', 'claude-3-5-haiku-20241022'],
  // Google
  'gemini-2.0-flash': ['gemini-2.0-flash', 'gemini-2.0-flash-exp'],
  'gemini-1.5-pro': ['gemini-1.5-pro'],
  // DeepSeek
  'deepseek-chat': ['deepseek-chat', 'deepseek-v3'],
  'deepseek-reasoner': ['deepseek-reasoner', 'deepseek-r1'],
}

// ============================================================================
// In-Memory Cache
// ============================================================================

let memoryCache: CachedPricing | null = null

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Fetch fresh pricing data from Helicone API
 */
async function fetchPricingFromHelicone(): Promise<HeliconeModelPricing[]> {
  logger.info('Fetching pricing data from Helicone API')

  const response = await fetch(HELICONE_API_URL, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Helicone API returned ${response.status}: ${response.statusText}`)
  }

  const data = (await response.json()) as HeliconeResponse
  logger.info({ modelCount: data.data.length }, 'Fetched pricing data from Helicone')

  return data.data
}

/**
 * Load cached pricing from database
 */
async function loadCacheFromDatabase(): Promise<CachedPricing | null> {
  try {
    const cached = await getSystemSetting(CACHE_KEY)
    if (!cached) return null

    const parsed: CachedPricing = JSON.parse(cached)
    return parsed
  } catch (err) {
    logger.warn({ err }, 'Failed to load pricing cache from database')
    return null
  }
}

/**
 * Save pricing cache to database
 */
async function saveCacheToDatabase(cache: CachedPricing): Promise<void> {
  try {
    await setSystemSetting(
      CACHE_KEY,
      JSON.stringify(cache),
      'Cached LLM pricing data from Helicone API'
    )
    logger.debug('Saved pricing cache to database')
  } catch (err) {
    logger.warn({ err }, 'Failed to save pricing cache to database')
  }
}

/**
 * Check if cache is still valid (within TTL)
 */
function isCacheValid(cache: CachedPricing): boolean {
  const age = Date.now() - cache.fetchedAt
  return age < CACHE_TTL_MS
}

/**
 * Get pricing data, refreshing cache if needed
 */
export async function getPricingData(): Promise<HeliconeModelPricing[]> {
  // Check memory cache first
  if (memoryCache && isCacheValid(memoryCache)) {
    return memoryCache.data
  }

  // Try to load from database
  const dbCache = await loadCacheFromDatabase()
  if (dbCache && isCacheValid(dbCache)) {
    memoryCache = dbCache
    return dbCache.data
  }

  // Fetch fresh data
  try {
    const freshData = await fetchPricingFromHelicone()
    const newCache: CachedPricing = {
      fetchedAt: Date.now(),
      data: freshData,
    }

    // Update both caches
    memoryCache = newCache
    await saveCacheToDatabase(newCache)

    return freshData
  } catch (err) {
    logger.error({ err }, 'Failed to fetch pricing from Helicone')

    // Return stale cache if available
    if (dbCache) {
      logger.warn('Using stale pricing cache')
      memoryCache = dbCache
      return dbCache.data
    }

    // Return empty array as fallback
    return []
  }
}

/**
 * Find pricing for a specific provider and model
 */
export async function findModelPricing(
  provider: string,
  modelId: string
): Promise<{ inputCostPerMillion: number; outputCostPerMillion: number } | null> {
  // Self-hosted providers have no API costs
  if (provider === 'ollama' || provider === 'openai-compatible') {
    return { inputCostPerMillion: 0, outputCostPerMillion: 0 }
  }

  const pricingData = await getPricingData()
  if (pricingData.length === 0) {
    return null
  }

  // Get Helicone provider names for our provider
  const heliconeProviders = PROVIDER_MAP[provider] || []
  if (heliconeProviders.length === 0) {
    return null
  }

  // Get model aliases
  const modelPatterns = MODEL_ALIASES[modelId] || [modelId]

  // Search for matching pricing entry
  for (const heliconeProvider of heliconeProviders) {
    for (const pattern of modelPatterns) {
      // Find matching entries
      const matches = pricingData.filter((entry) => {
        if (entry.provider !== heliconeProvider) return false

        switch (entry.operator) {
          case 'equals':
            return entry.model === pattern || entry.model.toLowerCase() === pattern.toLowerCase()
          case 'startsWith':
            return (
              pattern.startsWith(entry.model) ||
              pattern.toLowerCase().startsWith(entry.model.toLowerCase())
            )
          case 'includes':
            return (
              pattern.includes(entry.model) ||
              pattern.toLowerCase().includes(entry.model.toLowerCase())
            )
          default:
            return entry.model === pattern
        }
      })

      if (matches.length > 0) {
        // Prefer exact matches, then startsWith, then includes
        const exactMatch = matches.find((m) => m.operator === 'equals')
        const match = exactMatch || matches[0]

        return {
          inputCostPerMillion: match.input_cost_per_1m,
          outputCostPerMillion: match.output_cost_per_1m,
        }
      }
    }
  }

  // Try fuzzy matching as fallback
  for (const heliconeProvider of heliconeProviders) {
    const providerEntries = pricingData.filter((e) => e.provider === heliconeProvider)

    for (const entry of providerEntries) {
      // Check if our model ID is contained in the Helicone model name or vice versa
      const modelLower = modelId.toLowerCase()
      const entryModelLower = entry.model.toLowerCase()

      if (entryModelLower.includes(modelLower) || modelLower.includes(entryModelLower)) {
        return {
          inputCostPerMillion: entry.input_cost_per_1m,
          outputCostPerMillion: entry.output_cost_per_1m,
        }
      }
    }
  }

  return null
}

/**
 * Force refresh the pricing cache
 */
export async function refreshPricingCache(): Promise<void> {
  logger.info('Force refreshing pricing cache')
  memoryCache = null

  try {
    const freshData = await fetchPricingFromHelicone()
    const newCache: CachedPricing = {
      fetchedAt: Date.now(),
      data: freshData,
    }

    memoryCache = newCache
    await saveCacheToDatabase(newCache)

    logger.info({ modelCount: freshData.length }, 'Pricing cache refreshed')
  } catch (err) {
    logger.error({ err }, 'Failed to refresh pricing cache')
    throw err
  }
}

/**
 * Get cache status for monitoring
 */
export async function getPricingCacheStatus(): Promise<{
  cached: boolean
  fetchedAt: Date | null
  modelCount: number
  ageHours: number | null
  isStale: boolean
}> {
  const dbCache = await loadCacheFromDatabase()

  if (!dbCache) {
    return {
      cached: false,
      fetchedAt: null,
      modelCount: 0,
      ageHours: null,
      isStale: true,
    }
  }

  const ageMs = Date.now() - dbCache.fetchedAt
  const ageHours = Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10

  return {
    cached: true,
    fetchedAt: new Date(dbCache.fetchedAt),
    modelCount: dbCache.data.length,
    ageHours,
    isStale: !isCacheValid(dbCache),
  }
}
