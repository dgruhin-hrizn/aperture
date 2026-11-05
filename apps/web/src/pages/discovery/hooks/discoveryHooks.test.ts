import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { AuthContext, type AuthContextType } from '../../../hooks/auth-context'
import { useDiscoveryData } from './useDiscoveryData'
import { useDiscoveryJobStatus } from './useDiscoveryJobStatus'
import type { DiscoveryFilterOptions, MediaType } from '../types'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalEventSource = globalThis.EventSource
const tick = () => new Promise((resolve) => setImmediate(resolve))
let renderer: ReactTestRenderer | undefined
let doc: EventTarget & { visibilityState: string }
beforeEach(() => {
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true })
  Object.defineProperty(globalThis, 'window', { value: doc, configurable: true })
  const data: Record<string, string> = {}
  Object.defineProperties(data, {
    getItem: { value: (k: string) => data[k] ?? null },
    setItem: {
      value: (k: string, v: string) => {
        data[k] = v
      },
    },
    removeItem: {
      value: (k: string) => {
        delete data[k]
      },
    },
  })
  Object.defineProperty(globalThis, 'localStorage', { value: data, configurable: true })
})
afterEach(async () => {
  await act(async () => renderer?.unmount())
  renderer = undefined
  globalThis.fetch = originalFetch
  Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true })
  Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true })
  globalThis.EventSource = originalEventSource
})
const enabledStatus = {
  enabled: true,
  requestEnabled: true,
  movieRun: null,
  seriesRun: null,
  movieCount: 50,
  seriesCount: 50,
}
const rows = (type: MediaType, count = 50) =>
  Array.from({ length: count }, (_, i) => ({
    tmdbId: i + 1,
    mediaType: type,
    id: `${type}-${i}`,
    title: `${type} ${i}`,
    finalScore: 1,
  }))
let current!: ReturnType<typeof useDiscoveryData>
function DataProbe({ filters, type }: { filters: DiscoveryFilterOptions; type: MediaType | null }) {
  current = useDiscoveryData(filters, type)
  return null
}
function probe(
  userId = 'a',
  type: MediaType | null = 'movie',
  filters: DiscoveryFilterOptions = {}
) {
  return React.createElement(
    AuthContext.Provider,
    { value: { user: { id: userId } } as AuthContextType },
    React.createElement(DataProbe, { filters, type })
  )
}

test('movies render before Seerr resolves; inactive TV and browse modes do not load saved picks', async () => {
  const calls: string[] = []
  let statusSignal!: AbortSignal
  globalThis.fetch = async (url, init) => {
    calls.push(String(url))
    if (String(url).endsWith('/status/batch')) {
      statusSignal = init!.signal!
      return new Promise(() => {})
    }
    if (String(url).endsWith('/status')) return Response.json(enabledStatus)
    return Response.json({ candidates: rows('movie'), run: null })
  }
  await act(async () => {
    renderer = create(probe())
    await tick()
  })
  assert.equal(current.loading, false)
  assert.equal(current.movieCandidates.length, 50)
  assert.equal(
    calls.some((url) => url.includes('/discovery/series')),
    false
  )
  assert.equal(statusSignal.aborted, false)
  await act(async () => {
    renderer!.update(probe('a', null))
    await tick()
  })
  assert.equal(statusSignal.aborted, true)
  assert.equal(current.loading, false)
  assert.equal(calls.filter((url) => url.includes('/discovery/movies')).length, 1)
})
test('optional Seerr failure leaves suggestions visible and request badges stay local', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/status/batch')) throw Error('Seerr offline')
    if (String(url).endsWith('/status')) return Response.json(enabledStatus)
    return Response.json({ candidates: rows('movie'), run: null })
  }
  await act(async () => {
    renderer = create(probe())
    await tick()
  })
  await act(async () => current.markAsRequested(1, 'movie'))
  assert.equal(current.loading, false)
  assert.equal(current.error, null)
  assert.equal(current.seerrStatus['movie:1'].requested, true)
  assert.equal(current.seerrStatus['tv:1'], undefined)
})
test('disabled Discovery makes no candidate or Seerr calls', async () => {
  const calls: string[] = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return Response.json({ ...enabledStatus, enabled: false })
  }
  await act(async () => {
    renderer = create(probe())
    await tick()
  })
  assert.deepEqual(calls, ['/api/discovery/status'])
  assert.equal(current.loading, false)
  assert.deepEqual(current.movieCandidates, [])
})
test('an account switch cannot display previous user rows while new requests wait', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/status/batch')) return Response.json({ statuses: {} })
    if (String(url).endsWith('/status')) return Response.json(enabledStatus)
    return Response.json({ candidates: rows('movie'), run: null })
  }
  await act(async () => {
    renderer = create(probe())
    await tick()
  })
  assert.equal(current.movieCandidates.length, 50)
  globalThis.fetch = async () => new Promise(() => {})
  await act(async () => {
    renderer!.update(probe('b'))
    await tick()
  })
  assert.deepEqual(current.movieCandidates, [])
  assert.equal(current.loading, true)
})
test('failed candidate requests end loading with an error instead of permanent skeletons', async () => {
  globalThis.fetch = async (url) =>
    String(url).endsWith('/status')
      ? Response.json(enabledStatus)
      : new Response(null, { status: 503 })
  await act(async () => {
    renderer = create(probe())
    await tick()
  })
  assert.equal(current.loading, false)
  assert.ok(current.error)
})

test('idle job polling uses sixty seconds and pauses completely while hidden', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ jobs: [] })
  }
  function Probe() {
    useDiscoveryJobStatus({ userId: 'poll-test' })
    return null
  }
  await act(async () => {
    renderer = create(React.createElement(Probe))
    await tick()
  })
  assert.equal(calls, 1)
  await act(async () => {
    t.mock.timers.tick(59_999)
    await tick()
  })
  assert.equal(calls, 1)
  await act(async () => {
    t.mock.timers.tick(1)
    await tick()
  })
  assert.equal(calls, 2)
  await act(async () => {
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    t.mock.timers.tick(120_000)
    await tick()
  })
  assert.equal(calls, 2)
  await act(async () => {
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await tick()
  })
  assert.equal(calls, 3)
})
test('successful SSE completion refreshes once; streams close on unmount', async () => {
  const sources: { onmessage?: (e: { data: string }) => void; closed: boolean }[] = []
  class Source {
    onmessage?: (e: { data: string }) => void
    closed = false
    constructor() {
      sources.push(this)
    }
    close() {
      this.closed = true
    }
  }
  globalThis.EventSource = Source as unknown as typeof EventSource
  const job = { jobId: 'one', jobName: 'generate-discovery-suggestions', status: 'running' }
  globalThis.fetch = async () => Response.json({ jobs: [job] })
  let completions = 0
  let running = false
  function Probe() {
    running = useDiscoveryJobStatus({
      userId: 'sse-test',
      onComplete: () => {
        completions++
      },
    }).isRunning
    return null
  }
  await act(async () => {
    renderer = create(React.createElement(Probe))
    await tick()
  })
  assert.equal(running, true)
  assert.equal(sources.length, 1)
  await act(async () => {
    sources[0].onmessage?.({ data: JSON.stringify({ ...job, status: 'completed' }) })
    await tick()
  })
  assert.equal(completions, 1)
  assert.equal(running, false)
  assert.equal(sources[0].closed, true)
})
