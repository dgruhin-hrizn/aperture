import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EmbyProvider } from './EmbyProvider.js'

test('Emby cleanup targets the resolved item ID when display names are ambiguous', async t => {
  const provider = new EmbyProvider('http://fixture.test')
  const fetch = t.mock.method(provider, 'fetch', async (path: string) => {
    if (path === '/Library/VirtualFolders') return [
      { ItemId: '15528', Id: 'options-1', Name: 'Same title', CollectionType: 'tvshows' },
      { ItemId: '15529', Id: 'options-2', Name: 'Same title', CollectionType: 'tvshows' },
    ]
    return undefined
  })

  const libraries = await provider.getLibraries('fixture-key')
  await provider.deleteVirtualLibrary('fixture-key', libraries[1])
  assert.deepEqual(fetch.mock.calls[1].arguments, [
    '/Library/VirtualFolders/Delete',
    'fixture-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Id: '15529' }),
    },
  ])
  await assert.rejects(provider.deleteVirtualLibrary('fixture-key', { id: '', name: 'Same title' }), /ID is required/)
  assert.equal(fetch.mock.callCount(), 2)
})
