/**
 * OpenAI client configuration
 */
import { createOpenAI } from '@ai-sdk/openai'

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return createOpenAI({ apiKey })
}

