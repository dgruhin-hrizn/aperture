import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EmbyProviderBase } from './base.js'
import { queueLibraryRefresh } from './refreshQueue.js'
import { EmbyHttpError } from './fetchHelpers.js'

test('paces refreshes across instances and waits for reported active scans', async (t) => {
  const providers = [
    new EmbyProviderBase('http://refresh.test'),
    new EmbyProviderBase('http://refresh.test'),
  ]
  const posts: number[] = []
  let busyReads = 1
  for (const provider of providers) {
    t.mock.method(provider, 'fetch', async (endpoint: string) => {
      if (endpoint === '/Library/VirtualFolders') {
        return [{ ItemId: 'one', RefreshStatus: busyReads-- > 0 ? 'Running' : undefined }]
      }
      const options = new URL(endpoint, provider.baseUrl).searchParams
      assert.equal(options.get('Recursive'), 'true')
      assert.equal(options.get('MetadataRefreshMode'), 'Default')
      assert.equal(options.get('ReplaceAllMetadata'), 'false')
      assert.equal(options.get('ReplaceAllImages'), 'false')
      posts.push(Date.now())
      return {}
    })
  }
  await Promise.all(
    providers.map((provider, i) => queueLibraryRefresh(provider, 'fixture', String(i)))
  )
  assert.equal(posts.length, 2)
  assert.ok(posts[1] - posts[0] >= 4_900, 'refresh POSTs should be at least five seconds apart')
})

test('stops repeated refresh submissions after a server failure', async (t) => {
  const provider = new EmbyProviderBase('http://failed-refresh.test')
  let posts = 0
  t.mock.method(provider, 'fetch', async (endpoint: string) => {
    if (endpoint === '/Library/VirtualFolders') return []
    posts++
    throw new Error('Emby unavailable')
  })
  await assert.rejects(queueLibraryRefresh(provider, 'fixture', 'one'), /Emby unavailable/)
  await assert.rejects(queueLibraryRefresh(provider, 'fixture', 'two'), /temporarily deferred/)
  assert.equal(posts, 1)
})

test('a deleted library does not defer other users library refreshes', async (t) => {
  const provider = new EmbyProviderBase('http://missing-library-refresh.test')
  t.mock.method(provider, 'fetch', async (endpoint: string) => {
    if (endpoint === '/Library/VirtualFolders') return []
    if (endpoint.startsWith('/Items/deleted/Refresh?')) throw new EmbyHttpError(404, 'Not Found', '')
    return {}
  })
  await assert.rejects(queueLibraryRefresh(provider, 'fixture', 'deleted'), { status: 404 })
  await queueLibraryRefresh(provider, 'fixture', 'existing')
})
