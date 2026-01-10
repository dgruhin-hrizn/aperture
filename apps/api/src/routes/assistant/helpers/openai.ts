/**
 * OpenAI client configuration
 */
import { createOpenAI } from '@ai-sdk/openai'
import { getOpenAIApiKey } from '@aperture/core'

export async function getOpenAIClient() {
  const apiKey = await getOpenAIApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }
  return createOpenAI({ apiKey })
}


