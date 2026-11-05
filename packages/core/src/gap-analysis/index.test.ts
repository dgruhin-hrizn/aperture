import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import pg from 'pg'
import { closePool, query } from '../lib/db.js'
import {
  isReleasedReleaseDate, parseTmdbId, runLibraryGapAnalysis, getLatestCompletedGapRun,
  getGapCollectionSummaries, getGapCollectionParts, listGapResults, getDistinctMovieCollectionIds,
} from './index.js'

test('release dates reject invalid calendar dates, unknown dates and future releases', () => {
  for (const date of [null, undefined, '', '2024-02-30', '2023-02-29', '2024-13-01', '2024-00-01',
    '2024-01-00', '2024-01-32', '2024-01-01 extra', '9999-01-01']) {
    assert.equal(isReleasedReleaseDate(date), false, String(date))
  }
  for (const date of ['2024-02-29', '2000-01-01', new Date().toISOString().slice(0, 10)]) {
    assert.equal(isReleasedReleaseDate(date), true, date)
  }
})

test('TMDb IDs reject partial strings, overflow, fractions and nonpositive values', () => {
  for (const id of ['abc', '12abc', '', ' ', '1.2', 0, -1, 2.1, Infinity, NaN, 2147483648, null]) {
    assert.equal(parseTmdbId(id), null, String(id))
  }
  assert.equal(parseTmdbId(' 0012 '), 12)
  assert.equal(parseTmdbId(2147483647), 2147483647)
})

const fixtureUrl = process.env.APERTURE_TEST_DATABASE_URL

test('gap snapshots survive upstream failures and all displays agree after requests or sync', { skip: !fixtureUrl }, async (t) => {
  const url = new URL(fixtureUrl!)
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/aperture_test'))
  const schema = `curation_${randomUUID().replaceAll('-', '')}`
  const bootstrap = new pg.Client({ connectionString: url.toString() })
  await bootstrap.connect()
  await bootstrap.query(`CREATE SCHEMA ${schema}`)
  url.searchParams.set('options', `-c search_path=${schema}`)
  process.env.DATABASE_URL = url.toString()
  let mode: 'success' | 'unavailable' | 'not_found' = 'success'
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const address = String(input)
    assert.ok(address.startsWith('https://api.themoviedb.org/') || address.startsWith('https://seerr.invalid/'))
    if (address.startsWith('https://seerr.invalid/')) return new Response('', { status: 404 })
    if (mode !== 'success') return new Response('', { status: mode === 'not_found' ? 404 : 500 })
    return Response.json({ id: 10, name: 'Test collection', overview: '', poster_path: null, backdrop_path: null,
      parts: [
        { id: 1, title: 'Owned', release_date: '2000-01-01', poster_path: null },
        { id: 2, title: 'Missing', release_date: '2001-01-01', poster_path: null },
        { id: 2, title: 'Missing', release_date: '2001-01-01', poster_path: null },
        { id: 3, title: 'Bad date', release_date: '2001-02-30', poster_path: null },
        { id: 4, title: 'Future', release_date: '9999-01-01', poster_path: null },
      ] })
  })
  try {
    await query(`CREATE TABLE system_settings (key text PRIMARY KEY, value text);
      CREATE TABLE movies (tmdb_id text, collection_id text);
      CREATE TABLE discovery_requests (user_id uuid, tmdb_id int, media_type text, status text, created_at timestamptz DEFAULT now());
      CREATE TABLE tmdb_collection_cache (collection_id int PRIMARY KEY, name text, overview text,
        poster_path text, backdrop_path text, parts_json jsonb, updated_at timestamptz);`)
    await query(await readFile(new URL('../../../../db/migrations/0106_gap_analysis.sql', import.meta.url), 'utf8'))
    await query(await readFile(new URL('../../../../db/migrations/0108_gap_results_status.sql', import.meta.url), 'utf8'))
    await query("INSERT INTO system_settings VALUES ('tmdb_api_key','test'); INSERT INTO movies VALUES ('001','10'), ('99','garbage'), ('98','2147483648')")
    await query(`INSERT INTO gap_analysis_runs (status,completed_at)
      VALUES ('completed',now()-interval '3 days'),('completed',now()-interval '2 days'),('running',NULL)`)
    await query(`INSERT INTO gap_analysis_runs (status,completed_at)
      SELECT 'failed', now()-n*interval '1 hour' FROM generate_series(1,6) AS n`)
    assert.deepEqual(await getDistinctMovieCollectionIds(), [10])
    const successful = await runLibraryGapAnalysis()
    const retained = await query<{ status: string; count: number }>('SELECT status, count(*)::int AS count FROM gap_analysis_runs GROUP BY status')
    assert.deepEqual(Object.fromEntries(retained.rows.map(row => [row.status, row.count])), { completed: 2, failed: 5, running: 1 })
    assert.equal(successful.totalParts, 2)
    assert.equal(successful.ownedParts, 1)
    assert.equal(successful.missingCount, 1)
    mode = 'unavailable'
    await assert.rejects(runLibraryGapAnalysis(), /Could not retrieve TMDb collection/)
    assert.equal((await getLatestCompletedGapRun())?.id, successful.runId)
    assert.equal((await getGapCollectionSummaries(successful.runId))[0].missingCount, 1)
    mode = 'success'
    await query("INSERT INTO system_settings VALUES ('seerr_url','https://seerr.invalid'),('seerr_api_key','test'),('seerr_enabled','true')")
    await assert.rejects(runLibraryGapAnalysis(), /Seerr status unavailable/)
    assert.equal((await getLatestCompletedGapRun())?.id, successful.runId)
    await query("INSERT INTO discovery_requests (user_id,tmdb_id,media_type,status) VALUES ($1,2,'movie','submitted')", [randomUUID()])
    assert.deepEqual(await getGapCollectionSummaries(successful.runId), [])
    assert.equal((await listGapResults({ runId: successful.runId, userId: randomUUID(), page: NaN, pageSize: Infinity })).total, 0)
    assert.equal((await getGapCollectionParts(successful.runId, [10])).get(10)?.parts.find(p => p.tmdbId === 2)?.seerrStatus, 'requested')
    await query("UPDATE discovery_requests SET status='failed'")
    assert.equal((await getGapCollectionSummaries(successful.runId))[0].missingCount, 1)
    await query("INSERT INTO movies VALUES ('2',NULL)")
    assert.deepEqual(await getGapCollectionSummaries(successful.runId), [])
    assert.equal((await listGapResults({ runId: successful.runId, userId: randomUUID() })).total, 0)
    assert.equal((await getGapCollectionParts(successful.runId, [10])).get(10)?.parts.find(p => p.tmdbId === 2)?.inLibrary, true)
    mode = 'not_found'
    assert.equal((await runLibraryGapAnalysis()).totalParts, 0)
  } finally {
    fetchMock.mock.restore()
    await closePool()
    await bootstrap.query(`DROP SCHEMA ${schema} CASCADE`)
    await bootstrap.end()
  }
})
