import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import React, { useContext, useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { browserFixture, tick, wrap } from '../test/uiHarness'
import { WatchingProvider } from './WatchingContext'
import { WatchingContext, type WatchingContextValue, type WatchingSeries } from './watching-context'
let fixture: ReturnType<typeof browserFixture>,
  renderer: ReactTestRenderer | undefined,
  current: WatchingContextValue
const originalFetch = globalThis.fetch
const row = (id = randomUUID()) =>
  ({ seriesId: id, id, title: 'Series', upcomingEpisode: null }) as WatchingSeries
const next = () => ({
  title: 'Episode',
  seasonNumber: 1,
  episodeNumber: 2,
  airDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  source: 'tmdb',
})
function Probe({ upcoming = false }: { upcoming?: boolean }) {
  current = useContext(WatchingContext)!
  const subscribe = current.subscribeUpcoming
  useEffect(() => (upcoming ? subscribe() : undefined), [upcoming, subscribe])
  return null
}
const tree = (upcoming = false, id = 'user-a') =>
  wrap(React.createElement(WatchingProvider, null, React.createElement(Probe, { upcoming })), id)
beforeEach(() => {
  fixture = browserFixture()
})
afterEach(async () => {
  await act(async () => renderer?.unmount())
  renderer = undefined
  fixture.restore()
  globalThis.fetch = originalFetch
})
test('ordinary pages load only local list data; episode demand renders rows before pending enrichment', async () => {
  const rows = [row()]
  const calls: string[] = []
  let finish!: (response: Response) => void
  globalThis.fetch = async (url) => {
    const path = String(url)
    calls.push(path)
    return path.includes('/upcoming?')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Response.json({ series: rows })
  }
  await act(async () => {
    renderer = create(tree())
    await tick()
  })
  assert.deepEqual(calls, ['/api/watching?includeUpcoming=false'])
  assert.equal(current.loading, false)
  assert.equal(current.series.length, 1)
  await act(async () => {
    renderer!.update(tree(true))
    await tick()
  })
  assert.equal(current.loading, false)
  assert.equal(current.upcomingLoading, true)
  await act(async () => {
    finish(
      Response.json({
        seriesIds: [rows[0].seriesId],
        resolvedSeriesIds: [rows[0].seriesId],
        episodes: { [rows[0].seriesId]: next() },
      })
    )
    await tick()
  })
  assert.equal(current.upcomingLoading, false)
  assert.equal(current.series[0].upcomingEpisode?.title, 'Episode')
})
test('small batches settle independently with two browser reads maximum', async () => {
  const rows = Array.from({ length: 23 }, () => row())
  const pending: { ids: string[]; finish: (response: Response) => void }[] = []
  let active = 0,
    peak = 0
  globalThis.fetch = async (url) => {
    if (!String(url).includes('/upcoming?')) return Response.json({ series: rows })
    const ids = new URL(String(url), 'http://test').searchParams.get('seriesIds')!.split(',')
    peak = Math.max(peak, ++active)
    return new Promise((resolve) =>
      pending.push({
        ids,
        finish: (response) => {
          active--
          resolve(response)
        },
      })
    )
  }
  await act(async () => {
    renderer = create(tree(true))
    await tick()
  })
  assert.equal(pending.length, 2)
  assert.ok(pending.every((p) => p.ids.length === 10))
  const resolveBatch = (p: (typeof pending)[number]) =>
    p.finish(
      Response.json({
        seriesIds: p.ids,
        resolvedSeriesIds: p.ids,
        episodes: Object.fromEntries(p.ids.map((id) => [id, next()])),
      })
    )
  await act(async () => {
    resolveBatch(pending[0])
    await tick()
  })
  assert.equal(current.series.filter((s) => s.upcomingEpisode).length, 10)
  assert.equal(current.upcomingLoading, true)
  assert.equal(pending.length, 3)
  assert.equal(pending[2].ids.length, 3)
  await act(async () => {
    resolveBatch(pending[1])
    resolveBatch(pending[2])
    await tick()
  })
  assert.equal(current.series.filter((s) => s.upcomingEpisode).length, 23)
  assert.equal(peak, 2)
})
test('leaving an episode view cancels optional reads and account changes ignore late results', async () => {
  const a = row(),
    b = row()
  let finish!: (response: Response) => void, signal!: AbortSignal
  globalThis.fetch = async (url, init) =>
    String(url).includes('/upcoming?')
      ? new Promise((resolve) => {
          finish = resolve
          signal = init!.signal!
        })
      : Response.json({ series: [a] })
  await act(async () => {
    renderer = create(tree(true))
    await tick()
  })
  await act(async () => {
    renderer!.update(tree(false))
    await tick()
  })
  assert.equal(signal.aborted, true)
  assert.equal(current.upcomingLoading, false)
  globalThis.fetch = async () => Response.json({ series: [b] })
  await act(async () => {
    renderer!.update(tree(false, 'user-b'))
    await tick()
  })
  await act(async () => {
    finish(
      Response.json({
        seriesIds: [a.seriesId],
        resolvedSeriesIds: [a.seriesId],
        episodes: { [a.seriesId]: next() },
      })
    )
    await tick()
  })
  assert.equal(current.series[0].seriesId, b.seriesId)
  assert.equal(current.series[0].upcomingEpisode, null)
})
test('optional failures preserve known forecasts and support a read-only retry', async () => {
  const value = { ...row(), upcomingEpisode: next() } as WatchingSeries
  let failures = true
  globalThis.fetch = async (url) =>
    String(url).includes('/upcoming?')
      ? failures
        ? new Response(null, { status: 503 })
        : Response.json({
            seriesIds: [value.seriesId],
            resolvedSeriesIds: [value.seriesId],
            episodes: {},
          })
      : Response.json({ series: [value] })
  await act(async () => {
    renderer = create(tree(true))
    await tick()
  })
  assert.equal(current.loading, false)
  assert.equal(current.error, null)
  assert.equal(current.upcomingError, true)
  assert.equal(current.series[0].upcomingEpisode?.title, 'Episode')
  failures = false
  await act(async () => {
    current.refreshUpcoming()
    await tick()
  })
  assert.equal(current.upcomingError, false)
  assert.equal(current.series[0].upcomingEpisode, null)
})
test('fresh, owner-validated forecasts reuse cache; stale forecasts refresh without extending metadata lifetime', async () => {
  const value = { ...row(), upcomingEpisode: next() },
    timestamp = Date.now() - 60 * 60_000
  localStorage.setItem(
    'aperture_watching_v2:user-a',
    JSON.stringify({
      userId: 'user-a',
      version: 2,
      series: [value],
      timestamp,
      upcomingCheckedAt: Date.now() - 60_000,
    })
  )
  const calls: string[] = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return Response.json(
      String(url).endsWith('/ids')
        ? { seriesIds: [value.seriesId] }
        : { seriesIds: [value.seriesId], resolvedSeriesIds: [value.seriesId], episodes: {} }
    )
  }
  await act(async () => {
    renderer = create(tree(true))
    await tick()
  })
  assert.deepEqual(calls, ['/api/watching/ids'])
  await act(async () => {
    current.refreshUpcoming()
    await tick()
  })
  assert.equal(calls.length, 2)
  assert.equal(current.series[0].upcomingEpisode, null)
  assert.equal(
    JSON.parse(localStorage.getItem('aperture_watching_v2:user-a')!).timestamp,
    timestamp
  )
})
test('a batch rechecks membership and removes a no-longer-owned row before caching it again', async () => {
  const value = row()
  globalThis.fetch = async (url) =>
    String(url).includes('/upcoming?')
      ? Response.json({ seriesIds: [], resolvedSeriesIds: [], episodes: {} })
      : Response.json({ series: [value] })
  await act(async () => {
    renderer = create(tree(true))
    await tick()
  })
  assert.deepEqual(current.series, [])
  assert.equal(current.isWatching(value.seriesId), false)
  assert.deepEqual(JSON.parse(localStorage.getItem('aperture_watching_v2:user-a')!).series, [])
})
