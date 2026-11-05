import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getLibraryTypeLabel, processLibraryTitle } from './libraryTitles.js'

test('grouped titles use the explicit tag, preserve old suffixes and use the recipient locale', () => {
  const context = { username: 'Alex $&', type: getLibraryTypeLabel('series', 'fr') }
  assert.equal(processLibraryTitle('{{GROUP}} – {{type}} pour {{username}}', { ...context, group: 'Anime' }), 'Anime – Séries TV pour Alex $&')
  assert.equal(processLibraryTitle('{{type}} pour {{username}}', { ...context, group: 'Anime' }), 'Séries TV pour Alex $& – Anime')
  assert.equal(processLibraryTitle('{{group}} – {{type}}', context), 'Séries TV')
  assert.equal(processLibraryTitle('{{type}} – {{group}}', context), 'Séries TV')
  assert.equal(processLibraryTitle('({{group}}) {{type}}', context), 'Séries TV')
})
