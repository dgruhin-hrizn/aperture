import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import Fastify from 'fastify'
import { closePool, getPool, runMigrations } from '@aperture/core'
import routes from './index.js'

const database = process.env.APERTURE_TEST_DATABASE_URL

test('gap requests reconcile ambiguous Seerr submissions and avoid duplicate POSTs', { skip: !database }, async (t) => {
  const fixture = new URL(database!)
  assert.ok(['localhost', '127.0.0.1'].includes(fixture.hostname) && fixture.pathname.startsWith('/aperture_test'))
  process.env.DATABASE_URL = fixture.toString()
  assert.equal((await runMigrations(fixture.toString(), new URL('../../../../../db/migrations/', import.meta.url).pathname)).error, undefined)
  const pool = getPool()
  const a = randomUUID(), b = randomUUID()
  const tmdbId = 42
  await pool.query(
    "INSERT INTO users(id,provider,provider_user_id,username,seerr_user_id) VALUES ($1::uuid,'emby',$1::uuid::text,'Fixture A',7),($2::uuid,'emby',$2::uuid::text,'Fixture B',8)",
    [a, b]
  )
  for (const [key, value] of [['seerr_url', 'https://seerr.invalid'], ['seerr_enabled', 'true'], ['seerr_api_key', 'fixture']])
    await pool.query('INSERT INTO system_settings(key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [key, value])

  let posts = 0
  let available = false
  let posted = false
  let releasePost!: () => void
  let markPost!: () => void
  const received = new Promise<void>((resolve) => { markPost = resolve })
  const hold = new Promise<void>((resolve) => { releasePost = resolve })
  t.mock.method(globalThis, 'fetch', async (input: string, init?: RequestInit) => {
    const url = new URL(String(input))
    assert.equal(url.origin, 'https://seerr.invalid')
    if (init?.method === 'POST') {
      assert.equal(url.pathname, '/api/v1/request')
      posts++
      markPost()
      await hold
      posted = true
      throw new Error('Connection closed after Seerr accepted the request')
    }
    assert.equal(url.pathname, `/api/v1/movie/${tmdbId}`)
    return Response.json({ id: tmdbId, mediaInfo: available ? { status: 5 } : posted ? {
      status: 2, requests: [{ id: 17, status: 1, is4k: false, requestedBy: { id: 7 } }],
    } : null })
  })
  const app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = { id: request.headers['x-other'] ? b : a, username: 'fixture', displayName: null,
      provider: 'emby', providerUserId: '', isAdmin: true, isEnabled: true, canManageWatchHistory: false, avatarUrl: null }
  })
  await app.register(routes)
  const send = (other = false) => app.inject({ method: 'POST', url: '/api/admin/gap-analysis/request',
    headers: other ? { 'x-other': '1' } : {},
    payload: { items: [{ tmdbId, mediaType: 'movie', title: 'Test' }] } })
  try {
    const first = send().then((response) => response)
    await received
    assert.equal((await send(true)).json().skipped, 1)
    releasePost()
    assert.equal((await first).json().submitted, 1)
    assert.deepEqual((await pool.query('SELECT status,seerr_request_id FROM discovery_requests WHERE user_id=$1', [a])).rows,
      [{ status: 'submitted', seerr_request_id: 17 }])
    available = true
    assert.equal((await send(true)).json().skipped, 1)
    assert.equal(posts, 1)
  } finally {
    releasePost()
    await app.close()
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[a, b]])
    await pool.query("DELETE FROM system_settings WHERE key IN ('seerr_url','seerr_enabled','seerr_api_key')")
    await closePool()
  }
})

test('TV gaps compare released TMDb episodes with a complete Emby inventory', { skip: !database }, async (t) => {
  const fixture = new URL(database!)
  assert.ok(['localhost', '127.0.0.1'].includes(fixture.hostname) && fixture.pathname.startsWith('/aperture_test'))
  process.env.DATABASE_URL = fixture.toString()
  assert.equal((await runMigrations(fixture.toString(), new URL('../../../../../db/migrations/', import.meta.url).pathname)).error, undefined)
  const pool = getPool(), id = randomUUID(), account = randomUUID()
  await pool.query("INSERT INTO series(id,provider_item_id,title,tmdb_id) VALUES ($1,'gap-series','Inventory Fixture','12345')", [id])
  const settings = [['media_server_type', 'emby'], ['media_server_base_url', 'https://emby.invalid'],
    ['media_server_api_key', 'fixture'], ['tmdb_api_key', 'fixture']]
  for (const [key, value] of settings) await pool.query(
    'INSERT INTO system_settings(key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [key, value]
  )
  let incomplete = false
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(String(input))
    if (url.origin === 'https://emby.invalid') {
      if (url.pathname.endsWith('/gap-series')) return Response.json({ Id: 'gap-series', Name: 'Inventory Fixture' })
      if (url.pathname.endsWith('/Items')) return Response.json({
        TotalRecordCount: incomplete ? 2 : 1,
        StartIndex: Number(url.searchParams.get('StartIndex')),
        Items: incomplete && url.searchParams.get('StartIndex') === '1' ? [] : [{
          Id: 'episode-file', SeriesId: 'gap-series', Name: 'Combined file', ParentIndexNumber: 1,
          IndexNumber: 1, IndexNumberEnd: 2, Path: '/fixture/file.mkv',
        }],
      })
    }
    assert.equal(url.origin, 'https://api.themoviedb.org')
    if (url.pathname.endsWith('/tv/12345')) return Response.json({
      id: 12345, seasons: [{ season_number: 0 }, { season_number: 1 }, { season_number: 2 }],
    })
    if (url.pathname.endsWith('/season/1')) return Response.json({
      season_number: 1, name: 'Season 1', episodes: [1, 2, 3, 4].map((number) => ({
        episode_number: number, name: `Item ${number}`,
        air_date: number === 4 ? '9999-01-01' : '2020-01-01',
      })),
    })
    if (url.pathname.endsWith('/season/2')) return Response.json({
      season_number: 2, name: 'Season 2', episodes: [{ episode_number: 1, name: 'Missing', air_date: '2020-02-01' }],
    })
    throw new Error(`Unexpected fixture request ${url.pathname}`)
  })
  const app = Fastify()
  app.addHook('onRequest', async (request) => {
    request.user = { id: account, username: 'fixture', displayName: null, provider: 'emby', providerUserId: '',
      isAdmin: !request.headers['x-non-admin'], isEnabled: true, canManageWatchHistory: false, avatarUrl: null }
  })
  await app.register(routes)
  const url = `/api/admin/gap-analysis/tv/${id}`
  try {
    assert.equal((await app.inject({ url, headers: { 'x-non-admin': '1' } })).statusCode, 403)
    assert.equal((await app.inject({ url: '/api/admin/gap-analysis/tv?q=Inventory' })).json().series[0].id, id)
    const verified = await app.inject({ url })
    assert.equal(verified.statusCode, 200, verified.body)
    assert.deepEqual(verified.json().seasons.map((season: { number: number; released: number; missing: { number: number }[] }) =>
      [season.number, season.released, season.missing.map((episode) => episode.number)]),
    [[1, 3, [3]], [2, 1, [1]]])
    incomplete = true
    assert.equal((await app.inject({ url })).statusCode, 503)
  } finally {
    await app.close()
    await pool.query('DELETE FROM series WHERE id=$1', [id])
    await pool.query('DELETE FROM system_settings WHERE key=ANY($1::text[])', [settings.map(([key]) => key)])
    await closePool()
  }
})
