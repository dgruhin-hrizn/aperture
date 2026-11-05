import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { getPool, closePool } from '@aperture/core'
import { registerTmdbGenreRowsRoutes } from './tmdbGenreRows.js'
import { registerStreamingDiscoveryRoutes } from './streaming.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
test('fast strip responses skip optional Seerr/poster API work, retain library flags and recheck access', async () => {
  const pool = getPool(),
    originalQuery = pool.query,
    originalFetch = globalThis.fetch
  let allowed = true,
    seerrReads = 0,
    details = 0,
    cachedPoster = false
  const raw = {
    data: {
      popularTitles: {
        edges: [
          {
            node: {
              id: 'one',
              objectType: 'MOVIE',
              content: {
                title: 'Movie',
                externalIds: { tmdbId: '90123' },
                posterUrl: 'https://images.justwatch.com/poster.jpg',
              },
            },
          },
        ],
      },
    },
  }
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      let rows: unknown[] = []
      if (sql.includes('FROM users')) rows = [{ discover_enabled: allowed }]
      else if (sql.includes('system_settings')) {
        const key = String(params[0])
        if (key.includes('seerr')) seerrReads++
        rows = [
          {
            value:
              key === 'tmdb_api_key'
                ? 'strip-test-key'
                : key === 'streaming_discovery_enabled'
                  ? 'true'
                  : null,
          },
        ]
      } else if (sql.includes('justwatch_chart_cache'))
        rows = [{ payload: raw, fetched_at: new Date() }]
      else if (sql.includes('FROM tmdb_poster_cache'))
        rows = cachedPoster
          ? [{ tmdb_id: 90123, poster_path: '/cached.jpg', fetched_at: new Date() }]
          : []
      else if (sql.includes('SELECT id, tmdb_id FROM movies'))
        rows = [{ id: 'local', tmdb_id: '90123' }]
      return { rows, rowCount: rows.length }
    },
  })
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (!url.pathname.includes('/discover/')) {
      details++
      throw Error('Unexpected detail lookup')
    }
    return Response.json({
      total_pages: 1,
      total_results: 1,
      results: [
        {
          id: 98765,
          title: 'Genre Movie',
          poster_path: '/poster.jpg',
          original_language: 'en',
          genre_ids: [28],
          release_date: '2025-01-01',
          overview: '',
          vote_average: 7,
          vote_count: 10,
          popularity: 1,
        },
      ],
    })
  }
  const app = Fastify()
  app.addHook('preHandler', async (request) => {
    if (!request.headers['x-anonymous'])
      request.user = { id: 'strip-user', isAdmin: true } as typeof request.user
  })
  registerTmdbGenreRowsRoutes(app)
  registerStreamingDiscoveryRoutes(app)
  try {
    const genre = await app.inject(
      '/api/discovery/tmdb-genre-row?mediaType=movie&genreIds=28&limit=1&includeStatuses=false'
    )
    assert.equal(genre.statusCode, 200, genre.body)
    assert.equal(genre.json().candidates.length, 1)
    assert.deepEqual(genre.json().seerrStatusesByMedia, {})
    const path =
      '/api/discovery/streaming/popular?country=US&limit=24&includeStatuses=false&cachedPostersOnly=true'
    const streaming = await app.inject(path)
    assert.equal(streaming.statusCode, 200, streaming.body)
    assert.equal(streaming.json().rows[0].inLibrary, true)
    assert.equal(streaming.json().rows[0].posterPath, 'https://images.justwatch.com/poster.jpg')
    assert.deepEqual(streaming.json().seerrStatusesByMedia, {})
    assert.equal(seerrReads, 0)
    assert.equal(details, 0)
    const missing = await app.inject(path + '&missingOnly=true')
    assert.deepEqual(missing.json().rows, [])
    cachedPoster = true
    const cached = await app.inject(path)
    assert.equal(cached.json().rows[0].posterPath, '/cached.jpg')
    await app.inject('/api/discovery/streaming/popular?country=US&limit=24')
    assert.ok(seerrReads > 0, 'legacy clients keep default inline status enrichment')
    assert.equal((await app.inject({ url: path, headers: { 'x-anonymous': '1' } })).statusCode, 401)
    allowed = false
    assert.equal((await app.inject(path)).statusCode, 403)
    assert.equal(
      (
        await app.inject(
          '/api/discovery/tmdb-genre-row?mediaType=movie&genreIds=28&includeStatuses=false'
        )
      ).statusCode,
      403
    )
  } finally {
    await app.close()
    Object.assign(pool, { query: originalQuery })
    globalThis.fetch = originalFetch
    await closePool()
  }
})
