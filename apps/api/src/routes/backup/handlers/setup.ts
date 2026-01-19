/**
 * Backup Setup Wizard Handlers (No Auth Required)
 */

import type { FastifyInstance } from 'fastify'
import {
  getBackupConfig,
  restoreBackup,
  listBackups,
  validateBackup,
  formatBytes,
} from '@aperture/core'
import { backupSchemas } from '../schemas.js'
import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'

export async function registerSetupHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/setup/backup/list
   * List available backups during setup (no auth required)
   */
  fastify.get(
    '/api/setup/backup/list',
    { schema: backupSchemas.setupListBackups },
    async (_request, reply) => {
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
    }
  )

  /**
   * POST /api/setup/backup/upload
   * Upload a backup file during setup (no auth required)
   */
  fastify.post(
    '/api/setup/backup/upload',
    { schema: backupSchemas.setupUploadBackup },
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
        fastify.log.error({ err }, 'Failed to upload backup for setup')
        return reply.status(500).send({ error: 'Failed to upload backup' })
      }
    }
  )

  /**
   * POST /api/setup/backup/restore
   * Restore from a backup during setup (no auth required)
   */
  fastify.post<{
    Body: {
      filename: string
      confirmText?: string
    }
    Querystring: { sync?: string }
  }>(
    '/api/setup/backup/restore',
    { schema: backupSchemas.setupRestoreBackup },
    async (request, reply) => {
      try {
        const { filename, confirmText } = request.body
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
    }
  )
}
