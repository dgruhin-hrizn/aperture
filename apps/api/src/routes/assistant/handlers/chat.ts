/**
 * Chat streaming handler with AI SDK v5 + Tool UI
 * https://www.tool-ui.com/docs/quick-start
 *
 * Uses a custom stream transformer to buffer tool calls until complete,
 * avoiding issues with @assistant-ui/react expecting tool args to stream in order.
 * See: https://www.aha.io/engineering/articles/streaming-ai-responses-incomplete-json
 */
import { Readable } from 'node:stream'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai'
import { getChatModelInstance, getEmbeddingModelInstance, getFunctionConfig, type AIFunction } from '@aperture/core'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { getMediaServerInfo, buildSystemPrompt } from '../helpers/index.js'
import { createTools } from '../tools/index.js'

interface ChatBody {
  messages: UIMessage[]
  system?: string
}

/**
 * Creates a TransformStream that transforms tool-input streaming events
 * into a single complete event. This fixes compatibility issues with
 * @assistant-ui/react which expects tool args to be appended in order.
 *
 * Some models (like GPT-4.1-mini) stream JSON properties in different orders,
 * breaking the "append only" assumption in assistant-ui.
 *
 * Strategy:
 * - Skip tool-input-start (we'll emit tool-input-available instead)
 * - Skip tool-input-delta (causes the argsText error)
 * - Keep tool-input-available (has complete args, frontend needs this)
 * - Keep tool-output-available (has results)
 */
function createToolBufferingStream(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  // Buffer for accumulating SSE data
  let buffer = ''

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })

      // Process complete SSE events (end with \n\n)
      const events = buffer.split('\n\n')
      // Keep the last incomplete event in the buffer
      buffer = events.pop() || ''

      for (const event of events) {
        if (!event.trim()) continue

        // Parse SSE event to get data
        const lines = event.split('\n')
        let eventData = ''

        for (const line of lines) {
          if (line.startsWith('data:')) {
            eventData = line.slice(5).trim()
          }
        }

        // Parse JSON data to check the type field
        let dataType = ''
        try {
          const parsed = JSON.parse(eventData)
          dataType = parsed.type || ''
        } catch {
          // If we can't parse, pass through
        }

        // Filter out ONLY the streaming delta events
        // - tool-input-start: SKIP (we'll use tool-input-available instead)
        // - tool-input-delta: SKIP (causes the argsText append error)
        // - tool-input-available: KEEP (has complete args, needed by frontend)
        // - tool-output-available: KEEP (has results)
        if (dataType === 'tool-input-start' || dataType === 'tool-input-delta') {
          continue // Skip streaming events
        }

        // Emit the event
        controller.enqueue(encoder.encode(event + '\n\n'))
      }
    },
    flush(controller) {
      // Emit any remaining buffered data
      if (buffer.trim()) {
        controller.enqueue(encoder.encode(buffer))
      }
    },
  })
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
        const chatModel = await getChatModelInstance()
        const embeddingModel = await getEmbeddingModelInstance()
        const chatConfig = await getFunctionConfig('chat' as AIFunction)
        const embeddingConfig = await getFunctionConfig('embeddings' as AIFunction)
        const mediaServer = await getMediaServerInfo()
        const systemPrompt = await buildSystemPrompt(user.id, user.isAdmin)

        // Create tool context
        const toolContext = {
          userId: user.id,
          isAdmin: user.isAdmin,
          embeddingModel,
          embeddingModelId: embeddingConfig?.model ?? 'text-embedding-3-large',
          mediaServer,
        }

        // Create tools with context
        const tools = createTools(toolContext)

        fastify.log.info({ toolCount: Object.keys(tools).length, model: chatConfig?.model ?? 'unknown' }, 'Starting chat stream')

        // Stream the response using AI SDK v5
        // stopWhen allows the model to continue generating text after tool results
        const result = streamText({
          model: chatModel,
          system: systemPrompt,
          messages: convertToModelMessages(messages),
          tools,
          toolChoice: 'auto',
          stopWhen: stepCountIs(5), // Stop after 5 steps (allows tool calls + follow-up responses)
          onStepFinish: (step) => {
            fastify.log.info(
              {
                stepKeys: Object.keys(step),
                hasText: !!step.text,
                textLength: step.text?.length,
                toolCallCount: step.toolCalls?.length ?? 0,
                toolResultCount: step.toolResults?.length ?? 0,
              },
              'Step finished'
            )
          },
        })

        // Get the UI Message Stream Response (Web Response)
        const webResponse = result.toUIMessageStreamResponse()

        // Forward status + headers to Fastify
        reply.status(webResponse.status)
        webResponse.headers.forEach((value: string, key: string) => reply.header(key, value))

        // Pipe through the tool buffering transform to fix streaming order issues
        // Then pipe to Node response
        const bufferedStream = webResponse.body!.pipeThrough(createToolBufferingStream())
        const nodeStream = Readable.fromWeb(
          bufferedStream as Parameters<typeof Readable.fromWeb>[0]
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
