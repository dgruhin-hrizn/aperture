import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { getPool, closePool } from '../lib/db.js'
import {
  batchGetMediaStatusByMedia,
  createRequest,
  deleteRequest,
  getMediaStatus,
  setSeerrConfig,
} from './provider.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
const pool = getPool()
const originalQuery = pool.query
const originalFetch = globalThis.fetch
let reads = 0
let calls = 0
let generation = 0
let available = false
let fail = false
Object.assign(pool, {
  query: async () => {
    reads++
    return {
      rows: [
        { key: 'seerr_url', value: `http://seerr-${generation}.test` },
        { key: 'seerr_api_key', value: 'test' },
        { key: 'seerr_enabled', value: 'true' },
      ],
      rowCount: 3,
    }
  },
})
beforeEach(async () => {
  generation++
  reads = 0
  calls = 0
  available = false
  fail = false
  await setSeerrConfig({})
  globalThis.fetch = async (_url, init) => {
    calls++
    assert.ok(init?.signal, 'status lookups have a deadline')
    if (fail) return new Response('{}', { status: 503 })
    return Response.json({
      mediaInfo: { status: available ? 5 : 1, requests: available ? [{ id: 9, status: 2 }] : [] },
    })
  }
})
after(async () => {
  Object.assign(pool, { query: originalQuery })
  globalThis.fetch = originalFetch
  await closePool()
})

test('one config read per batch, typed deduplication, shared cache across simultaneous batches', async () => {
  const items = [
    { tmdbId: 12, mediaType: 'movie' as const },
    { tmdbId: 12, mediaType: 'tv' as const },
    { tmdbId: 12, mediaType: 'movie' as const },
  ]
  const [a, b] = await Promise.all([
    batchGetMediaStatusByMedia(items),
    batchGetMediaStatusByMedia(items),
  ])
  assert.deepEqual([...a.keys()], ['movie:12', 'tv:12'])
  assert.deepEqual(a, b)
  assert.equal(calls, 2)
  assert.equal(reads, 2)
  await batchGetMediaStatusByMedia(items)
  assert.equal(calls, 2)
})
test('failures are not cached and disabled or invalid items cannot make upstream calls', async () => {
  fail = true
  assert.equal(await getMediaStatus(13, 'movie'), null)
  fail = false
  assert.ok(await getMediaStatus(13, 'movie'))
  assert.equal(calls, 2)
  assert.equal(await getMediaStatus(-1, 'movie'), null)
  assert.equal(
    await getMediaStatus(15, 'movie', { url: 'http://unused', apiKey: 'test', enabled: false }),
    null
  )
  assert.equal(calls, 2)
})
test('request creation and deletion invalidate previous statuses', async () => {
  await getMediaStatus(14, 'movie')
  available = true
  // Mutation requests do not use the status-only timeout; the fake handles these separately.
  globalThis.fetch = async (_url, init) => {
    calls++
    return Response.json(
      init?.method === 'POST' ? { id: 9 } : { mediaInfo: { status: available ? 5 : 1 } }
    )
  }
  assert.equal((await createRequest(14, 'movie')).success, true)
  assert.equal((await getMediaStatus(14, 'movie'))?.exists, true)
  available = false
  assert.equal(await deleteRequest(9), true)
  assert.equal((await getMediaStatus(14, 'movie'))?.exists, false)
})
