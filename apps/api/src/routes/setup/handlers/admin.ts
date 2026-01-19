/**
 * Setup Admin Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  getSetupProgress,
  setSetupCurrentStep,
  markSetupStepCompleted,
  resetSetupProgress,
  isSetupComplete,
  markSetupComplete,
  getMediaServerConfig,
  getLibraryConfigs,
  getAiRecsOutputConfig,
  getOutputPathConfig,
  getTopPicksConfig,
  hasOpenAIApiKey,
  type SetupStepId,
} from '@aperture/core'
import { requireAdmin } from '../../../plugins/auth.js'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'
import type { SetupProgressBody } from './status.js'

export async function registerAdminHandlers(fastify: FastifyInstance) {
  /**
   * POST /api/setup/complete
   * Mark setup as complete
   */
  fastify.post(
    '/api/setup/complete',
    { schema: setupSchemas.completeSetup },
    async (request, reply) => {
      const mediaServerConfig = await getMediaServerConfig()
      if (!mediaServerConfig.isConfigured) {
        return reply.status(400).send({
          error: 'Media server must be configured before completing setup',
        })
      }

      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      await markSetupComplete()
      await markSetupStepCompleted('initialJobs')

      return reply.send({ success: true })
    }
  )

  /**
   * POST /api/admin/setup/run-initial-jobs
   * Admin-only orchestration endpoint: runs initial jobs in the required order.
   */
  fastify.post(
    '/api/admin/setup/run-initial-jobs',
    { preHandler: requireAdmin, schema: setupSchemas.adminRunInitialJobs },
    async (_request, reply) => {
      const jobs = [
        'sync-movies',
        'sync-series',
        'sync-movie-watch-history',
        'sync-series-watch-history',
        'generate-movie-embeddings',
        'generate-series-embeddings',
        'generate-movie-recommendations',
        'generate-series-recommendations',
        'sync-movie-libraries',
        'sync-series-libraries',
      ] as const

      const jobIds: string[] = []
      for (const name of jobs) {
        const res = await fastify.inject({
          method: 'POST',
          url: `/api/jobs/${name}/run`,
        })

        if (res.statusCode >= 400) {
          return reply.status(500).send({
            error: `Failed to start job ${name}`,
            statusCode: res.statusCode,
            body: res.body,
          })
        }

        const parsed = res.json() as { jobId?: string }
        if (parsed.jobId) jobIds.push(parsed.jobId)
      }

      await markSetupStepCompleted('initialJobs')

      return reply.send({ success: true, jobIds })
    }
  )

  /**
   * GET /api/admin/setup/progress
   * Admin-only: Get setup progress
   */
  fastify.get(
    '/api/admin/setup/progress',
    { preHandler: requireAdmin, schema: setupSchemas.adminGetProgress },
    async (_request, reply) => {
      const progress = await getSetupProgress()
      const mediaServerConfig = await getMediaServerConfig()
      const hasOpenAI = await hasOpenAIApiKey()
      const libraries = await getLibraryConfigs(true)
      const aiRecsOutput = await getAiRecsOutputConfig()
      const outputPathConfig = await getOutputPathConfig()
      const topPicks = await getTopPicksConfig()

      return reply.send({
        progress,
        snapshot: {
          mediaServer: mediaServerConfig,
          openai: { configured: hasOpenAI },
          libraries,
          aiRecsOutput,
          outputPathConfig,
          topPicks,
        },
      })
    }
  )

  /**
   * POST /api/admin/setup/progress
   * Admin-only: Update setup progress
   */
  fastify.post<{ Body: SetupProgressBody }>(
    '/api/admin/setup/progress',
    { preHandler: requireAdmin, schema: setupSchemas.adminUpdateProgress },
    async (request, reply) => {
      const { currentStep, completedStep, reset } = request.body || {}
      if (reset) {
        await resetSetupProgress()
        await markSetupComplete()
        return reply.send({ success: true })
      }
      if (currentStep !== undefined) {
        await setSetupCurrentStep(currentStep ?? null)
      }
      if (completedStep) {
        await markSetupStepCompleted(completedStep)
      }
      return reply.send({ success: true })
    }
  )
}
