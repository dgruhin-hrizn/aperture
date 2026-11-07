import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { validateOutputAccess } from './outputValidation.js'

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-output-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return {
    root,
    mediaRoot: path.join(root, 'missing-media'),
    serverRoot: '/server/output',
    useSymlinks: false,
  }
}

test('STRM without a source mount passes required checks and leaves playback unverified', async (t) => {
  const options = await fixture(t)
  const checks = await validateOutputAccess(options)
  assert.ok(checks.every((c) => c.status !== 'failed'))
  assert.equal(checks.find((c) => c.id === 'media-access')?.status, 'warning')
  assert.equal(checks.find((c) => c.id === 'playback')?.status, 'warning')
  assert.deepEqual(await fs.readdir(options.root), [])
})

test('native Windows paths reject Linux symlinks but permit STRM pointers', async (t) => {
  const options = { ...(await fixture(t)), serverRoot: 'D:\\ApertureLibraries' }
  const links = await validateOutputAccess({ ...options, useSymlinks: true })
  assert.equal(links.find((c) => c.id === 'symlink-support')?.status, 'failed')
  assert.ok((await validateOutputAccess(options)).every((c) => c.status !== 'failed'))
})

test('server checks distinguish local links from server output and original-directory resolution', async (t) => {
  const options = await fixture(t)
  const media = await fs.mkdtemp(path.join(os.tmpdir(), 'aperture-original-'))
  t.after(() => fs.rm(media, { recursive: true, force: true }))
  await fs.writeFile(path.join(media, 'movie.mkv'), 'fixture')
  const checks = await validateOutputAccess({
    ...options,
    useSymlinks: true,
    sampleMediaPath: path.join(media, 'movie.mkv'),
    listDirectory: async (directory) =>
      (await fs.readdir(directory.replace('/server/output', options.root))).map((Name) => ({
        Name,
      })),
  })
  for (const id of ['symlink-support', 'server-output', 'server-target'])
    assert.equal(checks.find((c) => c.id === id)?.status, 'passed')
  assert.equal(checks.find((c) => c.id === 'playback')?.status, 'warning')
  assert.equal(await fs.readFile(path.join(media, 'movie.mkv'), 'utf8'), 'fixture')
  assert.deepEqual(await fs.readdir(options.root), [])
})

test('a server path failure is reported separately and temporary files are removed', async (t) => {
  const options = await fixture(t)
  const checks = await validateOutputAccess({
    ...options,
    listDirectory: async () => {
      throw new Error('fixture unavailable')
    },
  })
  assert.equal(checks.find((c) => c.id === 'write-access')?.status, 'passed')
  assert.equal(checks.find((c) => c.id === 'server-path')?.status, 'warning')
  assert.deepEqual(await fs.readdir(options.root), [])
})

test('a missing output mount fails instead of being created by validation', async (t) => {
  const options = await fixture(t)
  const root = path.join(options.root, 'not-mounted')
  const checks = await validateOutputAccess({ ...options, root })
  assert.equal(checks.find((c) => c.id === 'write-access')?.status, 'failed')
  await assert.rejects(fs.stat(root))
})

test('an output marker mismatch fails rather than claiming server access', async (t) => {
  const options = await fixture(t)
  const checks = await validateOutputAccess({ ...options, listDirectory: async () => [] })
  assert.equal(checks.find((c) => c.id === 'server-path')?.status, 'failed')
  assert.equal(
    checks.some((c) => c.id === 'server-output' && c.status === 'passed'),
    false
  )
  assert.deepEqual(await fs.readdir(options.root), [])
})

test('a missing sample explicitly leaves original-target resolution unverified', async (t) => {
  const options = await fixture(t)
  const checks = await validateOutputAccess({ ...options, useSymlinks: true })
  assert.equal(checks.find((c) => c.id === 'symlink-support')?.status, 'passed')
  assert.equal(checks.find((c) => c.id === 'server-target')?.status, 'warning')
})

test('the output probe permits a separate media-server account to traverse and read it', async (t) => {
  const options = await fixture(t)
  let inspected = false
  await validateOutputAccess({
    ...options,
    listDirectory: async (directory) => {
      const local = directory.replace('/server/output', options.root)
      const folder = await fs.stat(local)
      const marker = await fs.stat(path.join(local, 'visible.txt'))
      assert.equal(folder.mode & 0o005, 0o005, 'other accounts need read and traversal permission')
      assert.equal(marker.mode & 0o004, 0o004, 'other accounts need to read the marker')
      inspected = true
      return [{ Name: 'visible.txt' }]
    },
  })
  assert.equal(inspected, true)
})
