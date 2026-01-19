/**
 * Setup Legacy OpenAI Handlers
 */

import type { FastifyInstance } from 'fastify'
import {
  hasOpenAIApiKey,
  getOpenAIApiKey,
  setOpenAIApiKey,
} from '@aperture/core'
import { setupSchemas } from '../schemas.js'
import { requireSetupWritable } from './status.js'

interface OpenAIBody {
  apiKey: string
}

export async function registerOpenAIHandlers(fastify: FastifyInstance) {
  /**
   * POST /api/setup/openai/test
   * Test OpenAI connection (public during setup)
   */
  fastify.post<{ Body: OpenAIBody }>(
    '/api/setup/openai/test',
    { schema: setupSchemas.testOpenAI },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })
      const { apiKey } = request.body

      if (!apiKey) {
        return reply.status(400).send({
          success: false,
          error: 'API key is required',
        })
      }

      const originalKey = process.env.OPENAI_API_KEY
      process.env.OPENAI_API_KEY = apiKey

      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (response.ok) {
          return reply.send({ success: true })
        } else {
          const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
          return reply.send({
            success: false,
            error: data.error?.message || `API returned status ${response.status}`,
          })
        }
      } catch (err) {
        return reply.send({
          success: false,
          error: err instanceof Error ? err.message : 'Connection failed',
        })
      } finally {
        if (originalKey) {
          process.env.OPENAI_API_KEY = originalKey
        } else {
          delete process.env.OPENAI_API_KEY
        }
      }
    }
  )

  /**
   * GET /api/setup/openai
   * Check if OpenAI API key exists and return masked version
   */
  fastify.get(
    '/api/setup/openai',
    { schema: setupSchemas.getOpenAI },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const existingKey = await getOpenAIApiKey()

      if (existingKey) {
        const masked =
          existingKey.length > 12
            ? `${existingKey.slice(0, 7)}...${existingKey.slice(-4)}`
            : '••••••••'
        return reply.send({ configured: true, maskedKey: masked })
      }

      return reply.send({ configured: false, maskedKey: null })
    }
  )

  /**
   * POST /api/setup/openai
   * Save OpenAI API key (only during setup)
   */
  fastify.post<{ Body: OpenAIBody }>(
    '/api/setup/openai',
    { schema: setupSchemas.saveOpenAI },
    async (request, reply) => {
      const { complete, isAdmin } = await requireSetupWritable(request)
      if (complete && !isAdmin) return reply.status(404).send({ error: 'Not Found' })

      const { apiKey } = request.body

      if (!apiKey) {
        return reply.status(400).send({ error: 'API key is required' })
      }

      await setOpenAIApiKey(apiKey)

      return reply.send({ success: true })
    }
  )
}
