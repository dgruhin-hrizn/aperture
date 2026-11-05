import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import { ToolLoopAgent, convertToModelMessages, createUIMessageStreamResponse, toUIMessageStream, stepCountIs, type UIMessage } from 'ai'
import { z } from 'zod'
import { getChatModelInstance, getEmbeddingModelInstance, getActiveEmbeddingModelId } from '@aperture/core'
import { requireAuth } from '../../../plugins/auth.js'
import { queryOne } from '../../../lib/db.js'
import { getMediaServerInfo, buildSystemPrompt } from '../helpers/index.js'
import { createTools } from '../tools/index.js'
import { claimRun, loadMessages, releaseRun, saveMessage } from '../messages.js'

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(z.object({ id: z.string().min(1).max(200), role: z.enum(['user', 'assistant']),
    parts: z.array(z.unknown()).max(100) })).max(100),
  trigger: z.string().optional(),
})

export function registerChatHandler(fastify: FastifyInstance, dependencies: { getModel?: typeof getChatModelInstance } = {}) {
  fastify.post('/api/assistant/chat', { preHandler: requireAuth, bodyLimit: 512_000 }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid conversation or messages', code: 'INVALID_CHAT' })
    const user = request.user!
    if (!user.isEnabled) return reply.code(403).send({ error: 'This account is disabled' })
    const { conversationId, messages: incoming, trigger } = parsed.data
    if (!await queryOne('SELECT id FROM assistant_conversations WHERE id = $1 AND user_id = $2', [conversationId, user.id]))
      return reply.code(404).send({ error: 'Conversation not found' })
    const runId = randomUUID()
    if (!await claimRun(conversationId, user.id, runId))
      return reply.code(409).send({ error: 'This conversation is already running', code: 'RUN_ACTIVE' })
    const abort = new AbortController()
    reply.raw.on('close', () => { if (!reply.raw.writableFinished) abort.abort() })
    try {
      const history = await loadMessages(conversationId)
      let originalMessages = history
      let responseId: string = randomUUID()
      if (trigger === 'regenerate-message') {
        const last = history.at(-1)
        if (last?.role === 'assistant') { responseId = last.id; originalMessages = history.slice(0, -1) }
      } else {
        const last = incoming.at(-1)
        const text = last?.parts.filter((p): p is { type: 'text'; text: string } =>
          typeof p === 'object' && p !== null && 'type' in p && p.type === 'text' && 'text' in p && typeof p.text === 'string')
        if (last?.role !== 'user' || !text?.length || text.some((p) => p.text.length > 20_000)) {
          await releaseRun(conversationId, runId)
          return reply.code(400).send({ error: 'A text message is required' })
        }
        // Ignore fabricated client tool/system history; use the owned server transcript.
        const message: UIMessage = { id: last.id, role: 'user', parts: text }
        const existing = history.find((m) => m.id === message.id)
        if (existing && JSON.stringify(existing.parts) !== JSON.stringify(message.parts)) {
          await releaseRun(conversationId, runId)
          return reply.code(409).send({ error: 'Message ID already exists' })
        }
        await saveMessage(conversationId, message)
        originalMessages = existing ? history : [...history, message]
      }
      const [model, embeddingModel, embeddingModelId, mediaServer, instructions] = await Promise.all([
        (dependencies.getModel ?? getChatModelInstance)(), getEmbeddingModelInstance().catch(() => null),
        getActiveEmbeddingModelId(), getMediaServerInfo(), buildSystemPrompt(user.id, user.isAdmin),
      ])
      const tools = createTools({ userId: user.id, isAdmin: user.isAdmin, embeddingModel,
        embeddingModelId: embeddingModelId ?? '', mediaServer })
      const agent = new ToolLoopAgent({ model, tools, instructions: `${instructions}\nCurrent UTC date: ${new Date().toISOString()}.`,
        maxOutputTokens: 4000, stopWhen: stepCountIs(12),
        onEnd: ({ totalUsage, steps }) => request.log.info({ runId, usage: totalUsage, steps: steps.length }, 'Encore run completed'),
      })
      const result = await agent.stream({ messages: await convertToModelMessages(originalMessages, { tools, ignoreIncompleteToolCalls: true }),
        abortSignal: abort.signal, timeout: 180_000 })
      const stream = toUIMessageStream({ stream: result.stream, tools, originalMessages,
        generateMessageId: () => responseId,
        onError: (error) => { request.log.error({ err: error, runId }, 'Encore stream failed'); return 'Encore could not complete this response. Please retry.' },
        onEnd: async ({ responseMessage }) => {
          try { await saveMessage(conversationId, responseMessage) }
          finally { await releaseRun(conversationId, runId) }
        },
      })
      const response = createUIMessageStreamResponse({ stream })
      response.headers.forEach((value, key) => reply.header(key, value))
      return reply.send(Readable.fromWeb(response.body! as Parameters<typeof Readable.fromWeb>[0]))
    } catch (error) {
      await releaseRun(conversationId, runId)
      request.log.error({ err: error, runId }, 'Encore run failed')
      return reply.code(502).send({ error: 'Encore is unavailable. Check the configured chat provider and retry.', code: 'CHAT_UNAVAILABLE' })
    }
  })
}
