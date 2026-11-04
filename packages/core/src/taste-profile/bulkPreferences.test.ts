import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import pg from 'pg'
import { query, closePool } from '../lib/db.js'
import { bulkUpdateFranchisePreferences, bulkUpdateGenreWeights } from './index.js'

const fixtureUrl = process.env.APERTURE_TEST_DATABASE_URL

test('batched preferences preserve overrides, duplicate ordering, resets and atomicity', { skip: !fixtureUrl }, async () => {
  const url = new URL(fixtureUrl!)
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.startsWith('/aperture_test'))
  const schema = 'aperture_' + randomUUID().replaceAll('-', '')
  const bootstrap = new pg.Client({ connectionString: url.toString() })
  await bootstrap.connect()
  await bootstrap.query(`CREATE SCHEMA ${schema}`)
  url.searchParams.set('options', `-c search_path=${schema}`)
  process.env.DATABASE_URL = url.toString()
  const first = randomUUID()
  const second = randomUUID()
  const franchise = (name: string, items: number, engagement: number, mediaType: 'movie' | 'series' | 'both' = 'movie') => ({
    franchiseName: name, mediaType, preferenceScore: -0.8, itemsWatched: items, totalEngagement: engagement,
  })
  try {
    const migration = await readFile(new URL('../../../../db/migrations/0085_user_taste_profiles.sql', import.meta.url), 'utf8')
    await query('CREATE TABLE users (id UUID PRIMARY KEY)')
    for (const table of ['user_franchise_preferences', 'user_genre_weights']) {
      const ddl = migration.match(new RegExp(`CREATE TABLE ${table} \\([\\s\\S]*?\\n\\);`))
      assert.ok(ddl)
      await query(ddl[0])
    }
    await query('INSERT INTO users VALUES ($1), ($2)', [first, second])
    await query(`INSERT INTO user_genre_weights (user_id, genre, weight, is_user_set)
      VALUES ($1, 'Drama', 1.7, true), ($1, 'Action', 0.8, false), ($2, 'Drama', 1.4, true)`, [first, second])
    await query(`INSERT INTO user_franchise_preferences
      (user_id, franchise_name, media_type, preference_score, is_user_set, items_watched, total_engagement)
      VALUES ($1, 'Saga', 'movie', 0.9, true, 2, 3), ($1, 'Saga', 'series', 0.7, true, 3, 6),
        ($1, 'Shared', 'both', 0.4, true, 1, 2), ($2, 'Saga', 'movie', 0.8, true, 1, 1)`, [first, second])

    assert.equal(await bulkUpdateGenreWeights(first, [
      { genre: 'Drama', weight: 0 }, { genre: 'Action', weight: 3 }, { genre: 'Comedy', weight: -1 },
    ]), 2)
    assert.deepEqual((await query('SELECT genre, weight::float, is_user_set FROM user_genre_weights WHERE user_id=$1 ORDER BY genre', [first])).rows, [
      { genre: 'Action', weight: 2, is_user_set: false }, { genre: 'Comedy', weight: 0, is_user_set: false },
      { genre: 'Drama', weight: 1.7, is_user_set: true },
    ])
    assert.equal(await bulkUpdateFranchisePreferences(first, [franchise('Saga', 4, 8), franchise('Auto', 1, 2)]), 2)
    let manual = (await query("SELECT preference_score::float, is_user_set, items_watched, total_engagement FROM user_franchise_preferences WHERE user_id=$1 AND franchise_name='Saga' AND media_type='movie'", [first])).rows[0]
    assert.deepEqual(manual, { preference_score: 0.9, is_user_set: true, items_watched: 4, total_engagement: 8 })
    assert.equal(await bulkUpdateFranchisePreferences(first, [franchise('Saga', 4, 99)]), 0)

    assert.equal(await bulkUpdateGenreWeights(first, [{ genre: 'Action', weight: 0.3 }, { genre: 'Action', weight: 0.5 }]), 2)
    assert.equal(await bulkUpdateFranchisePreferences(first, [franchise('Saga', 5, 15), franchise('Saga', 4, 16)]), 2)
    manual = (await query("SELECT total_engagement FROM user_franchise_preferences WHERE user_id=$1 AND franchise_name='Saga' AND media_type='movie'", [first])).rows[0]
    assert.equal(manual.total_engagement, 16)

    const snapshot = async () => (await query('SELECT * FROM user_genre_weights ORDER BY user_id, genre')).rows
    const before = await snapshot()
    const tooLarge = Array.from({ length: 1000 }, (_, i) => ({ genre: `Genre ${i}`, weight: 1 }))
    await assert.rejects(bulkUpdateGenreWeights(first, [...tooLarge, { genre: null as unknown as string, weight: 1 }], true))
    assert.deepEqual(await snapshot(), before)
    assert.equal(await bulkUpdateGenreWeights(first, tooLarge), 1000)

    const franchisesBefore = (await query('SELECT * FROM user_franchise_preferences ORDER BY id')).rows
    await assert.rejects(bulkUpdateFranchisePreferences(first, [franchise(null as unknown as string, 1, 1)], true, 'movie'))
    assert.deepEqual((await query('SELECT * FROM user_franchise_preferences ORDER BY id')).rows, franchisesBefore)
    assert.equal(await bulkUpdateFranchisePreferences(first, [franchise('Replacement', 2, 5)], true, 'movie'), 1)
    assert.deepEqual((await query('SELECT franchise_name, media_type FROM user_franchise_preferences WHERE user_id=$1 ORDER BY franchise_name', [first])).rows, [
      { franchise_name: 'Replacement', media_type: 'movie' }, { franchise_name: 'Saga', media_type: 'series' },
      { franchise_name: 'Shared', media_type: 'both' },
    ])

    await Promise.all([
      bulkUpdateGenreWeights(first, [{ genre: 'Concurrent A', weight: 1 }], true),
      bulkUpdateGenreWeights(first, [{ genre: 'Concurrent B', weight: 1 }], true),
    ])
    const concurrent = (await query('SELECT genre FROM user_genre_weights WHERE user_id=$1', [first])).rows
    assert.equal(concurrent.length, 1)
    assert.ok(['Concurrent A', 'Concurrent B'].includes(concurrent[0].genre as string))
    assert.equal(await bulkUpdateGenreWeights(first, [], true), 0)
    assert.equal((await query('SELECT * FROM user_genre_weights WHERE user_id=$1', [first])).rowCount, 0)
    assert.equal((await query('SELECT weight::float FROM user_genre_weights WHERE user_id=$1', [second])).rows[0].weight, 1.4)
    assert.equal((await query('SELECT preference_score::float FROM user_franchise_preferences WHERE user_id=$1', [second])).rows[0].preference_score, 0.8)
  } finally {
    await closePool()
    await bootstrap.query(`DROP SCHEMA ${schema} CASCADE`)
    await bootstrap.end()
  }
})
