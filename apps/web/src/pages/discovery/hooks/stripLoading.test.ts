import assert from 'node:assert/strict'
import { test, afterEach } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { wrap, tick } from '../../../test/uiHarness'
import { useStripStatuses } from './useStripStatuses'
import { usePersonPortrait } from '../../../hooks/usePersonPortrait'

const originalFetch = globalThis.fetch
let renderer: ReactTestRenderer | undefined
afterEach(async () => {
  await act(async () => renderer?.unmount())
  renderer = undefined
  globalThis.fetch = originalFetch
})

test('cached TMDb portraits display immediately without calling Emby or a profile lookup', async () => {
  let current!: ReturnType<typeof usePersonPortrait>
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    throw Error('Unexpected lookup')
  }
  function Probe() {
    current = usePersonPortrait({
      personName: 'Cached Person',
      tmdbImageUrl: 'https://image.tmdb.org/t/p/w185/cached.jpg',
    })
    return null
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe)))
    await tick()
  })
  assert.equal(current.displaySrc, 'https://image.tmdb.org/t/p/w185/cached.jpg')
  assert.equal(calls, 0)
  await act(async () => {
    current.onImageError()
    await tick()
  })
  assert.equal(current.phase, 'none')
  assert.equal(calls, 0)
})

test('availability batches dedupe overlapping strips, keep movie/TV IDs separate and reject old account responses', async () => {
  let current!: ReturnType<typeof useStripStatuses>
  const requests: {
    body: { items: { tmdbId: number; mediaType: string }[] }
    signal: AbortSignal
    resolve: (r: Response) => void
  }[] = []
  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((resolve) =>
      requests.push({
        body: JSON.parse(String(init?.body)),
        signal: init?.signal as AbortSignal,
        resolve,
      })
    )
  function Probe({ ids }: { ids: number[] }) {
    current = useStripStatuses(
      ids.flatMap((id) => [
        { tmdbId: id, mediaType: 'movie' as const },
        { tmdbId: id, mediaType: 'series' as const },
      ]),
      true,
      'view'
    )
    return null
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe, { ids: [1, 1] }), 'strip-a'))
    await tick()
  })
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0].body.items, [
    { tmdbId: 1, mediaType: 'movie' },
    { tmdbId: 1, mediaType: 'series' },
  ])
  assert.deepEqual(current, {}, 'strip content does not wait for availability')
  await act(async () => {
    renderer!.update(wrap(React.createElement(Probe, { ids: [1, 2] }), 'strip-a'))
    await tick()
  })
  assert.deepEqual(requests[1].body.items, [
    { tmdbId: 2, mediaType: 'movie' },
    { tmdbId: 2, mediaType: 'series' },
  ])
  await act(async () => {
    renderer!.update(wrap(React.createElement(Probe, { ids: [1] }), 'strip-b'))
    await tick()
  })
  assert.equal(requests[0].signal.aborted, true)
  await act(async () => {
    requests[0].resolve(Response.json({ statusesByMedia: { 'movie:1': { requested: true } } }))
    await tick()
  })
  assert.deepEqual(current, {})
  await act(async () => {
    requests[2].resolve(
      Response.json({ statusesByMedia: { 'movie:1': { requested: false, status: 'available' } } })
    )
    await tick()
  })
  assert.equal(current['movie:1'].status, 'available')
  assert.equal(current['tv:1'], undefined)
})

test('portrait loading stays dormant offscreen, dedupes reads and aborts obsolete lookups', async () => {
  let current!: ReturnType<typeof usePersonPortrait>
  const calls: { url: string; signal: AbortSignal; resolve: (r: Response) => void }[] = []
  globalThis.fetch = async (input, init) =>
    new Promise<Response>((resolve) =>
      calls.push({ url: String(input), signal: init?.signal as AbortSignal, resolve })
    )
  function Probe({ name, enabled }: { name: string; enabled: boolean }) {
    current = usePersonPortrait({
      personName: name,
      enabled,
    })
    return null
  }
  await act(async () => {
    renderer = create(
      wrap(React.createElement(Probe, { name: 'First', enabled: false }), 'portrait-a')
    )
    await tick()
  })
  assert.equal(current.displaySrc, undefined)
  await act(async () => {
    current.onImageError()
    await tick()
  })
  assert.equal(calls.length, 0)
  await act(async () => {
    renderer!.update(
      wrap(React.createElement(Probe, { name: 'First', enabled: true }), 'portrait-a')
    )
    await tick()
  })
  await act(async () => {
    current.onImageError()
    current.onImageError()
    await tick()
  })
  assert.equal(calls.length, 1)
  await act(async () => {
    renderer!.update(
      wrap(React.createElement(Probe, { name: 'Second', enabled: true }), 'portrait-a')
    )
    await tick()
  })
  assert.equal(calls[0].signal.aborted, true)
  await act(async () => {
    calls[0].resolve(Response.json({ imageUrl: 'https://image.tmdb.org/t/p/w185/old.jpg' }))
    await tick()
  })
  assert.equal(current.phase, 'pending-tmdb')
  assert.ok(!String(current.displaySrc ?? '').includes('old.jpg'))
})
