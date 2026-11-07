import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { downloadImage } from './images.js'
import type { ImageDownloadTask } from './types.js'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('incremental-output')
const IMAGE_CACHE_MS = 24 * 60 * 60 * 1000
const outputLocks = new Map<string, Promise<void>>()

async function withOutputLock<T>(destination: string, work: () => Promise<T>): Promise<T> {
  const previous = outputLocks.get(destination) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  outputLocks.set(destination, current)
  await previous
  try {
    return await work()
  } finally {
    release()
    if (outputLocks.get(destination) === current) outputLocks.delete(destination)
  }
}

async function isRegularOutputFile(root: string, relative: string): Promise<boolean> {
  let current = root
  const components = relative.split(path.sep)
  for (const part of components.slice(0, -1)) {
    if (!(await stat(current))?.isDirectory()) return false
    current = path.join(current, part)
  }
  return (
    (await stat(path.dirname(path.join(root, relative))))?.isDirectory() === true &&
    (await stat(path.join(root, relative)))?.isFile() === true
  )
}

async function stat(file: string) {
  try {
    return await fs.lstat(file)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

interface ImageCacheEntry {
  fingerprint: string
  checkedAt: number
}

/** Build away from Emby's watched folders, then publish only actual differences. */
export class GeneratedOutput {
  private readonly images: Record<string, ImageCacheEntry> = {}
  readonly changes: Changes = { updated: 0, removed: 0 }

  constructor(
    readonly path: string,
    private readonly destination: string,
    private readonly previousImages: Record<string, ImageCacheEntry> = {},
    private readonly incremental = true
  ) {}

  async pruneStaleFiles(images: ImageDownloadTask[]): Promise<void> {
    if (!this.incremental) return
    // Withdraw revoked media before waiting for optional image downloads.
    await pruneStale(
      this.path,
      this.destination,
      this.changes,
      new Set(images.map((image) => image.path))
    )
  }

  async withdrawFolder(name: string): Promise<void> {
    if (!this.incremental || !name || name === '.' || name === '..' || name.includes(path.sep))
      return
    if (!(await stat(this.destination))?.isDirectory()) return
    const target = path.join(this.destination, name)
    if (await stat(target)) {
      await fs.rm(target, { recursive: true, force: true })
      this.changes.removed++
    }
  }

  async downloadImage(task: ImageDownloadTask): Promise<boolean> {
    if (!this.incremental) return downloadImage(task)
    const relative = path.relative(this.path, task.path)
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Image is outside output directory')
    // Persist hashes, never media-server URLs or credentials.
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          version: 1,
          url: task.url,
          fallbacks: task.fallbackUrls,
          poster: task.isPoster,
          rank: task.rank,
          score: task.matchScore,
          mode: task.mode,
        })
      )
      .digest('hex')
    const previous = this.previousImages[relative]
    const existing = path.join(this.destination, relative)
    const canReuse =
      previous?.fingerprint === fingerprint &&
      (await isRegularOutputFile(this.destination, relative))
    if (canReuse && Date.now() - previous.checkedAt < IMAGE_CACHE_MS) {
      await fs.copyFile(existing, task.path)
      this.images[relative] = previous
      return true
    }
    if (await downloadImage(task)) {
      this.images[relative] = { fingerprint, checkedAt: Date.now() }
      return true
    }
    // A temporary artwork failure must not delete a previously verified image.
    if (canReuse) {
      await fs.copyFile(existing, task.path)
      this.images[relative] = previous
      return true
    }
    return false
  }

  get imageCache(): Record<string, ImageCacheEntry> {
    return this.images
  }
}

interface Changes {
  updated: number
  removed: number
}

async function pruneStale(
  staged: string,
  destination: string,
  changes: Changes,
  reserved: Set<string>
): Promise<void> {
  const existing = await stat(destination)
  if (!existing) return
  if (!existing.isDirectory()) {
    await fs.rm(destination, { recursive: true, force: true })
    changes.removed++
    return
  }
  const expected = new Map(
    (await fs.readdir(staged, { withFileTypes: true })).map((entry) => [entry.name, entry])
  )
  for (const name of await fs.readdir(destination)) {
    const entry = expected.get(name)
    const source = path.join(staged, name)
    const target = path.join(destination, name)
    const current = await stat(target)
    if (!entry && reserved.has(source)) continue
    if (
      !entry ||
      (entry.isDirectory() && !current?.isDirectory()) ||
      (entry.isFile() && !current?.isFile()) ||
      (entry.isSymbolicLink() &&
        (!current?.isSymbolicLink() || (await fs.readlink(source)) !== (await fs.readlink(target))))
    ) {
      await fs.rm(target, { recursive: true, force: true })
      changes.removed++
    } else if (entry.isDirectory()) {
      await pruneStale(source, target, changes, reserved)
    }
  }
}

/** Never follow existing directory symlinks when pruning or publishing files. */
async function reconcile(staged: string, destination: string, changes: Changes): Promise<void> {
  const existing = await stat(destination)
  if (existing && !existing.isDirectory()) {
    await fs.rm(destination, { recursive: true, force: true })
    changes.removed++
  }
  if (!existing?.isDirectory()) {
    await fs.mkdir(destination, { recursive: true })
    changes.updated++
  }

  const expected = await fs.readdir(staged, { withFileTypes: true })
  const names = new Set(expected.map((entry) => entry.name))
  for (const entry of await fs.readdir(destination)) {
    if (!names.has(entry)) {
      await fs.rm(path.join(destination, entry), { recursive: true, force: true })
      changes.removed++
    }
  }
  for (const entry of expected) {
    const source = path.join(staged, entry.name)
    const target = path.join(destination, entry.name)
    if (entry.isDirectory()) {
      await reconcile(source, target, changes)
      continue
    }
    const current = await stat(target)
    if (entry.isSymbolicLink()) {
      const link = await fs.readlink(source)
      if (current?.isSymbolicLink() && (await fs.readlink(target)) === link) continue
    } else if (
      entry.isFile() &&
      current?.isFile() &&
      (await fs.stat(source)).size === current.size
    ) {
      const [before, after] = await Promise.all([fs.readFile(target), fs.readFile(source)])
      if (before.equals(after)) continue
    }
    if (current?.isDirectory()) await fs.rm(target, { recursive: true, force: true })
    // Both directories are on the output volume; changed files replace atomically.
    await fs.rename(source, target)
    changes.updated++
  }
}

interface OutputOptions {
  root: string
  destination: string
  incremental: boolean
}

interface OutputState {
  images: Record<string, ImageCacheEntry>
  needsRefresh: boolean
  revision: string
}

function statePath(destination: string): string {
  return path.join(
    path.dirname(destination),
    '.aperture-state',
    createHash('sha256').update(destination).digest('hex') + '.json'
  )
}

export async function acknowledgeOutputRefresh(
  destination: string,
  revision?: string
): Promise<void> {
  if (!revision) return
  await withOutputLock(destination, async () => {
    const file = statePath(destination)
    const state: OutputState = JSON.parse(await fs.readFile(file, 'utf8'))
    if (state.revision !== revision) return
    await fs.writeFile(file, JSON.stringify({ ...state, needsRefresh: false }))
  })
}

export async function publishGeneratedOutput<T extends { localPath: string; deleted: number }>(
  options: OutputOptions,
  build: (output: GeneratedOutput) => Promise<T>
): Promise<T & { changed: boolean; needsRefresh: boolean; revision?: string }> {
  if (!options.incremental) {
    return {
      ...(await build(new GeneratedOutput(options.destination, options.destination, {}, false))),
      changed: true,
      needsRefresh: true,
    }
  }
  const relative = path.relative(options.root, options.destination)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Invalid generated output path')
  return withOutputLock(options.destination, async () => {
    let staged: string | undefined
    try {
      const stateRoot = path.join(path.dirname(options.destination), '.aperture-state')
      const stagingRoot = path.join(path.dirname(options.destination), '.aperture-staging')
      await fs.mkdir(stagingRoot, { recursive: true })
      staged = await fs.mkdtemp(path.join(stagingRoot, 'output-'))
      const stateFile = statePath(options.destination)
      let previousState: Partial<OutputState> = {}
      try {
        const parsed = JSON.parse(await fs.readFile(stateFile, 'utf8'))
        if (parsed && typeof parsed === 'object') previousState = parsed
      } catch {
        // Missing/corrupt cache metadata only causes fresh artwork downloads.
      }
      const output = new GeneratedOutput(staged, options.destination, previousState.images ?? {})
      const result = await build(output)
      const changes = output.changes
      await reconcile(staged, options.destination, changes)
      await fs.mkdir(stateRoot, { recursive: true })
      const changed = changes.updated + changes.removed > 0
      const needsRefresh = changed || previousState.needsRefresh !== false
      const revision = changed || !previousState.revision ? randomUUID() : previousState.revision
      await fs.writeFile(
        stateFile,
        JSON.stringify({ images: output.imageCache, needsRefresh, revision })
      )
      logger.info(
        { destination: options.destination, ...changes, changed },
        'Generated output reconciled'
      )
      return {
        ...result,
        localPath: options.destination,
        deleted: result.deleted + changes.removed,
        changed,
        needsRefresh,
        revision,
      }
    } catch (err) {
      // Authorization, source reads, and publication must all succeed. Failed or
      // denied output cannot retain previously published access to source media.
      await fs.rm(options.destination, { recursive: true, force: true })
      throw err
    } finally {
      if (staged) await fs.rm(staged, { recursive: true, force: true })
    }
  })
}
