import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { isCompetingPosterFile } from './artwork.js'
import {
  buildTmdbPosterUrl,
  isMediaServerPosterUrl,
} from './posterUrl.js'
import { createTopPicksPoster } from './poster.js'

test('isMediaServerPosterUrl detects Emby/Jellyfin primary image URLs', () => {
  assert.equal(
    isMediaServerPosterUrl('http://emby:8096/emby/Items/abc123/Images/Primary?tag=xyz'),
    true
  )
  assert.equal(isMediaServerPosterUrl('https://image.tmdb.org/t/p/w500/abc.jpg'), false)
})

test('buildTmdbPosterUrl builds w500 image URL', () => {
  assert.equal(
    buildTmdbPosterUrl('/abc123.jpg'),
    'https://image.tmdb.org/t/p/w500/abc123.jpg'
  )
})

test('isCompetingPosterFile skips alternate poster filenames', () => {
  assert.equal(isCompetingPosterFile('poster.jpg'), false)
  assert.equal(isCompetingPosterFile('fanart.jpg'), false)
  assert.equal(isCompetingPosterFile('poster.png'), true)
  assert.equal(isCompetingPosterFile('folder.jpg'), true)
  assert.equal(isCompetingPosterFile('cover.jpg'), true)
  assert.equal(isCompetingPosterFile('season01-poster.jpg'), true)
  assert.equal(isCompetingPosterFile('banner.jpg'), false)
})

test('createTopPicksPoster returns JPEG with rank overlay applied', async () => {
  const source = await sharp({
    create: {
      width: 200,
      height: 300,
      channels: 3,
      background: { r: 80, g: 120, b: 160 },
    },
  })
    .jpeg()
    .toBuffer()

  const result = await createTopPicksPoster(source, 1)
  assert.ok(result.byteLength > 0)
  assert.equal(result[0], 0xff)
  assert.equal(result[1], 0xd8)
})
