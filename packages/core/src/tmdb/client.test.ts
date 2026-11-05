import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tmdbRequest } from './client.js'

test('parallel TMDb requests reserve separate rate-limit slots instead of waking together', async (t) => {
  const originalFetch = globalThis.fetch,
    timer = globalThis.setTimeout
  const delays: number[] = []
  let calls = 0
  t.mock.method(globalThis, 'setTimeout', (callback: () => void, ms: number) => {
    delays.push(ms)
    return timer(callback, 0)
  })
  globalThis.fetch = async () => {
    calls++
    return Response.json({ ok: true })
  }
  try {
    await Promise.all(
      Array.from({ length: 4 }, () => tmdbRequest('/tv/1', { apiKey: 'test-rate-key' }))
    )
    assert.equal(calls, 4)
    assert.equal(delays.length, 3)
    assert.ok(delays[1] > delays[0] + 10)
    assert.ok(delays[2] > delays[1] + 10)
  } finally {
    globalThis.fetch = originalFetch
  }
})
