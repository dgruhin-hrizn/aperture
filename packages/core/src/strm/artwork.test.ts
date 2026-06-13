import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test, after, before } from 'node:test'
import {
  isBasenameMatchedSidecar,
  setPathPrefixOverrideForTests,
  symlinkArtwork,
  symlinkBasenameMatchedSidecars,
} from './artwork.js'

let tempRoot = ''
let mediaServerPrefix = ''
let localMediaPrefix = ''

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-artwork-'))
  mediaServerPrefix = path.join(tempRoot, 'server')
  localMediaPrefix = path.join(tempRoot, 'local')
  await fs.mkdir(mediaServerPrefix, { recursive: true })
  await fs.mkdir(localMediaPrefix, { recursive: true })

  setPathPrefixOverrideForTests({
    mediaServerPathPrefix: mediaServerPrefix,
    localMediaPathPrefix: localMediaPrefix,
  })
})

after(async () => {
  setPathPrefixOverrideForTests(null)
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

async function setupSourceAndTarget(sourceRel: string, targetRel: string) {
  const sourceLocal = path.join(localMediaPrefix, sourceRel)
  const sourceServer = path.join(mediaServerPrefix, sourceRel)
  const targetPath = path.join(tempRoot, targetRel)
  await fs.mkdir(sourceLocal, { recursive: true })
  await fs.mkdir(targetPath, { recursive: true })
  return { sourceLocal, sourceServer, targetPath }
}

test('isBasenameMatchedSidecar detects subtitles and Emby sidecars', () => {
  assert.equal(isBasenameMatchedSidecar('Release.Name.en.srt'), true)
  assert.equal(isBasenameMatchedSidecar('Release.Name.2026.bif'), true)
  assert.equal(isBasenameMatchedSidecar('Release.Name.chapters.xml'), true)
  assert.equal(isBasenameMatchedSidecar('banner.jpg'), false)
  assert.equal(isBasenameMatchedSidecar('movie.nfo'), false)
})

test('symlinkBasenameMatchedSidecars renames BIF and subtitle files', async () => {
  const { sourceLocal, sourceServer, targetPath } = await setupSourceAndTarget(
    'movies/inception',
    'aperture/inception'
  )

  const originalBasename = 'Inception.2010.1080p.BluRay'
  const targetBasename = 'Inception (2010)'

  await fs.writeFile(path.join(sourceLocal, `${originalBasename}.bif`), 'bif')
  await fs.writeFile(path.join(sourceLocal, `${originalBasename}.en.srt`), 'subs')

  const count = await symlinkBasenameMatchedSidecars({
    mediaServerPath: sourceServer,
    targetPath,
    targetBasename,
    originalBasename,
    title: 'Inception',
  })

  assert.equal(count, 2)

  const bifLink = await fs.readlink(path.join(targetPath, `${targetBasename}.bif`))
  assert.equal(bifLink, path.join(sourceServer, `${originalBasename}.bif`))

  const srtLink = await fs.readlink(path.join(targetPath, `${targetBasename}.en.srt`))
  assert.equal(srtLink, path.join(sourceServer, `${originalBasename}.en.srt`))
})

test('symlinkBasenameMatchedSidecars skips unrelated sidecar files', async () => {
  const { sourceLocal, sourceServer, targetPath } = await setupSourceAndTarget(
    'movies/other',
    'aperture/other'
  )

  await fs.writeFile(path.join(sourceLocal, 'Different.Release.2020.bif'), 'bif')
  await fs.writeFile(path.join(sourceLocal, 'Target.Release.2020.bif'), 'bif')

  const count = await symlinkBasenameMatchedSidecars({
    mediaServerPath: sourceServer,
    targetPath,
    targetBasename: 'Movie (2020)',
    originalBasename: 'Target.Release.2020',
    title: 'Movie',
  })

  assert.equal(count, 1)
  await assert.rejects(() => fs.readlink(path.join(targetPath, 'Different.Release.2020.bif')))
})

test('symlinkBasenameMatchedSidecars removes stale misnamed sidecar symlinks', async () => {
  const { sourceLocal, sourceServer, targetPath } = await setupSourceAndTarget(
    'movies/stale',
    'aperture/stale'
  )

  const originalBasename = 'Release.Name.2026.720p'
  const targetBasename = 'Title (2026)'

  await fs.writeFile(path.join(sourceLocal, `${originalBasename}.bif`), 'bif')
  await fs.symlink(
    path.join(sourceServer, `${originalBasename}.bif`),
    path.join(targetPath, `${originalBasename}.bif`)
  )

  await symlinkBasenameMatchedSidecars({
    mediaServerPath: sourceServer,
    targetPath,
    targetBasename,
    originalBasename,
    title: 'Title',
  })

  await assert.rejects(() => fs.readlink(path.join(targetPath, `${originalBasename}.bif`)))
  const renamedLink = await fs.readlink(path.join(targetPath, `${targetBasename}.bif`))
  assert.equal(renamedLink, path.join(sourceServer, `${originalBasename}.bif`))
})

test('symlinkArtwork skips basename-matched sidecars', async () => {
  const { sourceLocal, sourceServer, targetPath } = await setupSourceAndTarget(
    'movies/artwork',
    'aperture/artwork'
  )

  const originalBasename = 'Release.Name.2026.720p'
  await fs.writeFile(path.join(sourceLocal, `${originalBasename}.bif`), 'bif')
  await fs.writeFile(path.join(sourceLocal, 'clearlogo.png'), 'logo')

  const count = await symlinkArtwork({
    mediaServerPath: sourceServer,
    targetPath,
    skipFiles: [],
    skipSeasonFolders: false,
    mediaType: 'movie',
    title: 'Title',
  })

  assert.equal(count, 1)
  await assert.rejects(() => fs.readlink(path.join(targetPath, `${originalBasename}.bif`)))
  const logoLink = await fs.readlink(path.join(targetPath, 'clearlogo.png'))
  assert.equal(logoLink, path.join(sourceServer, 'clearlogo.png'))
})
