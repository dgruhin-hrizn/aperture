import type { FastifyInstance } from 'fastify'
import type { z } from 'zod'
import { reasoningPresetSchema, reasoningPresets, resolveProviderConnection } from '@aperture/core'
import type { aiReasoningBody } from '../../../contracts/bodies/settings.js'
import { requireAdmin } from '../../../plugins/auth.js'

export function registerAiReasoningHandlers(fastify: FastifyInstance) {
  fastify.post<{ Body: z.infer<typeof aiReasoningBody> }>(
    '/api/settings/ai/reasoning',
    { preHandler: requireAdmin, schema: { tags: ['settings'], summary: 'Get supported reasoning presets for an AI model' } },
    async (request, reply) => {
      const { function: fn, provider, model, apiKey, baseUrl } = request.body
      if (fn === 'embeddings') return { presets: [] }
      try {
        const connection = await resolveProviderConnection(provider, fn, { apiKey, baseUrl })
        const nativePresets = await reasoningPresets({ provider, model, ...connection })
        return { presets: fn === 'chat' ? reasoningPresetSchema.options : nativePresets, nativePresets }
      } catch {
        return reply.code(400).send({ error: 'Check the AI endpoint URL and try again.' })
      }
    }
  )
}
