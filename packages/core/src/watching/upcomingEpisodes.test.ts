import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { closePool, getPool } from '../lib/db.js'
import {
  getUpcomingEpisodeBatch,
  getUpcomingEpisodes,
  getUpcomingEpisodeForSeries,
} from './upcomingEpisodes.js'
process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1/unused'
const originalFetch = globalThis.fetch
let originalQuery: ReturnType<typeof getPool>['query'], apiKey: string | null, configReads: number
let local: unknown[], series: { id: string; tmdb_id: string | null }[], queries: string[]
const future = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
const forecast = () => ({
  next_episode_to_air: {
    name: 'New episode',
    overview: null,
    air_date: future(),
    season_number: 2,
    episode_number: 3,
  },
})
beforeEach(() => {
  apiKey = randomUUID()
  configReads = 0
  local = []
  series = []
  queries = []
  const pool = getPool()
  originalQuery = pool.query
  Object.assign(pool, {
    query: async (sql: string, params: unknown[]) => {
      queries.push(sql)
      if (sql.includes('FROM episodes')) return { rows: local }
      if (sql.includes('FROM series'))
        return { rows: series.filter((row) => (params[0] as string[]).includes(row.id)) }
      if (sql.includes('FROM system_settings')) {
        configReads++
        return { rows: apiKey ? [{ value: apiKey }] : [] }
      }
      throw Error('Unexpected SQL')
    },
  })
  globalThis.fetch = async () => Response.json(forecast())
})
afterEach(async () => {
  Object.assign(getPool(), { query: originalQuery })
  globalThis.fetch = originalFetch
  await closePool()
})

test('local-only lists make no TMDb/configuration reads and keep local episodes first', async () => {
  const id = randomUUID()
  series = [{ id, tmdb_id: '1' }]
  local = [
    {
      series_id: id,
      season_number: 1,
      episode_number: 4,
      title: 'Local',
      overview: null,
      premiere_date: new Date(future()),
    },
  ]
  globalThis.fetch = async () => {
    throw Error('Must not contact TMDb')
  }
  const result = await getUpcomingEpisodes([id], { localOnly: true })
  assert.equal(result.get(id)?.source, 'emby')
  assert.equal(result.get(id)?.airDate, future())
  assert.equal(configReads, 0)
  assert.equal(queries.length, 1)
})
test('overlapping batches share public forecasts with at most four remote reads and one config query per batch', async () => {
  series = Array.from({ length: 12 }, (_, n) => ({ id: randomUUID(), tmdb_id: String(n + 1) }))
  let active = 0,
    peak = 0,
    calls = 0
  globalThis.fetch = async () => {
    calls++
    peak = Math.max(peak, ++active)
    await new Promise((resolve) => setTimeout(resolve, 45))
    active--
    return Response.json(forecast())
  }
  const ids = series.map((row) => row.id)
  const [a, b] = await Promise.all([
    getUpcomingEpisodeBatch(ids),
    getUpcomingEpisodeBatch(ids.slice(3)),
  ])
  assert.equal(calls, 12)
  assert.ok(peak > 1 && peak <= 4)
  assert.equal(a.episodes.size, 12)
  assert.equal(b.episodes.size, 9)
  assert.equal(a.resolvedSeriesIds.length, 12)
  assert.equal(configReads, 2)
  await getUpcomingEpisodeBatch(ids)
  assert.equal(calls, 12, 'warm reads must make no upstream calls')
})
test('confirmed no-upcoming results are cached, but upstream failures remain unresolved and retryable', async () => {
  const id = randomUUID()
  series = [{ id, tmdb_id: '201' }]
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ next_episode_to_air: null })
  }
  assert.deepEqual((await getUpcomingEpisodeBatch([id])).resolvedSeriesIds, [id])
  await getUpcomingEpisodeBatch([id])
  assert.equal(calls, 1)
  apiKey = randomUUID()
  globalThis.fetch = async () => {
    calls++
    return new Response(null, { status: 503 })
  }
  assert.deepEqual((await getUpcomingEpisodeBatch([id])).resolvedSeriesIds, [])
  assert.deepEqual((await getUpcomingEpisodeBatch([id])).resolvedSeriesIds, [])
  assert.equal(calls, 3)
})
test('API-key changes and removal are honored, and a missing TMDb ID is resolved without remote calls', async () => {
  const id = randomUUID(),
    missing = randomUUID()
  series = [
    { id, tmdb_id: '202' },
    { id: missing, tmdb_id: null },
  ]
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json(forecast())
  }
  await getUpcomingEpisodeBatch([id, missing])
  assert.equal(calls, 1)
  apiKey = randomUUID()
  await getUpcomingEpisodeBatch([id])
  assert.equal(calls, 2)
  apiKey = null
  const disabled = await getUpcomingEpisodeBatch([id, missing])
  assert.equal(disabled.episodes.size, 0)
  assert.equal(disabled.resolvedSeriesIds.length, 2)
  assert.equal(calls, 2)
})
test('single-series and batch helpers share forecasts; duplicate TMDb IDs retain each Aperture series ID', async () => {
  const a = randomUUID(),
    b = randomUUID()
  series = [
    { id: a, tmdb_id: '203' },
    { id: b, tmdb_id: '203' },
  ]
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json(forecast())
  }
  assert.equal((await getUpcomingEpisodeForSeries(a, '203'))?.seriesId, a)
  const batch = await getUpcomingEpisodeBatch([a, b, a])
  assert.equal(calls, 1)
  assert.equal(batch.episodes.size, 2)
  assert.equal(batch.episodes.get(b)?.seriesId, b)
})
test('past TMDb dates do not appear as upcoming and are cached as confirmed absence', async () => {
  const id = randomUUID()
  series = [{ id, tmdb_id: '204' }]
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    const data = forecast()
    data.next_episode_to_air.air_date = '2000-01-01'
    return Response.json(data)
  }
  assert.equal((await getUpcomingEpisodeBatch([id])).episodes.size, 0)
  assert.deepEqual((await getUpcomingEpisodeBatch([id])).resolvedSeriesIds, [id])
  assert.equal(calls, 1)
})
test('interactive lookup timeouts are single-attempt and never cached as no episodes', async (t) => {
  const id = randomUUID()
  series = [{ id, tmdb_id: '205' }]
  let calls = 0
  const timeout = AbortSignal.timeout
  const deadlines: number[] = []
  t.mock.method(AbortSignal, 'timeout', (ms: number) => {
    deadlines.push(ms)
    return timeout(ms)
  })
  globalThis.fetch = async () => {
    calls++
    throw new DOMException('Slow upstream', 'TimeoutError')
  }
  assert.deepEqual((await getUpcomingEpisodeBatch([id])).resolvedSeriesIds, [])
  await getUpcomingEpisodeBatch([id])
  assert.equal(calls, 2)
  assert.deepEqual(deadlines, [5000, 5000])
})
