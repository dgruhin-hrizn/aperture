import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPool, closePool } from '../../lib/db.js'
import { generateSeriesRecommendationsForUser } from './pipeline.js'

test('TV generation honors saved dislike behavior independently of rewatching', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  const stopBeforeSaving = new Error('Scoring captured before saving')
  let includeWatched = true
  let behavior = 'exclude'
  let stored: unknown[] = []
  const mock = t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    let rows: unknown[] = []
    if (sql.includes('INSERT INTO recommendation_candidates')) {
      stored = params
      throw stopBeforeSaving
    } else if (sql.includes('INSERT INTO recommendation_runs')) {
      rows = [{ id: 'run' }]
    } else if (sql.includes('FROM recommendation_config') || sql.includes('UPDATE recommendation_runs')
      || sql.includes('INSERT INTO user_preferences') || sql.includes('FROM user_custom_interests')
      || sql.includes('FROM user_genre_weights')) {
      rows = []
    } else if (sql.includes('SELECT settings FROM user_preferences')) {
      rows = [{ settings: { algorithmSettings: { enabled: true, series: { diversityWeight: 0 } } } }]
    } else if (sql.includes('FROM user_taste_profiles')) {
      rows = [{ embedding: '[1,0]', embedding_model: 'openai:text-embedding-3-small',
        auto_updated_at: new Date(), refresh_interval_days: 30, is_locked: false }]
    } else if (sql.includes('FROM system_settings')) {
      const settings: Record<string, string> = {
        ai_config: JSON.stringify({ embeddings: { provider: 'openai', model: 'text-embedding-3-small' } }),
        media_server_type: 'jellyfin', media_server_base_url: 'http://localhost:8096', media_server_api_key: 'test',
      }
      rows = [{ value: settings[params[0] as string] }]
    } else if (sql.includes('SELECT include_watched')) {
      rows = [{ include_watched: includeWatched, dislike_behavior: behavior,
        settings: { dislikeBehavior: behavior === 'exclude' ? 'penalize' : 'exclude' } }]
    } else if (sql.includes('FROM user_ratings')) {
      rows = [{ series_id: 'disliked', rating: 1 }]
    } else if (sql.includes('WITH watched AS')) {
      rows = [{ id: 'watched' }]
    } else if (sql.includes('1 - (se.embedding')) {
      rows = ['watched', 'disliked', 'preferred', 'other'].map((id, index) => ({
        series_id: id, title: id, year: 2026, genres: ['Drama'],
        community_rating: 7, similarity: 1 - index * 0.1, previously_suggested: false,
      }))
    } else if (sql.includes('SELECT genres FROM series')) {
      rows = [{ genres: ['Drama'] }]
    } else if (sql.includes('COUNT(DISTINCT wh.episode_id)')) {
      rows = [{ series_id: 'watched', episodes_watched: 1, total_episodes: 10,
        has_favorites: false, last_played_at: new Date() }]
    } else {
      throw new Error(`Unexpected query ${sql}`)
    }
    return { rows, rowCount: rows.length }
  })
  try {
    const generate = () => generateSeriesRecommendationsForUser(
      { id: 'user', username: 'Test', providerUserId: '' },
      { selectedCount: 4, maxCandidates: 10, similarityWeight: 1, noveltyWeight: 0, ratingWeight: 0, diversityWeight: 0 }
    )
    await assert.rejects(generate(), (err) => err === stopBeforeSaving)
    assert.deepEqual(stored[1], ['watched', 'preferred', 'other'])

    includeWatched = false
    await assert.rejects(generate(), (err) => err === stopBeforeSaving)
    assert.deepEqual(stored[1], ['preferred', 'other'])

    includeWatched = true
    behavior = 'penalize'
    await assert.rejects(generate(), (err) => err === stopBeforeSaving)
    const ids = stored[1] as string[]
    const scores = stored[7] as number[]
    assert.deepEqual(ids, ['watched', 'preferred', 'other', 'disliked'])
    assert.ok(Math.abs(scores[ids.indexOf('disliked')] - 0.18) < 1e-12)
  } finally {
    mock.mock.restore()
    await closePool()
  }
})
