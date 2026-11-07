import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EMBY_HEAVY_JOBS, runEmbyJob } from './mediaServerJobs.js'

test('serializes Emby jobs, skips cancelled queued work, and recovers after failures', async () => {
  const ran: string[] = []
  let release!: () => void
  let cancelled = false
  const first = runEmbyJob(
    async () => {
      ran.push('first')
      await new Promise<void>((resolve) => {
        release = resolve
      })
    },
    () => false
  )
  const second = runEmbyJob(
    async () => {
      ran.push('cancelled')
    },
    () => cancelled
  )
  const third = runEmbyJob(
    async () => {
      ran.push('third')
    },
    () => false
  )
  assert.deepEqual(ran, ['first'])
  cancelled = true
  release()
  await Promise.all([first, second, third])
  assert.deepEqual(ran, ['first', 'third'])
  await assert.rejects(
    runEmbyJob(
      async () => {
        throw new Error('fixture')
      },
      () => false
    ),
    /fixture/
  )
  await runEmbyJob(
    async () => {
      ran.push('recovered')
    },
    () => false
  )
  assert.equal(ran.at(-1), 'recovered')
  assert.equal(
    EMBY_HEAVY_JOBS.has('import-media-server'),
    false,
    'parent imports must not hold the slot their child jobs need'
  )
})
