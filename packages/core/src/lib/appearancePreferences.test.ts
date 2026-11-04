import assert from 'node:assert/strict'
import { test } from 'node:test'
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
  const mock = t.mock.method(getPool(), 'query', async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('SELECT'))
      return {
        rows: [
          {
            user_id: 'account',
            library_name: 'My Movies',
            series_library_name: 'My Series',
            settings_json: original,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      }
    writes.push({ sql, params })
    return { rows: [], rowCount: 1 }
  })
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
  } finally {
    mock.mock.restore()
    await closePool()
  }
})
