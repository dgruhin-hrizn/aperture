import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEncoreTools, hashEncoreToken, scopeCatalogQuery, validateReleaseWindow } from '@aperture/core/encore'

test('catalog scopes bind exact server-visible IDs in joins, aggregates and existing CTEs', () => {
  const result = scopeCatalogQuery('SELECT COUNT(*) FROM movies m JOIN episodes e ON true WHERE m.title = $1', ['1917'], { movieIds: ['visible'], seriesIds: ['show'] })
  assert.deepEqual(result.params, ['1917', ['visible'], ['show']])
  assert.match(result.text, /public.movies WHERE provider_item_id = ANY\(\$2/)
  assert.match(result.text, /public.series WHERE provider_item_id = ANY\(\$3/)
  assert.match(result.text, /public.episodes e JOIN series s/)
  assert.match(scopeCatalogQuery('WITH ranked AS (SELECT * FROM movies) SELECT * FROM ranked', [], { movieIds: [], seriesIds: [] }).text, /WITH movies AS[\s\S]*, ranked AS/)
})
test('restricted MCP connections cannot discover tools that expose taste, history or other scopes', () => {
  const ctx = { userId: 'fixture', isAdmin: false, embeddingModel: null, embeddingModelId: '', mediaServer: null }
  const library = createEncoreTools(ctx, ['library:read'])
  assert.ok(library.searchContent)
  assert.ok(library.discoverTitles)
  assert.equal(library.getUserRatings, undefined)
  assert.equal(library.getTasteProfile, undefined)
  assert.equal(library.getReleaseSchedule, undefined)
  const profile = createEncoreTools(ctx, ['profile:read'])
  assert.ok(profile.getTasteProfile)
  assert.equal(profile.getWatchHistory, undefined)
})
test('release windows reject impossible dates, inverted ranges and unbounded calendars', () => {
  validateReleaseWindow('2026-11-01', '2026-11-30')
  for (const [start, end] of [['2026-02-30', '2026-03-01'], ['2026-11-03', '2026-11-02'], ['2026-01-01', '2027-01-01']]) assert.throws(() => validateReleaseWindow(start, end))
})
test('connection credentials use irreversible stable hashes instead of storing raw tokens', () => {
  const token = 'apmcp_fixture'
  assert.equal(hashEncoreToken(token).length, 64)
  assert.equal(hashEncoreToken(token), hashEncoreToken(token))
  assert.notEqual(hashEncoreToken(token), token)
})
