import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PoolClient } from 'pg'
import { getPool, closePool } from './db.js'
import { updateUserUiPreferences } from './userSettings.js'

test('an appearance-only patch preserves all recommendation, library, language, and existing UI settings', async (t) => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/aperture_test'
  const original = {
    algorithmSettings: { enabled: true, movie: { noveltyWeight: 0.3 } },
    excludedLibraryIds: ['private-source'],
    ui: {
      sidebarCollapsed: true,
      uiLanguage: 'fr',
      aiLanguage: 'de',
      dismissedAdminRelease: 'dev.7',
      viewModes: { movies: 'list' },
      browseSort: { movies: { sortBy: 'year', sortOrder: 'desc' } },
      browseFilterPresets: [{ id: 'preset', name: 'Favorites' }],
    },
  }
  const writes: Array<{ sql: string; params: unknown[] }> = []
  let savedSettings = original
  const client = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.startsWith('SELECT')) {
        assert.match(sql, /FOR UPDATE$/)
        return { rows: [{ settings_json: savedSettings }], rowCount: 1 }
      }
      if (sql.startsWith('UPDATE')) savedSettings = JSON.parse(params[0] as string)
      writes.push({ sql, params })
      return { rows: [], rowCount: 1 }
    },
    release() {},
  }
  const mock = t.mock.method(getPool(), 'connect', async () => client as unknown as PoolClient)
  try {
    const appearance = { theme: 'studio', mode: 'light' } as const
    const result = await updateUserUiPreferences('account', { appearance })
    assert.deepEqual(result, { ...original.ui, appearance })
    const update = writes.find((w) => w.sql.includes('UPDATE user_settings'))!
    assert.deepEqual(JSON.parse(update.params[0] as string), {
      ...original,
      ui: { ...original.ui, appearance },
    })
    assert.equal(update.params[1], 'account')
    assert.ok(!update.sql.includes('library_name ='))
    assert.deepEqual(original.ui.viewModes, { movies: 'list' })

    const dismissed = await updateUserUiPreferences('account', { dismissedWelcomeTourVersion: 2 })
    assert.deepEqual(dismissed, { ...original.ui, appearance, dismissedWelcomeTourVersion: 2 })
    const retried = await updateUserUiPreferences('account', { dismissedWelcomeTourVersion: 1 })
    assert.deepEqual(retried, dismissed)
    const unrelated = await updateUserUiPreferences('account', { sidebarCollapsed: false })
    assert.deepEqual(unrelated, { ...dismissed, sidebarCollapsed: false })
  } finally {
    mock.mock.restore()
    await closePool()
  }
})
