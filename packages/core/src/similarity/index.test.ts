import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closePool, getPool } from '../lib/db.js'
import { getSimilarMovies, getSimilarSeries, getGraphForSource, semanticSearch } from './index.js'
import { parseValidationReply, validateConnection } from './diverse.js'

const watched = '00000000-0000-0000-0000-000000000002'
const source = '00000000-0000-0000-0000-000000000001'

test('similar views honor watched preferences before limiting, and mixed search can fill from either type', async (t) => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/aperture_test'
  let hideWatched = true
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const item = { id: source, title: 'Source', year: 2000, genres: ['Drama'], directors: [], actors: [], studios: [], keywords: [] }
  const dbMock = t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params })
    let rows: unknown[] = []
    if (sql.includes('FROM system_settings')) rows = [{ value: JSON.stringify({ embeddings: { provider: 'openai', model: 'text-embedding-3-small', apiKey: 'test', baseUrl: 'https://embedding.invalid/v1' } }) }]
    else if (sql.includes('FROM user_preferences')) rows = [{ similarity_hide_watched: hideWatched }]
    else if (sql.includes('WITH watched AS MATERIALIZED')) rows = [{ id: watched }]
    else if (sql.includes('embedding::text')) rows = [{ embedding: '[1,0]' }]
    else if (sql.includes('WHERE id = $1')) rows = [item]
    else if (sql.includes('m.community_rating IS NOT NULL')) rows = [3, 4].map(id => ({ ...item, id: `00000000-0000-0000-0000-00000000000${id}` }))
    else if (sql.includes('JOIN movies')) rows = [0.99, 0.98, 0.97, 0.96].map((similarity, i) => ({ ...item, id: `movie-${i}`, similarity }))
    return { rows, rowCount: rows.length }
  })
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({
    data: [{ object: 'embedding', index: 0, embedding: [1, 0] }], model: 'text-embedding-3-small',
    usage: { prompt_tokens: 1, total_tokens: 1 },
  }))
  try {
    for (const getSimilar of [getSimilarMovies, getSimilarSeries]) {
      await getSimilar(source, { userId: 'user', limit: 3 })
      assert.deepEqual(calls.at(-1)?.params.at(-1), [watched])
      assert.match(calls.at(-1)!.sql, /AND NOT \([ms]\.id = ANY\(\$5::uuid\[\]\)\)[\s\S]*LIMIT \$4/)
      hideWatched = false
      await getSimilar(source, { userId: 'user', limit: NaN })
      assert.deepEqual(calls.at(-1)?.params.at(-1), [])
      assert.equal(calls.at(-1)?.params[3], 12)
      hideWatched = true
    }
    const start = calls.length
    await getSimilarMovies(source, { userId: 'user', watchedIds: new Set([watched]) })
    assert.ok(!calls.slice(start).some(call => call.sql.includes('FROM user_preferences')))
    const graphStart = calls.length
    await getGraphForSource('top-movies', 'user', { limit: 2 })
    assert.equal(calls.slice(graphStart).filter(call => call.sql.includes('FROM user_preferences')).length, 1)
    assert.equal(calls.slice(graphStart).filter(call => call.sql.includes('WITH watched AS MATERIALIZED')).length, 1)
    const result = await semanticSearch('a drama', { type: 'both', limit: 4, userId: 'user', hideWatched: true })
    assert.equal(result.results.length, 4, 'an empty TV pool does not waste half of the results')
    assert.deepEqual(result.results.map(r => r.similarity), [0.99, 0.98, 0.97, 0.96])
    const searches = calls.filter(call => call.sql.includes('WHERE e.model = $2'))
    assert.equal(searches.length, 2)
    for (const call of searches) {
      assert.equal(call.params[2], 4)
      assert.match(call.sql, /wh.played = true/)
      assert.match(call.sql, /wh.playback_position_ticks/)
    }
  } finally { fetchMock.mock.restore(); dbMock.mock.restore(); await closePool() }
})

// Validation failures must never become permanent negative recommendations.

test('AI graph validation accepts explicit judgments and never caches provider outages', async (t) => {
  assert.deepEqual(parseValidationReply('  YES - shared themes\n'), { isValid: true, reason: 'shared themes' })
  assert.deepEqual(parseValidationReply('```text\nNO: different tone\n```'), { isValid: false, reason: 'different tone' })
  assert.equal(parseValidationReply('I could not compare these titles'), null)
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/aperture_test'
  const calls: string[] = []
  const dbMock = t.mock.method(getPool(), 'query', async (sql: string) => {
    calls.push(sql)
    assert.ok(sql.startsWith('SELECT'), 'unavailable model judgment must not be persisted')
    return { rows: [] }
  })
  const item = { id: source, title: 'One', year: 2000, poster_url: null, type: 'movie' as const,
    genres: ['Drama'], directors: [], actors: [], collection_name: 'First saga', network: null, keywords: [], studios: [] }
  try {
    for (let i = 0; i < 2; i++) {
      assert.equal((await validateConnection(item, { ...item, id: watched, title: 'Two', collection_name: 'Another story' })).reason, 'AI validation unavailable')
    }
    assert.equal(calls.filter(sql => sql.includes('FROM similarity_validation_cache')).length, 2)
  } finally { dbMock.mock.restore(); await closePool() }
})
