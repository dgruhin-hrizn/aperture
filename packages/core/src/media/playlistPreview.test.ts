import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getPlaylistItems as embyItems,
  getPlaylistPreview as embyPreview,
} from './emby/playlists.js'
import {
  getPlaylistItems as jellyfinItems,
  getPlaylistPreview as jellyfinPreview,
} from './jellyfin/playlists.js'
import type { EmbyProviderBase } from './emby/base.js'
import type { JellyfinProviderBase } from './jellyfin/base.js'

for (const kind of ['emby', 'jellyfin'] as const) {
  test(`${kind} previews bound upstream items to five while retaining the full count and full-playlist behavior`, async () => {
    const paths: string[] = []
    const provider = {
      baseUrl: 'http://media.test',
      fetch: async (path: string) => {
        paths.push(path)
        const limit = Number(new URL(path, 'http://media.test').searchParams.get('Limit') || 25)
        return {
          TotalRecordCount: 25,
          Items: Array.from({ length: limit }, (_, i) => ({
            Id: String(i),
            PlaylistItemId: `entry-${i}`,
            Name: `Item ${i}`,
            ProductionYear: 2025,
          })),
        }
      },
    }
    const preview =
      kind === 'emby'
        ? await embyPreview(provider as unknown as EmbyProviderBase, 'key', 'playlist')
        : await jellyfinPreview(provider as unknown as JellyfinProviderBase, 'key', 'playlist')
    assert.equal(preview.items.length, 5)
    assert.equal(preview.total, 25)
    const full =
      kind === 'emby'
        ? await embyItems(provider as unknown as EmbyProviderBase, 'key', 'playlist')
        : await jellyfinItems(provider as unknown as JellyfinProviderBase, 'key', 'playlist')
    assert.equal(full.length, 25)
    assert.match(paths[0], /Limit=5/)
    assert.doesNotMatch(paths[1], /Limit=/)
  })
}
