import { z } from 'zod'

export const providerTypeSchema = z.enum([
  'openai', 'anthropic', 'ollama', 'openai-compatible', 'groq', 'google', 'deepseek', 'openrouter', 'huggingface',
])
export const aiFunctionSchema = z.enum(['embeddings', 'chat', 'textGeneration', 'exploration'])
export type ProviderType = z.infer<typeof providerTypeSchema>
export type AIFunction = z.infer<typeof aiFunctionSchema>
