/**
 * Recommendations History & Evidence Handlers
 */

import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { recommendationSchemas } from '../schemas.js'
import type { RecommendationRun } from '../types.js'

export async function registerHistoryHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/recommendations/:userId/history
   * Get user's recommendation run history
   */
  fastify.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
    '/api/recommendations/:userId/history',
    { preHandler: requireAuth, schema: recommendationSchemas.getHistory },
    async (request, reply) => {
      const { userId } = request.params
      const limit = Math.min(parseInt(request.query.limit || '10', 10), 50)
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const runs = await query<RecommendationRun>(
        `SELECT * FROM recommendation_runs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      )

      return reply.send({ runs: runs.rows })
    }
  )

  /**
   * GET /api/recommendations/:userId/candidates/:candidateId/evidence
   * Get evidence for why a movie was recommended
   */
  fastify.get<{ Params: { userId: string; candidateId: string } }>(
    '/api/recommendations/:userId/candidates/:candidateId/evidence',
    { preHandler: requireAuth, schema: recommendationSchemas.getEvidence },
    async (request, reply) => {
      const { userId, candidateId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const candidate = await queryOne(
        `SELECT rc.* FROM recommendation_candidates rc
         JOIN recommendation_runs rr ON rr.id = rc.run_id
         WHERE rc.id = $1 AND rr.user_id = $2`,
        [candidateId, userId]
      )

      if (!candidate) {
        return reply.status(404).send({ error: 'Candidate not found' })
      }

      const evidence = await query(
        `SELECT re.*,
                json_build_object(
                  'id', m.id,
                  'title', m.title,
                  'year', m.year,
                  'poster_url', m.poster_url
                ) as similar_movie
         FROM recommendation_evidence re
         JOIN movies m ON m.id = re.similar_movie_id
         WHERE re.candidate_id = $1
         ORDER BY re.similarity DESC`,
        [candidateId]
      )

      return reply.send({
        candidate,
        evidence: evidence.rows,
      })
    }
  )
}
