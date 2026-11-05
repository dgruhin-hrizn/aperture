/**
 * Conversation management handlers
 */
import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import type { ConversationRow } from '../types.js'
import { loadMessages } from '../messages.js'

export function registerConversationHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/assistant/conversations
   * List user's conversations
   */
  fastify.get('/api/assistant/conversations', { preHandler: requireAuth, schema: { tags: ["ai-assistant"] } }, async (request, reply) => {
    const user = request.user as SessionUser

    const conversations = await query<ConversationRow>(
      `SELECT id, title, created_at, updated_at
       FROM assistant_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [user.id]
    )

    return reply.send({ conversations: conversations.rows })
  })

  /**
   * POST /api/assistant/conversations
   * Create a new conversation
   */
  fastify.post<{ Body: { title?: string } }>(
    '/api/assistant/conversations',
    { preHandler: requireAuth, schema: { tags: ["ai-assistant"] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { title = 'New Chat' } = request.body || {}

      const conversation = await queryOne<ConversationRow>(
        `INSERT INTO assistant_conversations (user_id, title)
         VALUES ($1, $2)
         RETURNING id, title, created_at, updated_at`,
        [user.id, title]
      )

      return reply.status(201).send({ conversation })
    }
  )

  /**
   * GET /api/assistant/conversations/:id
   * Get a conversation with its messages
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/assistant/conversations/:id',
    { preHandler: requireAuth, schema: { tags: ["ai-assistant"] } },
    async (request, reply) => {
      try {
        const user = request.user as SessionUser
        const { id } = request.params

        const conversation = await queryOne<ConversationRow>(
          `SELECT id, title, created_at, updated_at
           FROM assistant_conversations
           WHERE id = $1 AND user_id = $2`,
          [id, user.id]
        )

        if (!conversation) {
          return reply.status(404).send({ error: 'Conversation not found' })
        }

        return reply.send({ conversation, messages: await loadMessages(id) })
      } catch (err) {
        request.log.error({ err }, 'Failed to fetch conversation')
        return reply.status(500).send({ error: 'Failed to fetch conversation' })
      }
    }
  )

  /**
   * PATCH /api/assistant/conversations/:id
   * Update conversation (title)
   */
  fastify.patch<{ Params: { id: string }; Body: { title: string } }>(
    '/api/assistant/conversations/:id',
    { preHandler: requireAuth, schema: { tags: ["ai-assistant"] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params
      const { title } = request.body

      const conversation = await queryOne<ConversationRow>(
        `UPDATE assistant_conversations
         SET title = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING id, title, created_at, updated_at`,
        [title, id, user.id]
      )

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }

      return reply.send({ conversation })
    }
  )

  /**
   * DELETE /api/assistant/conversations/:id
   * Delete a conversation
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/assistant/conversations/:id',
    { preHandler: requireAuth, schema: { tags: ["ai-assistant"] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params

      const result = await query(
        `DELETE FROM assistant_conversations
         WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      )

      if (result.rowCount === 0) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }

      return reply.status(204).send()
    }
  )

  // The stream owns message persistence. Reject legacy browser transcript writes.
  fastify.post('/api/assistant/conversations/:id/messages', { preHandler: requireAuth }, async (_request, reply) =>
    reply.code(410).send({ error: 'Messages are now saved by the chat stream' }))
}
