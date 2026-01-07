/**
 * Chat streaming handler
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { streamText } from 'ai'
import { getEmbeddingModel } from '@aperture/core'
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

      try {
        const openai = getOpenAIClient()
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

        // Stream the response
        const result = streamText({
          model: openai('gpt-4o'),
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          tools,
          maxSteps: 10,
          toolChoice: 'auto',
        })

        // Set up SSE response
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })

        // Stream the response
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'text', text: part.textDelta })}\n\n`)
          } else if (part.type === 'tool-call') {
            reply.raw.write(
              `data: ${JSON.stringify({
                type: 'tool-call',
                toolName: part.toolName,
                args: part.args,
              })}\n\n`
            )
          } else if (part.type === 'tool-result') {
            reply.raw.write(
              `data: ${JSON.stringify({
                type: 'tool-result',
                toolName: part.toolName,
                result: part.result,
              })}\n\n`
            )
          } else if (part.type === 'finish') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'finish' })}\n\n`)
          }
        }

        reply.raw.end()
        return reply
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

