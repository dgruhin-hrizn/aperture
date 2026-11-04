import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { getPool, closePool } from '@aperture/core'
import movieRoutes from './movies/index.js'
import graphRoutes from './graphPlaylists/index.js'
import channelRoutes from './channels/index.js'
import seerrRoutes from './seerr/index.js'
import watchingRoutes from './watching/index.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
test('preview access and batched reads remain authenticated and owner-scoped', async () => {
  const userId = randomUUID(),
    foreignId = randomUUID(),
    movieId = randomUUID()
  const pool = getPool(),
    originalQuery = pool.query,
    originalFetch = globalThis.fetch
  const remoteIds: number[] = []
  let summaries = 0,
    ownedRequestQueries = 0
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      let rows: unknown[] = []
      if (sql.includes('FROM user_watching_series')) {
        assert.equal(params[0], userId)
        rows = [{ series_id: movieId }]
      } else if (sql.includes('FROM channels WHERE id'))
        rows = [{ id: foreignId, owner_id: foreignId, playlist_id: 'private' }]
      else if (sql.includes('FROM graph_playlists'))
        rows = [
          { id: foreignId, ownerId: foreignId, mediaServerPlaylistId: 'private', itemCount: 25 },
        ]
      else if (sql.includes('array_position')) {
        summaries++
        assert.deepEqual(params, [[movieId]])
        rows = [{ id: movieId, title: 'Summary', year: 2025, poster_url: null }]
      } else if (sql.includes('DISTINCT seerr_request_id')) {
        ownedRequestQueries++
        assert.equal(params[0], userId)
        rows = (params[1] as number[]).includes(10) ? [{ seerr_request_id: 10 }] : []
      } else if (sql.includes('SELECT * FROM discovery_requests'))
        rows = [
          {
            id: randomUUID(),
            user_id: userId,
            media_type: 'movie',
            tmdb_id: 3,
            title: 'Saved',
            seerr_request_id: 30,
            status: 'submitted',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]
      else if (sql.includes('COUNT(*)')) rows = [{ c: 1 }]
      else if (sql.includes('FROM system_settings') && sql.includes('ANY'))
        rows = [
          { key: 'seerr_url', value: 'http://request-status.test' },
          { key: 'seerr_api_key', value: 'test' },
          { key: 'seerr_enabled', value: 'true' },
        ]
      return { rows, rowCount: rows.length }
    },
  })
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    const id = Number(url.pathname.split('/').at(-1))
    remoteIds.push(id)
    return Response.json({ id, status: 2, media: { status: 5 } })
  }
  const app = Fastify({ ajv: { customOptions: { strict: false } } })
  app.addHook('preHandler', async (request) => {
    if (!request.headers['x-anonymous'])
      request.user = { id: userId, isAdmin: false } as typeof request.user
  })
  await app.register(movieRoutes)
  await app.register(graphRoutes)
  await app.register(channelRoutes)
  await app.register(seerrRoutes)
  await app.register(watchingRoutes)
  try {
    const membership = await app.inject({ url: '/api/watching/ids' })
    assert.equal(membership.statusCode, 200)
    assert.deepEqual(membership.json(), { seriesIds: [movieId] })
    assert.equal((await app.inject({ url: `/api/channels/${foreignId}/preview` })).statusCode, 403)
    assert.equal(
      (await app.inject({ url: `/api/graph-playlists/${foreignId}/preview` })).statusCode,
      403
    )
    assert.deepEqual(remoteIds, [], 'denied previews must not contact the media server')
    assert.equal(
      (
        await app.inject({
          url: `/api/movies/summaries?ids=${movieId}`,
          headers: { 'x-anonymous': 'yes' },
        })
      ).statusCode,
      401
    )
    const summary = await app.inject({ url: `/api/movies/summaries?ids=${movieId}` })
    assert.equal(summary.statusCode, 200, summary.body)
    assert.deepEqual(Object.keys(summary.json().movies[0]).sort(), [
      'id',
      'poster_url',
      'title',
      'year',
    ])
    assert.equal((await app.inject({ url: '/api/movies/summaries?ids=invalid' })).statusCode, 400)
    assert.equal(summaries, 1)
    const status = await app.inject({
      method: 'POST',
      url: '/api/seerr/requests/status/batch',
      payload: { requestIds: [10, 20] },
    })
    assert.equal(status.statusCode, 200, status.body)
    assert.deepEqual(Object.keys(status.json().statuses), ['10'])
    assert.deepEqual(remoteIds, [10])
    assert.equal(status.json().statuses['10'].mediaStatus, 'available')
    await app.inject({
      method: 'POST',
      url: '/api/seerr/requests/status/batch',
      payload: { requestIds: [10, 20] },
    })
    assert.deepEqual(remoteIds, [10], 'warm statuses reuse the cache after rechecking ownership')
    assert.equal(ownedRequestQueries, 2)
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/seerr/requests/status/batch',
          payload: { requestIds: [0] },
        })
      ).statusCode,
      400
    )
    const saved = await app.inject({ url: '/api/seerr/requests?includeLive=false' })
    assert.equal(saved.statusCode, 200, saved.body)
    assert.equal(saved.json().requests.length, 1)
    assert.equal(saved.json().requests[0].seerrRequestId, 30)
    assert.deepEqual(remoteIds, [10], 'saved request rows do not depend on Seerr')
  } finally {
    await app.close()
    globalThis.fetch = originalFetch
    Object.assign(pool, { query: originalQuery })
    await closePool()
  }
})
