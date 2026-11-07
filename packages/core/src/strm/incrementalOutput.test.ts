import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { acknowledgeOutputRefresh, publishGeneratedOutput } from './incrementalOutput.js'

test('unchanged files retain inodes and pending refreshes survive repeat publishing', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-output-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'aperture-tv', 'viewer')
  let content = 'episode metadata'
  const publish = () =>
    publishGeneratedOutput({ root, destination, incremental: true }, async (output) => {
      await fs.mkdir(path.join(output.path, 'Show'), { recursive: true })
      await fs.symlink('/media/source.mkv', path.join(output.path, 'Show', 'episode.mkv'))
      await fs.writeFile(path.join(output.path, 'Show', 'episode.nfo'), content)
      return { localPath: output.path, deleted: 0 }
    })
  const first = await publish()
  const video = await fs.lstat(path.join(destination, 'Show', 'episode.mkv'))
  const nfo = await fs.stat(path.join(destination, 'Show', 'episode.nfo'))
  const second = await publish()
  assert.equal(second.changed, false)
  assert.equal(second.needsRefresh, true, 'a failed/unsubmitted refresh must be retried')
  assert.equal((await fs.lstat(path.join(destination, 'Show', 'episode.mkv'))).ino, video.ino)
  assert.equal((await fs.stat(path.join(destination, 'Show', 'episode.nfo'))).mtimeMs, nfo.mtimeMs)
  await acknowledgeOutputRefresh(destination, first.revision)
  assert.equal((await publish()).needsRefresh, false)
  content = 'updated metadata'
  const changed = await publish()
  await acknowledgeOutputRefresh(destination, first.revision)
  assert.equal(
    (await publish()).needsRefresh,
    true,
    'an older acknowledgment cannot clear a newer change'
  )
  await acknowledgeOutputRefresh(destination, changed.revision)
  assert.equal((await publish()).needsRefresh, false)
  assert.equal((await fs.lstat(path.join(destination, 'Show', 'episode.mkv'))).ino, video.ino)
})

test('withdraws output on failed validation, preserves source files and releases the output lock', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-denied-output-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'aperture', 'viewer')
  const source = path.join(root, 'source')
  await fs.mkdir(source)
  await fs.writeFile(path.join(source, 'video.mkv'), 'original video')
  await fs.mkdir(destination, { recursive: true })
  await fs.symlink(source, path.join(destination, 'legacy-season'))
  await assert.rejects(
    publishGeneratedOutput({ root, destination, incremental: true }, async (output) => {
      await fs.writeFile(path.join(output.path, 'partial.nfo'), 'partial')
      throw new Error('access could not be verified')
    }),
    /access could not be verified/
  )
  await assert.rejects(fs.lstat(destination), { code: 'ENOENT' })
  assert.equal(await fs.readFile(path.join(source, 'video.mkv'), 'utf8'), 'original video')
  const next = await publishGeneratedOutput(
    { root, destination, incremental: true },
    async (output) => ({ localPath: output.path, deleted: 0 })
  )
  assert.equal(next.changed, true)
  assert.deepEqual(await fs.readdir(path.join(path.dirname(destination), '.aperture-staging')), [])
})

test('replaces legacy directory symlinks without modifying their source directories', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-legacy-output-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'aperture-tv', 'viewer')
  const source = path.join(root, 'source')
  await fs.mkdir(source)
  await fs.writeFile(path.join(source, 'private.mkv'), 'keep')
  await fs.mkdir(destination, { recursive: true })
  await fs.symlink(source, path.join(destination, 'Season 01'))
  await publishGeneratedOutput({ root, destination, incremental: true }, async (output) => {
    await fs.mkdir(path.join(output.path, 'Season 01'))
    await fs.symlink('/allowed/episode.mkv', path.join(output.path, 'Season 01', 'allowed.mkv'))
    return { localPath: output.path, deleted: 0 }
  })
  assert.equal((await fs.lstat(path.join(destination, 'Season 01'))).isDirectory(), true)
  assert.deepEqual(await fs.readdir(path.join(destination, 'Season 01')), ['allowed.mkv'])
  assert.deepEqual(await fs.readdir(source), ['private.mkv'])
})

test('reuses unchanged artwork and invalidates the cache when overlay inputs change', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-artwork-output-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'aperture', 'viewer')
  let downloads = 0
  t.mock.method(globalThis, 'fetch', async () => {
    downloads++
    return new Response('image bytes')
  })
  const publish = (url: string) =>
    publishGeneratedOutput({ root, destination, incremental: true }, async (output) => {
      await output.downloadImage({
        url,
        path: path.join(output.path, 'fanart.jpg'),
        movieTitle: 'Movie',
        isPoster: false,
      })
      return { localPath: output.path, deleted: 0 }
    })
  await publish('http://fixture/art?tag=1')
  const before = await fs.stat(path.join(destination, 'fanart.jpg'))
  assert.equal((await publish('http://fixture/art?tag=1')).changed, false)
  assert.equal(downloads, 1)
  assert.equal((await fs.stat(path.join(destination, 'fanart.jpg'))).mtimeMs, before.mtimeMs)
  await publish('http://fixture/art?tag=2')
  assert.equal(downloads, 2)
})

test('withdraws revoked files before optional artwork downloads', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-prune-output-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'aperture', 'viewer')
  await fs.mkdir(destination, { recursive: true })
  await fs.symlink('/revoked/video.mkv', path.join(destination, 'revoked.mkv'))
  await fs.writeFile(path.join(destination, 'fanart.jpg'), 'previous artwork')
  await publishGeneratedOutput({ root, destination, incremental: true }, async (output) => {
    const image = {
      url: 'http://fixture/art',
      path: path.join(output.path, 'fanart.jpg'),
      movieTitle: 'Movie',
      isPoster: false,
    }
    await output.pruneStaleFiles([image])
    await assert.rejects(fs.lstat(path.join(destination, 'revoked.mkv')), { code: 'ENOENT' })
    assert.equal(
      await fs.readFile(path.join(destination, 'fanart.jpg'), 'utf8'),
      'previous artwork'
    )
    return { localPath: output.path, deleted: 0 }
  })
})
