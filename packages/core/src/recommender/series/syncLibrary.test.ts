import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { getJobProgress, type LogEntry } from '../../jobs/progress.js'
import { getPool } from '../../lib/db.js'
import { syncSeries } from './syncLibrary.js'

const settings: Record<string, string> = {
  media_server_type: 'emby',
  media_server_base_url: 'http://emby.test',
  media_server_api_key: 'fixture-key',
}
const animeLibrary = '8243'
const otherLibrary = '9000'

function mockSeriesSync(
  t: TestContext,
  failure: 'large-page' | 'persistent' | 'overlap' | 'unauthorized'
) {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  t.mock.timers.enable({ apis: ['setTimeout'] })

  const requests: [libraryId: string, offset: number, limit: number][] = []
  const writtenEpisodes: string[] = []
  const cleanups: { libraryId: string; seen: string[] }[] = []
  const db = t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    let rows: unknown[] = []
    if (sql.includes('FROM system_settings')) {
      rows = [{ value: settings[params[0] as string] }]
    } else if (sql.includes('FROM library_config')) {
      rows = [animeLibrary, otherLibrary].map((id) => ({ provider_library_id: id }))
    } else if (sql.startsWith('SELECT id, provider_item_id FROM series')) {
      rows = [animeLibrary, otherLibrary].map((id) => ({ id, provider_item_id: `series-${id}` }))
    } else if (sql.startsWith('INSERT INTO episodes') || sql.startsWith('UPDATE episodes')) {
      const episodeIds = params[0] as string[]
      writtenEpisodes.push(...episodeIds)
      rows = episodeIds.map(() => ({ xmax: '0' }))
    } else if (sql.startsWith('DELETE FROM episodes')) {
      cleanups.push({ libraryId: params[0] as string, seen: params[1] as string[] })
    }
    return { rows, rowCount: rows.length }
  })

  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input)
    assert.equal(url.pathname, '/Items')
    const libraryId = url.searchParams.get('ParentId')!
    const startIndex = Number(url.searchParams.get('StartIndex'))
    const limit = Number(url.searchParams.get('Limit'))
    const seriesId = `series-${libraryId}`
    if (url.searchParams.get('IncludeItemTypes') === 'Series') {
      return Response.json({
        Items: [{ Id: seriesId, Name: seriesId }],
        TotalRecordCount: 1,
        StartIndex: startIndex,
      })
    }

    requests.push([libraryId, startIndex, limit])
    assert.equal(url.searchParams.get('SortBy'), 'SeriesSortName,SortName')
    if (libraryId === animeLibrary && startIndex === 2000) {
      if (failure === 'unauthorized')
        return new Response('', { status: 401, statusText: 'Unauthorized' })
      if (failure === 'persistent' || limit > 250) {
        return new Response("Exception of type 'SQLitePCL.pretty.SQLiteException' was thrown.", {
          status: 500,
          statusText: 'Internal Server Error',
        })
      }
    }

    const total = libraryId === animeLibrary ? 2510 : 2
    const items = Array.from({ length: Math.min(limit, total - startIndex) }, (_, index) => {
      const offset = startIndex + index
      const number = failure === 'overlap' && offset === 2250 ? offset : offset + 1
      return {
        Id: `${libraryId}-${number}`,
        SeriesId: seriesId,
        Name: `Episode ${number}`,
        ParentIndexNumber: 1,
        IndexNumber: number,
      }
    })
    return Response.json({ Items: items, TotalRecordCount: total, StartIndex: startIndex })
  })

  return { requests, writtenEpisodes, cleanups, db }
}

test('series sync retries an Emby episode page at the same offset and retains its new limit only for that library', async (t) => {
  const { requests, writtenEpisodes, cleanups } = mockSeriesSync(t, 'large-page')
  const result = await syncSeries('recovered')

  assert.deepEqual(
    requests.filter(([, offset]) => offset >= 2000),
    [
      [animeLibrary, 2000, 1000],
      [animeLibrary, 2000, 250],
      [animeLibrary, 2250, 250],
      [animeLibrary, 2500, 250],
    ]
  )
  assert.deepEqual(
    requests.filter(([id]) => id === otherLibrary),
    [
      [otherLibrary, 0, 1],
      [otherLibrary, 0, 1000],
    ]
  )
  const animeEpisodes = Array.from({ length: 2510 }, (_, index) => `${animeLibrary}-${index + 1}`)
  assert.deepEqual(writtenEpisodes, [...animeEpisodes, '9000-1', '9000-2'])
  assert.deepEqual(cleanups[0], { libraryId: animeLibrary, seen: animeEpisodes })
  assert.equal(result.episodesAdded, 2512)
  const logs = getJobProgress(result.jobId)?.logs ?? []
  assert.ok(
    logs.some(
      ({ message }) =>
        message.includes('HTTP 500 (SQLiteException)') &&
        message.includes('Retrying with page size 250')
    )
  )
  assert.ok(logs.some(({ message }) => message.includes('offset 2000 returned 250 episodes')))
})

test('series sync fails without stale cleanup when Emby rejects even a one-episode page', async (t) => {
  const { requests, db } = mockSeriesSync(t, 'persistent')
  await assert.rejects(
    syncSeries('unrecoverable'),
    /HTTP 500 \(SQLiteException\).*library 8243 at offset 2000 with page size 1\. Check the Emby Server log around \d{4}-\d{2}-\d{2}T[\d:.]+Z/
  )
  assert.deepEqual(
    requests.filter(([, offset]) => offset >= 2000).map(([, offset, limit]) => [offset, limit]),
    [
      [2000, 1000],
      [2000, 250],
      [2000, 62],
      [2000, 15],
      [2000, 3],
      [2000, 1],
    ]
  )
  assert.ok(db.mock.calls.every(({ arguments: [sql] }) => !sql.startsWith('DELETE')))
  const jobRun = db.mock.calls.find(({ arguments: [sql] }) =>
    sql.startsWith('INSERT INTO job_runs')
  )
  const params = jobRun?.arguments[1]
  assert.equal(params?.[1], 'failed')
  assert.equal(params?.[7], getJobProgress('unrecoverable')?.error)
  const { logs } = JSON.parse(String(params?.[8])) as { logs: LogEntry[] }
  assert.deepEqual(logs.find(({ data }) => data?.limit === 1000)?.data, {
    libraryId: animeLibrary,
    startIndex: 2000,
    limit: 1000,
    nextLimit: 250,
    status: 500,
    serverException: 'SQLiteException',
  })
})

test('series sync does not shrink pages on Emby authentication failures', async (t) => {
  const { requests } = mockSeriesSync(t, 'unauthorized')
  await assert.rejects(syncSeries('unauthorized'), /Emby API error: 401 Unauthorized/)
  assert.deepEqual(
    requests.filter(([, offset]) => offset >= 2000),
    [[animeLibrary, 2000, 1000]]
  )
})

test('series sync skips stale episode cleanup if page boundaries overlap after a retry', async (t) => {
  const { cleanups } = mockSeriesSync(t, 'overlap')
  const result = await syncSeries('overlap')
  assert.deepEqual(
    cleanups.map(({ libraryId }) => libraryId),
    [otherLibrary]
  )
  assert.ok(
    getJobProgress(result.jobId)?.logs.some(({ message }) =>
      message.includes('2510 episodes (2509 unique)')
    )
  )
})
