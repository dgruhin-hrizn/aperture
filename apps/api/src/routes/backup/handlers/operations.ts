/**
 * Backup Operations Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getBackupConfig,
  createBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  validateBackup,
  getBackupPath,
  formatBytes,
  cancelBackupProcess,
  cancelJob,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { backupSchemas } from '../schemas.js'
import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'

export async function registerOperationsHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/backup/list
   * List all available backups
   */
  fastify.get(
    '/api/backup/list',
    { preHandler: requireAdmin, schema: backupSchemas.listBackups },
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
   * Create a new backup
   */
  fastify.post<{
    Querystring: { sync?: string }
  }>(
    '/api/backup/create',
    { preHandler: requireAdmin, schema: backupSchemas.createBackup },
    async (request, reply) => {
      try {
        const sync = request.query.sync === 'true'
        const jobId = randomUUID()

        if (sync) {
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
  }>(
    '/api/backup/cancel/:jobId',
    { preHandler: requireAdmin, schema: backupSchemas.cancelBackup },
    async (request, reply) => {
      try {
        const { jobId } = request.params

        const jobCancelled = cancelJob(jobId)
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
    }
  )

  /**
   * POST /api/backup/restore
   * Restore from a backup file
   */
  fastify.post<{
    Body: {
      filename: string
      createPreRestoreBackup?: boolean
      confirmText?: string
    }
    Querystring: { sync?: string }
  }>(
    '/api/backup/restore',
    { preHandler: requireAdmin, schema: backupSchemas.restoreBackup },
    async (request, reply) => {
      try {
        const { filename, createPreRestoreBackup = true, confirmText } = request.body
        const sync = request.query.sync === 'true'
        const jobId = randomUUID()

        if (confirmText !== 'RESTORE') {
          return reply.status(400).send({
            error: 'Please type RESTORE to confirm the restore operation',
          })
        }

        if (!filename || typeof filename !== 'string') {
          return reply.status(400).send({ error: 'Filename is required' })
        }

        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
          return reply.status(400).send({ error: 'Invalid filename' })
        }

        const validation = await validateBackup(filename)
        if (!validation.valid) {
          return reply.status(400).send({ error: validation.error || 'Invalid backup file' })
        }

        if (sync) {
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
    }
  )

  /**
   * DELETE /api/backup/:filename
   * Delete a specific backup file
   */
  fastify.delete<{
    Params: { filename: string }
  }>(
    '/api/backup/:filename',
    { preHandler: requireAdmin, schema: backupSchemas.deleteBackup },
    async (request, reply) => {
      try {
        const { filename } = request.params

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
    }
  )

  /**
   * GET /api/backup/download/:filename
   * Download a backup file
   */
  fastify.get<{
    Params: { filename: string }
  }>(
    '/api/backup/download/:filename',
    { preHandler: requireAdmin, schema: backupSchemas.downloadBackup },
    async (request, reply) => {
      try {
        const { filename } = request.params

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
    }
  )

  /**
   * POST /api/backup/upload
   * Upload a backup file for restore
   */
  fastify.post(
    '/api/backup/upload',
    { preHandler: requireAdmin, schema: backupSchemas.uploadBackup },
    async (request, reply) => {
      try {
        const data = await request.file()
        if (!data) {
          return reply.status(400).send({ error: 'No file uploaded' })
        }

        const config = await getBackupConfig()

        const originalFilename = data.filename || 'uploaded_backup.sql.gz'
        if (!originalFilename.endsWith('.sql') && !originalFilename.endsWith('.sql.gz')) {
          return reply.status(400).send({
            error: 'Invalid file type. Only .sql and .sql.gz files are allowed',
          })
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
        const ext = originalFilename.endsWith('.sql.gz') ? '.sql.gz' : '.sql'
        const filename = `aperture_uploaded_${timestamp}${ext}`
        const filePath = path.join(config.backupPath, filename)

        await fs.promises.mkdir(config.backupPath, { recursive: true })

        const writeStream = fs.createWriteStream(filePath)
        await pipeline(data.file, writeStream)

        const stats = await fs.promises.stat(filePath)

        const validation = await validateBackup(filename)
        if (!validation.valid) {
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
}
