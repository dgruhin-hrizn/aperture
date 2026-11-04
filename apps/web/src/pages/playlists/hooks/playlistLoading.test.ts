import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { browserFixture, tick, wrap } from '../../../test/uiHarness'
import { usePlaylistsData } from './usePlaylistsData'
import type { Channel } from '../types'

let fixture: ReturnType<typeof browserFixture>,
  renderer: ReactTestRenderer | undefined,
  current: ReturnType<typeof usePlaylistsData>
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
  current = usePlaylistsData()
  return null
}

test('playlist page loads only its lists; opening the editor fetches examples in one summary request and defers genres', async () => {
  const calls: string[] = []
  globalThis.fetch = async (input) => {
    const url = String(input)
    calls.push(url)
    if (url === '/api/channels') return Response.json({ channels: [] })
    if (url === '/api/graph-playlists') return Response.json({ playlists: [] })
    if (url.startsWith('/api/movies/summaries'))
      return Response.json({
        movies: [
          { id: 'one', title: 'First' },
          { id: 'two', title: 'Second' },
        ],
      })
    return Response.json({ genres: [] })
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe)))
    await tick()
  })
  assert.deepEqual(calls.sort(), ['/api/channels', '/api/graph-playlists'])
  const channel = { name: 'Example', example_movie_ids: ['one', 'two'] } as Channel
  await act(async () => {
    await current.handleOpenDialog(channel)
    await tick()
  })
  assert.equal(calls.filter((url) => url.startsWith('/api/movies/summaries')).length, 1)
  assert.equal(calls.filter((url) => /^\/api\/movies\/(one|two)$/.test(url)).length, 0)
  assert.ok(calls.includes('/api/genres'))
  assert.equal(current.formData.exampleMovies.length, 2)
})
test('graph playlists can finish loading independently of a pending channels request', async () => {
  globalThis.fetch = async (input) =>
    String(input) === '/api/channels'
      ? new Promise(() => {})
      : Response.json({ playlists: [{ id: 'graph', name: 'Graph' }] })
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe)))
    await tick()
  })
  assert.equal(current.loadingGraph, false)
  assert.equal(current.graphPlaylists.length, 1)
  assert.equal(current.loading, true)
})
test('closing an editor cancels its pending example lookup and prevents it reopening', async () => {
  let finish!: (r: Response) => void
  globalThis.fetch = async (input) =>
    String(input).startsWith('/api/movies/summaries')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Response.json({ channels: [], playlists: [] })
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe)))
    await tick()
  })
  let pending!: Promise<void>
  await act(async () => {
    pending = current.handleOpenDialog({ example_movie_ids: ['one'] } as Channel)
    await tick()
  })
  await act(async () => current.handleCloseDialog())
  await act(async () => {
    finish(Response.json({ movies: [] }))
    await pending
    await tick()
  })
  assert.equal(current.dialogOpen, false)
})
