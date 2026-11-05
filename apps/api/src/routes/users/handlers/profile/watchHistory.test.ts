import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { randomUUID } from 'node:crypto'
import { getPool, closePool } from '@aperture/core'
import { registerWatchHistoryHandlers } from './watchHistory.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
test('exact movie watch status finds an older title regardless of paginated history, checks ownership and respects incomplete playback', async () => {
  const pool = getPool(),
    original = pool.query
  const userId = randomUUID(),
    movieId = randomUUID()
  let completed = true,
    queries = 0
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      queries++
      assert.ok(sql.includes('wh.movie_id = $2'))
      assert.deepEqual(params, [userId, movieId])
      return {
        rows: [
          {
            played: completed,
            play_count: completed ? 3 : 0,
            last_played_at: new Date('2020-01-01'),
          },
        ],
        rowCount: 1,
      }
    },
  })
  const app = Fastify()
  app.addHook('preHandler', async (request) => {
    request.user = { id: userId, isAdmin: false } as typeof request.user
  })
  registerWatchHistoryHandlers(app)
  try {
    const url = `/api/users/${userId}/watch-history/movies/${movieId}`
    const first = await app.inject({ url })
    assert.equal(first.statusCode, 200, first.body)
    assert.equal(first.json().isWatched, true)
    assert.equal(first.json().playCount, 3)
    completed = false
    assert.equal((await app.inject({ url })).json().isWatched, false)
    assert.equal(
      (await app.inject({ url: `/api/users/${randomUUID()}/watch-history/movies/${movieId}` }))
        .statusCode,
      403
    )
    assert.equal(
      (await app.inject({ url: `/api/users/${userId}/watch-history/movies/invalid` })).statusCode,
      400
    )
    assert.equal(queries, 2)
  } finally {
    await app.close()
    Object.assign(pool, { query: original })
    await closePool()
  }
})
