/**
 * Backup OpenAPI Schemas
 */

// =============================================================================
// Configuration Schemas
// =============================================================================

const getConfig = {
  tags: ['backup'],
  summary: 'Get backup configuration',
  description: 'Get current backup configuration including path and retention settings.',
}

const updateConfig = {
  tags: ['backup'],
  summary: 'Update backup configuration',
  description: 'Update backup path and retention settings.',
  body: {
    type: 'object' as const,
    properties: {
      backupPath: { type: 'string' as const },
      retentionCount: { type: 'number' as const },
    },
  },
}

// =============================================================================
// Backup Operations Schemas
// =============================================================================

const listBackups = {
  tags: ['backup'],
  summary: 'List backups',
  description: 'List all available backup files.',
}

const createBackup = {
  tags: ['backup'],
  summary: 'Create backup',
  description: 'Create a new database backup. Use sync=true for synchronous mode.',
  querystring: {
    type: 'object' as const,
    properties: {
      sync: { type: 'string' as const },
    },
  },
}

const cancelBackup = {
  tags: ['backup'],
  summary: 'Cancel backup',
  description: 'Cancel a running backup operation.',
  params: {
    type: 'object' as const,
    properties: {
      jobId: { type: 'string' as const },
    },
    required: ['jobId'] as string[],
  },
}

const restoreBackup = {
  tags: ['backup'],
  summary: 'Restore backup',
  description: 'Restore database from a backup file.',
  body: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string' as const },
      createPreRestoreBackup: { type: 'boolean' as const },
      confirmText: { type: 'string' as const },
    },
    required: ['filename'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      sync: { type: 'string' as const },
    },
  },
}

const deleteBackup = {
  tags: ['backup'],
  summary: 'Delete backup',
  description: 'Delete a specific backup file.',
  params: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string' as const },
    },
    required: ['filename'] as string[],
  },
}

const downloadBackup = {
  tags: ['backup'],
  summary: 'Download backup',
  description: 'Download a backup file.',
  params: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string' as const },
    },
    required: ['filename'] as string[],
  },
}

const uploadBackup = {
  tags: ['backup'],
  summary: 'Upload backup',
  description: 'Upload a backup file for restore.',
}

// =============================================================================
// Setup Wizard Schemas (No Auth)
// =============================================================================

const setupListBackups = {
  tags: ['setup'],
  security: [],
  summary: 'List backups (setup)',
  description: 'List available backups during setup (no auth required).',
}

const setupUploadBackup = {
  tags: ['setup'],
  security: [],
  summary: 'Upload backup (setup)',
  description: 'Upload a backup file during setup (no auth required).',
}

const setupRestoreBackup = {
  tags: ['setup'],
  security: [],
  summary: 'Restore backup (setup)',
  description: 'Restore from a backup during setup (no auth required).',
  body: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string' as const },
      confirmText: { type: 'string' as const },
    },
    required: ['filename'] as string[],
  },
  querystring: {
    type: 'object' as const,
    properties: {
      sync: { type: 'string' as const },
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
