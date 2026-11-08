import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useEncoreController } from './useEncoreController'

for (const entry of ['/browse?tab=series', '/encore?view=memory']) {
  test(`the agent opens over the page, preserves its view and handles the legacy link ${entry}`, async () => {
    let state!: ReturnType<typeof useEncoreController>
    let location!: ReturnType<typeof useLocation>
    function Probe() {
      state = useEncoreController()
      location = useLocation()
      return null
    }
    let renderer!: ReturnType<typeof create>
    try {
      await act(async () => {
        renderer = create(
          React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(Probe))
        )
      })
      const legacy = entry.startsWith('/encore')
      assert.equal(state.open, legacy)
      assert.equal(location.pathname, legacy ? '/dashboard' : '/browse')
      assert.equal(state.view, legacy ? 'memory' : 'chat')
      await act(async () => state.openEncore('plans'))
      assert.equal(state.open, true)
      assert.equal(state.view, 'plans')
      await act(async () => state.closeEncore())
      assert.equal(state.open, false)
      await act(async () => state.openEncore())
      assert.equal(state.view, 'plans')
      assert.equal(location.pathname, legacy ? '/dashboard' : '/browse')
      assert.equal(location.search, legacy ? '' : '?tab=series')
    } finally {
      await act(async () => renderer?.unmount())
    }
  })
}
