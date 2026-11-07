import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WorkQueue } from './workQueue.js'

test('bounds concurrent work and preserves FIFO order after a rejected task', async () => {
  const queue = new WorkQueue(2)
  const started: number[] = []
  const release: Array<() => void> = []
  let active = 0
  let maximum = 0
  const work = Array.from({ length: 6 }, (_, index) =>
    queue.run(async () => {
      started.push(index)
      maximum = Math.max(maximum, ++active)
      await new Promise<void>((resolve) => {
        release[index] = resolve
      })
      active--
      if (index === 0) throw new Error('fixture failure')
      return index
    })
  )
  const results = Promise.allSettled(work)
  assert.deepEqual(started, [0, 1])
  for (let index = 0; index < 6; index++) {
    release[index]()
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.equal(maximum, 2)
  assert.deepEqual(started, [0, 1, 2, 3, 4, 5])
  assert.equal((await results)[0].status, 'rejected')
  assert.equal(await queue.run(async () => 'recovered'), 'recovered')
})
