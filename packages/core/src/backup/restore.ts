import { spawn, type ChildProcess } from 'node:child_process'
import { createReadStream, createWriteStream, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('database-restore')

/** pg_dump 17 emits transaction_timeout even when its source is PostgreSQL 16. */
async function* compatibleRestoreSql(source: AsyncIterable<Buffer>, olderServer: boolean) {
  let header: Buffer[] | null = olderServer ? [] : null
  let headerBytes = 0
  const normalize = (bytes: Buffer) => {
    const boundary = bytes.indexOf('SET client_encoding =')
    if (boundary < 0) return bytes
    const preamble = bytes.subarray(0, boundary).toString('utf8')
    if (!preamble.startsWith('--') || !preamble.includes('-- PostgreSQL database dump')) return bytes
    return Buffer.concat([
      Buffer.from(preamble.replace(/^SET transaction_timeout = 0;\r?\n/m, '')),
      bytes.subarray(boundary),
    ])
  }
  for await (const chunk of source) {
    if (!header) {
      yield chunk
      continue
    }
    header.push(chunk)
    headerBytes += chunk.length
    if (headerBytes >= 4096) {
      yield normalize(Buffer.concat(header))
      header = null
    }
  }
  if (header) yield normalize(Buffer.concat(header))
}

function childCompletion(child: ChildProcess, name: string): Promise<void> {
  let stderr = ''
  child.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-16000) })
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${name} exited with ${signal ?? code}: ${stderr.trim()}`))
    })
  })
}

export async function restoreInTransaction(
  filePath: string,
  db: { host: string; port: string; user: string; database: string; password: string },
  olderServer: boolean
): Promise<void> {
  const scratch = await fs.mkdtemp(join(tmpdir(), 'aperture-restore-'))
  const sqlPath = join(scratch, 'restore.sql')
  try {
    const output = createWriteStream(sqlPath, { mode: 0o600 })
    if (filePath.endsWith('.dump')) {
      const converter = spawn('pg_restore', [
        '--clean', '--if-exists', '--no-owner', '--no-acl', '--file=-', filePath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
      // Require the archive to be read completely before a database transaction starts.
      const converted = childCompletion(converter, 'pg_restore')
      try {
        await Promise.all([
          pipeline(converter.stdout, (source) => compatibleRestoreSql(source, olderServer), output),
          converted,
        ])
      } finally {
        if (converter.exitCode === null && converter.signalCode === null) converter.kill()
        await converted.catch(() => undefined)
      }
    } else {
      const input = createReadStream(filePath)
      if (filePath.endsWith('.gz')) {
        await pipeline(input, createGunzip(), (source) => compatibleRestoreSql(source, olderServer), output)
      } else {
        await pipeline(input, (source) => compatibleRestoreSql(source, olderServer), output)
      }
    }

    const restore = spawn('psql', [
      '-X', '-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database,
      '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', sqlPath,
    ], {
      env: { ...process.env, PGPASSWORD: db.password },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    await childCompletion(restore, 'psql')
  } finally {
    await fs.rm(scratch, { recursive: true, force: true }).catch((err) =>
      logger.warn({ err }, 'Could not remove temporary restore data')
    )
  }
}
