/**
 * Chat streaming handler
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { streamText } from 'ai'
import { getEmbeddingModel, getChatAssistantModel } from '@aperture/core'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { getOpenAIClient, getMediaServerInfo, buildSystemPrompt } from '../helpers/index.js'
import { createTools } from '../tools/index.js'

interface ChatBody {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export function registerChatHandler(fastify: FastifyInstance) {
  fastify.post<{ Body: ChatBody }>(
    '/api/assistant/chat',
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Body: ChatBody }>, reply: FastifyReply) => {
      const user = request.user as SessionUser
      const { messages } = request.body

      if (!messages || !Array.isArray(messages)) {
        return reply.status(400).send({ error: 'Messages array is required' })
      }

      try {
        const openai = getOpenAIClient()
        const model = await getChatAssistantModel()
        const embeddingModel = await getEmbeddingModel()
        const mediaServer = await getMediaServerInfo()
        const systemPrompt = await buildSystemPrompt(user.id, user.isAdmin)

        // Create tool context
        const toolContext = {
          userId: user.id,
          isAdmin: user.isAdmin,
          embeddingModel,
          mediaServer,
        }

        // Create tools with context
        const tools = createTools(toolContext)

        fastify.log.info({ toolCount: Object.keys(tools).length, model }, 'Starting chat stream')

        // Stream the response using AI SDK's built-in streaming
        const result = streamText({
          model: openai(model),
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          tools,
          maxSteps: 10,
          maxTokens: 16384, // Allow long, detailed responses
          toolChoice: 'auto',
        })

        // Use the official AI SDK pattern for Fastify
        // See: https://ai-sdk.dev/cookbook/api-servers/fastify
        reply.header('X-Vercel-AI-Data-Stream', 'v1')
        reply.header('Content-Type', 'text/plain; charset=utf-8')

        return reply.send(result.toDataStream())
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        const errorStack = err instanceof Error ? err.stack : undefined
        fastify.log.error({ err, errorMessage, errorStack }, 'Assistant chat error')

        if (reply.raw.headersSent) {
          reply.raw.end()
          return
        }

        return reply.status(500).send({
          error: 'Failed to process chat request',
          message: errorMessage,
        })
      }
    }
  )
}
