/**
 * Movie Recommendations Handlers
 */

import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { regenerateUserRecommendations } from '@aperture/core'
import { recommendationSchemas } from '../schemas.js'
import type { MovieRecommendationCandidate, RecommendationRun } from '../types.js'

export async function registerMovieHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/recommendations/:userId
   * Get user's latest movie recommendations
   */
  fastify.get<{ Params: { userId: string }; Querystring: { runId?: string } }>(
    '/api/recommendations/:userId',
    { preHandler: requireAuth, schema: recommendationSchemas.getMovieRecommendations },
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
           WHERE user_id = $1 AND status = 'completed' AND media_type = 'movie'
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId]
        )
      }

      if (!run) {
        return reply.send({
          run: null,
          recommendations: [],
          message: 'No recommendations found',
        })
      }

      const candidates = await query<MovieRecommendationCandidate>(
        `SELECT rc.*,
                json_build_object(
                  'id', m.id,
                  'title', m.title,
                  'year', m.year,
                  'poster_url', m.poster_url,
                  'genres', m.genres,
                  'community_rating', m.community_rating,
                  'overview', m.overview
                ) as movie
         FROM recommendation_candidates rc
         JOIN movies m ON m.id = rc.movie_id
         LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE rc.run_id = $1 
           AND rc.is_selected = true
           AND rc.movie_id IS NOT NULL
           AND (
             NOT EXISTS (SELECT 1 FROM library_config WHERE collection_type = 'movies')
             OR lc.is_enabled = true
             OR m.provider_library_id IS NULL
           )
         ORDER BY rc.selected_rank ASC NULLS LAST`,
        [run.id]
      )

      return reply.send({
        run,
        recommendations: candidates.rows,
      })
    }
  )

  /**
   * POST /api/recommendations/:userId/regenerate
   * Regenerate movie recommendations for a user
   */
  fastify.post<{ Params: { userId: string } }>(
    '/api/recommendations/:userId/regenerate',
    { preHandler: requireAuth, schema: recommendationSchemas.regenerateMovieRecommendations },
    async (request, reply) => {
      const { userId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const result = await regenerateUserRecommendations(userId)
        return reply.send({
          message: 'Recommendations regenerated successfully',
          runId: result.runId,
          count: result.count,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error({ err, userId }, 'Failed to regenerate recommendations')
        return reply.status(500).send({ error: `Failed to regenerate: ${error}` })
      }
    }
  )

  /**
   * GET /api/recommendations/:userId/movie/:movieId/insights
   * Get detailed AI recommendation insights for a specific movie
   */
  fastify.get<{ Params: { userId: string; movieId: string } }>(
    '/api/recommendations/:userId/movie/:movieId/insights',
    { preHandler: requireAuth, schema: recommendationSchemas.getMovieInsights },
    async (request, reply) => {
      const { userId, movieId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const latestRun = await queryOne<{ id: string }>(
        `SELECT id FROM recommendation_runs
         WHERE user_id = $1 AND status = 'completed'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      )

      if (!latestRun) {
        return reply.send({
          isRecommended: false,
          message: 'No recommendations generated yet',
        })
      }

      const candidate = await queryOne<{
        id: string
        rank: number
        is_selected: boolean
        final_score: number
        similarity_score: number | null
        novelty_score: number | null
        rating_score: number | null
        diversity_score: number | null
        score_breakdown: Record<string, unknown>
      }>(
        `SELECT rc.id, rc.rank, rc.is_selected, rc.final_score,
                rc.similarity_score, rc.novelty_score, rc.rating_score, rc.diversity_score,
                rc.score_breakdown
         FROM recommendation_candidates rc
         WHERE rc.run_id = $1 AND rc.movie_id = $2`,
        [latestRun.id, movieId]
      )

      if (!candidate) {
        return reply.send({
          isRecommended: false,
          message: 'This movie was not considered in your recommendations',
        })
      }

      const evidence = await query<{
        id: string
        similar_movie_id: string
        similarity: number
        evidence_type: string
        similar_movie: {
          id: string
          title: string
          year: number | null
          poster_url: string | null
          genres: string[]
        }
      }>(
        `SELECT re.id, re.similar_movie_id, re.similarity, re.evidence_type,
                json_build_object(
                  'id', m.id,
                  'title', m.title,
                  'year', m.year,
                  'poster_url', m.poster_url,
                  'genres', m.genres
                ) as similar_movie
         FROM recommendation_evidence re
         JOIN movies m ON m.id = re.similar_movie_id
         WHERE re.candidate_id = $1
         ORDER BY re.similarity DESC
         LIMIT 10`,
        [candidate.id]
      )

      const tasteInsights = await query<{
        genre: string
        watch_count: number
      }>(
        `SELECT unnest(m.genres) as genre, COUNT(*) as watch_count
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         WHERE wh.user_id = $1
         GROUP BY unnest(m.genres)
         ORDER BY watch_count DESC
         LIMIT 10`,
        [userId]
      )

      const movie = await queryOne<{ genres: string[] }>(
        `SELECT genres FROM movies WHERE id = $1`,
        [movieId]
      )

      const userGenres = new Set(tasteInsights.rows.map((t) => t.genre))
      const movieGenres = movie?.genres || []
      const matchingGenres = movieGenres.filter((g) => userGenres.has(g))
      const newGenres = movieGenres.filter((g) => !userGenres.has(g))

      return reply.send({
        isRecommended: true,
        isSelected: candidate.is_selected,
        rank: candidate.rank,
        scores: {
          final: Number(candidate.final_score),
          similarity: candidate.similarity_score ? Number(candidate.similarity_score) : null,
          novelty: candidate.novelty_score ? Number(candidate.novelty_score) : null,
          rating: candidate.rating_score ? Number(candidate.rating_score) : null,
          diversity: candidate.diversity_score ? Number(candidate.diversity_score) : null,
        },
        scoreBreakdown: candidate.score_breakdown,
        evidence: evidence.rows,
        genreAnalysis: {
          movieGenres,
          matchingGenres,
          newGenres,
          userTopGenres: tasteInsights.rows.slice(0, 5),
        },
      })
    }
  )
}
