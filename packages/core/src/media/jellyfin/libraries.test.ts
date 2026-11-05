import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { JellyfinProviderBase } from './base.js'
import { getLibraries } from './libraries.js'

test('Jellyfin virtual folders use the current ItemId and Locations contract', async () => {
  const provider = { fetch: async () => [
    { ItemId: 'movie-folder', Name: 'Movies', CollectionType: 'movies', Locations: ['/movies'] },
    { Id: 'older', Guid: 'guid', Name: 'Older', CollectionType: 'tvshows', Path: '/tv' },
    { ItemId: null, Name: 'Incomplete' },
  ] } as unknown as JellyfinProviderBase
  const result = await getLibraries(provider, 'fixture')
  assert.deepEqual(result.map(({ id, guid, path, locations }) => ({ id, guid, path, locations })), [
    { id: 'movie-folder', guid: 'movie-folder', path: '/movies', locations: ['/movies'] },
    { id: 'older', guid: 'guid', path: '/tv', locations: undefined },
  ])
})
