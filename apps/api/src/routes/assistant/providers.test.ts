import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { embedMany } from 'ai'
import { closePool, getPool, getChatModelInstance, getEmbeddingModelInstance } from '@aperture/core'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
after(closePool)

test('upgraded provider adapters create compatible chat and embedding models without making network requests', async () => {
  const pool = getPool(), original = pool.query, originalFetch = globalThis.fetch
  let provider = 'openai'
  Object.assign(pool, { query: async (sql: string) => {
    assert.match(sql, /FROM system_settings/)
    const config = { provider, model: 'fixture-model', apiKey: 'fixture-key', baseUrl: 'http://127.0.0.1:1/v1' }
    return { rows: [{ value: JSON.stringify({ chat: config, embeddings: config }) }], rowCount: 1 }
  } })
  try {
    for (provider of ['openai', 'anthropic', 'google', 'groq', 'deepseek', 'openrouter', 'ollama', 'openai-compatible', 'huggingface']) {
      const model = await getChatModelInstance()
      assert.ok(typeof model === 'object', provider)
      assert.ok('doStream' in model, provider)
      assert.ok(['v2', 'v3', 'v4'].includes(model.specificationVersion), provider)
    }
    for (provider of ['openai', 'google', 'openrouter', 'ollama', 'openai-compatible', 'huggingface']) {
      const model = await getEmbeddingModelInstance()
      assert.ok(typeof model === 'object', provider)
      assert.ok('doEmbed' in model, provider)
      assert.ok(['v2', 'v3', 'v4'].includes(model.specificationVersion), provider)
    }
    provider = 'huggingface'
    const model = await getEmbeddingModelInstance()
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), 'http://127.0.0.1:1/v1')
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fixture-key')
      const body = JSON.parse(String(init?.body))
      return Response.json(body.inputs.map(() => [0.1, 0.2, 0.3]))
    }
    assert.deepEqual((await embedMany({ model, values: ['first', 'second'] })).embeddings, [[0.1, 0.2, 0.3], [0.1, 0.2, 0.3]])
    globalThis.fetch = async () => Response.json([[1]])
    await assert.rejects(embedMany({ model, values: ['first', 'second'], maxRetries: 0 }), /invalid embedding/)
  } finally { Object.assign(pool, { query: original }); globalThis.fetch = originalFetch }
})
