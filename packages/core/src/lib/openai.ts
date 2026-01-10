/**
 * Centralized OpenAI client management
 * 
 * This module provides a single, shared OpenAI client instance that:
 * - Lazily initializes when first needed (not at module load)
 * - Reads API key from database (with env fallback)
 * - Recreates client if API key changes
 */
import OpenAI from 'openai'
import { getOpenAIApiKey } from '../settings/systemSettings.js'

let openaiClient: OpenAI | null = null
let cachedApiKey: string | null = null

/**
 * Get a shared OpenAI client instance.
 * 
 * The client is lazily initialized and will be recreated if the API key changes.
 * This allows the API key to be configured via UI after startup.
 * 
 * @throws Error if OpenAI API key is not configured
 */
export async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = await getOpenAIApiKey()
  
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please set it in Settings > AI.')
  }
  
  // Recreate client if API key changed (e.g., user updated it in settings)
  if (!openaiClient || cachedApiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey })
    cachedApiKey = apiKey
  }
  
  return openaiClient
}

/**
 * Check if OpenAI is configured (has API key)
 */
export async function isOpenAIConfigured(): Promise<boolean> {
  const apiKey = await getOpenAIApiKey()
  return !!apiKey
}

/**
 * Clear the cached OpenAI client.
 * Useful for testing or when API key is updated.
 */
export function clearOpenAIClient(): void {
  openaiClient = null
  cachedApiKey = null
}

