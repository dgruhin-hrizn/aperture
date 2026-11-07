import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateChatStyles, type ChatUsage } from './chatCost'

const price = {
  provider: 'openai', providerName: 'OpenAI', model: 'gpt-6.1-terra', modelName: 'GPT-6.1 Terra',
  isLocalProvider: false, priceAvailable: true, inputCostPerMillion: 1, cachedInputCostPerMillion: 0.05,
  cacheWriteCostPerMillion: 1.25, outputCostPerMillion: 5,
}

test('measured preset costs apply cached rates and count reasoning as part of output once', () => {
  const usage: ChatUsage = {
    defaultPreset: 'expanded',
    presets: [{ preset: 'expanded', samples: 4, input: 4000, cached: 2000, cacheWrite: 1000, output: 1000, reasoning: 600 }],
  }
  const styles = estimateChatStyles(price, usage)
  const expanded = styles.find((style) => style.isDefault)
  assert.equal(expanded?.preset, 'expanded')
  assert.equal(expanded?.samples, 4)
  assert.equal(expanded?.cost, 0.00735)
  assert.equal(styles.find((style) => style.preset === 'standard')?.samples, 0)
  assert.equal(estimateChatStyles({ ...price, priceAvailable: false }, usage)[0].cost, null)
  assert.equal(estimateChatStyles({ ...price, isLocalProvider: true }, usage)[0].cost, 0)
})
