import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { randomUUID } from 'node:crypto'
import { browserFixture, tick, wrap } from '../test/uiHarness'
import { useUserPreferences, saveUserPreferences, type UserPreferences } from './userPreferences'
import { AppearanceProvider } from '../appearance/AppearanceProvider'
import { useAppearance } from '../appearance/context'

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

test('three preference consumers share one request and cannot receive another user’s snapshot', async () => {
  const firstId = randomUUID(),
    secondId = randomUUID()
  let calls = 0,
    finish!: (r: Response) => void
  let last!: ReturnType<typeof useUserPreferences>
  globalThis.fetch = async () => {
    calls++
    return new Promise((resolve) => {
      finish = resolve
    })
  }
  function Consumer() {
    last = useUserPreferences()
    return null
  }
  const tree = () =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(Consumer),
      React.createElement(Consumer),
      React.createElement(Consumer)
    )
  await act(async () => {
    renderer = create(wrap(tree(), firstId))
    await tick()
  })
  assert.equal(calls, 1)
  await act(async () => {
    finish(Response.json({ sidebarCollapsed: true }))
    await tick()
  })
  assert.equal(last.data?.sidebarCollapsed, true)
  await act(async () => {
    renderer!.update(wrap(tree(), secondId))
    await tick()
  })
  assert.equal(last.data, undefined)
  assert.equal(last.loading, true)
  assert.equal(calls, 2)
  await act(async () => {
    finish(Response.json({ sidebarCollapsed: false }))
    await tick()
  })
  const finalData = (last as { data?: UserPreferences }).data
  assert.equal(finalData?.sidebarCollapsed, false)
})

test('preference saves serialize partial patches and notify all consumers without resetting unrelated settings', async () => {
  const userId = randomUUID()
  let value: UserPreferences = {
    sidebarCollapsed: true,
    appearance: { theme: 'studio', mode: 'dark' },
    viewModes: { recommendations: 'list' },
    uiLanguage: 'fr',
  }
  const bodies: unknown[] = []
  let reads = 0,
    current!: ReturnType<typeof useUserPreferences>
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'PATCH') {
      const patch = JSON.parse(String(init.body))
      bodies.push(patch)
      value = { ...value, ...patch, viewModes: { ...value.viewModes, ...patch.viewModes } }
      return Response.json(value)
    }
    reads++
    return Response.json(value)
  }
  function Consumer() {
    current = useUserPreferences()
    return null
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Consumer), userId))
    await tick()
  })
  await act(async () => {
    await Promise.all([
      saveUserPreferences(userId, { appearance: { theme: 'classic', mode: 'light' } }),
      saveUserPreferences(userId, { viewModes: { topPicks: 'list' } }),
    ])
    await tick()
  })
  assert.deepEqual(bodies, [
    { appearance: { theme: 'classic', mode: 'light' } },
    { viewModes: { topPicks: 'list' } },
  ])
  assert.equal(reads, 1)
  assert.equal(current.data?.uiLanguage, 'fr')
  assert.equal(current.data?.sidebarCollapsed, true)
  assert.deepEqual(current.data?.viewModes, { recommendations: 'list', topPicks: 'list' })
})

test('failed preference loading preserves appearance error handling and sends no write', async () => {
  let writes = 0
  let appearance!: ReturnType<typeof useAppearance>
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'PATCH') writes++
    return new Response(null, { status: 503 })
  }
  function Probe() {
    appearance = useAppearance()
    return null
  }
  await act(async () => {
    renderer = create(
      wrap(React.createElement(AppearanceProvider, null, React.createElement(Probe)), randomUUID())
    )
    await tick()
  })
  assert.equal(appearance.loadError, true)
  assert.equal(appearance.loading, false)
  await assert.rejects(appearance.updateAppearance({ theme: 'studio', mode: 'dark' }))
  assert.equal(writes, 0)
})

test('an obsolete in-flight response cannot replace preferences after an account switch', async () => {
  let oldFinish!: (r: Response) => void,
    calls = 0
  let current!: ReturnType<typeof useUserPreferences>
  globalThis.fetch = async () =>
    ++calls === 1
      ? new Promise((resolve) => {
          oldFinish = resolve
        })
      : Response.json({ sidebarCollapsed: false })
  function Probe() {
    current = useUserPreferences()
    return null
  }
  await act(async () => {
    renderer = create(wrap(React.createElement(Probe), randomUUID()))
    await tick()
  })
  await act(async () => {
    renderer!.update(wrap(React.createElement(Probe), randomUUID()))
    await tick()
  })
  await act(async () => {
    oldFinish(Response.json({ sidebarCollapsed: true }))
    await tick()
  })
  assert.equal(current.data?.sidebarCollapsed, false)
})
