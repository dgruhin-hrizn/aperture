import fs from 'fs/promises'
import path from 'path'
import pg from 'pg'
import { createChildLogger } from './lib/logger.js'

const { Pool } = pg

const logger = createChildLogger('migrations')

interface Migration {
  name: string
  content: string
}

interface AppliedMigration {
  name: string
  applied_at: Date
}

export interface MigrationResult {
  applied: string[]
  skipped: string[]
  error?: string
}

async function ensureMigrationsTable(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS aperture_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

async function getAppliedMigrations(client: pg.PoolClient): Promise<Set<string>> {
  const result = await client.query<AppliedMigration>(
    'SELECT name FROM aperture_migrations ORDER BY name'
  )
  return new Set(result.rows.map((row) => row.name))
}

async function readMigrationFiles(migrationsDir: string): Promise<Migration[]> {
  const files = await fs.readdir(migrationsDir)
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()

  const migrations: Migration[] = []

  for (const file of sqlFiles) {
    const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8')
    migrations.push({
      name: file,
      content,
    })
  }

  return migrations
}

async function applyMigration(
  client: pg.PoolClient,
  migration: Migration
): Promise<void> {
  logger.info({ migration: migration.name }, 'Applying migration')

  // Run migration in transaction
  await client.query('BEGIN')
  try {
    await client.query(migration.content)
    await client.query('INSERT INTO aperture_migrations (name) VALUES ($1)', [migration.name])
    await client.query('COMMIT')
    logger.info({ migration: migration.name }, 'Migration applied successfully')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

export async function runMigrations(
  databaseUrl: string,
  migrationsDir: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    applied: [],
    skipped: [],
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const client = await pool.connect()

    try {
      // Ensure migrations table exists (outside of migration transactions)
      await ensureMigrationsTable(client)

      // Get already applied migrations
      const appliedMigrations = await getAppliedMigrations(client)

      // Read migration files
      const migrations = await readMigrationFiles(migrationsDir)

      if (migrations.length === 0) {
        logger.warn({ migrationsDir }, 'No migration files found')
        return result
      }

      logger.info({ total: migrations.length, applied: appliedMigrations.size }, 'Starting migrations')

      for (const migration of migrations) {
        if (appliedMigrations.has(migration.name)) {
          result.skipped.push(migration.name)
          continue
        }

        await applyMigration(client, migration)
        result.applied.push(migration.name)
      }

      if (result.applied.length > 0) {
        logger.info({ applied: result.applied }, 'Migrations completed')
      } else {
        logger.info('No new migrations to apply')
      }
    } finally {
      client.release()
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'Migration failed')
    result.error = error
    throw err
  } finally {
    await pool.end()
  }

  return result
}

export async function getMigrationStatus(
  databaseUrl: string,
  migrationsDir: string
): Promise<{ applied: string[]; pending: string[] }> {
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const client = await pool.connect()

    try {
      await ensureMigrationsTable(client)
      const appliedMigrations = await getAppliedMigrations(client)
      const migrations = await readMigrationFiles(migrationsDir)

      const applied: string[] = []
      const pending: string[] = []

      for (const migration of migrations) {
        if (appliedMigrations.has(migration.name)) {
          applied.push(migration.name)
        } else {
          pending.push(migration.name)
        }
      }

      return { applied, pending }
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

