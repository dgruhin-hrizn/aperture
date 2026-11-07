import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EmbyProvider } from './EmbyProvider.js'
import { configureGeneratedLibrary } from './libraries.js'

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

test('managed library options preserve custom settings and skip unchanged updates', async t => {
  const provider = new EmbyProvider('http://fixture.test')
  const library = {
    ItemId: 'managed', Id: 'options-id', Locations: ['/generated/viewer'],
    LibraryOptions: { ContentType: 'tvshows', PreferredMetadataLanguage: 'he', EnableRealtimeMonitor: true },
  }
  const posts: Array<{ Id: string; LibraryOptions: typeof library.LibraryOptions }> = []
  t.mock.method(provider, 'fetch', async (endpoint: string, _key: string, options?: RequestInit) => {
    if (endpoint === '/Library/VirtualFolders') return [library]
    const body = JSON.parse(options!.body as string)
    posts.push(body)
    library.LibraryOptions = body.LibraryOptions
    return {}
  })
  await configureGeneratedLibrary(provider, 'fixture', 'managed', '/generated/viewer')
  assert.equal(posts.length, 1)
  assert.equal(posts[0].Id, 'options-id')
  assert.equal(posts[0].LibraryOptions.ContentType, 'tvshows')
  assert.equal(posts[0].LibraryOptions.PreferredMetadataLanguage, 'he')
  assert.equal(posts[0].LibraryOptions.EnableRealtimeMonitor, false)
  await configureGeneratedLibrary(provider, 'fixture', 'managed', '/generated/viewer')
  await configureGeneratedLibrary(provider, 'fixture', 'managed', '/source/tv')
  library.Locations.push('/source/tv')
  await configureGeneratedLibrary(provider, 'fixture', 'managed', '/generated/viewer')
  assert.equal(posts.length, 1, 'unrelated, mixed-path, and unchanged libraries must not be modified')
})
