import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { browserFixture, tick } from '../../../test/uiHarness'
import { useMediaDetail } from './useMediaDetail'

let fixture: ReturnType<typeof browserFixture>, renderer: ReactTestRenderer | undefined
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

test('primary movie renders while optional similar titles, ratings and watch statistics remain pending', async () => {
  let current!: ReturnType<typeof useMediaDetail>
  const calls: string[] = []
  globalThis.fetch = async (input) => {
    const url = String(input)
    calls.push(url)
    if (url === '/api/movies/one') return Response.json({ id: 'one', title: 'Movie' })
    if (url.endsWith('/watch-history/movies/one'))
      return Response.json({ isWatched: true, playCount: 3, lastWatched: '2026-01-01' })
    return new Promise(() => {})
  }
  function Probe() {
    current = useMediaDetail('movie', 'one', 'viewer')
    return null
  }
  await act(async () => {
    renderer = create(React.createElement(Probe))
    await tick()
  })
  assert.equal(current.media?.title, 'Movie')
  assert.equal(current.loading, false)
  assert.equal(current.watchStatus?.isWatched, true)
  assert.equal(
    calls.some((url) => url.includes('pageSize=1000')),
    false
  )
  assert.ok(calls.includes('/api/ratings/movie/one'))
})
test('navigating to a different title cancels old optional requests and ignores late results', async () => {
  let current!: ReturnType<typeof useMediaDetail>,
    finish!: (r: Response) => void,
    signal!: AbortSignal
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url === '/api/movies/old') return Response.json({ id: 'old', title: 'Old' })
    if (url.startsWith('/api/movies/old/similar')) {
      signal = init!.signal!
      return new Promise((resolve) => {
        finish = resolve
      })
    }
    if (url === '/api/movies/new') return Response.json({ id: 'new', title: 'New' })
    return Response.json({ similar: [] })
  }
  function Probe({ id }: { id: string }) {
    current = useMediaDetail('movie', id, undefined)
    return null
  }
  await act(async () => {
    renderer = create(React.createElement(Probe, { id: 'old' }))
    await tick()
  })
  await act(async () => {
    renderer!.update(React.createElement(Probe, { id: 'new' }))
    await tick()
  })
  await act(async () => {
    finish(Response.json({ similar: [{ id: 'wrong' }] }))
    await tick()
  })
  assert.equal(signal.aborted, true)
  assert.equal(current.media?.title, 'New')
  assert.deepEqual(current.similar, [])
})
test('series details request only that series rating instead of downloading all ratings', async () => {
  const calls: string[] = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return Response.json({ id: 'show', title: 'Show', seasons: {}, similar: [] })
  }
  function Probe() {
    useMediaDetail('series', 'show', 'viewer')
    return null
  }
  await act(async () => {
    renderer = create(React.createElement(Probe))
    await tick()
  })
  assert.ok(calls.includes('/api/ratings/series/show'))
  assert.equal(calls.includes('/api/ratings'), false)
})
