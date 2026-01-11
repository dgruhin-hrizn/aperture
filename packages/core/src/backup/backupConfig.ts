import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'

const logger = createChildLogger('backup-config')

export interface BackupConfig {
  backupPath: string
  retentionCount: number
  lastBackupAt: Date | null
  lastBackupFilename: string | null
  lastBackupSizeBytes: number | null
  createdAt: Date
  updatedAt: Date
}

interface BackupConfigRow {
  id: number
  backup_path: string
  retention_count: number
  last_backup_at: Date | null
  last_backup_filename: string | null
  last_backup_size_bytes: string | null
  created_at: Date
  updated_at: Date
}

const DEFAULT_CONFIG: Omit<BackupConfig, 'createdAt' | 'updatedAt'> = {
  backupPath: '/backups',
  retentionCount: 7,
  lastBackupAt: null,
  lastBackupFilename: null,
  lastBackupSizeBytes: null,
}

function rowToConfig(row: BackupConfigRow): BackupConfig {
  return {
    backupPath: row.backup_path,
    retentionCount: row.retention_count,
    lastBackupAt: row.last_backup_at,
    lastBackupFilename: row.last_backup_filename,
    lastBackupSizeBytes: row.last_backup_size_bytes ? parseInt(row.last_backup_size_bytes, 10) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Get backup configuration
 */
export async function getBackupConfig(): Promise<BackupConfig> {
  const row = await queryOne<BackupConfigRow>(
    'SELECT * FROM backup_config WHERE id = 1'
  )

  if (!row) {
    // Insert default config if it doesn't exist
    await query(
      `INSERT INTO backup_config (id, backup_path, retention_count)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_CONFIG.backupPath, DEFAULT_CONFIG.retentionCount]
    )

    const newRow = await queryOne<BackupConfigRow>(
      'SELECT * FROM backup_config WHERE id = 1'
    )

    if (!newRow) {
      throw new Error('Failed to create backup config')
    }

    return rowToConfig(newRow)
  }

  return rowToConfig(row)
}

/**
 * Update backup configuration
 */
export async function setBackupConfig(updates: {
  backupPath?: string
  retentionCount?: number
}): Promise<BackupConfig> {
  const current = await getBackupConfig()

  const newPath = updates.backupPath ?? current.backupPath
  const newRetention = updates.retentionCount ?? current.retentionCount

  // Validate retention count
  if (newRetention < 1 || newRetention > 100) {
    throw new Error('Retention count must be between 1 and 100')
  }

  await query(
    `UPDATE backup_config 
     SET backup_path = $1, retention_count = $2, updated_at = NOW()
     WHERE id = 1`,
    [newPath, newRetention]
  )

  logger.info({ backupPath: newPath, retentionCount: newRetention }, 'Backup config updated')

  return getBackupConfig()
}

/**
 * Update last backup info after successful backup
 */
export async function updateLastBackupInfo(
  filename: string,
  sizeBytes: number
): Promise<void> {
  await query(
    `UPDATE backup_config 
     SET last_backup_at = NOW(), 
         last_backup_filename = $1, 
         last_backup_size_bytes = $2,
         updated_at = NOW()
     WHERE id = 1`,
    [filename, sizeBytes]
  )

  logger.info({ filename, sizeBytes }, 'Last backup info updated')
}

