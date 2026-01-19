import type { FastifyPluginAsync } from 'fastify'
import {
  getBackupConfig,
  setBackupConfig,
  createBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  validateBackup,
  getBackupPath,
  formatBytes,
  cancelBackupProcess,
  cancelJob,
  type BackupConfig,
} from '@aperture/core'
import { requireAdmin } from '../plugins/auth.js'
import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'

const backupRoutes: FastifyPluginAsync = async (fastify) => {
  // =========================================================================
  // Backup Configuration
  // =========================================================================

  /**
   * GET /api/backup/config
   * Get backup configuration
   */
  fastify.get(
    '/api/backup/config',
    { preHandler: requireAdmin, schema: { tags: ['backup'] } },
    async (_request, reply) => {
      try {
        const config = await getBackupConfig()
        return reply.send({
          backupPath: config.backupPath,
          retentionCount: config.retentionCount,
          lastBackupAt: config.lastBackupAt,
          lastBackupFilename: config.lastBackupFilename,
          lastBackupSizeBytes: config.lastBackupSizeBytes,
          lastBackupSizeFormatted: config.lastBackupSizeBytes
            ? formatBytes(config.lastBackupSizeBytes)
            : null,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get backup config')
        return reply.status(500).send({ error: 'Failed to get backup configuration' })
      }
    }
  )

  /**
   * PATCH /api/backup/config
   * Update backup configuration
   */
  fastify.patch<{
    Body: {
      backupPath?: string
      retentionCount?: number
    }
  }>('/api/backup/config', { preHandler: requireAdmin, schema: { tags: ['backup'] } }, async (request, reply) => {
    try {
      const { backupPath, retentionCount } = request.body

      // Validate retention count
      if (retentionCount !== undefined) {
        if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > 100) {
          return reply.status(400).send({ error: 'Retention count must be an integer between 1 and 100' })
        }
      }

      // Validate backup path
      if (backupPath !== undefined) {
        if (typeof backupPath !== 'string' || backupPath.trim() === '') {
          return reply.status(400).send({ error: 'Backup path must be a non-empty string' })
        }
        // Basic path validation
        if (backupPath.includes('..')) {
          return reply.status(400).send({ error: 'Invalid backup path' })
        }
      }

      const config = await setBackupConfig({ backupPath, retentionCount })

      return reply.send({
        backupPath: config.backupPath,
        retentionCount: config.retentionCount,
        message: 'Backup configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update backup config')
      return reply.status(500).send({ error: 'Failed to update backup configuration' })
    }
  })

  // =========================================================================
  // Backup Operations
  // =========================================================================

  /**
   * GET /api/backup/list
   * List all available backups
   */
  fastify.get(
    '/api/backup/list',
    { preHandler: requireAdmin, schema: { tags: ['backup'] } },
    async (_request, reply) => {
      try {
        const backups = await listBackups()
        const config = await getBackupConfig()

        return reply.send({
          backups: backups.map((b) => ({
            filename: b.filename,
            sizeBytes: b.sizeBytes,
            sizeFormatted: formatBytes(b.sizeBytes),
            createdAt: b.createdAt,
            isCompressed: b.isCompressed,
          })),
          backupPath: config.backupPath,
          retentionCount: config.retentionCount,
          totalCount: backups.length,
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to list backups')
        return reply.status(500).send({ error: 'Failed to list backups' })
      }
    }
  )

  /**
   * POST /api/backup/create
   * Create a new backup (runs in background with progress tracking)
   */
  fastify.post<{
    Querystring: { sync?: string }
  }>(
    '/api/backup/create',
    { preHandler: requireAdmin, schema: { tags: ['backup'] } },
    async (request, reply) => {
      try {
        const sync = request.query.sync === 'true'
        const jobId = randomUUID()

        if (sync) {
          // Synchronous mode - wait for completion
          const result = await createBackup(jobId)

          if (!result.success) {
            return reply.status(500).send({
              error: result.error || 'Backup failed',
              duration: result.duration,
              jobId,
            })
          }

          return reply.send({
            success: true,
            filename: result.filename,
            sizeBytes: result.sizeBytes,
            sizeFormatted: result.sizeBytes ? formatBytes(result.sizeBytes) : null,
            duration: result.duration,
            jobId,
            message: 'Backup created successfully',
          })
        } else {
          // Async mode - return job ID immediately and run in background
          // Fire and forget - let the job progress system track it
          createBackup(jobId).catch((err) => {
            fastify.log.error({ err, jobId }, 'Background backup failed')
          })

          return reply.send({
            success: true,
            jobId,
            message: 'Backup started. Track progress with /api/jobs/progress/:jobId',
          })
        }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to create backup')
        return reply.status(500).send({ error: 'Failed to create backup' })
      }
    }
  )

  /**
   * POST /api/backup/cancel/:jobId
   * Cancel a running backup
   */
  fastify.post<{
    Params: { jobId: string }
  }>('/api/backup/cancel/:jobId', { preHandler: requireAdmin, schema: { tags: ['backup'] } }, async (request, reply) => {
    try {
      const { jobId } = request.params

      // Cancel the job (marks it as cancelled)
      const jobCancelled = cancelJob(jobId)
      
      // Also kill the pg_dump process if it's still running
      const processCancelled = cancelBackupProcess(jobId)

      if (jobCancelled || processCancelled) {
        return reply.send({
          success: true,
          message: 'Backup cancelled',
        })
      } else {
        return reply.status(404).send({
          error: 'No running backup found with that job ID',
        })
      }
    } catch (err) {
      fastify.log.error({ err }, 'Failed to cancel backup')
      return reply.status(500).send({ error: 'Failed to cancel backup' })
    }
  })

  /**
   * POST /api/backup/restore
   * Restore from a backup file (runs in background with progress tracking)
   */
  fastify.post<{
    Body: {
      filename: string
      createPreRestoreBackup?: boolean
      confirmText?: string
    }
    Querystring: { sync?: string }
  }>('/api/backup/restore', { preHandler: requireAdmin, schema: { tags: ['backup'] } }, async (request, reply) => {
    try {
      const { filename, createPreRestoreBackup = true, confirmText } = request.body
      const sync = request.query.sync === 'true'
      const jobId = randomUUID()

      // Require confirmation text
      if (confirmText !== 'RESTORE') {
        return reply.status(400).send({
          error: 'Please type RESTORE to confirm the restore operation',
        })
      }

      // Validate filename
      if (!filename || typeof filename !== 'string') {
        return reply.status(400).send({ error: 'Filename is required' })
      }

      // Prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return reply.status(400).send({ error: 'Invalid filename' })
      }

      // Validate backup exists
      const validation = await validateBackup(filename)
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error || 'Invalid backup file' })
      }

      if (sync) {
        // Synchronous mode - wait for completion
        const result = await restoreBackup(filename, createPreRestoreBackup, jobId)

        if (!result.success) {
          return reply.status(500).send({
            error: result.error || 'Restore failed',
            duration: result.duration,
            preRestoreBackup: result.preRestoreBackup,
            jobId,
          })
        }

        return reply.send({
          success: true,
          duration: result.duration,
          preRestoreBackup: result.preRestoreBackup,
          jobId,
          message: 'Database restored successfully. You may need to restart the application.',
        })
      } else {
        // Async mode - return job ID immediately and run in background
        restoreBackup(filename, createPreRestoreBackup, jobId).catch((err) => {
          fastify.log.error({ err, jobId }, 'Background restore failed')
        })

        return reply.send({
          success: true,
          jobId,
          filename,
          message: 'Restore started. Track progress with /api/jobs/progress/:jobId',
        })
      }
    } catch (err) {
      fastify.log.error({ err }, 'Failed to restore backup')
      return reply.status(500).send({ error: 'Failed to restore backup' })
    }
  })

  /**
   * DELETE /api/backup/:filename
   * Delete a specific backup file
   */
  fastify.delete<{
    Params: { filename: string }
  }>('/api/backup/:filename', { preHandler: requireAdmin, schema: { tags: ['backup'] } }, async (request, reply) => {
    try {
      const { filename } = request.params

      // Prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return reply.status(400).send({ error: 'Invalid filename' })
      }

      const deleted = await deleteBackup(filename)

      if (!deleted) {
        return reply.status(404).send({ error: 'Backup file not found or could not be deleted' })
      }

      return reply.send({
        success: true,
        message: 'Backup deleted successfully',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete backup')
      return reply.status(500).send({ error: 'Failed to delete backup' })
    }
  })

  /**
   * GET /api/backup/download/:filename
   * Download a backup file
   */
  fastify.get<{
    Params: { filename: string }
  }>('/api/backup/download/:filename', { preHandler: requireAdmin, schema: { tags: ['backup'] } }, async (request, reply) => {
    try {
      const { filename } = request.params

      // Prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return reply.status(400).send({ error: 'Invalid filename' })
      }

      const filePath = await getBackupPath(filename)
      if (!filePath) {
        return reply.status(404).send({ error: 'Backup file not found' })
      }

      const stats = await fs.promises.stat(filePath)
      const readStream = fs.createReadStream(filePath)

      reply.header('Content-Type', 'application/gzip')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      reply.header('Content-Length', stats.size)

      return reply.send(readStream)
    } catch (err) {
      fastify.log.error({ err }, 'Failed to download backup')
      return reply.status(500).send({ error: 'Failed to download backup' })
    }
  })

  /**
   * POST /api/backup/upload
   * Upload a backup file for restore
   */
  fastify.post(
    '/api/backup/upload',
    { preHandler: requireAdmin, schema: { tags: ['backup'] } },
    async (request, reply) => {
      try {
        const data = await request.file()
        if (!data) {
          return reply.status(400).send({ error: 'No file uploaded' })
        }

        const config = await getBackupConfig()

        // Validate file extension
        const originalFilename = data.filename || 'uploaded_backup.sql.gz'
        if (!originalFilename.endsWith('.sql') && !originalFilename.endsWith('.sql.gz')) {
          return reply.status(400).send({
            error: 'Invalid file type. Only .sql and .sql.gz files are allowed',
          })
        }

        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
        const ext = originalFilename.endsWith('.sql.gz') ? '.sql.gz' : '.sql'
        const filename = `aperture_uploaded_${timestamp}${ext}`
        const filePath = path.join(config.backupPath, filename)

        // Ensure backup directory exists
        await fs.promises.mkdir(config.backupPath, { recursive: true })

        // Write file
        const writeStream = fs.createWriteStream(filePath)
        await pipeline(data.file, writeStream)

        // Get file size
        const stats = await fs.promises.stat(filePath)

        // Validate the uploaded file
        const validation = await validateBackup(filename)
        if (!validation.valid) {
          // Delete invalid file
          await fs.promises.unlink(filePath)
          return reply.status(400).send({
            error: `Invalid backup file: ${validation.error}`,
          })
        }

        return reply.send({
          success: true,
          filename,
          sizeBytes: stats.size,
          sizeFormatted: formatBytes(stats.size),
          message: 'Backup file uploaded successfully',
        })
      } catch (err) {
        fastify.log.error({ err }, 'Failed to upload backup')
        return reply.status(500).send({ error: 'Failed to upload backup' })
      }
    }
  )

  // =========================================================================
  // Setup Wizard Endpoints (No Auth Required During Setup)
  // =========================================================================

  /**
   * GET /api/setup/backup/list
   * List available backups during setup (no auth required)
   */
  fastify.get('/api/setup/backup/list', { schema: { tags: ['setup'], security: [] } }, async (_request, reply) => {
    try {
      const backups = await listBackups()

      return reply.send({
        backups: backups.map((b) => ({
          filename: b.filename,
          sizeBytes: b.sizeBytes,
          sizeFormatted: formatBytes(b.sizeBytes),
          createdAt: b.createdAt,
          isCompressed: b.isCompressed,
        })),
        hasBackups: backups.length > 0,
        totalCount: backups.length,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to list backups for setup')
      return reply.status(500).send({ error: 'Failed to list backups' })
    }
  })

  /**
   * POST /api/setup/backup/upload
   * Upload a backup file during setup (no auth required)
   */
  fastify.post('/api/setup/backup/upload', { schema: { tags: ['setup'], security: [] } }, async (request, reply) => {
    try {
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      const config = await getBackupConfig()

      // Validate file extension
      const originalFilename = data.filename || 'uploaded_backup.sql.gz'
      if (!originalFilename.endsWith('.sql') && !originalFilename.endsWith('.sql.gz')) {
        return reply.status(400).send({
          error: 'Invalid file type. Only .sql and .sql.gz files are allowed',
        })
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
      const ext = originalFilename.endsWith('.sql.gz') ? '.sql.gz' : '.sql'
      const filename = `aperture_uploaded_${timestamp}${ext}`
      const filePath = path.join(config.backupPath, filename)

      // Ensure backup directory exists
      await fs.promises.mkdir(config.backupPath, { recursive: true })

      // Write file
      const writeStream = fs.createWriteStream(filePath)
      await pipeline(data.file, writeStream)

      // Get file size
      const stats = await fs.promises.stat(filePath)

      // Validate the uploaded file
      const validation = await validateBackup(filename)
      if (!validation.valid) {
        // Delete invalid file
        await fs.promises.unlink(filePath)
        return reply.status(400).send({
          error: `Invalid backup file: ${validation.error}`,
        })
      }

      return reply.send({
        success: true,
        filename,
        sizeBytes: stats.size,
        sizeFormatted: formatBytes(stats.size),
        message: 'Backup file uploaded successfully',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to upload backup for setup')
      return reply.status(500).send({ error: 'Failed to upload backup' })
    }
  })

  /**
   * POST /api/setup/backup/restore
   * Restore from a backup during setup (no auth required, runs in background with progress tracking)
   */
  fastify.post<{
    Body: {
      filename: string
      confirmText?: string
    }
    Querystring: { sync?: string }
  }>('/api/setup/backup/restore', { schema: { tags: ['setup'], security: [] } }, async (request, reply) => {
    try {
      const { filename, confirmText } = request.body
      const sync = request.query.sync === 'true'
      const jobId = randomUUID()

      // Require confirmation text
      if (confirmText !== 'RESTORE') {
        return reply.status(400).send({
          error: 'Please type RESTORE to confirm the restore operation',
        })
      }

      // Validate filename
      if (!filename || typeof filename !== 'string') {
        return reply.status(400).send({ error: 'Filename is required' })
      }

      // Prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return reply.status(400).send({ error: 'Invalid filename' })
      }

      // Validate backup exists
      const validation = await validateBackup(filename)
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error || 'Invalid backup file' })
      }

      if (sync) {
        // Synchronous mode - wait for completion
        // Don't create pre-restore backup during setup (database is likely empty)
        const result = await restoreBackup(filename, false, jobId)

        if (!result.success) {
          return reply.status(500).send({
            error: result.error || 'Restore failed',
            duration: result.duration,
            jobId,
          })
        }

        return reply.send({
          success: true,
          duration: result.duration,
          jobId,
          message: 'Database restored successfully. Setup will continue with restored data.',
        })
      } else {
        // Async mode - return job ID immediately and run in background
        // Don't create pre-restore backup during setup (database is likely empty)
        restoreBackup(filename, false, jobId).catch((err) => {
          fastify.log.error({ err, jobId }, 'Background restore during setup failed')
        })

        return reply.send({
          success: true,
          jobId,
          filename,
          message: 'Restore started. Track progress with /api/jobs/progress/:jobId',
        })
      }
    } catch (err) {
      fastify.log.error({ err }, 'Failed to restore backup during setup')
      return reply.status(500).send({ error: 'Failed to restore backup' })
    }
  })
}

export default backupRoutes

