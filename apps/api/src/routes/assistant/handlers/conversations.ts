/**
 * Conversation management handlers
 */
import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import type { ConversationRow, MessageRow } from '../types.js'

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

        const messages = await query<MessageRow>(
          `SELECT id, role, content, tool_invocations, created_at
           FROM assistant_messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC`,
          [id]
        )

        return reply.send({
          conversation,
          messages: messages.rows.map((m) => ({
            ...m,
            toolInvocations: m.tool_invocations || undefined,
          })),
        })
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

  /**
   * POST /api/assistant/conversations/:id/messages
   * Add messages to a conversation (for saving chat history)
   */
  fastify.post<{
    Params: { id: string }
    Body: { messages: Array<{ role: string; content: string; toolInvocations?: unknown[] }> }
  }>(
    '/api/assistant/conversations/:id/messages',
    { preHandler: requireAuth, schema: { tags: ["ai-assistant"] } },
    async (request, reply) => {
      const user = request.user as SessionUser
      const { id } = request.params
      const { messages } = request.body

      // Verify ownership
      const conversation = await queryOne<{ id: string }>(
        `SELECT id FROM assistant_conversations WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      )

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }

      // Insert messages
      for (const msg of messages) {
        await query(
          `INSERT INTO assistant_messages (conversation_id, role, content, tool_invocations)
           VALUES ($1, $2, $3, $4)`,
          [id, msg.role, msg.content, msg.toolInvocations ? JSON.stringify(msg.toolInvocations) : null]
        )
      }

      // Update conversation title from first user message if still "New Chat"
      const existingConvo = await queryOne<{ title: string }>(
        `SELECT title FROM assistant_conversations WHERE id = $1`,
        [id]
      )

      if (existingConvo?.title === 'New Chat') {
        const firstUserMsg = messages.find((m) => m.role === 'user')
        if (firstUserMsg) {
          const newTitle =
            firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
          await query(
            `UPDATE assistant_conversations SET title = $1, updated_at = NOW() WHERE id = $2`,
            [newTitle, id]
          )
        }
      } else {
        await query(`UPDATE assistant_conversations SET updated_at = NOW() WHERE id = $1`, [id])
      }

      return reply.status(201).send({ success: true })
    }
  )
}

