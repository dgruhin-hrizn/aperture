import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPool, closePool } from '../lib/db.js'
import { listPeopleForBrowse } from './peopleBrowse.js'

process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
test('People shares page work but rechecks library visibility, separates filters and expires cached pages', async () => {
  const pool = getPool(),
    original = pool.query,
    now = Date.now
  let enabled = true,
    aggregates = 0,
    configReads = 0,
    time = now()
  Date.now = () => time
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT provider_library_id')) {
        configReads++
        return { rows: [{ provider_library_id: 'people-test', is_enabled: enabled }] }
      }
      if (sql.includes('FROM person_tmdb_profile_cache'))
        return { rows: [{ name_key: 'person', profile_path: '/profile.jpg' }] }
      aggregates++
      const visible = params.length === 3 || (params[3] as string[]).length > 0
      return {
        rows: [
          {
            name: visible && params[2] !== 499950 ? 'Person' : null,
            credits: 3,
            movie_credits: 2,
            series_credits: 1,
            full_total: visible ? '75' : '0',
          },
        ],
      }
    },
  })
  try {
    const [a, b] = await Promise.all([listPeopleForBrowse(), listPeopleForBrowse()])
    assert.deepEqual(a, b)
    assert.equal(a.total, 75)
    assert.equal(a.people[0].tmdbProfilePath, '/profile.jpg')
    assert.equal(aggregates, 1)
    assert.equal(configReads, 2)
    await listPeopleForBrowse()
    assert.equal(aggregates, 1)
    await listPeopleForBrowse({ page: 2 })
    await listPeopleForBrowse({ search: 'Pe' })
    await listPeopleForBrowse({ sortBy: 'credits' })
    assert.equal(aggregates, 4)
    const empty = await listPeopleForBrowse({ page: 10000 })
    assert.equal(empty.total, 75, 'an empty page must retain the real filtered count')
    assert.deepEqual(empty.people, [])
    enabled = false
    assert.deepEqual(
      (await listPeopleForBrowse()).people,
      [],
      'disabled sources cannot use an old cached page'
    )
    assert.equal((await listPeopleForBrowse({ showAll: true })).people.length, 1)
    enabled = true
    const before = aggregates
    await listPeopleForBrowse()
    assert.equal(aggregates, before)
    time += 30001
    await listPeopleForBrowse()
    assert.equal(aggregates, before + 1)
  } finally {
    Date.now = now
    Object.assign(pool, { query: original })
    await closePool()
  }
})
