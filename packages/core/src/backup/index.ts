export {
  getBackupConfig,
  setBackupConfig,
  updateLastBackupInfo,
  type BackupConfig,
} from './backupConfig.js'

export {
  createBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  pruneOldBackups,
  validateBackup,
  getBackupPath,
  formatBytes,
  cancelBackupProcess,
  type BackupInfo,
  type BackupResult,
  type RestoreResult,
} from './backupService.js'

