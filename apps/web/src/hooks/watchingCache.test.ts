import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { useContext } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { browserFixture, tick, wrap } from '../test/uiHarness'
import { WatchingProvider } from './WatchingContext'
import { WatchingContext, type WatchingContextValue } from './watching-context'

let fixture: ReturnType<typeof browserFixture>,
  renderer: ReactTestRenderer | undefined,
  current: WatchingContextValue
const originalFetch = globalThis.fetch
beforeEach(() => {
  fixture = browserFixture()
})
afterEach(async () => {
  await act(async () => renderer?.unmount())
  renderer = undefined
  fixture.restore()
  globalThis.fetch = originalFetch
})
function Probe() {
  current = useContext(WatchingContext)!
  return null
}
const tree = (id: string) =>
  wrap(React.createElement(WatchingProvider, null, React.createElement(Probe)), id)

test('legacy ownerless cache is retired; a new user never sees the previous user’s list', async () => {
  localStorage.setItem(
    'aperture_watching_cache',
    JSON.stringify({ version: 1, timestamp: Date.now(), series: [{ seriesId: 'leaked' }] })
  )
  let finish!: (r: Response) => void
  globalThis.fetch = async () => Response.json({ series: [{ seriesId: 'a-only', id: 'one' }] })
  await act(async () => {
    renderer = create(tree('user-a'))
    await tick()
  })
  assert.equal(current.isWatching('a-only'), true)
  assert.equal(localStorage.getItem('aperture_watching_cache'), null)
  globalThis.fetch = async () =>
    new Promise((resolve) => {
      finish = resolve
    })
  await act(async () => {
    renderer!.update(tree('user-b'))
    await tick()
  })
  assert.equal(current.isWatching('a-only'), false)
  assert.deepEqual(current.series, [])
  await act(async () => {
    finish(Response.json({ series: [{ seriesId: 'b-only' }] }))
    await tick()
  })
  assert.equal(current.isWatching('b-only'), true)
  assert.equal(current.isWatching('a-only'), false)
})
test('cached metadata requires current server membership before display', async () => {
  localStorage.setItem(
    'aperture_watching_v2:user-c',
    JSON.stringify({
      version: 2,
      userId: 'user-c',
      timestamp: Date.now(),
      series: [{ seriesId: 'removed' }],
    })
  )
  const calls: string[] = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return Response.json(
      String(url).endsWith('/ids') ? { seriesIds: ['new'] } : { series: [{ seriesId: 'new' }] }
    )
  }
  await act(async () => {
    renderer = create(tree('user-c'))
    await tick()
  })
  assert.deepEqual(calls, ['/api/watching/ids', '/api/watching?includeUpcoming=false'])
  assert.equal(current.isWatching('removed'), false)
  assert.equal(current.isWatching('new'), true)
})
test('matching membership uses only the cheap validation request', async () => {
  const cachedAt = Date.now() - 60_000
  localStorage.setItem(
    'aperture_watching_v2:user-d',
    JSON.stringify({
      version: 2,
      userId: 'user-d',
      timestamp: cachedAt,
      series: [{ seriesId: 'kept' }],
    })
  )
  const calls: string[] = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return Response.json({ seriesIds: ['kept'] })
  }
  await act(async () => {
    renderer = create(tree('user-d'))
    await tick()
  })
  assert.deepEqual(calls, ['/api/watching/ids'])
  assert.equal(current.isWatching('kept'), true)
  assert.equal(
    JSON.parse(localStorage.getItem('aperture_watching_v2:user-d')!).timestamp,
    cachedAt,
    'membership checks must not extend metadata TTL'
  )
})
test('failed validation withholds cached data rather than displaying an unchecked list', async () => {
  localStorage.setItem(
    'aperture_watching_v2:user-e',
    JSON.stringify({
      version: 2,
      userId: 'user-e',
      timestamp: Date.now(),
      series: [{ seriesId: 'private' }],
    })
  )
  globalThis.fetch = async () => new Response(null, { status: 403 })
  await act(async () => {
    renderer = create(tree('user-e'))
    await tick()
  })
  assert.deepEqual(current.series, [])
  assert.equal(current.loading, false)
  assert.ok(current.error)
})
