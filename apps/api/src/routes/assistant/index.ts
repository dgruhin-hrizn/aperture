/**
 * AI Assistant Routes
 *
 * Provides a conversational AI assistant for media discovery and recommendations.
 */
import type { FastifyPluginAsync } from 'fastify'
import { registerChatHandler, registerConversationHandlers, registerSuggestionsHandler } from './handlers/index.js'

const assistantRoutes: FastifyPluginAsync = async (fastify) => {
  // Register chat streaming endpoint
  registerChatHandler(fastify)

  // Register conversation management endpoints
  registerConversationHandlers(fastify)

  // Register personalized suggestions endpoint
  registerSuggestionsHandler(fastify)
}

export default assistantRoutes

