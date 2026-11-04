import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  discoveryResource,
  filterQuery,
  invalidateDiscoveryCache,
  loadCandidates,
} from './discoveryRequests'
import { createStripQueue } from './stripQueue'

const originalFetch = globalThis.fetch
const tick = () => new Promise((resolve) => setImmediate(resolve))
afterEach(() => {
  globalThis.fetch = originalFetch
})
function storage() {
  const data: Record<string, string> = {}
  Object.defineProperties(data, {
    getItem: { value: (key: string) => data[key] ?? null },
    setItem: {
      value: (key: string, value: string) => {
        data[key] = value
      },
    },
    removeItem: {
      value: (key: string) => {
        delete data[key]
      },
    },
  })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: data })
}

test('candidate cache is user/filter/type scoped and always revalidated; denied access never restores rows', async () => {
  storage()
  let mode = 200
  const headers: Headers[] = []
  globalThis.fetch = async (_url, init) => {
    headers.push(new Headers(init?.headers))
    return mode === 200
      ? Response.json({ candidates: [], run: null }, { headers: { ETag: '"one"' } })
      : new Response(null, { status: mode })
  }
  const signal = new AbortController().signal
  await loadCandidates('user-a', 'movie', '', signal)
  mode = 304
  await loadCandidates('user-a', 'movie', '', signal)
  assert.equal(headers[1].get('If-None-Match'), '"one"')
  mode = 200
  await loadCandidates('user-b', 'movie', '', signal)
  await loadCandidates('user-a', 'series', '', signal)
  await loadCandidates('user-a', 'movie', '?genres=28', signal)
  assert.ok(headers.slice(2).every((h) => !h.has('If-None-Match')))
  mode = 403
  await assert.rejects(loadCandidates('user-a', 'movie', '', signal))
  mode = 200
  await loadCandidates('user-a', 'movie', '', signal)
  assert.equal(headers.at(-1)?.has('If-None-Match'), false)
  invalidateDiscoveryCache('user-a')
  assert.ok(Object.keys(localStorage).every((key) => !key.includes('user-a')))
})
test('equivalent filter ordering shares a cache key without altering caller preferences', () => {
  const filters = { languages: ['fr', 'en'], genreIds: [35, 28], includeUnknownLanguage: false }
  assert.equal(
    filterQuery(filters),
    '?languages=en%2Cfr&includeUnknownLanguage=false&genres=28%2C35'
  )
  assert.deepEqual(filters.genreIds, [35, 28])
})
test('config readers share one request; cancelling one reader preserves the other', async () => {
  let calls = 0
  let finish!: (r: Response) => void
  let upstream!: AbortSignal
  globalThis.fetch = async (_url, init) => {
    calls++
    upstream = init!.signal!
    return new Promise((resolve) => {
      finish = resolve
    })
  }
  const a = new AbortController(),
    b = new AbortController()
  const first = discoveryResource('a', '/config-shared', a.signal)
  const second = discoveryResource('a', '/config-shared', b.signal)
  a.abort()
  await assert.rejects(first)
  assert.equal(upstream.aborted, false)
  finish(Response.json({ ok: true }))
  assert.deepEqual(await second, { ok: true })
  assert.deepEqual(await discoveryResource('a', '/config-shared', b.signal), { ok: true })
  assert.equal(calls, 1)
})
test('leaving a resource aborts its unused request and another user does not reuse it', async () => {
  let signal!: AbortSignal
  globalThis.fetch = async (_url, init) => {
    signal = init!.signal!
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('abort')))
    )
  }
  const controller = new AbortController()
  const pending = discoveryResource('a', '/cancel-config', controller.signal)
  controller.abort()
  await assert.rejects(pending)
  assert.equal(signal.aborted, true)
  globalThis.fetch = async () => Response.json('other user')
  assert.equal(
    await discoveryResource('b', '/cancel-config', new AbortController().signal),
    'other user'
  )
})
test('row queue runs two at once, deduplicates active rows and ignores retired completions after reset', async () => {
  const started: string[] = []
  const finish = new Map<string, () => void>()
  const signals = new Map<string, AbortSignal>()
  const queue = createStripQueue(async (key, signal) => {
    started.push(key)
    signals.set(key, signal)
    await new Promise<void>((resolve) => finish.set(key, resolve))
  })
  queue.enqueue('a', () => true)
  queue.enqueue('a', () => true)
  queue.enqueue('b', () => true)
  queue.enqueue('c', () => true)
  await tick()
  assert.deepEqual(started, ['a', 'b'])
  queue.reset()
  assert.equal(signals.get('a')?.aborted, true)
  queue.enqueue('d', () => true)
  queue.enqueue('e', () => true)
  await tick()
  finish.get('a')!()
  finish.get('b')!()
  await tick()
  assert.deepEqual(started, ['a', 'b', 'd', 'e'])
  finish.get('d')!()
  finish.get('e')!()
  await tick()
})
