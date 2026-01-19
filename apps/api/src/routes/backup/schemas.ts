/**
 * Backup OpenAPI Schemas
 * 
 * Database backup and restore operations. All endpoints require admin privileges.
 */

// =============================================================================
// Component Schemas
// =============================================================================

export const backupComponentSchemas = {
  // Backup file info
  BackupFile: {
    type: 'object' as const,
    description: 'Information about a backup file',
    properties: {
      filename: { type: 'string' as const, description: 'Backup filename', example: 'aperture-backup-2024-01-15-103000.sql.gz' },
      size: { type: 'integer' as const, description: 'File size in bytes', example: 15728640 },
      sizeFormatted: { type: 'string' as const, description: 'Human-readable file size', example: '15 MB' },
      createdAt: { type: 'string' as const, format: 'date-time', description: 'When the backup was created' },
      isAutomatic: { type: 'boolean' as const, description: 'Whether this was an automatic scheduled backup' },
      isPreRestore: { type: 'boolean' as const, description: 'Whether this is a pre-restore safety backup' },
    },
  },

  // Backup configuration
  BackupConfig: {
    type: 'object' as const,
    description: 'Backup system configuration',
    properties: {
      backupPath: { type: 'string' as const, description: 'Directory where backups are stored', example: '/data/backups' },
      retentionCount: { type: 'integer' as const, description: 'Number of backups to keep (older ones are deleted)', example: 10 },
      lastBackupAt: { type: 'string' as const, format: 'date-time', nullable: true, description: 'When the last backup was created' },
      totalBackups: { type: 'integer' as const, description: 'Current number of backup files' },
    },
  },
} as const

// =============================================================================
// Configuration Schemas
// =============================================================================

const getConfig = {
  tags: ['backup'],
  summary: 'Get backup configuration',
  description: 'Get current backup configuration including storage path, retention settings, and backup statistics (admin only).',
  response: {
    200: { $ref: 'BackupConfig#' },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

const updateConfig = {
  tags: ['backup'],
  summary: 'Update backup configuration',
  description: 'Update backup storage path and retention settings (admin only). Changing the path does not move existing backups.',
  body: {
    type: 'object' as const,
    properties: {
      backupPath: { 
        type: 'string' as const, 
        description: 'Directory path for storing backups. Must be writable.',
        example: '/data/backups'
      },
      retentionCount: { 
        type: 'number' as const,
        minimum: 1,
        maximum: 100,
        description: 'Number of backups to retain. Older backups are automatically deleted.',
        example: 10
      },
    },
    example: {
      backupPath: '/data/backups',
      retentionCount: 10,
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const },
      },
    },
  },
}

// =============================================================================
// Backup Operations Schemas
// =============================================================================

const listBackups = {
  tags: ['backup'],
  summary: 'List backups',
  description: 'List all available backup files sorted by creation date (newest first). Admin only.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        backups: { type: 'array' as const, items: { $ref: 'BackupFile#' } },
        totalSize: { type: 'integer' as const, description: 'Total size of all backups in bytes' },
        totalSizeFormatted: { type: 'string' as const, description: 'Human-readable total size' },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

const createBackup = {
  tags: ['backup'],
  summary: 'Create backup',
  description: 'Create a new database backup. By default runs asynchronously. Use sync=true to wait for completion. Admin only.',
  querystring: {
    type: 'object' as const,
    properties: {
      sync: { 
        type: 'string' as const, 
        enum: ['true', 'false'],
        description: 'If true, wait for backup to complete before returning',
        default: 'false'
      },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        jobId: { type: 'string' as const, format: 'uuid', description: 'Backup job ID (async mode)' },
        filename: { type: 'string' as const, description: 'Backup filename (sync mode)' },
        message: { type: 'string' as const },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Backup already in progress' },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

const cancelBackup = {
  tags: ['backup'],
  summary: 'Cancel backup',
  description: 'Cancel a running backup operation. Admin only.',
  params: {
    type: 'object' as const,
    properties: {
      jobId: { type: 'string' as const, format: 'uuid', description: 'Backup job ID to cancel' },
    },
    required: ['jobId'] as string[],
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const },
      },
    },
    404: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Backup job not found' },
      },
    },
  },
}

const restoreBackup = {
  tags: ['backup'],
  summary: 'Restore backup',
  description: 'Restore database from a backup file. WARNING: This will replace all current data. Optionally creates a pre-restore backup for safety. Requires confirmation text "RESTORE" to proceed. Admin only.',
  body: {
    type: 'object' as const,
    required: ['filename'] as string[],
    properties: {
      filename: { type: 'string' as const, description: 'Backup filename to restore', example: 'aperture-backup-2024-01-15-103000.sql.gz' },
      createPreRestoreBackup: { type: 'boolean' as const, description: 'Create a safety backup before restoring', default: true },
      confirmText: { type: 'string' as const, description: 'Must be "RESTORE" to confirm the operation' },
    },
    example: {
      filename: 'aperture-backup-2024-01-15-103000.sql.gz',
      createPreRestoreBackup: true,
      confirmText: 'RESTORE',
    },
  },
  querystring: {
    type: 'object' as const,
    properties: {
      sync: { type: 'string' as const, enum: ['true', 'false'], description: 'Wait for restore to complete', default: 'false' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const },
        preRestoreBackup: { type: 'string' as const, nullable: true, description: 'Filename of pre-restore backup if created' },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Confirmation text required' },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

const deleteBackup = {
  tags: ['backup'],
  summary: 'Delete backup',
  description: 'Permanently delete a specific backup file. This cannot be undone. Admin only.',
  params: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string' as const, description: 'Backup filename to delete' },
    },
    required: ['filename'] as string[],
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const },
      },
    },
    404: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Backup file not found' },
      },
    },
  },
}

const downloadBackup = {
  tags: ['backup'],
  summary: 'Download backup',
  description: 'Download a backup file. Returns the file as an attachment. Admin only.',
  params: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string' as const, description: 'Backup filename to download' },
    },
    required: ['filename'] as string[],
  },
  response: {
    200: {
      description: 'Backup file download (application/gzip)',
      type: 'string' as const,
      format: 'binary',
    },
    404: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Backup file not found' },
      },
    },
  },
}

const uploadBackup = {
  tags: ['backup'],
  summary: 'Upload backup',
  description: 'Upload a backup file for later restore. Accepts .sql.gz files. Admin only.',
  consumes: ['multipart/form-data'],
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        filename: { type: 'string' as const, description: 'Saved filename' },
        message: { type: 'string' as const },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const, example: 'Invalid file format' },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

// =============================================================================
// Setup Wizard Schemas (No Auth)
// =============================================================================

const setupListBackups = {
  tags: ['setup'],
  security: [],
  summary: 'List backups (setup)',
  description: 'List available backups during initial setup. No authentication required. Only available when setup is not complete.',
  response: {
    200: {
      type: 'object' as const,
      properties: {
        backups: { type: 'array' as const, items: { $ref: 'BackupFile#' } },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

const setupUploadBackup = {
  tags: ['setup'],
  security: [],
  summary: 'Upload backup (setup)',
  description: 'Upload a backup file during initial setup. No authentication required. Only available when setup is not complete.',
  consumes: ['multipart/form-data'],
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        filename: { type: 'string' as const },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

const setupRestoreBackup = {
  tags: ['setup'],
  security: [],
  summary: 'Restore backup (setup)',
  description: 'Restore from a backup during initial setup. No authentication required. Only available when setup is not complete.',
  body: {
    type: 'object' as const,
    required: ['filename'] as string[],
    properties: {
      filename: { type: 'string' as const, description: 'Backup filename to restore' },
      confirmText: { type: 'string' as const, description: 'Must be "RESTORE" to confirm' },
    },
  },
  querystring: {
    type: 'object' as const,
    properties: {
      sync: { type: 'string' as const, enum: ['true', 'false'], description: 'Wait for restore to complete' },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const },
      },
    },
    400: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
    500: {
      type: 'object' as const,
      properties: {
        error: { type: 'string' as const },
      },
    },
  },
}

// =============================================================================
// Export all schemas
// =============================================================================

export const backupSchemas = {
  getConfig,
  updateConfig,
  listBackups,
  createBackup,
  cancelBackup,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  uploadBackup,
  setupListBackups,
  setupUploadBackup,
  setupRestoreBackup,
}
