import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { filterNavigation, mobileDestination, isEncoreLocation } from './navigationRules'
import { useMobileViewport } from './useMobileViewport'
import { usePaneScroll } from './usePaneScroll'
import { browserFixture, wrap, tick } from '../../test/uiHarness'

test('mobile destinations keep deep links, the agent launcher and disabled-feature fallback consistent', () => {
  assert.ok(!isEncoreLocation('/'))
  assert.ok(isEncoreLocation('/encore'))
  for (const [path, value] of [
    ['/', 'you'],
    ['/encore', 'encore'],
    ['/discovery', 'discover'],
    ['/top-picks/movies', 'discover'],
    ['/movies/one', 'library'],
    ['/series/one', 'library'],
    ['/person/name', 'library'],
    ['/watching', 'watching'],
    ['/settings', 'you'],
    ['/admin/jobs', 'you'],
    ['/dashboard', 'you'],
  ])
    assert.equal(mobileDestination(path, true), value)
  assert.equal(mobileDestination('/recommendations', false), 'watching')
  const links = [
    { path: '/tonight', feature: 'emby' as const },
    { path: '/watching', feature: 'watching' as const },
    { path: '/encore' },
  ]
  assert.ok(
    !filterNavigation(links, 'jellyfin', false).some(
      (item) => item.path === '/tonight' || item.path === '/watching'
    )
  )
  assert.ok(filterNavigation(links, 'emby', true).some((item) => item.path === '/tonight'))
})

test('visible keyboard height, focus, rotation and cleanup preserve the usable app viewport', async () => {
  const fixture = browserFixture(),
    surface = fixture.surface,
    values = new Map<string, string>()
  const visual = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 })
  Object.assign(surface, {
    innerHeight: 844,
    visualViewport: visual,
    documentElement: {
      style: {
        getPropertyValue: (key: string) => values.get(key) ?? '',
        setProperty: (key: string, value: string) => values.set(key, value),
        removeProperty: (key: string) => values.delete(key),
      },
    },
    activeElement: null,
  })
  let current!: ReturnType<typeof useMobileViewport>, renderer: ReactTestRenderer | undefined
  function Probe() {
    current = useMobileViewport(true)
    return null
  }
  try {
    await act(async () => {
      renderer = create(React.createElement(Probe))
      await tick()
    })
    assert.deepEqual(current, { height: 844, top: 0, keyboard: false })
    Object.assign(surface, { activeElement: { tagName: 'TEXTAREA', getAttribute: () => null } })
    visual.height = 490
    visual.offsetTop = 12
    await act(async () => {
      visual.dispatchEvent(new Event('resize'))
      await tick()
    })
    assert.deepEqual(current, { height: 490, top: 12, keyboard: true })
    assert.equal(values.get('--ap-viewport-height'), '490px')
    visual.scale = 2
    await act(async () => {
      visual.dispatchEvent(new Event('resize'))
      await tick()
    })
    assert.equal(current!.keyboard, false, 'pinch zoom is not interpreted as a keyboard')
    visual.scale = 1
    Object.assign(surface, { activeElement: null, innerHeight: 390 })
    visual.height = 390
    visual.offsetTop = 0
    await act(async () => {
      surface.dispatchEvent(new Event('orientationchange'))
      await tick()
    })
    assert.deepEqual(current, { height: 390, top: 0, keyboard: false })
    await act(async () => renderer!.unmount())
    renderer = undefined
    assert.equal(values.has('--ap-viewport-height'), false)
  } finally {
    if (renderer) await act(async () => renderer!.unmount())
    fixture.restore()
  }
})

test('mobile content restores the prior scroll position on browser Back', async () => {
  const pane = { scrollTop: 0 },
    ref = { current: pane as HTMLElement },
    fixture = browserFixture()
  let navigate!: ReturnType<typeof useNavigate>, renderer: ReactTestRenderer | undefined
  function Probe() {
    navigate = useNavigate()
    usePaneScroll(ref, true)
    return null
  }
  try {
    await act(async () => {
      renderer = create(
        wrap(
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/browse'] },
            React.createElement(Probe)
          )
        )
      )
      await tick()
    })
    pane.scrollTop = 640
    await act(async () => {
      await navigate('/movies/one')
      await tick()
    })
    assert.equal(pane.scrollTop, 0)
    pane.scrollTop = 130
    await act(async () => {
      await navigate(-1)
      await tick()
    })
    assert.equal(pane.scrollTop, 640)
  } finally {
    if (renderer) await act(async () => renderer!.unmount())
    fixture.restore()
  }
})
