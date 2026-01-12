/**
 * API Errors Routes
 * 
 * Provides endpoints for managing API error alerts:
 * - List active errors
 * - Dismiss individual errors
 * - Dismiss all errors for a provider
 * - Get error summary for dashboard
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth, requireAdmin } from '../plugins/auth.js'
import {
  getActiveApiErrors,
  getActiveErrorsByProvider,
  getErrorSummary,
  dismissApiError,
  dismissErrorsByProvider,
  cleanupOldErrors,
  createChildLogger,
} from '@aperture/core'

const logger = createChildLogger('api-errors-routes')

const apiErrorsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/errors
   * Get all active API errors for display
   */
  fastify.get(
    '/api/errors',
    { preHandler: requireAuth },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const errors = await getActiveApiErrors()
        
        // Transform for frontend consumption
        const transformed = errors.map((error) => ({
          id: error.id,
          provider: error.provider,
          errorType: error.errorType,
          errorCode: error.errorCode,
          httpStatus: error.httpStatus,
          message: error.errorMessage,
          resetAt: error.resetAt?.toISOString() || null,
          actionUrl: error.actionUrl,
          createdAt: error.createdAt?.toISOString() || null,
        }))
        
        reply.send({ errors: transformed })
      } catch (err) {
        logger.error({ err }, 'Failed to get API errors')
        reply.status(500).send({ error: 'Failed to get API errors' })
      }
    }
  )

  /**
   * GET /api/errors/summary
   * Get error summary for dashboard display
   */
  fastify.get(
    '/api/errors/summary',
    { preHandler: requireAuth },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const summary = await getErrorSummary()
        reply.send({ summary })
      } catch (err) {
        logger.error({ err }, 'Failed to get error summary')
        reply.status(500).send({ error: 'Failed to get error summary' })
      }
    }
  )

  /**
   * GET /api/errors/:provider
   * Get active errors for a specific provider
   */
  fastify.get(
    '/api/errors/:provider',
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { provider: string } }>,
      reply: FastifyReply
    ) => {
      const { provider } = request.params
      
      // Validate provider
      const validProviders = ['openai', 'tmdb', 'trakt', 'mdblist', 'omdb']
      if (!validProviders.includes(provider)) {
        return reply.status(400).send({ error: 'Invalid provider' })
      }
      
      try {
        const errors = await getActiveErrorsByProvider(provider as 'openai' | 'tmdb' | 'trakt' | 'mdblist' | 'omdb')
        
        const transformed = errors.map((error) => ({
          id: error.id,
          provider: error.provider,
          errorType: error.errorType,
          errorCode: error.errorCode,
          httpStatus: error.httpStatus,
          message: error.errorMessage,
          resetAt: error.resetAt?.toISOString() || null,
          actionUrl: error.actionUrl,
          createdAt: error.createdAt?.toISOString() || null,
        }))
        
        reply.send({ errors: transformed })
      } catch (err) {
        logger.error({ err, provider }, 'Failed to get provider errors')
        reply.status(500).send({ error: 'Failed to get provider errors' })
      }
    }
  )

  /**
   * POST /api/errors/:id/dismiss
   * Dismiss a specific error
   */
  fastify.post(
    '/api/errors/:id/dismiss',
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params
      
      try {
        await dismissApiError(id)
        reply.send({ success: true })
      } catch (err) {
        logger.error({ err, id }, 'Failed to dismiss error')
        reply.status(500).send({ error: 'Failed to dismiss error' })
      }
    }
  )

  /**
   * POST /api/errors/:provider/dismiss-all
   * Dismiss all errors for a provider
   */
  fastify.post(
    '/api/errors/:provider/dismiss-all',
    { preHandler: requireAuth },
    async (
      request: FastifyRequest<{ Params: { provider: string } }>,
      reply: FastifyReply
    ) => {
      const { provider } = request.params
      
      // Validate provider
      const validProviders = ['openai', 'tmdb', 'trakt', 'mdblist', 'omdb']
      if (!validProviders.includes(provider)) {
        return reply.status(400).send({ error: 'Invalid provider' })
      }
      
      try {
        const count = await dismissErrorsByProvider(provider as 'openai' | 'tmdb' | 'trakt' | 'mdblist' | 'omdb')
        reply.send({ success: true, dismissed: count })
      } catch (err) {
        logger.error({ err, provider }, 'Failed to dismiss provider errors')
        reply.status(500).send({ error: 'Failed to dismiss provider errors' })
      }
    }
  )

  /**
   * POST /api/errors/cleanup
   * Clean up old dismissed errors (admin only)
   */
  fastify.post(
    '/api/errors/cleanup',
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const count = await cleanupOldErrors()
        reply.send({ success: true, deleted: count })
      } catch (err) {
        logger.error({ err }, 'Failed to cleanup old errors')
        reply.status(500).send({ error: 'Failed to cleanup old errors' })
      }
    }
  )
}

export default apiErrorsRoutes

