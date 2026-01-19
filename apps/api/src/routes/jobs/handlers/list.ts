/**
 * Jobs List Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getJobProgress,
  getAllJobConfigs,
  getJobConfig,
  formatSchedule,
  getLastJobRuns,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { jobSchemas } from '../schemas.js'
import { jobDefinitions } from '../definitions.js'
import { activeJobs } from '../state.js'

export async function registerListHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/jobs
   * List all jobs with their status and schedule config
   */
  fastify.get(
    '/api/jobs',
    { preHandler: requireAdmin, schema: jobSchemas.listJobs },
    async (_request, reply) => {
      // Get all job configs from database
      const jobConfigs = await getAllJobConfigs()
      const configMap = new Map(jobConfigs.map((c) => [c.jobName, c]))

      // Get last runs for all jobs
      const lastRunsMap = await getLastJobRuns()

      const jobs = await Promise.all(
        jobDefinitions.map(async (def) => {
          const activeJobId = activeJobs.get(def.name)
          const progress = activeJobId ? getJobProgress(activeJobId) : null
          const config = configMap.get(def.name) || (await getJobConfig(def.name))
          const lastRun = lastRunsMap.get(def.name)

          return {
            ...def,
            status: progress?.status === 'running' ? 'running' : 'idle',
            currentJobId: activeJobId,
            progress: progress
              ? {
                  overallProgress: progress.overallProgress,
                  currentStep: progress.currentStep,
                  itemsProcessed: progress.itemsProcessed,
                  itemsTotal: progress.itemsTotal,
                }
              : null,
            schedule: config
              ? {
                  type: config.scheduleType,
                  hour: config.scheduleHour,
                  minute: config.scheduleMinute,
                  dayOfWeek: config.scheduleDayOfWeek,
                  intervalHours: config.scheduleIntervalHours,
                  isEnabled: config.isEnabled,
                  formatted: formatSchedule(config),
                }
              : null,
            lastRun: lastRun
              ? {
                  id: lastRun.id,
                  status: lastRun.status,
                  startedAt: lastRun.started_at,
                  completedAt: lastRun.completed_at,
                  durationMs: lastRun.duration_ms,
                  itemsProcessed: lastRun.items_processed,
                  itemsTotal: lastRun.items_total,
                  errorMessage: lastRun.error_message,
                }
              : null,
          }
        })
      )

      return reply.send({ jobs })
    }
  )

  /**
   * GET /api/jobs/:name
   * Get job details
   */
  fastify.get<{ Params: { name: string } }>(
    '/api/jobs/:name',
    { preHandler: requireAdmin, schema: jobSchemas.getJob },
    async (request, reply) => {
      const { name } = request.params

      const jobDef = jobDefinitions.find((j) => j.name === name)
      if (!jobDef) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const activeJobId = activeJobs.get(name)
      const progress = activeJobId ? getJobProgress(activeJobId) : null

      return reply.send({
        ...jobDef,
        currentJobId: activeJobId,
        progress,
      })
    }
  )
}
