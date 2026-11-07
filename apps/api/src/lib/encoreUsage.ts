import type { LanguageModelUsage } from 'ai'
import { reasoningModelKey, type ProviderConfig, type ReasoningPreset } from '@aperture/core'
import { query } from './db.js'

export async function recordEncoreUsage(modelKey: string, preset: ReasoningPreset, usage: LanguageModelUsage) {
  if (usage.inputTokens === undefined || usage.outputTokens === undefined || usage.inputTokens + usage.outputTokens === 0) return
  await query(
    `INSERT INTO encore_usage_daily (
       day, model_key, preset, samples, input_tokens, cached_tokens, cache_write_tokens, output_tokens, reasoning_tokens
     ) VALUES (CURRENT_DATE, $1, $2, 1, $3, $4, $5, $6, $7)
     ON CONFLICT (model_key, preset, day) DO UPDATE SET
       samples = encore_usage_daily.samples + 1,
       input_tokens = encore_usage_daily.input_tokens + EXCLUDED.input_tokens,
       cached_tokens = encore_usage_daily.cached_tokens + EXCLUDED.cached_tokens,
       cache_write_tokens = encore_usage_daily.cache_write_tokens + EXCLUDED.cache_write_tokens,
       output_tokens = encore_usage_daily.output_tokens + EXCLUDED.output_tokens,
       reasoning_tokens = encore_usage_daily.reasoning_tokens + EXCLUDED.reasoning_tokens`,
    [modelKey, preset, usage.inputTokens, usage.inputTokenDetails.cacheReadTokens ?? 0,
      usage.inputTokenDetails.cacheWriteTokens ?? 0, usage.outputTokens, usage.outputTokenDetails.reasoningTokens ?? 0]
  )
}

interface PresetUsage {
  preset: ReasoningPreset
  samples: number
  input: number
  cached: number
  cacheWrite: number
  output: number
  reasoning: number
}

export async function getEncoreUsage(config: ProviderConfig) {
  const { rows } = await query<PresetUsage>(
    `SELECT preset, SUM(samples)::int AS samples,
       SUM(input_tokens)::float8 / SUM(samples) AS input,
       SUM(cached_tokens)::float8 / SUM(samples) AS cached,
       SUM(cache_write_tokens)::float8 / SUM(samples) AS "cacheWrite",
       SUM(output_tokens)::float8 / SUM(samples) AS output,
       SUM(reasoning_tokens)::float8 / SUM(samples) AS reasoning
     FROM encore_usage_daily
     WHERE model_key = $1 AND day > CURRENT_DATE - 30
     GROUP BY preset`,
    [reasoningModelKey(config)]
  )
  return { defaultPreset: config.reasoningPreset ?? 'standard', presets: rows }
}
