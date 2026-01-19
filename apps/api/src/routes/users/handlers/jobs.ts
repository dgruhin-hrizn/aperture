import type { FastifyInstance } from 'fastify'
import { queryOne } from '../../../lib/db.js'
import { requireAdmin } from '../../../plugins/auth.js'
import {
  syncWatchHistoryForUser,
  generateRecommendationsForUser,
  writeStrmFilesForUser,
  ensureUserLibrary,
  updateUserLibraryPermissions,
  refreshUserLibrary,
  createChildLogger,
} from '@aperture/core'
import type { UserRow } from '../types.js'

const logger = createChildLogger('users-api')

export function registerJobHandlers(fastify: FastifyInstance) {
  /**
   * POST /api/users/:id/sync-history
   * Sync watch history for a specific user
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/sync-history',
    { preHandler: requireAdmin, schema: { tags: ["users"] } },
    async (request, reply) => {
      const { id } = request.params

      const user = await queryOne<UserRow>(
        `SELECT * FROM users WHERE id = $1`,
        [id]
      )

      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      if (!user.is_enabled) {
        return reply.status(400).send({ error: 'User is not enabled for AI recommendations' })
      }

      logger.info({ userId: id, username: user.username }, 'Starting watch history sync for user')

      try {
        const result = await syncWatchHistoryForUser(id, user.provider_user_id)
        logger.info({ userId: id, result }, 'Watch history sync complete for user')
        return reply.send({ 
          message: 'Watch history synced',
          ...result
        })
      } catch (error) {
        logger.error({ error, userId: id }, 'Failed to sync watch history for user')
        return reply.status(500).send({ error: 'Failed to sync watch history' })
      }
    }
  )

  /**
   * POST /api/users/:id/generate-recommendations
   * Generate recommendations for a specific user
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/generate-recommendations',
    { preHandler: requireAdmin, schema: { tags: ["users"] } },
    async (request, reply) => {
      const { id } = request.params

      const user = await queryOne<UserRow>(
        `SELECT * FROM users WHERE id = $1`,
        [id]
      )

      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      if (!user.is_enabled) {
        return reply.status(400).send({ error: 'User is not enabled for AI recommendations' })
      }

      logger.info({ userId: id, username: user.username }, 'Starting recommendation generation for user')

      try {
        const result = await generateRecommendationsForUser({
          id,
          username: user.username,
          providerUserId: user.provider_user_id,
          maxParentalRating: user.max_parental_rating,
        })
        logger.info({ userId: id, recommendations: result.recommendations.length }, 'Recommendations generated for user')
        return reply.send({ 
          message: 'Recommendations generated',
          runId: result.runId,
          count: result.recommendations.length,
        })
      } catch (error) {
        logger.error({ error, userId: id }, 'Failed to generate recommendations for user')
        return reply.status(500).send({ error: 'Failed to generate recommendations' })
      }
    }
  )

  /**
   * POST /api/users/:id/update-strm
   * Update STRM files and permissions for a specific user
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/update-strm',
    { preHandler: requireAdmin, schema: { tags: ["users"] } },
    async (request, reply) => {
      const { id } = request.params

      const user = await queryOne<UserRow>(
        `SELECT * FROM users WHERE id = $1`,
        [id]
      )

      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      if (!user.is_enabled) {
        return reply.status(400).send({ error: 'User is not enabled for AI recommendations' })
      }

      logger.info({ userId: id, username: user.username }, 'Starting STRM update for user')

      try {
        // Ensure library exists
        const library = await ensureUserLibrary(id, user.provider_user_id, user.display_name || user.username)
        
        // Write STRM files
        const strmResult = await writeStrmFilesForUser(id, user.provider_user_id, user.display_name || user.username)
        
        // Update permissions (pass userId and providerUserId, not library object)
        await updateUserLibraryPermissions(id, user.provider_user_id)
        
        // Refresh library (pass userId, not library object)
        await refreshUserLibrary(id)

        logger.info({ userId: id, written: strmResult.written, deleted: strmResult.deleted }, 'STRM update complete for user')
        return reply.send({ 
          message: 'STRM files updated',
          written: strmResult.written,
          deleted: strmResult.deleted,
          libraryName: library.name,
        })
      } catch (error) {
        logger.error({ error, userId: id }, 'Failed to update STRM for user')
        return reply.status(500).send({ error: 'Failed to update STRM files' })
      }
    }
  )

  /**
   * POST /api/users/:id/run-all
   * Run all jobs (sync, recommendations, STRM) for a specific user
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/run-all',
    { preHandler: requireAdmin, schema: { tags: ["users"] } },
    async (request, reply) => {
      const { id } = request.params

      const user = await queryOne<UserRow>(
        `SELECT * FROM users WHERE id = $1`,
        [id]
      )

      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      if (!user.is_enabled) {
        return reply.status(400).send({ error: 'User is not enabled for AI recommendations' })
      }

      logger.info({ userId: id, username: user.username }, 'Starting full pipeline for user')

      try {
        // Step 1: Sync watch history
        const syncResult = await syncWatchHistoryForUser(id, user.provider_user_id)
        logger.info({ userId: id, syncResult }, 'Watch history synced')

        // Step 2: Generate recommendations
        const recsResult = await generateRecommendationsForUser({
          id,
          username: user.username,
          providerUserId: user.provider_user_id,
          maxParentalRating: user.max_parental_rating,
        })
        logger.info({ userId: id, recommendations: recsResult.recommendations.length }, 'Recommendations generated')

        // Step 3: Update STRM files
        const library = await ensureUserLibrary(id, user.provider_user_id, user.display_name || user.username)
        const strmResult = await writeStrmFilesForUser(id, user.provider_user_id, user.display_name || user.username)
        await updateUserLibraryPermissions(id, user.provider_user_id)
        await refreshUserLibrary(id)
        logger.info({ userId: id, written: strmResult.written }, 'STRM files updated')

        return reply.send({ 
          message: 'Full pipeline complete',
          sync: syncResult,
          recommendations: {
            runId: recsResult.runId,
            count: recsResult.recommendations.length,
          },
          strm: {
            written: strmResult.written,
            deleted: strmResult.deleted,
          },
        })
      } catch (error) {
        logger.error({ error, userId: id }, 'Failed to run full pipeline for user')
        return reply.status(500).send({ error: 'Failed to run pipeline' })
      }
    }
  )
}



