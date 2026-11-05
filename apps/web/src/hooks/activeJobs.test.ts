import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { randomUUID } from 'node:crypto'
import { browserFixture, tick, wrap } from '../test/uiHarness'
import { useActiveJobs } from './useActiveJobs'

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

test('admin header and global widget share idle requests and stop while hidden', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ jobs: [] })
  }
  function Probe() {
    useActiveJobs()
    useActiveJobs()
    return null
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe), randomUUID()))
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
    fixture.surface.visibilityState = 'hidden'
    fixture.surface.dispatchEvent(new Event('visibilitychange'))
    t.mock.timers.tick(120_000)
    await tick()
  })
  assert.equal(calls, 2)
  await act(async () => {
    fixture.surface.visibilityState = 'visible'
    fixture.surface.dispatchEvent(new Event('visibilitychange'))
    await tick()
  })
  assert.equal(calls, 3)
})
test('regular users do not call the admin job endpoint', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ jobs: [] })
  }
  function Probe() {
    useActiveJobs()
    return null
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe), randomUUID(), false))
    await tick()
  })
  assert.equal(calls, 0)
})
