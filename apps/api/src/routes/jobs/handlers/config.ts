/**
 * Jobs Configuration Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getJobConfig,
  setJobConfig,
  formatSchedule,
  getValidJobNames,
  createChildLogger,
  type ScheduleType,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { refreshJobSchedule } from '../../../lib/scheduler.js'
import { jobSchemas } from '../schemas.js'

const logger = createChildLogger('jobs-config')

export async function registerConfigHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/jobs/:name/config
   * Get job schedule configuration
   */
  fastify.get<{ Params: { name: string } }>(
    '/api/jobs/:name/config',
    { preHandler: requireAdmin, schema: jobSchemas.getJobConfig },
    async (request, reply) => {
      const { name } = request.params

      if (!getValidJobNames().includes(name)) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const config = await getJobConfig(name)
      if (!config) {
        return reply.status(404).send({ error: 'Job config not found' })
      }

      return reply.send({
        config: {
          jobName: config.jobName,
          scheduleType: config.scheduleType,
          scheduleHour: config.scheduleHour,
          scheduleMinute: config.scheduleMinute,
          scheduleDayOfWeek: config.scheduleDayOfWeek,
          scheduleIntervalHours: config.scheduleIntervalHours,
          isEnabled: config.isEnabled,
          formatted: formatSchedule(config),
        },
      })
    }
  )

  /**
   * PATCH /api/jobs/:name/config
   * Update job schedule configuration
   */
  fastify.patch<{
    Params: { name: string }
    Body: {
      scheduleType?: ScheduleType
      scheduleHour?: number | null
      scheduleMinute?: number | null
      scheduleDayOfWeek?: number | null
      scheduleIntervalHours?: number | null
      isEnabled?: boolean
    }
  }>(
    '/api/jobs/:name/config',
    { preHandler: requireAdmin, schema: jobSchemas.updateJobConfig },
    async (request, reply) => {
      const { name } = request.params
      const updates = request.body

      if (!getValidJobNames().includes(name)) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      // Validate schedule type
      if (
        updates.scheduleType &&
        !['daily', 'weekly', 'interval', 'manual'].includes(updates.scheduleType)
      ) {
        return reply
          .status(400)
          .send({ error: 'Invalid schedule type. Must be: daily, weekly, interval, or manual' })
      }

      // Validate hour (0-23)
      if (updates.scheduleHour !== undefined && updates.scheduleHour !== null) {
        if (updates.scheduleHour < 0 || updates.scheduleHour > 23) {
          return reply.status(400).send({ error: 'Hour must be between 0 and 23' })
        }
      }

      // Validate minute (0-59)
      if (updates.scheduleMinute !== undefined && updates.scheduleMinute !== null) {
        if (updates.scheduleMinute < 0 || updates.scheduleMinute > 59) {
          return reply.status(400).send({ error: 'Minute must be between 0 and 59' })
        }
      }

      // Validate day of week (0-6)
      if (updates.scheduleDayOfWeek !== undefined && updates.scheduleDayOfWeek !== null) {
        if (updates.scheduleDayOfWeek < 0 || updates.scheduleDayOfWeek > 6) {
          return reply
            .status(400)
            .send({ error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' })
        }
      }

      // Validate interval hours
      if (updates.scheduleIntervalHours !== undefined && updates.scheduleIntervalHours !== null) {
        if (![1, 2, 3, 4, 6, 8, 12].includes(updates.scheduleIntervalHours)) {
          return reply
            .status(400)
            .send({ error: 'Interval hours must be one of: 1, 2, 3, 4, 6, 8, 12' })
        }
      }

      try {
        const config = await setJobConfig(name, updates)
        logger.info({ job: name, config: updates }, 'Job config updated')

        // Refresh the scheduler for this job
        try {
          await refreshJobSchedule(name)
        } catch (schedErr) {
          logger.error({ err: schedErr, job: name }, 'Failed to refresh job schedule')
        }

        return reply.send({
          config: {
            jobName: config.jobName,
            scheduleType: config.scheduleType,
            scheduleHour: config.scheduleHour,
            scheduleMinute: config.scheduleMinute,
            scheduleDayOfWeek: config.scheduleDayOfWeek,
            scheduleIntervalHours: config.scheduleIntervalHours,
            isEnabled: config.isEnabled,
            formatted: formatSchedule(config),
          },
          message: 'Job configuration updated',
        })
      } catch (err) {
        logger.error({ err, job: name }, 'Failed to update job config')
        return reply.status(500).send({ error: 'Failed to update job configuration' })
      }
    }
  )
}
