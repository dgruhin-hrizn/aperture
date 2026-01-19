/**
 * Legacy AI Model Settings Handlers
 * 
 * These endpoints are for backwards compatibility with older setups.
 * New setups should use the multi-provider /api/settings/ai endpoints.
 * 
 * Endpoints:
 * - GET /api/settings/embedding-model - Get embedding model config
 * - PATCH /api/settings/embedding-model - Update embedding model
 * - GET /api/settings/text-generation-model - Get text generation model config
 * - PATCH /api/settings/text-generation-model - Update text generation model
 * - GET /api/settings/chat-assistant-model - Get chat assistant model config
 * - PATCH /api/settings/chat-assistant-model - Update chat assistant model
 */
import type { FastifyInstance } from 'fastify'
import {
  getEmbeddingModel,
  setEmbeddingModel,
  EMBEDDING_MODELS,
  getTextGenerationModel,
  setTextGenerationModel,
  TEXT_GENERATION_MODELS,
  getChatAssistantModel,
  setChatAssistantModel,
  CHAT_ASSISTANT_MODELS,
  VALID_EMBEDDING_DIMENSIONS,
  type EmbeddingModel,
  type TextGenerationModel,
  type ChatAssistantModel,
} from '@aperture/core'
import { query, queryOne } from '../../../lib/db.js'
import { requireAdmin } from '../../../plugins/auth.js'
import {
  embeddingModelSchema,
  updateEmbeddingModelSchema,
  textGenerationModelSchema,
  updateTextGenerationModelSchema,
  chatAssistantModelSchema,
  updateChatAssistantModelSchema,
} from '../schemas.js'

export function registerLegacyAiModelsHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/embedding-model
   */
  fastify.get('/api/settings/embedding-model', { preHandler: requireAdmin, schema: embeddingModelSchema }, async (_request, reply) => {
    try {
      const currentModel = await getEmbeddingModel()

      const configCheck = await queryOne<{ count: string }>('SELECT COUNT(*) FROM library_config')
      const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0

      const countResult = await query<{ count: string }>(
        hasLibraryConfigs
          ? `SELECT COUNT(*) as count FROM movies m
             WHERE EXISTS (
               SELECT 1 FROM library_config lc
               WHERE lc.provider_library_id = m.provider_library_id
                 AND lc.is_enabled = true
             )`
          : 'SELECT COUNT(*) as count FROM movies'
      )
      const movieCount = parseInt(countResult.rows[0]?.count || '0', 10)

      const embeddingUnions = VALID_EMBEDDING_DIMENSIONS.map(d => 
        `SELECT COUNT(*)::int as count, model FROM embeddings_${d} GROUP BY model`
      ).join(' UNION ALL ')
      const embeddingResult = await query<{ count: number; model: string }>(
        `SELECT SUM(count)::int as count, model FROM (${embeddingUnions}) t GROUP BY model`
      )
      const embeddingsByModel = embeddingResult.rows.reduce(
        (acc, row) => {
          acc[row.model] = row.count
          return acc
        },
        {} as Record<string, number>
      )

      return reply.send({
        currentModel,
        availableModels: EMBEDDING_MODELS,
        movieCount,
        embeddingsByModel,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get embedding model')
      return reply.status(500).send({ error: 'Failed to get embedding model configuration' })
    }
  })

  /**
   * PATCH /api/settings/embedding-model
   */
  fastify.patch<{
    Body: { model: string }
  }>('/api/settings/embedding-model', { preHandler: requireAdmin, schema: updateEmbeddingModelSchema }, async (request, reply) => {
    try {
      const { model } = request.body

      const validModels = EMBEDDING_MODELS.map((m) => m.id)
      if (!validModels.includes(model as EmbeddingModel)) {
        return reply.status(400).send({
          error: `Invalid model. Valid options: ${validModels.join(', ')}`,
        })
      }

      await setEmbeddingModel(model as EmbeddingModel)

      return reply.send({
        model,
        message: 'Embedding model updated. Delete existing embeddings and regenerate for the change to take effect.',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update embedding model')
      return reply.status(500).send({ error: 'Failed to update embedding model' })
    }
  })

  /**
   * GET /api/settings/text-generation-model
   */
  fastify.get('/api/settings/text-generation-model', { preHandler: requireAdmin, schema: textGenerationModelSchema }, async (_request, reply) => {
    try {
      const currentModel = await getTextGenerationModel()

      const enabledUsersResult = await query<{
        movies_enabled_count: string
        series_enabled_count: string
      }>(`
        SELECT 
          COUNT(*) FILTER (WHERE movies_enabled = true) as movies_enabled_count,
          COUNT(*) FILTER (WHERE series_enabled = true) as series_enabled_count
        FROM users
      `)
      const moviesEnabledUsers = parseInt(enabledUsersResult.rows[0]?.movies_enabled_count || '0', 10)
      const seriesEnabledUsers = parseInt(enabledUsersResult.rows[0]?.series_enabled_count || '0', 10)

      const movieCountResult = await query<{ count: string }>(`
        SELECT COUNT(*) as count FROM movies m
        WHERE EXISTS (
          SELECT 1 FROM library_config lc
          WHERE lc.provider_library_id = m.provider_library_id
            AND lc.is_enabled = true
        )
      `)
      const movieCount = parseInt(movieCountResult.rows[0]?.count || '0', 10)

      const seriesCountResult = await query<{ count: string }>(`
        SELECT COUNT(*) as count FROM series s
        WHERE EXISTS (
          SELECT 1 FROM library_config lc
          WHERE lc.provider_library_id = s.provider_library_id
            AND lc.is_enabled = true
        )
      `)
      const seriesCount = parseInt(seriesCountResult.rows[0]?.count || '0', 10)

      return reply.send({
        currentModel,
        availableModels: TEXT_GENERATION_MODELS,
        stats: {
          moviesEnabledUsers,
          seriesEnabledUsers,
          movieCount,
          seriesCount,
        },
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get text generation model')
      return reply.status(500).send({ error: 'Failed to get text generation model configuration' })
    }
  })

  /**
   * PATCH /api/settings/text-generation-model
   */
  fastify.patch<{
    Body: { model: string }
  }>('/api/settings/text-generation-model', { preHandler: requireAdmin, schema: updateTextGenerationModelSchema }, async (request, reply) => {
    try {
      const { model } = request.body

      const validModels = TEXT_GENERATION_MODELS.map((m) => m.id)
      if (!validModels.includes(model as TextGenerationModel)) {
        return reply.status(400).send({
          error: `Invalid model. Valid options: ${validModels.join(', ')}`,
        })
      }

      await setTextGenerationModel(model as TextGenerationModel)

      return reply.send({
        model,
        message: 'Text generation model updated. Future recommendation runs will use the new model.',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update text generation model')
      return reply.status(500).send({ error: 'Failed to update text generation model' })
    }
  })

  /**
   * GET /api/settings/chat-assistant-model
   */
  fastify.get('/api/settings/chat-assistant-model', { preHandler: requireAdmin, schema: chatAssistantModelSchema }, async (_request, reply) => {
    try {
      const currentModel = await getChatAssistantModel()

      return reply.send({
        currentModel,
        availableModels: CHAT_ASSISTANT_MODELS,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get chat assistant model config')
      return reply.status(500).send({ error: 'Failed to get chat assistant model configuration' })
    }
  })

  /**
   * PATCH /api/settings/chat-assistant-model
   */
  fastify.patch<{
    Body: { model: string }
  }>('/api/settings/chat-assistant-model', { preHandler: requireAdmin, schema: updateChatAssistantModelSchema }, async (request, reply) => {
    try {
      const { model } = request.body

      const validModels = CHAT_ASSISTANT_MODELS.map((m) => m.id)
      if (!validModels.includes(model as ChatAssistantModel)) {
        return reply.status(400).send({
          error: `Invalid model. Valid options: ${validModels.join(', ')}`,
        })
      }

      await setChatAssistantModel(model as ChatAssistantModel)

      return reply.send({
        model,
        message: 'Chat assistant model updated. Changes take effect immediately.',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update chat assistant model')
      return reply.status(500).send({ error: 'Failed to update chat assistant model' })
    }
  })
}
