import * as fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export interface OutputCheck {
  id: string
  name: string
  description: string
  status: 'passed' | 'failed' | 'warning'
  suggestion?: string
}

export async function validateOutputAccess(options: {
  root: string
  mediaRoot: string
  serverRoot: string
  useSymlinks: boolean
  sampleMediaPath?: string
  listDirectory?: (directory: string) => Promise<Array<{ Name: string }>>
}): Promise<OutputCheck[]> {
  const checks: OutputCheck[] = []
  const add = (
    id: string,
    name: string,
    description: string,
    status: OutputCheck['status'],
    suggestion?: string
  ) => {
    checks.push({ id, name, description, status, suggestion })
  }
  let temporary: string | undefined
  try {
    // Match published output permissions; mkdtemp's 0700 blocks other UIDs.
    const candidate = path.join(options.root, '.aperture-check-' + randomUUID())
    await fs.mkdir(candidate, { mode: 0o755 })
    temporary = candidate
    await fs.writeFile(path.join(temporary, 'visible.txt'), 'Aperture output access check')
    add(
      'write-access',
      'Output write access',
      'Aperture can write to its generated-library storage.',
      'passed'
    )
    const remotePath = options.serverRoot.replace(/[\\/]$/, '') + '/' + path.basename(temporary)
    const windows = /^[a-z]:[\\/]|^\\\\/i.test(options.serverRoot)
    if (options.useSymlinks) {
      try {
        if (windows) throw new Error('Native Windows paths require STRM')
        await fs.symlink('visible.txt', path.join(temporary, 'local-link'))
        await fs.readFile(path.join(temporary, 'local-link'))
        add(
          'symlink-support',
          'Local symlink support',
          'Aperture created and followed a link on output storage. This alone does not verify the media server.',
          'passed'
        )
      } catch {
        add(
          'symlink-support',
          'Local symlink compatibility',
          'The selected output cannot use Linux symlinks.',
          'failed',
          'Use STRM for native Windows paths or storage without symlink support; otherwise check mount options and permissions.'
        )
      }
    }
    if (options.useSymlinks && !options.sampleMediaPath)
      add(
        'server-target',
        'Original target not checked',
        'No catalog movie path is available to sample.',
        'warning',
        'Import the catalog and retry, or verify a published item manually.'
      )
    if (options.listDirectory) {
      try {
        const entries = await options.listDirectory(remotePath)
        if (!entries.some((entry) => entry.Name === 'visible.txt'))
          throw new Error('Output marker missing')
        add(
          'server-output',
          'Media-server output visibility',
          'The media server can list a temporary file in the configured output folder.',
          'passed'
        )
        if (options.useSymlinks && options.sampleMediaPath && !windows) {
          const paths = /\\/.test(options.sampleMediaPath) ? path.win32 : path.posix
          await fs.symlink(
            paths.dirname(options.sampleMediaPath),
            path.join(temporary, 'server-link')
          )
          const files = await options.listDirectory(remotePath + '/server-link')
          if (!files.some((entry) => entry.Name === paths.basename(options.sampleMediaPath!)))
            throw new Error('Source missing')
          add(
            'server-target',
            'Media-server link resolution',
            'The media server followed an output link and listed a sampled original file. This does not verify playback.',
            'passed'
          )
        }
      } catch (error) {
        const definitive =
          error instanceof Error &&
          ['Output marker missing', 'Source missing'].includes(error.message)
        add(
          'server-path',
          'Media-server path check',
          'The media server could not verify output visibility or the sampled target.',
          definitive ? 'failed' : 'warning',
          'Check the server-side output path, source paths, permissions and share settings; test a published item before scheduling jobs.'
        )
      }
    } else {
      add(
        'server-path',
        'Media-server path check',
        'Automatic server-side filesystem checking is unavailable for this provider.',
        'warning',
        'Verify output visibility and playback in your media server.'
      )
    }
  } catch {
    add(
      'write-access',
      'Output write access',
      'Aperture could not prepare its output check.',
      'failed',
      'Check the /aperture-libraries mount and write permissions.'
    )
  } finally {
    if (temporary) {
      try {
        await fs.rm(temporary, { recursive: true, force: true })
      } catch {
        add(
          'cleanup',
          'Temporary check cleanup',
          'The temporary output check could not be removed.',
          'failed',
          'Check output permissions and remove the .aperture-check directory before retrying.'
        )
      }
    }
  }
  try {
    await fs.readdir(options.mediaRoot)
    add(
      'media-access',
      'Optional source access',
      'Aperture can browse its source mount for artwork and sidecars.',
      'passed'
    )
  } catch {
    add(
      'media-access',
      'Optional source access',
      'No readable source mount. Video pointers can still work through the media server.',
      'warning',
      'Mount sources read-only under /media if Aperture should read local artwork and sidecars.'
    )
  }
  add(
    'playback',
    'Playback not yet verified',
    'Filesystem checks do not establish decoding, subtitles, Direct Play or client compatibility.',
    'warning',
    'Publish a small selection and open one movie and TV episode in the media server. Check audio, external subtitles and seeking.'
  )
  return checks
}
