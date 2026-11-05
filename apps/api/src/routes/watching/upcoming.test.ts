import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { closePool, getPool } from '@aperture/core'
import watchingRoutes from './index.js'
process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
let originalQuery: ReturnType<typeof getPool>['query']
const originalFetch = globalThis.fetch
const userId = randomUUID(),
  owned = randomUUID(),
  foreign = randomUUID()
let calls: string[], queryInputs: unknown[][]
beforeEach(() => {
  calls = []
  queryInputs = []
  const pool = getPool()
  originalQuery = pool.query
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      let rows: unknown[] = []
      if (sql.includes('SELECT uws.id')) {
        assert.equal(params[0], userId)
        rows = [
          { id: randomUUID(), series_id: owned, title: 'My show', genres: [], tmdb_id: '555' },
        ]
      } else if (sql.includes('FROM user_watching_series')) {
        queryInputs.push(params)
        rows = (params[1] as string[]).includes(owned) ? [{ series_id: owned }] : []
      } else if (sql.includes('FROM episodes')) rows = []
      else if (sql.includes('FROM series')) {
        assert.deepEqual(params[0], [owned])
        rows = [{ id: owned, tmdb_id: '555' }]
      } else if (sql.includes('FROM system_settings')) rows = [{ value: randomUUID() }]
      else throw Error('Unexpected query')
      return { rows, rowCount: rows.length }
    },
  })
  globalThis.fetch = async (input) => {
    calls.push(new URL(String(input)).pathname)
    return Response.json({ next_episode_to_air: null })
  }
})
afterEach(async () => {
  Object.assign(getPool(), { query: originalQuery })
  globalThis.fetch = originalFetch
  await closePool()
})
async function app() {
  const server = Fastify({ ajv: { customOptions: { strict: false } } })
  server.addHook('preHandler', async (request) => {
    if (!request.headers['x-anonymous'])
      request.user = { id: userId, isAdmin: false } as typeof request.user
  })
  await server.register(watchingRoutes)
  return server
}
test('local-only Watching list returns saved series without contacting TMDb; legacy enrichment remains available', async () => {
  const server = await app()
  try {
    const quick = await server.inject({ url: '/api/watching?includeUpcoming=false' })
    assert.equal(quick.statusCode, 200, quick.body)
    assert.equal(quick.json().series[0].seriesId, owned)
    assert.deepEqual(calls, [])
    const full = await server.inject({ url: '/api/watching' })
    assert.equal(full.statusCode, 200, full.body)
    assert.deepEqual(calls, ['/3/tv/555'])
    assert.equal(
      (await server.inject({ url: '/api/watching?includeUpcoming=invalid' })).statusCode,
      400
    )
  } finally {
    await server.close()
  }
})
test('forecast batches require authentication, bound input and check membership before upstream reads', async () => {
  const server = await app()
  try {
    assert.equal(
      (
        await server.inject({
          url: `/api/watching/upcoming?seriesIds=${owned}`,
          headers: { 'x-anonymous': '1' },
        })
      ).statusCode,
      401
    )
    assert.equal(
      (await server.inject({ url: '/api/watching/upcoming?seriesIds=not-a-uuid' })).statusCode,
      400
    )
    assert.equal(
      (
        await server.inject({
          url:
            '/api/watching/upcoming?seriesIds=' +
            Array.from({ length: 21 }, () => randomUUID()).join(','),
        })
      ).statusCode,
      400
    )
    assert.deepEqual(queryInputs, [])
    assert.deepEqual(calls, [])
    const denied = await server.inject({ url: `/api/watching/upcoming?seriesIds=${foreign}` })
    assert.equal(denied.statusCode, 200, denied.body)
    assert.deepEqual(denied.json(), { episodes: {}, resolvedSeriesIds: [], seriesIds: [] })
    assert.deepEqual(calls, [])
    const mixed = await server.inject({
      url: `/api/watching/upcoming?seriesIds=${owned},${foreign}`,
    })
    assert.equal(mixed.statusCode, 200, mixed.body)
    assert.deepEqual(mixed.json(), { episodes: {}, resolvedSeriesIds: [owned], seriesIds: [owned] })
    assert.deepEqual(calls, ['/3/tv/555'])
    assert.deepEqual(queryInputs.at(-1), [userId, [owned, foreign]])
  } finally {
    await server.close()
  }
})
