import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { buildStarterTasteProfile, buildWeightedAverageEmbedding, calculateEngagementWeight } from './builder.js'
import { getUserTasteProfile } from './index.js'
import { closePool, getPool } from '../lib/db.js'

const database = process.env.APERTURE_TEST_DATABASE_URL

const items = [{ id: 'one', weight: 1 }, { id: 'two', weight: 1 }]

test('taste vectors depend on engagement rather than provider vector magnitude', () => {
  const normal = buildWeightedAverageEmbedding(items, new Map([['one', [1, 0]], ['two', [0, 1]]]))!
  const scaled = buildWeightedAverageEmbedding(items, new Map([['one', [100, 0]], ['two', [0, 0.01]]]))!
  normal.forEach((value, i) => assert.ok(Math.abs(value - scaled[i]) < 1e-10))
  assert.equal(buildWeightedAverageEmbedding(items, new Map([['one', [0, 0]], ['two', [NaN, 1]]])), null)
  assert.equal(buildWeightedAverageEmbedding(items, new Map([['one', [1, 0]], ['two', [-1, 0]]])), null)
})

test('future or invalid playback timestamps cannot inflate or corrupt taste weights', () => {
  const item = { id: 'one', title: 'One', playCount: 1, hasFavorites: false, genres: [], lastPlayedAt: null }
  const baseline = calculateEngagementWeight(item, 'movie')
  for (const date of [new Date('9999-01-01'), new Date('invalid')]) {
    assert.equal(calculateEngagementWeight({ ...item, lastPlayedAt: date }, 'movie'), baseline)
  }
})

test('locked profiles never reuse embeddings from a different model, even when stale', async (t) => {
  process.env.DATABASE_URL = database ?? 'postgresql://test:test@localhost/aperture_test'
  let model = 'openai:text-embedding-3-small'
  const mock = t.mock.method(getPool(), 'query', async (sql: string) => {
    if (sql.includes('FROM user_taste_profiles')) return { rows: [{
      id: 'profile', user_id: 'user', media_type: 'movie', embedding: '[1,0]', embedding_model: model,
      auto_updated_at: new Date(0), is_locked: true, refresh_interval_days: 30,
    }] }
    if (sql.includes('FROM system_settings')) return { rows: [{ value: JSON.stringify({ embeddings: { provider: 'openai', model: 'text-embedding-3-small' } }) }] }
    throw new Error(`Unexpected write or query: ${sql}`)
  })
  try {
    assert.equal((await getUserTasteProfile('user', 'movie'))?.isLocked, true)
    model = 'ollama:other-model'
    await assert.rejects(getUserTasteProfile('user', 'movie'), /Locked taste profile/)
  } finally { mock.mock.restore(); await closePool() }
})

test('starter picks use high ratings and current interests without watch history', { skip: !database }, async () => {
  const fixture = new URL(database!)
  assert.ok(['localhost', '127.0.0.1'].includes(fixture.hostname) && fixture.pathname.startsWith('/aperture_test'))
  process.env.DATABASE_URL = fixture.toString()
  const { runMigrations } = await import('../migrations.js')
  assert.equal((await runMigrations(fixture.toString(), new URL('../../../../db/migrations/', import.meta.url).pathname)).error, undefined)
  const pool = getPool(), userId = randomUUID(), loved = randomUUID(), disliked = randomUUID()
  const model = 'openai:text-embedding-3-small'
  const vector = (x: number, y: number) => JSON.stringify([x, y, ...Array(1534).fill(0)])
  try {
    await pool.query("INSERT INTO users(id,provider,provider_user_id,username) VALUES ($1::uuid,'emby',$1::uuid::text,'Starter fixture')", [userId])
    await pool.query("INSERT INTO movies(id,provider_item_id,title) VALUES ($1::uuid,$1::uuid::text,'Loved'),($2::uuid,$2::uuid::text,'Disliked')", [loved, disliked])
    await pool.query("INSERT INTO system_settings(key,value) VALUES ('ai_config',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
      [JSON.stringify({ embeddings: { provider: 'openai', model: 'text-embedding-3-small' } })])
    await pool.query("INSERT INTO user_ratings(user_id,movie_id,rating,source) VALUES ($1,$2,10,'manual'),($1,$3,1,'manual')", [userId, loved, disliked])
    await pool.query('INSERT INTO embeddings_1536(movie_id,model,embedding) VALUES ($1,$3,$4::halfvec),($2,$3,$5::halfvec)',
      [loved, disliked, model, vector(1, 0), vector(-1, -1)])
    await pool.query("INSERT INTO user_custom_interests(user_id,interest_text,embedding_model,embedding) VALUES ($1,'Mystery',$2,$3::halfvec),($1,'Outdated','other:model',$4::halfvec)",
      [userId, model, vector(0, 1), vector(-1, -1)])
    const starter = await buildStarterTasteProfile(userId, 'movie')
    assert.deepEqual(starter.seedIds, [loved])
    assert.ok(starter.embedding)
    assert.ok(Math.abs(starter.embedding[0] - Math.SQRT1_2) < 1e-8)
    assert.ok(Math.abs(starter.embedding[1] - Math.SQRT1_2) < 1e-8)
  } finally {
    await pool.query('DELETE FROM users WHERE id=$1', [userId])
    await pool.query('DELETE FROM movies WHERE id=ANY($1::uuid[])', [[loved, disliked]])
    await pool.query("DELETE FROM system_settings WHERE key='ai_config'")
    await closePool()
  }
})
