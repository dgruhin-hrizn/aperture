import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closePool, getPool } from '../../lib/db.js'
import {
  getCustomInterestBoost,
  getGenreBoost,
  loadPreferenceBoosts,
} from '../../taste-profile/index.js'
import { getCandidateEmbeddings } from './embeddings.js'

test('batched preference scoring preserves boosts and limits database reads', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  const calls: Array<{ sql: string; params: unknown[] }> = []
  let interests = [
    { embedding: '[1,0]', weight: '1', embedding_model: 'openai:text-embedding-3-small' },
    { embedding: '[0,1]', weight: '0.5', embedding_model: 'text-embedding-3-small' },
    { embedding: null, weight: '1', embedding_model: null },
    { embedding: '[]', weight: '1', embedding_model: 'openai:text-embedding-3-small' },
  ]
  const queryMock = t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params })
    let rows: unknown[]
    if (sql.includes('FROM user_genre_weights')) {
      rows = [{ genre: 'Drama', weight: '2' }, { genre: 'comedy', weight: '0' }]
    } else if (sql.includes('FROM user_custom_interests')) {
      rows = interests
    } else if (sql.includes('FROM user_franchise_preferences')) {
      rows = [{ preference_score: '-0.5' }]
    } else if (sql.includes('FROM system_settings')) {
      rows = [{ value: JSON.stringify({ embeddings: { provider: 'openai', model: 'text-embedding-3-small' } }) }]
    } else if (sql.includes('embedding::text')) {
      rows = [{ id: 'first', embedding: '[1,0]' }]
    } else {
      throw new Error(`Unexpected database query ${sql}`)
    }
    return { rows, rowCount: rows.length }
  })

  try {
    const boosts = await loadPreferenceBoosts('user-one', 'movie')
    assert.equal(calls.length, 3)
    assert.equal(boosts.hasCustomInterests, true)
    assert.equal(boosts.getGenreBoost(['DRAMA']), 1.5)
    assert.equal(boosts.getGenreBoost(['comedy']), 0.5)
    assert.equal(boosts.getGenreBoost(['Drama', 'Comedy']), 1)
    assert.equal(boosts.getCustomInterestBoost([1, 0]), 1.3)
    assert.equal(boosts.getCustomInterestBoost([0, 1]), 1.15)
    assert.equal(boosts.getCustomInterestBoost([-1, 0]), 1)
    assert.equal(boosts.getCustomInterestBoost([1]), 1)
    for (const genres of [[], ['DRAMA'], ['comedy'], ['Drama', 'Comedy'], ['Unknown']]) {
      assert.equal(boosts.getGenreBoost(genres), await getGenreBoost('user-one', genres))
    }
    for (const embedding of [[1, 0], [0, 1], [-1, 0], [0, 0], [1], [0.4, 1]]) {
      assert.equal(boosts.getCustomInterestBoost(embedding), await getCustomInterestBoost('user-one', embedding))
    }

    const before = calls.length
    assert.deepEqual(await Promise.all([
      boosts.getFranchiseBoost('Saga'), boosts.getFranchiseBoost('Saga'), boosts.getFranchiseBoost(null),
    ]), [0.75, 0.75, 1])
    assert.equal(calls.length - before, 1)
    assert.deepEqual(calls.at(-1)?.params, ['user-one', 'Saga', 'movie'])

    const secondRun = await loadPreferenceBoosts('user-two', 'series')
    await secondRun.getFranchiseBoost('Saga')
    assert.deepEqual(calls.at(-1)?.params, ['user-two', 'Saga', 'series'])

    interests = []
    const noInterests = await loadPreferenceBoosts('user-one', 'movie')
    assert.equal(noInterests.hasCustomInterests, false)
    assert.equal(noInterests.getCustomInterestBoost([1, 0]), 1)
    interests = [{ embedding: null, weight: '1', embedding_model: null }]
    assert.equal((await loadPreferenceBoosts('user-one', 'movie')).hasCustomInterests, false)
    interests = [{ embedding: '[1,0]', weight: '1', embedding_model: 'ollama:different-model' }]
    assert.equal((await loadPreferenceBoosts('user-one', 'movie')).hasCustomInterests, false)
    assert.equal(await getCustomInterestBoost('user-one', [1, 0]), 1)

    const beforeEmpty = calls.length
    assert.deepEqual(await getCandidateEmbeddings([], 'movie'), new Map())
    assert.equal(calls.length, beforeEmpty)
    for (const [mediaType, column, table] of [
      ['movie', 'movie_id', 'embeddings_1536'],
      ['series', 'series_id', 'series_embeddings_1536'],
    ] as const) {
      assert.deepEqual(await getCandidateEmbeddings(['first', 'missing'], mediaType), new Map([['first', [1, 0]]]))
      assert.match(calls.at(-1)!.sql, new RegExp(`SELECT ${column} AS id, embedding::text FROM ${table}`))
      assert.match(calls.at(-1)!.sql, /ANY\(\$1::uuid\[\]\) AND model = \$2/)
      assert.deepEqual(calls.at(-1)?.params, [['first', 'missing'], 'openai:text-embedding-3-small'])
    }
  } finally {
    queryMock.mock.restore()
    await closePool()
  }
})
