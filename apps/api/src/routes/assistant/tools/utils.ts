/**
 * Tool utilities for AI assistant
 * Handles compatibility issues with local LLMs (Ollama, etc.)
 */
import { z } from 'zod'

/**
 * Normalize tool arguments for local LLM compatibility.
 * 
 * Local LLMs like Ollama/Llama have quirks:
 * 1. Send explicit nulls for optional parameters (Zod rejects null for .optional())
 * 2. Send numbers as strings (e.g., "15" instead of 15)
 * 3. Send booleans as strings (e.g., "true" instead of true)
 * 
 * This function normalizes these values before Zod validation.
 */
function normalizeToolArgs(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }
  
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([, v]) => v !== null) // Strip nulls
      .map(([k, v]) => {
        // Coerce string numbers to actual numbers
        if (typeof v === 'string') {
          // Check if it's a numeric string (integer)
          if (/^-?\d+$/.test(v)) {
            return [k, parseInt(v, 10)]
          }
          // Check if it's a numeric string (float)
          if (/^-?\d+\.\d+$/.test(v)) {
            return [k, parseFloat(v)]
          }
          // Check for boolean strings
          if (v === 'true') return [k, true]
          if (v === 'false') return [k, false]
        }
        return [k, v]
      })
  )
}

/**
 * Wrap a Zod schema with argument normalization for local LLM compatibility.
 * Handles null stripping, string-to-number coercion, and string-to-boolean coercion.
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
  return z.preprocess(normalizeToolArgs, schema) as unknown as T
}

