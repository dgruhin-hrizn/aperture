import { execFile } from 'child_process'
import { promisify } from 'util'
import { createChildLogger } from '../lib/logger.js'
import { queryOne } from '../lib/db.js'

const execFileAsync = promisify(execFile)

const logger = createChildLogger('db-client-compat')

/**
 * Result of comparing the bundled pg_dump/pg_restore client against the
 * PostgreSQL server Aperture is connected to.
 *
 * - `ok`                        client and server majors match
 * - `client-too-old`            client major < server major; pg_dump REFUSES to run
 * - `restore-needs-new-client`  client major > server major; dumps this client writes
 *                               cannot be read by a pg_restore matching the server
 * - `unknown`                   either version could not be determined
 */
export type DatabaseClientStatus =
  | 'ok'
  | 'client-too-old'
  | 'restore-needs-new-client'
  | 'unknown'

export interface DatabaseClientCompatibility {
  serverMajor: number | null
  clientMajor: number | null
  status: DatabaseClientStatus
}

/**
 * Major version of the PostgreSQL server, via `server_version_num`
 * (e.g. 160015 -> 16). Returns null if it cannot be read.
 */
async function getServerMajor(): Promise<number | null> {
  try {
    const row = await queryOne<{ server_version_num: string }>('SHOW server_version_num')
    const num = Number(row?.server_version_num)
    if (!Number.isFinite(num) || num <= 0) return null
    return Math.floor(num / 10000)
  } catch (err) {
    logger.debug({ err }, 'Could not read server_version_num')
    return null
  }
}

/**
 * Major version of the bundled pg_dump binary, parsed from
 * `pg_dump (PostgreSQL) 16.15`. Returns null if pg_dump is absent
 * (common in local dev outside Docker).
 */
async function getClientMajor(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('pg_dump', ['--version'])
    const match = stdout.match(/(\d+)\.(\d+)/)
    if (!match) return null
    return Number(match[1])
  } catch (err) {
    logger.debug({ err }, 'Could not run pg_dump --version')
    return null
  }
}

/**
 * Compare the bundled backup client against the live server and log an
 * actionable message when they are incompatible.
 *
 * Why this exists: the client major and the server major must move together.
 * pg_dump refuses to run against a server newer than itself, and pg_restore
 * cannot read an archive written by a newer pg_dump. A drifting client turns
 * both backup and restore into failures that only surface in an emergency.
 *
 * Never throws — a failed check must not stop the server from booting.
 */
export async function checkDatabaseClientCompatibility(): Promise<DatabaseClientCompatibility> {
  const [serverMajor, clientMajor] = await Promise.all([getServerMajor(), getClientMajor()])

  if (serverMajor === null || clientMajor === null) {
    logger.debug({ serverMajor, clientMajor }, 'Skipping database client compatibility check')
    return { serverMajor, clientMajor, status: 'unknown' }
  }

  if (clientMajor < serverMajor) {
    logger.error(
      { serverMajor, clientMajor },
      `Database backups are DISABLED by a version mismatch: the bundled pg_dump is ` +
        `${clientMajor} but the server is ${serverMajor}. pg_dump refuses to run against a ` +
        `newer server, so scheduled and manual backups will fail. Use an Aperture image whose ` +
        `client matches PostgreSQL ${serverMajor}, or move the database back to ${clientMajor}.`
    )
    return { serverMajor, clientMajor, status: 'client-too-old' }
  }

  if (clientMajor > serverMajor) {
    logger.warn(
      { serverMajor, clientMajor },
      `Backups are written by pg_dump ${clientMajor} while the server is ${serverMajor}. ` +
        `Backups will succeed, but the resulting .dump files can only be restored by ` +
        `pg_restore ${clientMajor} or newer — not by the tools inside the database container.`
    )
    return { serverMajor, clientMajor, status: 'restore-needs-new-client' }
  }

  logger.info(
    { serverMajor, clientMajor },
    `Database client matches server (PostgreSQL ${serverMajor})`
  )
  return { serverMajor, clientMajor, status: 'ok' }
}
