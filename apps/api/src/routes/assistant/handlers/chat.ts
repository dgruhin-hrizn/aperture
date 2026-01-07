/**
 * Chat streaming handler with AI SDK v5 + Tool UI
 * https://www.tool-ui.com/docs/quick-start
 */
import { Readable } from 'node:stream'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { getEmbeddingModel, getChatAssistantModel } from '@aperture/core'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { getMediaServerInfo, buildSystemPrompt } from '../helpers/index.js'
import { createTools } from '../tools/index.js'

interface ChatBody {
  messages: UIMessage[]
  system?: string
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

        // Stream the response using AI SDK v5
        const result = streamText({
          model: openai(model),
          system: systemPrompt,
          messages: convertToModelMessages(messages),
          tools,
          toolChoice: 'auto',
        })

        // Get the UI Message Stream Response (Web Response)
        const webResponse = result.toUIMessageStreamResponse()

        // Forward status + headers to Fastify
        reply.status(webResponse.status)
        webResponse.headers.forEach((value: string, key: string) => reply.header(key, value))

        // Pipe the Web ReadableStream -> Node response
        const nodeStream = Readable.fromWeb(
          webResponse.body as Parameters<typeof Readable.fromWeb>[0]
        )

        return reply.send(nodeStream)
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
