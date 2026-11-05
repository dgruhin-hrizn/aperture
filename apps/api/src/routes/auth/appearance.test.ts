import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { updatePreferencesSchema } from './schemas.js'

test('appearance validation accepts complete supported pairs and rejects invalid values before saving', async () => {
  const app = Fastify()
  let saves = 0
  app.patch('/preferences', { schema: { body: updatePreferencesSchema.body } }, async (request) => {
    saves++
    return request.body
  })
  try {
    for (const theme of ['classic', 'studio']) {
      for (const mode of ['light', 'dark', 'system']) {
        const response = await app.inject({
          method: 'PATCH',
          url: '/preferences',
          payload: { appearance: { theme, mode } },
        })
        assert.equal(response.statusCode, 200)
        assert.deepEqual(response.json(), { appearance: { theme, mode } })
      }
    }
    assert.equal(saves, 6)
    for (const appearance of [
      null,
      'studio',
      { theme: 'studio' },
      { mode: 'light' },
      { theme: 'other', mode: 'dark' },
      { theme: 'studio', mode: 'sepia' },
    ]) {
      assert.equal(
        (await app.inject({ method: 'PATCH', url: '/preferences', payload: { appearance } }))
          .statusCode,
        400
      )
    }
    assert.equal(saves, 6, 'invalid input never reaches persistence')
    const existing = { sidebarCollapsed: true, viewModes: { movies: 'list' }, uiLanguage: 'fr' }
    assert.deepEqual(
      (await app.inject({ method: 'PATCH', url: '/preferences', payload: existing })).json(),
      existing
    )
    const dismissed = { dismissedWelcomeTourVersion: 2 }
    assert.deepEqual(
      (await app.inject({ method: 'PATCH', url: '/preferences', payload: dismissed })).json(),
      dismissed
    )
    assert.equal(
      (await app.inject({
        method: 'PATCH',
        url: '/preferences',
        payload: { dismissedWelcomeTourVersion: 0 },
      })).statusCode,
      400
    )
    assert.equal(saves, 8)
  } finally {
    await app.close()
  }
})
