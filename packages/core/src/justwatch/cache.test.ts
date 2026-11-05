import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPool, closePool } from '../lib/db.js'
import { loadCachedOrFetch } from './cache.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
test('expired public charts return immediately, share one refresh and publish its result', async () => {
  const pool = getPool(),
    original = pool.query
  let persisted: unknown = { titles: ['old'] },
    writes = 0,
    loads = 0,
    finish!: (v: unknown) => void
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT')) {
        writes++
        persisted = params[1]
        return { rows: [] }
      }
      return { rows: [{ payload: persisted, fetched_at: new Date(Date.now() - 24 * 60 * 60_000) }] }
    },
  })
  const loader = () => {
    loads++
    return new Promise<unknown>((resolve) => {
      finish = resolve
    })
  }
  try {
    const first = await loadCachedOrFetch('stale-chart-test', loader)
    assert.deepEqual(first, { raw: { titles: ['old'] }, stale: true })
    assert.deepEqual(await loadCachedOrFetch('stale-chart-test', loader), first)
    assert.equal(loads, 1)
    assert.equal(writes, 0)
    finish({ titles: ['new'] })
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(await loadCachedOrFetch('stale-chart-test', loader), {
      raw: { titles: ['new'] },
      stale: false,
    })
    assert.equal(writes, 1)
  } finally {
    Object.assign(pool, { query: original })
    await closePool()
  }
})

test('failed stale refresh stays usable while uncached failures remain retryable', async () => {
  const pool = getPool(),
    original = pool.query
  Object.assign(pool, {
    query: async (_sql: string, params: unknown[]) => ({
      rows:
        params[0] === 'failed-stale-test' ? [{ payload: 'saved', fetched_at: new Date(0) }] : [],
    }),
  })
  try {
    const failed = () => Promise.reject(Error('offline'))
    assert.deepEqual(await loadCachedOrFetch('failed-stale-test', failed), {
      raw: 'saved',
      stale: true,
    })
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(await loadCachedOrFetch('failed-stale-test', failed), {
      raw: 'saved',
      stale: true,
    })
    await assert.rejects(
      loadCachedOrFetch('uncached-failure-test', failed),
      /JUSTWATCH_UNAVAILABLE/
    )
    await assert.rejects(
      loadCachedOrFetch('uncached-failure-test', failed),
      /JUSTWATCH_UNAVAILABLE/
    )
  } finally {
    Object.assign(pool, { query: original })
    await closePool()
  }
})
