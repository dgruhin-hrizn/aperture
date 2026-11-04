import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPool, closePool } from '../lib/db.js'
import { getTrendingMoviesBatch, getTrendingTVBatch } from './discover.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
test('parallel and repeated chart requests share public pages, preserve order and respect configuration removal', async () => {
  const pool = getPool(),
    originalQuery = pool.query,
    originalFetch = globalThis.fetch
  let enabled = true,
    calls = 0
  Object.assign(pool, {
    query: async () => ({ rows: enabled ? [{ value: 'chart-test-key' }] : [], rowCount: 1 }),
  })
  globalThis.fetch = async (input) => {
    calls++
    const url = new URL(String(input))
    return Response.json({
      results: [{ id: Number(url.searchParams.get('page')), title: 'Title' }],
    })
  }
  try {
    const [a, b] = await Promise.all([
      getTrendingMoviesBatch('week', 2),
      getTrendingMoviesBatch('week', 2),
    ])
    assert.deepEqual(
      a.map((r) => r.id),
      [1, 2]
    )
    assert.deepEqual(a, b)
    assert.equal(calls, 2)
    await getTrendingMoviesBatch('week', 2)
    assert.equal(calls, 2)
    await getTrendingTVBatch('week', 2)
    assert.equal(calls, 4, 'movie and TV pages must not collide')
    enabled = false
    assert.deepEqual(await getTrendingMoviesBatch('week', 2), [])
    assert.equal(calls, 4)
  } finally {
    globalThis.fetch = originalFetch
    Object.assign(pool, { query: originalQuery })
    await closePool()
  }
})
