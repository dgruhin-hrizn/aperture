import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { createChildLogger } from '../lib/logger.js'
import { getDatabaseUrl } from '../config/env.js'
import { getBackupConfig, updateLastBackupInfo } from './backupConfig.js'
import {
  createJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
  isJobCancelled,
} from '../jobs/progress.js'

const logger = createChildLogger('backup-service')

// Track active backup processes for cancellation
const activeBackupProcesses = new Map<string, ChildProcess>()

/**
 * Cancel an active backup by killing its process
 */
export function cancelBackupProcess(jobId: string): boolean {
  const process = activeBackupProcesses.get(jobId)
  if (process) {
    process.kill('SIGTERM')
    activeBackupProcesses.delete(jobId)
    return true
  }
  return false
}

export interface BackupInfo {
  filename: string
  path: string
  sizeBytes: number
  createdAt: Date
  isCompressed: boolean
}

export interface BackupResult {
  success: boolean
  filename?: string
  path?: string
  sizeBytes?: number
  error?: string
  duration?: number
}

export interface RestoreResult {
  success: boolean
  error?: string
  duration?: number
  preRestoreBackup?: string
}

/**
 * Parse DATABASE_URL into connection parameters
 */
function parseDatabaseUrl(): {
  host: string
  port: string
  database: string
  user: string
  password: string
} {
  const url = getDatabaseUrl()
  const parsed = new URL(url)

  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.slice(1), // Remove leading /
    user: parsed.username,
    password: parsed.password,
  }
}

/**
 * Generate a timestamped backup filename
 * Uses .dump extension for pg_dump custom format (compressed)
 */
function generateBackupFilename(): string {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  return `aperture_backup_${timestamp}.dump`
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(backupPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(backupPath, { recursive: true })
  } catch (err) {
    logger.error({ err, backupPath }, 'Failed to create backup directory')
    throw new Error(`Failed to create backup directory: ${backupPath}`)
  }
}

/**
 * Create a database backup
 * @param jobId Optional job ID for progress tracking
 */
export async function createBackup(jobId?: string): Promise<BackupResult> {
  const startTime = Date.now()
  const trackProgress = !!jobId

  // Create job progress if jobId provided
  if (trackProgress && jobId) {
    createJobProgress(jobId, 'backup-database', 4)
  }

  try {
    // Step 1: Initialize
    if (trackProgress && jobId) {
      setJobStep(jobId, 0, 'Initializing backup')
      addLog(jobId, 'info', '🔧 Loading backup configuration...')
    }

    const config = await getBackupConfig()
    const dbConfig = parseDatabaseUrl()

    await ensureBackupDir(config.backupPath)

    const filename = generateBackupFilename()
    const filePath = path.join(config.backupPath, filename)

    logger.info({ filename, backupPath: config.backupPath }, 'Starting database backup')

    // Step 2: Run pg_dump
    if (trackProgress && jobId) {
      setJobStep(jobId, 1, 'Dumping database')
      addLog(jobId, 'info', `📦 Running pg_dump to ${filename}...`)
      addLog(jobId, 'info', `   Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`)
    }

    // Create pg_dump process with optimized settings
    // Using custom format (-F c) with compression level 6 (-Z 6) is faster than
    // plain text + gzip because pg_dump compresses while dumping, avoiding
    // the overhead of piping through a separate gzip process.
    // Level 6 is ~3x faster than level 9 with minimal size difference (~5% larger).
    const pgDump = spawn('pg_dump', [
      '-h', dbConfig.host,
      '-p', dbConfig.port,
      '-U', dbConfig.user,
      '-d', dbConfig.database,
      '--no-owner',
      '--no-acl',
      '-F', 'c',  // Custom format (includes compression, faster restore)
      '-Z', '6',  // Compression level 6 (balanced speed/size)
    ], {
      env: {
        ...process.env,
        PGPASSWORD: dbConfig.password,
      },
    })

    // Track the process for cancellation
    if (jobId) {
      activeBackupProcesses.set(jobId, pgDump)
    }

    // Write directly to file (pg_dump handles compression internally)
    const writeStream = fs.createWriteStream(filePath)

    // Collect stderr for error reporting
    let stderr = ''
    let wasCancelled = false

    pgDump.stderr.on('data', (data) => {
      stderr += data.toString()
      // Log any pg_dump messages
      if (trackProgress && jobId && data.toString().trim()) {
        addLog(jobId, 'debug', `   pg_dump: ${data.toString().trim()}`)
      }
    })

    // Pipe pg_dump -> file (compression handled by pg_dump)
    try {
      await new Promise<void>((resolve, reject) => {
        pgDump.stdout.pipe(writeStream)

        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
        pgDump.on('error', reject)
        pgDump.on('close', (code, signal) => {
          // Check if it was cancelled
          if (signal === 'SIGTERM' || (jobId && isJobCancelled(jobId))) {
            wasCancelled = true
            reject(new Error('Backup cancelled'))
          } else if (code !== 0) {
            reject(new Error(`pg_dump exited with code ${code}: ${stderr}`))
          }
        })
      })
    } finally {
      // Clean up process tracking
      if (jobId) {
        activeBackupProcesses.delete(jobId)
      }
    }

    // If cancelled, clean up partial file and return
    if (wasCancelled || (jobId && isJobCancelled(jobId))) {
      try {
        await fs.promises.unlink(filePath)
        logger.info({ filename }, 'Deleted partial backup file after cancellation')
      } catch {
        // Ignore if file doesn't exist
      }
      return {
        success: false,
        error: 'Backup cancelled by user',
        duration: Date.now() - startTime,
      }
    }

    // Step 3: Finalize
    if (trackProgress && jobId) {
      setJobStep(jobId, 2, 'Finalizing backup')
      addLog(jobId, 'info', '📊 Getting backup file info...')
    }

    // Get file size
    const stats = await fs.promises.stat(filePath)
    const sizeBytes = stats.size

    // Update last backup info
    await updateLastBackupInfo(filename, sizeBytes)

    if (trackProgress && jobId) {
      addLog(jobId, 'info', `✅ Backup created: ${filename} (${formatBytes(sizeBytes)})`)
    }

    // Step 4: Prune old backups
    if (trackProgress && jobId) {
      setJobStep(jobId, 3, 'Pruning old backups')
      addLog(jobId, 'info', '🗑️ Checking for old backups to remove...')
    }

    const pruned = await pruneOldBackups()
    if (pruned > 0 && trackProgress && jobId) {
      addLog(jobId, 'info', `   Removed ${pruned} old backup(s)`)
    }

    const duration = Date.now() - startTime

    logger.info({ filename, sizeBytes, duration }, 'Database backup completed successfully')

    // Complete job
    if (trackProgress && jobId) {
      completeJob(jobId, { filename, sizeBytes, duration })
      addLog(jobId, 'info', `🎉 Backup completed in ${Math.round(duration / 1000)}s`)
    }

    return {
      success: true,
      filename,
      path: filePath,
      sizeBytes,
      duration,
    }
  } catch (err) {
    const duration = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    logger.error({ err, duration }, 'Database backup failed')

    if (trackProgress && jobId) {
      failJob(jobId, errorMessage)
      addLog(jobId, 'error', `❌ Backup failed: ${errorMessage}`)
    }

    return {
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

/**
 * Restore database from a backup file
 * @param filename Backup file to restore
 * @param createPreRestoreBackup Whether to create a backup before restoring
 * @param jobId Optional job ID for progress tracking
 */
export async function restoreBackup(
  filename: string,
  createPreRestoreBackup = true,
  jobId?: string
): Promise<RestoreResult> {
  const startTime = Date.now()
  const trackProgress = !!jobId

  // Create job progress if jobId provided
  if (trackProgress && jobId) {
    createJobProgress(jobId, 'restore-database', createPreRestoreBackup ? 5 : 4)
  }

  try {
    // Step 1: Validate
    if (trackProgress && jobId) {
      setJobStep(jobId, 0, 'Validating backup file')
      addLog(jobId, 'info', `🔍 Validating backup file: ${filename}`)
    }

    const config = await getBackupConfig()
    const dbConfig = parseDatabaseUrl()
    const filePath = path.join(config.backupPath, filename)

    // Validate backup file exists
    if (!await fileExists(filePath)) {
      throw new Error(`Backup file not found: ${filename}`)
    }

    // Validate backup file
    const validation = await validateBackup(filename)
    if (!validation.valid) {
      throw new Error(`Invalid backup file: ${validation.error}`)
    }

    // Get file size for info
    const stats = await fs.promises.stat(filePath)
    if (trackProgress && jobId) {
      addLog(jobId, 'info', `✅ Backup file validated (${formatBytes(stats.size)})`)
    }

    logger.info({ filename }, 'Starting database restore')

    // Step 2: Create pre-restore backup
    let preRestoreBackup: string | undefined
    let stepOffset = 0
    if (createPreRestoreBackup) {
      if (trackProgress && jobId) {
        setJobStep(jobId, 1, 'Creating safety backup')
        addLog(jobId, 'info', '🔒 Creating pre-restore safety backup...')
      }

      const preBackupResult = await createBackup()
      if (preBackupResult.success) {
        preRestoreBackup = preBackupResult.filename
        logger.info({ preRestoreBackup }, 'Pre-restore backup created')
        if (trackProgress && jobId) {
          addLog(jobId, 'info', `✅ Safety backup created: ${preRestoreBackup}`)
        }
      } else {
        logger.warn({ error: preBackupResult.error }, 'Failed to create pre-restore backup, continuing anyway')
        if (trackProgress && jobId) {
          addLog(jobId, 'warn', `⚠️ Could not create safety backup: ${preBackupResult.error}`)
          addLog(jobId, 'info', '   Continuing with restore anyway...')
        }
      }
      stepOffset = 1
    }

    // Step 3: Prepare restore
    if (trackProgress && jobId) {
      setJobStep(jobId, 1 + stepOffset, 'Preparing database')
      addLog(jobId, 'info', '🔧 Preparing to restore database...')
      addLog(jobId, 'info', `   Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`)
    }

    // Determine restore method based on file format
    const isCustomFormat = filename.endsWith('.dump')
    const isCompressed = filename.endsWith('.gz')

    // Step 4: Run restore
    if (trackProgress && jobId) {
      setJobStep(jobId, 2 + stepOffset, 'Restoring database')
      if (isCustomFormat) {
        addLog(jobId, 'info', '📥 Running pg_restore (custom format)...')
      } else {
        addLog(jobId, 'info', `📥 Running psql restore${isCompressed ? ' (decompressing)' : ''}...`)
      }
      addLog(jobId, 'warn', '⚠️ This will overwrite existing data!')
    }

    // Collect stderr for error reporting
    let stderr = ''
    let lastLogTime = Date.now()

    if (isCustomFormat) {
      // Use pg_restore for custom format (.dump) files
      // --clean drops existing objects, --if-exists prevents errors
      const pgRestore = spawn('pg_restore', [
        '-h', dbConfig.host,
        '-p', dbConfig.port,
        '-U', dbConfig.user,
        '-d', dbConfig.database,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        filePath,
      ], {
        env: {
          ...process.env,
          PGPASSWORD: dbConfig.password,
        },
      })

      pgRestore.stderr.on('data', (data) => {
        stderr += data.toString()
        if (trackProgress && jobId && Date.now() - lastLogTime > 2000) {
          addLog(jobId, 'debug', '   Restore in progress...')
          lastLogTime = Date.now()
        }
      })

      await new Promise<void>((resolve, reject) => {
        pgRestore.on('error', reject)
        pgRestore.on('close', (code) => {
          // pg_restore returns non-zero for warnings too, check stderr for actual errors
          if (code !== 0 && stderr.toLowerCase().includes('error')) {
            reject(new Error(`pg_restore exited with code ${code}: ${stderr}`))
          } else {
            resolve()
          }
        })
      })
    } else {
      // Use psql for plain text SQL files (.sql, .sql.gz)
      const psql = spawn('psql', [
        '-h', dbConfig.host,
        '-p', dbConfig.port,
        '-U', dbConfig.user,
        '-d', dbConfig.database,
        '-v', 'ON_ERROR_STOP=1',
      ], {
        env: {
          ...process.env,
          PGPASSWORD: dbConfig.password,
        },
      })

      psql.stderr.on('data', (data) => {
        stderr += data.toString()
        if (trackProgress && jobId && Date.now() - lastLogTime > 2000) {
          addLog(jobId, 'debug', '   Restore in progress...')
          lastLogTime = Date.now()
        }
      })

      const readStream = fs.createReadStream(filePath)

      await new Promise<void>((resolve, reject) => {
        psql.on('error', reject)
        psql.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`psql exited with code ${code}: ${stderr}`))
          } else {
            resolve()
          }
        })

        if (isCompressed) {
          const gunzip = zlib.createGunzip()
          readStream.pipe(gunzip).pipe(psql.stdin)
          gunzip.on('error', reject)
        } else {
          readStream.pipe(psql.stdin)
        }

        readStream.on('error', reject)
      })
    }

    // Step 5: Finalize
    if (trackProgress && jobId) {
      setJobStep(jobId, 3 + stepOffset, 'Finalizing')
      addLog(jobId, 'info', '✅ Database restore completed')
    }

    const duration = Date.now() - startTime

    logger.info({ filename, duration }, 'Database restore completed successfully')

    // Complete job
    if (trackProgress && jobId) {
      completeJob(jobId, { filename, duration, preRestoreBackup })
      addLog(jobId, 'info', `🎉 Restore completed in ${Math.round(duration / 1000)}s`)
      if (preRestoreBackup) {
        addLog(jobId, 'info', `💡 Previous data saved to: ${preRestoreBackup}`)
      }
    }

    return {
      success: true,
      duration,
      preRestoreBackup,
    }
  } catch (err) {
    const duration = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    logger.error({ err, duration }, 'Database restore failed')

    if (trackProgress && jobId) {
      failJob(jobId, errorMessage)
      addLog(jobId, 'error', `❌ Restore failed: ${errorMessage}`)
    }

    return {
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<BackupInfo[]> {
  try {
    const config = await getBackupConfig()

    // Check if backup directory exists
    if (!await fileExists(config.backupPath)) {
      return []
    }

    const files = await fs.promises.readdir(config.backupPath)
    const backups: BackupInfo[] = []

    for (const file of files) {
      // Only include backup files (supports both old .sql/.sql.gz and new .dump formats)
      if (!file.startsWith('aperture_backup_') || (!file.endsWith('.sql') && !file.endsWith('.sql.gz') && !file.endsWith('.dump'))) {
        continue
      }

      const filePath = path.join(config.backupPath, file)
      const stats = await fs.promises.stat(filePath)

      backups.push({
        filename: file,
        path: filePath,
        sizeBytes: stats.size,
        createdAt: stats.mtime,
        isCompressed: file.endsWith('.gz') || file.endsWith('.dump'),
      })
    }

    // Sort by creation date, newest first
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return backups
  } catch (err) {
    logger.error({ err }, 'Failed to list backups')
    return []
  }
}

/**
 * Delete a specific backup file
 */
export async function deleteBackup(filename: string): Promise<boolean> {
  try {
    const config = await getBackupConfig()
    const filePath = path.join(config.backupPath, filename)

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error('Invalid filename')
    }

    // Check if file exists
    if (!await fileExists(filePath)) {
      throw new Error('Backup file not found')
    }

    await fs.promises.unlink(filePath)

    logger.info({ filename }, 'Backup file deleted')

    return true
  } catch (err) {
    logger.error({ err, filename }, 'Failed to delete backup')
    return false
  }
}

/**
 * Prune old backups based on retention policy
 */
export async function pruneOldBackups(): Promise<number> {
  try {
    const config = await getBackupConfig()
    const backups = await listBackups()

    if (backups.length <= config.retentionCount) {
      return 0
    }

    // Sort by date, oldest first
    const sortedBackups = [...backups].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    // Calculate how many to delete
    const toDelete = sortedBackups.slice(0, sortedBackups.length - config.retentionCount)

    let deleted = 0
    for (const backup of toDelete) {
      if (await deleteBackup(backup.filename)) {
        deleted++
      }
    }

    if (deleted > 0) {
      logger.info({ deleted, retentionCount: config.retentionCount }, 'Pruned old backups')
    }

    return deleted
  } catch (err) {
    logger.error({ err }, 'Failed to prune old backups')
    return 0
  }
}

/**
 * Validate a backup file
 */
export async function validateBackup(filename: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const config = await getBackupConfig()
    const filePath = path.join(config.backupPath, filename)

    // Check file exists
    if (!await fileExists(filePath)) {
      return { valid: false, error: 'File not found' }
    }

    // Check file size
    const stats = await fs.promises.stat(filePath)
    if (stats.size === 0) {
      return { valid: false, error: 'File is empty' }
    }

    // Check file extension (supports old .sql/.sql.gz and new .dump formats)
    if (!filename.endsWith('.sql') && !filename.endsWith('.sql.gz') && !filename.endsWith('.dump')) {
      return { valid: false, error: 'Invalid file extension' }
    }

    // For gzip compressed files, verify gzip header
    if (filename.endsWith('.gz')) {
      const fd = await fs.promises.open(filePath, 'r')
      const buffer = Buffer.alloc(2)
      await fd.read(buffer, 0, 2, 0)
      await fd.close()

      // Gzip magic number: 1f 8b
      if (buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
        return { valid: false, error: 'Invalid gzip file' }
      }
    }

    // For pg_dump custom format, verify PGDMP header
    if (filename.endsWith('.dump')) {
      const fd = await fs.promises.open(filePath, 'r')
      const buffer = Buffer.alloc(5)
      await fd.read(buffer, 0, 5, 0)
      await fd.close()

      // pg_dump custom format magic: PGDMP
      if (buffer.toString('ascii') !== 'PGDMP') {
        return { valid: false, error: 'Invalid pg_dump custom format file' }
      }
    }

    return { valid: true }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return { valid: false, error: errorMessage }
  }
}

/**
 * Get the full path for a backup file
 */
export async function getBackupPath(filename: string): Promise<string | null> {
  const config = await getBackupConfig()
  const filePath = path.join(config.backupPath, filename)

  if (await fileExists(filePath)) {
    return filePath
  }

  return null
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`
}

