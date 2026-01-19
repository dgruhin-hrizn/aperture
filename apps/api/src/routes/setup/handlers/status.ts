/**
 * Setup Status and Progress Handlers
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  getSetupProgress,
  setSetupCurrentStep,
  markSetupStepCompleted,
  resetSetupProgress,
  isSetupComplete,
  type SetupStepId,
  getMediaServerConfig,
  getLibraryConfigs,
  getAiRecsOutputConfig,
  getOutputPathConfig,
  getTopPicksConfig,
  hasOpenAIApiKey,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'

interface SetupStatusResponse {
  needsSetup: boolean
  isAdmin: boolean
  canAccessSetup: boolean
  configured: {
    mediaServer: boolean
    openai: boolean
  }
}

interface SetupProgressBody {
  currentStep?: SetupStepId | null
  completedStep?: SetupStepId
  reset?: boolean
}

function isAdminRequest(request: unknown): boolean {
  return !!(request as { user?: { isAdmin?: boolean } }).user?.isAdmin
}

async function requireSetupWritable(
  request: unknown
): Promise<{ complete: boolean; isAdmin: boolean }> {
  const complete = await isSetupComplete()
  const isAdmin = isAdminRequest(request)
  return { complete, isAdmin }
}

export async function registerStatusHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/setup/status
   * Check if setup is needed (public endpoint, but includes admin check)
   */
  fastify.get<{ Reply: SetupStatusResponse }>(
    '/api/setup/status',
    { schema: setupSchemas.getStatus },
    async (request, reply) => {
      const setupComplete = await isSetupComplete()
      const isAdmin = isAdminRequest(request)
      const mediaServerConfig = await getMediaServerConfig()
      const hasOpenAI = await hasOpenAIApiKey()

      return reply.send({
        needsSetup: !setupComplete,
        isAdmin,
        canAccessSetup: !setupComplete || isAdmin,
        configured: {
          mediaServer: mediaServerConfig.isConfigured,
          openai: hasOpenAI,
        },
      })
    }
  )

  /**
   * GET /api/setup/progress
   * Public (first-run only): Return resumable wizard progress + current config snapshot
   */
  fastify.get(
    '/api/setup/progress',
    { schema: setupSchemas.getProgress },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) {
        return reply.status(404).send({ error: 'Not Found' })
      }

      const progress = await getSetupProgress()

      // Snapshot (safe for first-run; excludes user list)
      const mediaServerConfig = await getMediaServerConfig()
      const hasOpenAI = await hasOpenAIApiKey()
      // Exclude Aperture-created libraries from selection
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
   * POST /api/setup/progress
   * Public (first-run only): Update wizard progress (resume support)
   */
  fastify.post<{ Body: SetupProgressBody }>(
    '/api/setup/progress',
    { schema: setupSchemas.updateProgress },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) {
        return reply.status(404).send({ error: 'Not Found' })
      }

      const { currentStep, completedStep, reset } = request.body || {}

      // During first-run we allow reset; for admin rerun prefer /api/admin/setup/progress below.
      if (reset) {
        await resetSetupProgress()
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

// Export helpers for use in other handlers
export { isAdminRequest, requireSetupWritable }
export type { SetupProgressBody }
