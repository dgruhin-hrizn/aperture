import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getPool } from '../lib/db.js'
import { EmbyProvider } from '../media/emby/EmbyProvider.js'
import { setStrmConfigForTests } from './config.js'
import { writeStrmFilesForUser } from './movies/writer.js'
import { writeSeriesStrmFilesForUser } from './series/writer.js'
import { acknowledgeOutputRefresh } from './incrementalOutput.js'

async function fixture(t: TestContext) {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-publishing-'))
  t.after(async () => {
    setStrmConfigForTests(null)
    await fs.rm(root, { recursive: true, force: true })
  })
  setStrmConfigForTests({
    strmRoot: root,
    libraryRoot: root,
    libraryNamePrefix: 'AI Picks',
    libraryPathPrefix: '/generated',
    downloadImages: false,
    mediaServerPathPrefix: '/media',
    localMediaPathPrefix: path.join(root, 'source'),
  })
  const access = {
    allowed: true,
    failed: false,
    visible: new Set(['movie', 'ep-1', 'ep-2']),
    checks: 0,
  }
  const settings: Record<string, string> = {
    media_server_type: 'emby',
    media_server_base_url: 'http://publishing.test',
    media_server_api_key: 'fixture-key',
    ai_explanation_enabled: 'false',
  }
  t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    let rows: unknown[] = []
    if (sql.includes('FROM system_settings'))
      rows =
        settings[String(params[0])] === undefined ? [] : [{ value: settings[String(params[0])] }]
    else if (sql.includes('FROM recommendation_runs'))
      rows = [{ id: 'run', created_at: new Date('2026-11-01T10:00:00Z') }]
    else if (sql.includes('JOIN movies'))
      rows = [
        {
          movie_id: 'movie-db',
          provider_item_id: 'movie',
          provider_library_id: 'movies',
          title: 'Movie',
          year: 2020,
          path: '/media/Movie/movie.mkv',
          rank: 1,
          final_score: '0.9',
        },
      ]
    else if (sql.includes('JOIN series'))
      rows = [
        {
          series_id: 'series-db',
          provider_item_id: 'show',
          provider_library_id: 'tv',
          title: 'Show',
          year: 2020,
          rank: 1,
          final_score: '0.9',
        },
      ]
    else if (sql.includes('FROM episodes'))
      rows = [1, 2].map((number) => ({
        id: `ep-${number}`,
        provider_item_id: `ep-${number}`,
        season_number: 1,
        episode_number: number,
        title: `Episode ${number}`,
        path: `/media/Show/Season 01/episode-${number}.mkv`,
      }))
    else if (sql.includes('FROM library_config'))
      rows = [{ provider_library_id: sql.includes("'movies'") ? 'movies' : 'tv' }]
    else if (sql.includes('FROM strm_libraries'))
      rows = sql.includes('SELECT path,')
        ? [
            {
              path: `/generated/${sql.includes("'movies'") ? 'aperture' : 'aperture-tv'}/Viewer_viewer`,
              provider_library_id: sql.includes("'movies'") ? 'movie-output' : 'tv-output',
            },
          ]
        : [{ provider_library_id: 'movie-output' }, { provider_library_id: 'tv-output' }]
    else if (sql.includes('FROM user_preferences')) rows = [{ include_watched: true }]
    return { rows, rowCount: rows.length }
  })
  const libraries = [
    { ItemId: 'movies', Guid: 'movies-guid', Name: 'Movies', CollectionType: 'movies' },
    { ItemId: 'tv', Guid: 'tv-guid', Name: 'TV', CollectionType: 'tvshows' },
    {
      ItemId: 'movie-output',
      Id: 'movie-output',
      Guid: 'movie-output-guid',
      Name: 'Movie picks',
      CollectionType: 'movies',
      Locations: ['/generated/aperture/Viewer_viewer'],
      LibraryOptions: { EnableRealtimeMonitor: false },
    },
    {
      ItemId: 'tv-output',
      Id: 'tv-output',
      Guid: 'tv-output-guid',
      Name: 'TV picks',
      CollectionType: 'tvshows',
      Locations: ['/generated/aperture-tv/Viewer_viewer'],
      LibraryOptions: { EnableRealtimeMonitor: false },
    },
  ]
  t.mock.method(EmbyProvider.prototype, 'fetch', async (endpoint: string) => {
    if (endpoint === '/Library/VirtualFolders') return libraries
    if (endpoint === '/Library/VirtualFolders/LibraryOptions') return {}
    if (endpoint === '/Users')
      return [
        { Id: 'viewer', Name: 'Viewer', Policy: { IsAdministrator: false, IsDisabled: false } },
      ]
    if (endpoint === '/Users/viewer') {
      if (access.failed) throw new Error('Emby unavailable')
      return { Policy: { EnableAllFolders: access.allowed, EnabledFolders: [], IsDisabled: false } }
    }
    if (endpoint.startsWith('/Items?')) {
      access.checks++
      const ids = new URL(endpoint, 'http://publishing.test').searchParams.get('Ids')!.split(',')
      return {
        Items: ids
          .filter((id) => access.visible.has(id))
          .map((id) => ({
            Id: id,
            SeriesId: 'show',
            Path:
              id === 'movie'
                ? '/media/Movie/movie.mkv'
                : `/media/Show/Season 01/episode-${id.slice(-1)}.mkv`,
          })),
      }
    }
    throw new Error(`Unexpected fixture endpoint ${endpoint}`)
  })
  return { root, access }
}

test('movie publishing is unchanged across clock advances and still revalidates source access', async (t) => {
  const { access } = await fixture(t)
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-07T06:00:00Z').getTime() })
  const first = await writeStrmFilesForUser('viewer-db', 'viewer', 'Viewer')
  assert.equal(first.written, 1)
  const video = path.join(first.localPath, 'Movie (2020)', 'Movie (2020).mkv')
  const before = await fs.lstat(video)
  await acknowledgeOutputRefresh(first.localPath, first.revision)
  const checks = access.checks
  t.mock.timers.tick(3 * 60 * 60 * 1000)
  const second = await writeStrmFilesForUser('viewer-db', 'viewer', 'Viewer')
  assert.equal(second.changed, false)
  assert.equal(second.needsRefresh, false)
  assert.equal((await fs.lstat(video)).ino, before.ino)
  assert.ok(access.checks > checks, 'unchanged output must not skip authorization')
  access.allowed = false
  const revoked = await writeStrmFilesForUser('viewer-db', 'viewer', 'Viewer')
  assert.equal(revoked.written, 0)
  assert.equal(revoked.changed, true)
  assert.deepEqual(await fs.readdir(first.localPath), [])
})

test('series publishing preserves unchanged episodes and removes only episodes no longer visible', async (t) => {
  const { access } = await fixture(t)
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-07T06:00:00Z').getTime() })
  const first = await writeSeriesStrmFilesForUser('viewer-db', 'viewer', 'Viewer')
  assert.equal(first.seriesCount, 1)
  const season = path.join(first.localPath, 'Show (2020)', 'Season 01')
  const episode = path.join(season, 'Show S01E01 Episode 1.mkv')
  const before = await fs.lstat(episode)
  await acknowledgeOutputRefresh(first.localPath, first.revision)
  t.mock.timers.tick(3 * 60 * 60 * 1000)
  const second = await writeSeriesStrmFilesForUser('viewer-db', 'viewer', 'Viewer')
  assert.equal(second.changed, false)
  assert.equal(second.needsRefresh, false)
  access.visible.delete('ep-2')
  const revoked = await writeSeriesStrmFilesForUser('viewer-db', 'viewer', 'Viewer')
  assert.equal(revoked.changed, true)
  assert.equal((await fs.lstat(episode)).ino, before.ino)
  assert.deepEqual((await fs.readdir(season)).sort(), [
    'Show S01E01 Episode 1.mkv',
    'Show S01E01 Episode 1.nfo',
  ])
  access.failed = true
  const failed = await writeSeriesStrmFilesForUser('viewer-db', 'viewer', 'Viewer')
  assert.equal(failed.seriesCount, 0)
  assert.match(failed.withheldReason!, /Emby unavailable/)
  assert.deepEqual(await fs.readdir(first.localPath), [])
})
