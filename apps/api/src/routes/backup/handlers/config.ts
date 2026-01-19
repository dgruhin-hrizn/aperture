/**
 * Backup Configuration Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getBackupConfig,
  setBackupConfig,
  formatBytes,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { backupSchemas } from '../schemas.js'

export async function registerConfigHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/backup/config
   * Get backup configuration
   */
  fastify.get(
    '/api/backup/config',
    { preHandler: requireAdmin, schema: backupSchemas.getConfig },
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
  }>(
    '/api/backup/config',
    { preHandler: requireAdmin, schema: backupSchemas.updateConfig },
    async (request, reply) => {
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
    }
  )
}
