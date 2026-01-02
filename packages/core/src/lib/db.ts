import pg from 'pg'
import { createChildLogger } from './logger.js'
import { getDatabaseUrl } from '../config/env.js'

const { Pool } = pg

const logger = createChildLogger('db')

let pool: pg.Pool | null = null

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number | null
}

export function getPool(): pg.Pool {
  if (!pool) {
    const databaseUrl = getDatabaseUrl()

    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected database pool error')
    })

    pool.on('connect', () => {
      logger.debug('New database connection established')
    })
  }

  return pool
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now()
  const result = await getPool().query(text, params)
  const duration = Date.now() - start

  logger.debug({ query: text.substring(0, 100), duration, rows: result.rowCount }, 'Query executed')

  return {
    rows: result.rows as T[],
    rowCount: result.rowCount,
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params)
  return result.rows[0] || null
}

export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect()

  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    logger.info('Database pool closed')
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export type { Pool, PoolClient } from 'pg'

