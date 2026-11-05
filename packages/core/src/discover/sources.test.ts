import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPool, closePool } from '../lib/db.js'
import { fetchGenreStripDiscoverCandidates } from './sources.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
test('genre pages are shared while user watch exclusions are queried fresh on every load', async () => {
  const pool = getPool(),
    originalQuery = pool.query,
    originalFetch = globalThis.fetch
  let calls = 0,
    apiKey: string | null = 'test-key'
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      let rows: unknown[] = []
      if (sql.includes('system_settings')) rows = apiKey ? [{ value: apiKey }] : []
      if (sql.includes('FROM watch_history')) rows = [{ tmdb_id: params[0] === 'a' ? '1' : '2' }]
      return { rows, rowCount: rows.length }
    },
  })
  globalThis.fetch = async () => {
    calls++
    return Response.json({
      total_pages: 1,
      total_results: 2,
      results: [1, 2].map((id) => ({
        id,
        title: `Movie ${id}`,
        poster_path: '/poster.jpg',
        original_language: 'en',
        genre_ids: [28],
        release_date: '2025-01-01',
        overview: '',
        vote_average: 7,
        vote_count: 100,
        popularity: 1,
      })),
    })
  }
  try {
    const a = await fetchGenreStripDiscoverCandidates('movie', {
      userId: 'a',
      genreIds: [28],
      targetCount: 1,
    })
    const b = await fetchGenreStripDiscoverCandidates('movie', {
      userId: 'b',
      genreIds: [28],
      targetCount: 1,
    })
    assert.deepEqual(
      a.map((c) => c.tmdbId),
      [2]
    )
    assert.deepEqual(
      b.map((c) => c.tmdbId),
      [1]
    )
    assert.equal(calls, 1)
    apiKey = 'rotated-genre-key'
    await fetchGenreStripDiscoverCandidates('movie', {
      userId: 'a',
      genreIds: [28],
      targetCount: 1,
    })
    assert.equal(calls, 2, 'a different credential cannot reuse old cached pages')
    apiKey = null
    assert.deepEqual(
      await fetchGenreStripDiscoverCandidates('movie', {
        userId: 'a',
        genreIds: [28],
        targetCount: 1,
      }),
      []
    )
    assert.equal(calls, 2, 'removing the credential retires access to cached pages')
  } finally {
    globalThis.fetch = originalFetch
    Object.assign(pool, { query: originalQuery })
    await closePool()
  }
})
