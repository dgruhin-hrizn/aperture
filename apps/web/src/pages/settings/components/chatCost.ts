import type { FunctionPricing, ReasoningPreset } from '@aperture/core'

interface UsageSample {
  preset: ReasoningPreset
  samples: number
  input: number
  cached: number
  cacheWrite: number
  output: number
  reasoning: number
}

export interface ChatUsage {
  defaultPreset: ReasoningPreset
  presets: UsageSample[]
}

const estimatedTokens = {
  quick: { input: 2000, output: 300 },
  standard: { input: 2000, output: 500 },
  expanded: { input: 2500, output: 1300 },
} satisfies Record<ReasoningPreset, { input: number; output: number }>

export function estimateChatStyles(price: FunctionPricing | null, usage?: ChatUsage | null) {
  const presets: ReasoningPreset[] = ['quick', 'standard', 'expanded']
  return presets.map((preset) => {
    const measured = usage?.presets.find((entry) => entry.preset === preset)
    const tokens = measured ?? { ...estimatedTokens[preset], cached: 0, cacheWrite: 0, reasoning: 0, samples: 0 }
    const cached = Math.min(tokens.cached, tokens.input)
    const writes = Math.min(tokens.cacheWrite, tokens.input - cached)
    const uncached = tokens.input - cached - writes
    const cost = !price || price.priceAvailable === false
      ? null
      : price.isLocalProvider ? 0 : (
          uncached * price.inputCostPerMillion +
          cached * (price.cachedInputCostPerMillion ?? price.inputCostPerMillion) +
          writes * (price.cacheWriteCostPerMillion ?? price.inputCostPerMillion) +
          tokens.output * price.outputCostPerMillion
        ) / 1_000_000
    return { ...tokens, preset, cost, isDefault: preset === (usage?.defaultPreset ?? 'standard') }
  })
}
