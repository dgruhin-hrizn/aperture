import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EmbyProviderBase } from './base.js'

test('bounds Emby requests across provider instances until response bodies finish', async (t) => {
  const complete: Array<() => void> = []
  let started = 0
  t.mock.method(globalThis, 'fetch', async () => {
    started++
    return new Response(
      new ReadableStream({
        start(controller) {
          complete.push(() => {
            controller.enqueue(new TextEncoder().encode('{}'))
            controller.close()
          })
        },
      })
    )
  })
  const a = new EmbyProviderBase('http://concurrency.test')
  const b = new EmbyProviderBase('http://concurrency.test')
  const requests = Array.from({ length: 5 }, (_, i) => (i % 2 ? a : b).fetch('/Items', 'fixture'))
  const results = Promise.all(requests)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(started, 4)
  complete[0]()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(started, 5)
  for (const done of complete.slice(1)) done()
  await results
})

test('aborts a stalled response body and releases the Emby request slot', async (t) => {
  class FastDeadlineProvider extends EmbyProviderBase {
    protected override readonly requestTimeoutMs = 15
  }
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, options: RequestInit) =>
      new Response(
        new ReadableStream({
          start(controller) {
            options.signal!.addEventListener(
              'abort',
              () => controller.error(new DOMException('Aborted', 'AbortError')),
              { once: true }
            )
          },
        })
      )
  )
  const provider = new FastDeadlineProvider('http://deadline.test')
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => provider.fetch('/Items', 'fixture'))
  )
  assert.equal(results.filter((result) => result.status === 'rejected').length, 5)
  for (const result of results) {
    if (result.status === 'rejected') assert.match(result.reason.message, /timed out/)
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json({ recovered: true }))
  assert.deepEqual(await provider.fetch('/Items', 'fixture'), { recovered: true })
})

test('keeps HTTP errors and caller cancellation intact', async (t) => {
  const provider = new EmbyProviderBase('http://errors.test')
  t.mock.method(globalThis, 'fetch', async () => new Response('SQLiteException', { status: 500 }))
  await assert.rejects(provider.fetch('/Items', 'fixture'), {
    status: 500,
    serverException: 'SQLiteException',
  })
  const controller = new AbortController()
  controller.abort(new Error('caller cancelled'))
  t.mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
    options.signal!.throwIfAborted()
    return Response.json({})
  })
  await assert.rejects(
    provider.fetch('/Items', 'fixture', { signal: controller.signal }),
    /caller cancelled/
  )
})
