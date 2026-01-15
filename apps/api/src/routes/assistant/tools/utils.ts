/**
 * Tool utilities for AI assistant
 * Handles compatibility issues with local LLMs (Ollama, etc.)
 */
import { z } from 'zod'

/**
 * Strip null values from an object, converting them to undefined.
 * 
 * Local LLMs like Ollama/Llama send explicit nulls for optional parameters
 * instead of omitting them. Zod's `.optional()` doesn't accept null,
 * only undefined. This utility strips nulls before they hit validation.
 * 
 * Usage with Zod schemas:
 * ```typescript
 * inputSchema: z.preprocess(stripNulls, z.object({
 *   query: z.string(),
 *   limit: z.number().optional(),
 * }))
 * ```
 */
export function stripNulls(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== null)
  )
}

/**
 * Wrap a Zod schema with null stripping preprocessing.
 * Use this on inputSchema definitions to handle local LLM null values.
 * 
 * Usage:
 * ```typescript
 * import { nullSafe } from './utils.js'
 * 
 * inputSchema: nullSafe(z.object({
 *   query: z.string(),
 *   limit: z.number().optional(),
 * }))
 * ```
 */
export function nullSafe<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(stripNulls, schema) as unknown as T
}

