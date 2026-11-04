import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AsyncCache, concurrencyLimit } from './asyncCache.js'

const tick = () => new Promise((resolve) => setImmediate(resolve))
test('shares in-flight loads, bounds cached values, and retries failures/nulls', async () => {
  const cache = new AsyncCache<number | null>(60_000, 1)
  let calls = 0
  const load = async () => ++calls
  assert.deepEqual(await Promise.all([cache.get('a', load), cache.get('a', load)]), [1, 1])
  assert.equal(await cache.get('a', load), 1)
  await cache.get('b', load)
  assert.equal(await cache.get('a', load), 3)
  await assert.rejects(
    cache.get('fail', async () => {
      throw Error('offline')
    })
  )
  assert.equal(await cache.get('fail', load), 4)
  await cache.get('nil', async () => null)
  assert.equal(await cache.get('nil', load), 5)
})
test('invalidation prevents an older in-flight result from repopulating the cache', async () => {
  const cache = new AsyncCache<number>(60_000)
  let finish!: (n: number) => void
  const old = cache.get(
    'a',
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  await tick()
  cache.clear()
  assert.equal(await cache.get('a', async () => 2), 2)
  finish(1)
  await old
  assert.equal(await cache.get('a', async () => 3), 2)
})
test('expired entries reload and shared limiter never exceeds its cap', async () => {
  const cache = new AsyncCache<number>(1)
  await cache.get('a', async () => 1)
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(await cache.get('a', async () => 2), 2)
  const limit = concurrencyLimit(2)
  let active = 0
  let peak = 0
  await Promise.all(
    Array.from({ length: 10 }, () =>
      limit(async () => {
        peak = Math.max(peak, ++active)
        await tick()
        active--
      })
    )
  )
  assert.equal(peak, 2)
})
