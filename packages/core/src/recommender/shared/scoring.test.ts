import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateBaseScore, calculateNoveltyScore, applyDislikePenalty } from './scoring.js'
import { applyDiversitySelection } from './selection.js'
import { averageEmbeddings } from './embeddings.js'
import { getPool, closePool } from '../../lib/db.js'
import { getEffectiveAlgorithmConfig, getSmartDiversityWeight } from '../../lib/userAlgorithmSettings.js'

test('selection applies configured weights once', () => {
  const weights = { similarityWeight: 0.4, noveltyWeight: 0.2, ratingWeight: 0.2 }
  const candidate = {
    id: 'one', title: 'One', year: 2026, genres: ['Drama'],
    similarity: 0.8, novelty: 0.5, ratingScore: 0.7, diversityBoost: 0,
    finalScore: calculateBaseScore(0.8, 0.5, 0.7, weights),
  }
  const { selected } = applyDiversitySelection([candidate], 1, 0.2)
  const expected = 0.8 * 0.4 + 0.5 * 0.2 + 0.7 * 0.2 + 1 * 0.2
  assert.ok(Math.abs(selected[0].finalScore - expected) < 1e-12)
  assert.equal(calculateBaseScore(1, 1, 1, { similarityWeight: 0, noveltyWeight: 0, ratingWeight: 0 }), 0)
})

test('similarity-only ranking rewards the closer match', () => {
  const weights = { similarityWeight: 1, noveltyWeight: 0, ratingWeight: 0 }
  assert.ok(calculateBaseScore(0.9, 0, 0, weights) > calculateBaseScore(0.3, 1, 1, weights))
  assert.equal(calculateNoveltyScore(['Drama'], new Map(), 0), 0.5)
})

test('dislike penalties never improve a positive or negative score', () => {
  assert.ok(Math.abs(applyDislikePenalty(1, 1, 'penalize') - 0.2) < 1e-12)
  assert.ok(applyDislikePenalty(-0.5, 3, 'penalize') < -0.5)
  assert.equal(applyDislikePenalty(1, 4, 'penalize'), 1)
  assert.equal(applyDislikePenalty(1, undefined, 'penalize'), 1)
  assert.equal(applyDislikePenalty(1, 1, 'exclude'), 1)
})

test('weighted history produces a normalized vector favoring stronger signals', () => {
  const vector = averageEmbeddings([[1, 0], [0, 1]], [3, 1])
  assert.ok(Math.abs(vector[0] - 3 / Math.sqrt(10)) < 1e-12)
  assert.ok(Math.abs(vector[1] - 1 / Math.sqrt(10)) < 1e-12)
})

test('custom diversity uses the normalized effective weight', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  const mock = t.mock.method(getPool(), 'query', async (sql: string) => {
    const rows = sql.includes('FROM recommendation_config') ? [] : [
      { settings: { algorithmSettings: { enabled: true, movie: {
        similarityWeight: 1, noveltyWeight: 0, ratingWeight: 0, diversityWeight: 1,
      } } } },
    ]
    return { rows, rowCount: rows.length }
  })
  try {
    const config = await getEffectiveAlgorithmConfig('user', 'movie')
    assert.equal(config.diversityWeight, 0.5)
    assert.equal(await getSmartDiversityWeight('user', 'movie', config.diversityWeight), 0.5)
  } finally {
    mock.mock.restore()
    await closePool()
  }
})

test('automatic diversity reads the diversity statistic without full taste analysis', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const mock = t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params })
    let rows: unknown[]
    if (sql.includes('SELECT settings FROM user_preferences')) {
      rows = [{ settings: { excludedLibraryIds: ['excluded-source'] } }]
    } else if (sql.includes('FROM system_settings')) {
      rows = [{ value: JSON.stringify({ embeddings: { provider: 'openai', model: 'text-embedding-3-small' } }) }]
    } else if (sql.includes('avg_distance')) {
      rows = [{ avg_distance: '0.65' }]
    } else {
      throw new Error(`Unexpected query ${sql}`)
    }
    return { rows, rowCount: rows.length }
  })
  try {
    for (const mediaType of ['movie', 'series'] as const) {
      const before = calls.length
      assert.equal(await getSmartDiversityWeight('user', mediaType, 0.2), 0.24)
      assert.equal(calls.length - before, 5)
      assert.deepEqual(calls.at(-1)?.params, ['user', 'openai:text-embedding-3-small', ['excluded-source']])
    }
  } finally {
    mock.mock.restore()
    await closePool()
  }
})
