#!/usr/bin/env node

/**
 * Database Migration Runner
 *
 * Usage:
 *   node scripts/migrate.mjs              # Run all pending migrations
 *   node scripts/migrate.mjs --status     # Show migration status
 *
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string (required)
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import pg from 'pg'

// Load .env.local for local development
const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../.env.local') })

const { Pool } = pg
const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS aperture_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT name FROM aperture_migrations ORDER BY name')
  return new Set(result.rows.map((row) => row.name))
}

async function readMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR)
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()

  const migrations = []
  for (const file of sqlFiles) {
    const content = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8')
    migrations.push({ name: file, content })
  }

  return migrations
}

async function applyMigration(client, migration) {
  log(`  Applying: ${migration.name}`, 'cyan')

  await client.query('BEGIN')
  try {
    await client.query(migration.content)
    await client.query('INSERT INTO aperture_migrations (name) VALUES ($1)', [migration.name])
    await client.query('COMMIT')
    log(`  ✓ Applied: ${migration.name}`, 'green')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

async function showStatus(pool) {
  const client = await pool.connect()

  try {
    await ensureMigrationsTable(client)
    const appliedMigrations = await getAppliedMigrations(client)
    const migrations = await readMigrationFiles()

    log('\nMigration Status:', 'cyan')
    log('─'.repeat(50), 'dim')

    for (const migration of migrations) {
      if (appliedMigrations.has(migration.name)) {
        log(`  ✓ ${migration.name}`, 'green')
      } else {
        log(`  ○ ${migration.name} (pending)`, 'yellow')
      }
    }

    const pendingCount = migrations.filter((m) => !appliedMigrations.has(m.name)).length
    log('─'.repeat(50), 'dim')
    log(`\nTotal: ${migrations.length} | Applied: ${appliedMigrations.size} | Pending: ${pendingCount}`)
  } finally {
    client.release()
  }
}

async function runMigrations(pool) {
  const client = await pool.connect()

  try {
    await ensureMigrationsTable(client)
    const appliedMigrations = await getAppliedMigrations(client)
    const migrations = await readMigrationFiles()

    if (migrations.length === 0) {
      log('\n⚠ No migration files found in ' + MIGRATIONS_DIR, 'yellow')
      return { applied: [], skipped: [] }
    }

    const pending = migrations.filter((m) => !appliedMigrations.has(m.name))

    if (pending.length === 0) {
      log('\n✓ All migrations are up to date', 'green')
      return { applied: [], skipped: migrations.map((m) => m.name) }
    }

    log(`\nRunning ${pending.length} migration(s)...`, 'cyan')
    log('─'.repeat(50), 'dim')

    const applied = []
    for (const migration of pending) {
      await applyMigration(client, migration)
      applied.push(migration.name)
    }

    log('─'.repeat(50), 'dim')
    log(`\n✓ Successfully applied ${applied.length} migration(s)`, 'green')

    return { applied, skipped: migrations.filter((m) => appliedMigrations.has(m.name)).map((m) => m.name) }
  } finally {
    client.release()
  }
}

async function main() {
  let databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    log('Error: DATABASE_URL environment variable is required', 'red')
    process.exit(1)
  }

  // When running locally (outside Docker), replace 'db' hostname with 'localhost'
  // This allows the same .env.local to work both in Docker and locally
  if (!process.env.DOCKER_ENV) {
    databaseUrl = databaseUrl.replace(/@db:/, '@localhost:')
  }

  const showStatusOnly = process.argv.includes('--status')

  log('\n🔮 Aperture Database Migration', 'cyan')
  log(`   Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`, 'dim')

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
  })

  try {
    if (showStatusOnly) {
      await showStatus(pool)
    } else {
      await runMigrations(pool)
    }
  } catch (err) {
    log(`\n✗ Migration failed: ${err.message}`, 'red')
    if (err.detail) {
      log(`  Detail: ${err.detail}`, 'dim')
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
