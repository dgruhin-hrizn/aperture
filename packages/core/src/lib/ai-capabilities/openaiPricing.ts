// Standard USD rates per million tokens, verified against the official model pages on 2026-11-05.
// https://developers.openai.com/api/docs/pricing
const prices: Readonly<Record<string, readonly [input: number, output: number, cached?: number, write30m?: number]>> = {
  'gpt-6-astra': [10, 50, 1, 12.5],
  'gpt-6.1-sol': [2, 10, 0.1, 2.5],
  'gpt-6.1-terra': [1, 5, 0.05, 1.25],
  'gpt-6-luna': [0.1, 0.5, 0.01, 0.125],
  'gpt-5.6-sol': [4, 20, 0.4, 5],
  'gpt-5.6-terra': [2, 12, 0.2, 2.5],
  'gpt-5.6-luna': [0.2, 1.2, 0.02, 0.25],
  'gpt-4.1-mini': [0.4, 1.6, 0.1],
  'text-embedding-3-large': [0.13, 0],
}

export function getOfficialOpenAIPricing(modelId: string) {
  const canonical = modelId.toLowerCase().replace(/-\d{4}-\d{2}-\d{2}$/, '')
  const price = Object.hasOwn(prices, canonical) ? prices[canonical] : undefined
  if (!price) return undefined
  const [inputCostPerMillion, outputCostPerMillion, cachedInputCostPerMillion, cacheWriteCostPerMillion] = price
  return { inputCostPerMillion, outputCostPerMillion, cachedInputCostPerMillion, cacheWriteCostPerMillion, pricingSource: 'openai' as const }
}
