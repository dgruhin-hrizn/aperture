/**
 * Series Recommendations Handlers
 */

import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { regenerateUserSeriesRecommendations } from '@aperture/core'
import { recommendationSchemas } from '../schemas.js'
import type { SeriesRecommendationCandidate, RecommendationRun } from '../types.js'

export async function registerSeriesHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/recommendations/:userId/series
   * Get user's latest series recommendations
   */
  fastify.get<{ Params: { userId: string }; Querystring: { runId?: string } }>(
    '/api/recommendations/:userId/series',
    { preHandler: requireAuth, schema: recommendationSchemas.getSeriesRecommendations },
    async (request, reply) => {
      const { userId } = request.params
      const { runId } = request.query
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      let run: RecommendationRun | null

      if (runId) {
        run = await queryOne<RecommendationRun>(
          `SELECT * FROM recommendation_runs WHERE id = $1 AND user_id = $2`,
          [runId, userId]
        )
      } else {
        run = await queryOne<RecommendationRun>(
          `SELECT * FROM recommendation_runs
           WHERE user_id = $1 AND status = 'completed' AND media_type = 'series'
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId]
        )
      }

      if (!run) {
        return reply.send({
          run: null,
          recommendations: [],
          message: 'No series recommendations found',
        })
      }

      const candidates = await query<SeriesRecommendationCandidate>(
        `SELECT rc.*,
                json_build_object(
                  'id', s.id,
                  'title', s.title,
                  'year', s.year,
                  'poster_url', s.poster_url,
                  'genres', s.genres,
                  'community_rating', s.community_rating,
                  'overview', s.overview
                ) as series
         FROM recommendation_candidates rc
         JOIN series s ON s.id = rc.series_id
         LEFT JOIN library_config lc ON lc.provider_library_id = s.provider_library_id
         WHERE rc.run_id = $1 
           AND rc.is_selected = true
           AND rc.series_id IS NOT NULL
           AND (
             NOT EXISTS (SELECT 1 FROM library_config WHERE collection_type = 'tvshows')
             OR lc.is_enabled = true
             OR s.provider_library_id IS NULL
           )
         ORDER BY rc.selected_rank ASC`,
        [run.id]
      )

      return reply.send({
        run,
        recommendations: candidates.rows,
      })
    }
  )

  /**
   * POST /api/recommendations/:userId/series/regenerate
   * Regenerate series recommendations for a user
   */
  fastify.post<{ Params: { userId: string } }>(
    '/api/recommendations/:userId/series/regenerate',
    { preHandler: requireAuth, schema: recommendationSchemas.regenerateSeriesRecommendations },
    async (request, reply) => {
      const { userId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const result = await regenerateUserSeriesRecommendations(userId)
        return reply.send({
          message: 'Series recommendations regenerated successfully',
          runId: result.runId,
          count: result.count,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error({ err, userId }, 'Failed to regenerate series recommendations')
        return reply.status(500).send({ error: `Failed to regenerate: ${error}` })
      }
    }
  )
}
