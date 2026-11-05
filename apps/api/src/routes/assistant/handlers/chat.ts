import { limitEncoreContext } from '../contextBudget.js'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import { ToolLoopAgent, convertToModelMessages, createUIMessageStreamResponse, toUIMessageStream, stepCountIs, type UIMessage } from 'ai'
import { chatBody as bodySchema } from '../../../contracts/bodies/encore.js'
import { getChatModelInstance, getEmbeddingModelInstance, getActiveEmbeddingModelId } from '@aperture/core'
import { requireAuth } from '../../../plugins/auth.js'
import { queryOne } from '../../../lib/db.js'
import { getMediaServerInfo, buildSystemPrompt } from '../helpers/index.js'
import { createEncoreTools, getEncoreToolSchemas } from '@aperture/core/encore'
import { claimRun, loadMessages, releaseRun, saveMessage } from '../messages.js'
import { encoreWebSearchTool, supportsEncoreWebSearch, webSearchInstructions } from '../../../lib/encoreWebSearch.js'
import { encoreModelHistory, finishWithNextReplies, nextRepliesInstruction, suggestNextReplies } from '../nextReplies.js'

export function registerChatHandler(fastify: FastifyInstance, dependencies: { getModel?: typeof getChatModelInstance } = {}) {
  fastify.post('/api/assistant/chat', { preHandler: requireAuth, bodyLimit: 512_000 }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid conversation or messages', code: 'INVALID_CHAT' })
    const user = request.user!
    if (!user.isEnabled) return reply.code(403).send({ error: 'This account is disabled' })
    const { conversationId, messages: incoming, trigger, timezone, webSearch } = parsed.data
    if (!await queryOne('SELECT id FROM assistant_conversations WHERE id = $1 AND user_id = $2', [conversationId, user.id]))
      return reply.code(404).send({ error: 'Conversation not found' })
    const runId = randomUUID()
    if (!await claimRun(conversationId, user.id, runId))
      return reply.code(409).send({ error: 'This conversation is already running', code: 'RUN_ACTIVE' })
    const abort = new AbortController()
    reply.raw.on('close', () => { if (!reply.raw.writableFinished) abort.abort() })
    try {
      const getModel = dependencies.getModel ?? getChatModelInstance
      const searchModel = webSearch ? await getModel() : undefined
      if (webSearch && (typeof searchModel !== 'object' || searchModel.provider !== 'openai.responses'
        || !supportsEncoreWebSearch('openai', searchModel.modelId))) {
        await releaseRun(conversationId, runId)
        return reply.code(422).send({ error: 'The configured chat model does not support Encore web search.', code: 'WEB_SEARCH_UNAVAILABLE' })
      }
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
        if (last?.role !== 'user' || !text?.length || text.reduce((sum,p)=>sum+p.text.length,0)>20_000) {
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
        searchModel ?? getModel(), getEmbeddingModelInstance().catch(() => null),
        getActiveEmbeddingModelId(), getMediaServerInfo(), buildSystemPrompt(user.id, user.isAdmin),
      ])
      const localTools = createEncoreTools({ userId: user.id, isAdmin: user.isAdmin, embeddingModel,
        embeddingModelId: embeddingModelId ?? '', mediaServer,source:'encore',sourceId:`${conversationId}:${originalMessages.filter(m=>m.role==='user').at(-1)?.id??''}` })
      const chatTools = { ...localTools, suggestNextReplies }
      await getEncoreToolSchemas(chatTools)
      const tools = webSearch ? { ...chatTools, web_search: encoreWebSearchTool } : chatTools
      const agent = new ToolLoopAgent({ model, tools, instructions: `${instructions}\nCurrent UTC date: ${new Date().toISOString()}. User timezone: ${timezone}. Interpret relative dates using that timezone.\n${webSearchInstructions[webSearch ? 'enabled' : 'disabled']}\n${nextRepliesInstruction}`,
        maxOutputTokens: 4000, stopWhen: [stepCountIs(12), finishWithNextReplies],
        onEnd: ({ totalUsage, steps }) => request.log.info({ runId, usage: totalUsage, steps: steps.length }, 'Encore run completed'),
      })
      const result = await agent.stream({ messages: await convertToModelMessages(limitEncoreContext(encoreModelHistory(originalMessages)), { tools, ignoreIncompleteToolCalls: true }),
        abortSignal: abort.signal, timeout: 180_000 })
      const stream = toUIMessageStream({ stream: result.stream, tools, originalMessages, sendSources: webSearch,
        generateMessageId: () => responseId,
        onError: (error) => { request.log.error({ err: error, runId }, 'Encore stream failed'); return webSearch ? 'Encore could not complete the web-enabled response. Retry, or turn off Web search to continue with library and metadata tools.' : 'Encore could not complete this response. Please retry.' },
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
