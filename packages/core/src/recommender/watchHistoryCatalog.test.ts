import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPool, closePool } from '../lib/db.js'
import { EmbyProvider } from '../media/emby/EmbyProvider.js'
import { syncWatchHistoryForAllUsers, syncWatchHistoryForUser } from './movies/sync.js'
import { syncSeriesWatchHistoryForAllUsers, syncSeriesWatchHistoryForUser } from './series/watchHistorySync.js'

test('sync jobs share catalog identities while isolating user state and refreshing missing titles', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const users = [{ id: 'user-a', provider_user_id: 'provider-a', username: 'A' },
    { id: 'user-b', provider_user_id: 'provider-b', username: 'B' }]
  let media: 'movie' | 'series' = 'movie'
  let imported = false
  let fullCatalogLoads = 0
  let targetedLoads = 0
  const writes = new Map<string, unknown[]>()
  const removals = new Map<string, string[]>()
  const identity = (suffix: string, library: string) => ({ id: suffix, provider_item_id: 'provider-' + suffix,
    provider_library_id: library, tmdb_id: suffix, imdb_id: 'imdb-' + suffix, tvdb_id: 'tvdb-' + suffix,
    runtime_minutes: 45, series_id: 'show', season_number: 1, episode_number: suffix === 'a' ? 1 : suffix === 'b' ? 2 : 3 })
  const watch = (suffix: string) => ({ movieId: 'provider-' + suffix, episodeId: 'provider-' + suffix,
    seriesId: 'provider-show', seasonNumber: 1, episodeNumber: suffix === 'a' ? 1 : suffix === 'b' ? 2 : 3,
    playCount: 1, isFavorite: false, played: true })
  const history = (userId: string) => userId === 'provider-a'
    ? [watch('a'), { ...watch('b'), isFavorite: true },
      { ...watch('b'), movieId: 'alias-b', episodeId: 'alias-b', tmdbId: media === 'movie' ? 'b' : 'show',
        seriesId: 'old-show-id', playCount: 3 }]
    : [{ ...watch('a'), playCount: 7 }, watch('c')]
  t.mock.method(EmbyProvider.prototype, 'getUsers', async () => users.map((user) => ({ id: user.provider_user_id, name: user.username })))
  t.mock.method(EmbyProvider.prototype, 'getWatchHistory', async (_key: string, userId: string) => history(userId))
  t.mock.method(EmbyProvider.prototype, 'getSeriesWatchHistory', async (_key: string, userId: string) => history(userId))
  const queryMock = t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    let rows: unknown[] = []
    if (sql.includes('FROM system_settings')) {
      const settings: Record<string, string> = { media_server_type: 'emby',
        media_server_base_url: 'http://localhost:8096', media_server_api_key: 'test' }
      rows = [{ value: settings[params[0] as string] }]
    } else if (sql.includes('FROM users WHERE provider_user_id IS NOT NULL')) {
      rows = users
    } else if (sql.includes('watch_history_synced_at FROM users')) {
      rows = [{ watch_history_synced_at: null, series_watch_history_synced_at: null }]
    } else if (sql.includes('SELECT settings FROM user_preferences')) {
      rows = [{ settings: { excludedLibraryIds: params[0] === 'user-a' ? ['kids'] : [] } }]
    } else if (sql.includes('FROM movies WHERE provider_item_id IS NOT NULL')) {
      if (sql.includes('ANY')) {
        targetedLoads++
        imported = true
        rows = [identity('c', 'main')]
      } else {
        fullCatalogLoads++
        rows = [identity('a', 'kids'), identity('b', 'main'), ...(imported ? [identity('c', 'main')] : [])]
      }
    } else if (sql.includes('FROM series WHERE provider_item_id IS NOT NULL')) {
      rows = [{ ...identity('show', 'main') }]
    } else if (sql.includes('FROM episodes e JOIN series s')) {
      if (sql.includes('ANY')) {
        targetedLoads++
        imported = true
        rows = [identity('c', 'main')]
      } else {
        fullCatalogLoads++
        rows = [identity('a', 'kids'), identity('b', 'main'), ...(imported ? [identity('c', 'main')] : [])]
      }
    } else if (sql.startsWith('SELECT ') && sql.includes('FROM watch_history WHERE user_id')) {
      const field = media === 'movie' ? 'movie_id' : 'episode_id'
      rows = ['a', 'b', ...(params[0] === 'user-a' ? ['imported-during-job'] : [])].map((id) => ({ [field]: id }))
    } else if (sql.includes('INSERT INTO watch_history')) {
      writes.set(params[0] as string, params)
      return { rows: [], rowCount: (params[1] as string[]).length }
    } else if (sql.includes('DELETE FROM watch_history')) {
      removals.set(params[0] as string, params[1] as string[])
      return { rows: [], rowCount: (params[1] as string[]).length }
    } else if (sql.includes('UPDATE users SET') || sql.includes('INSERT INTO job_runs')) {
      rows = []
    } else {
      throw new Error(`Unexpected query ${sql}`)
    }
    return { rows, rowCount: rows.length }
  })
  try {
    for (const kind of ['movie', 'series'] as const) {
      media = kind
      imported = false
      fullCatalogLoads = 0
      targetedLoads = 0
      const allUsers = kind === 'movie' ? syncWatchHistoryForAllUsers : syncSeriesWatchHistoryForAllUsers
      const oneUser = kind === 'movie' ? syncWatchHistoryForUser : syncSeriesWatchHistoryForUser
      const result = await allUsers(undefined, true)
      assert.equal(result.success, 2)
      assert.equal(result.failed, 0)
      assert.equal(fullCatalogLoads, 1)
      assert.equal(targetedLoads, 1)
      assert.deepEqual(writes.get('user-a')?.[1], ['b'])
      assert.deepEqual(writes.get('user-a')?.[2], [3])
      assert.deepEqual(writes.get('user-a')?.[4], [true])
      assert.deepEqual(writes.get('user-a')?.[7], [45 * 600000000])
      assert.deepEqual(writes.get('user-b')?.[1], ['a', 'c'])
      assert.deepEqual(writes.get('user-b')?.[2], [7, 1])
      assert.deepEqual(removals.get('user-a'), ['a'])
      assert.deepEqual(removals.get('user-b'), ['b'])

      await allUsers(undefined, false)
      assert.equal(fullCatalogLoads, 2, 'Each new job should load a fresh catalog')
      await oneUser('user-a', 'provider-a', false)
      assert.equal(fullCatalogLoads, 3, 'Individual syncs should load their own catalog')
    }
  } finally {
    t.mock.timers.tick(600001)
    queryMock.mock.restore()
    await closePool()
  }
})
