import { buildServer } from './server.js'
import { validateEnv, getDatabaseUrl } from './config/env.js'
import { runMigrations, getMigrationStatus, detectInterruptedEnrichmentRuns, checkDatabaseClientCompatibility } from '@aperture/core'
import { closePool } from './lib/db.js'
import { initializeScheduler, stopScheduler } from './lib/scheduler.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err)
  // Don't exit - try to keep running
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit - try to keep running
})

async function main() {
  // Validate environment variables
  let env
  try {
    env = validateEnv()
  } catch (err) {
    console.error('Failed to validate environment:', err)
    process.exit(1)
  }

  const migrationsDir = path.resolve(__dirname, '../../../db/migrations')
  const databaseUrl = getDatabaseUrl()

  // Preflight: the bundled pg_dump/pg_restore major must track the server major,
  // or backups silently stop working. Logs and continues; never throws.
  await checkDatabaseClientCompatibility()

  // Run migrations if enabled
  if (env.RUN_MIGRATIONS_ON_START) {
    console.log('🔮 Running database migrations...')
    try {
      const result = await runMigrations(databaseUrl, migrationsDir)
      if (result.applied.length > 0) {
        console.log(`✓ Applied ${result.applied.length} migration(s)`)
      } else {
        console.log('✓ Database is up to date')
      }
    } catch (err) {
      console.error('Failed to run migrations:', err)
      process.exit(1)
    }
  } else {
    // Just check migration status
    try {
      const status = await getMigrationStatus(databaseUrl, migrationsDir)
      if (status.pending.length > 0) {
        console.warn(`⚠ ${status.pending.length} pending migration(s). Run 'pnpm db:migrate' to apply.`)
      }
    } catch {
      console.warn('⚠ Could not check migration status')
    }
  }

  // Detect any enrichment runs that were interrupted (e.g. container restart)
  try {
    await detectInterruptedEnrichmentRuns()
  } catch (err) {
    console.warn('⚠️ Could not check for interrupted enrichment runs:', err)
    // Don't exit - this is a recoverable error
  }

  // Build and start server
  const server = await buildServer({ logger: true })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`)

    try {
      stopScheduler()
      await server.close()
      await closePool()
      console.log('Server closed')
      process.exit(0)
    } catch (err) {
      console.error('Error during shutdown:', err)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Start listening
  try {
    const address = await server.listen({
      port: env.PORT,
      host: '0.0.0.0',
    })
    console.log(`🚀 Aperture API server running at ${address}`)

    // Initialize job scheduler after server is running
    try {
      await initializeScheduler()
      console.log('📅 Job scheduler initialized')
    } catch (err) {
      console.error('⚠️ Failed to initialize scheduler:', err)
      // Don't exit - scheduler failure shouldn't prevent server from running
    }
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

main()

