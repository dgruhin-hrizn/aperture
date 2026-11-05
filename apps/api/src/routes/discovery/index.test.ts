import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { getPool, closePool } from '@aperture/core'
import discoveryRoutes from './index.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
test('conditional candidates recheck access and actual library-filtered rows before issuing 304', async () => {
  const pool = getPool()
  const original = pool.query
  let allowed = true
  let removed = false
  Object.assign(pool, {
    query: async (sql: string) => {
      let rows: unknown[] = []
      if (sql.includes('FROM users')) rows = [{ discover_enabled: allowed }]
      else if (sql.includes('COUNT(*)')) rows = [{ count: removed ? '0' : '1' }]
      else if (sql.includes('SELECT dc.*'))
        rows = removed
          ? []
          : [
              {
                id: 'one',
                tmdb_id: 1,
                rank: 1,
                final_score: '0.8',
                genres: [],
                score_breakdown: {},
                created_at: new Date('2026-01-01'),
              },
            ]
      return { rows, rowCount: rows.length }
    },
  })
  const app = Fastify({ ajv: { customOptions: { strict: false } } })
  app.addHook('preHandler', async (request) => {
    request.user = { id: 'test', username: 'test', isAdmin: true } as typeof request.user
  })
  await app.register(discoveryRoutes)
  try {
    for (const type of ['movies', 'series']) {
      allowed = true
      removed = false
      const first = await app.inject({ url: `/api/discovery/${type}` })
      assert.equal(first.statusCode, 200, first.body)
      const etag = first.headers.etag
      assert.ok(etag)
      const headers = { 'if-none-match': String(etag) }
      assert.equal((await app.inject({ url: `/api/discovery/${type}`, headers })).statusCode, 304)
      removed = true
      const changed = await app.inject({ url: `/api/discovery/${type}`, headers })
      assert.equal(changed.statusCode, 200)
      assert.deepEqual(changed.json().candidates, [])
      assert.notEqual(changed.headers.etag, etag)
      allowed = false
      assert.equal((await app.inject({ url: `/api/discovery/${type}`, headers })).statusCode, 403)
    }
  } finally {
    await app.close()
    Object.assign(pool, { query: original })
    await closePool()
  }
})
