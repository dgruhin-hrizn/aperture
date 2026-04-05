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
                  'overview', s.overview,
                  'total_seasons', s.total_seasons,
                  'total_episodes', s.total_episodes,
                  'tmdb_id', s.tmdb_id
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

  /**
   * GET /api/recommendations/:userId/series/:seriesId/insights
   * Get detailed AI recommendation insights for a specific series
   */
  fastify.get<{ Params: { userId: string; seriesId: string } }>(
    '/api/recommendations/:userId/series/:seriesId/insights',
    { preHandler: requireAuth, schema: recommendationSchemas.getSeriesInsights },
    async (request, reply) => {
      const { userId, seriesId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const latestRun = await queryOne<{ id: string }>(
        `SELECT id FROM recommendation_runs
         WHERE user_id = $1 AND status = 'completed' AND media_type = 'series'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      )

      if (!latestRun) {
        return reply.send({
          isRecommended: false,
          message: 'No series recommendations generated yet',
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
         WHERE rc.run_id = $1 AND rc.series_id = $2`,
        [latestRun.id, seriesId]
      )

      if (!candidate) {
        return reply.send({
          isRecommended: false,
          message: 'This series was not considered in your recommendations',
        })
      }

      const evidence = await query<{
        id: string
        similar_series_id: string
        similarity: number
        evidence_type: string
        similar_series: {
          id: string
          title: string
          year: number | null
          poster_url: string | null
          genres: string[]
        }
      }>(
        `SELECT re.id, re.similar_series_id, re.similarity, re.evidence_type,
                json_build_object(
                  'id', s.id,
                  'title', s.title,
                  'year', s.year,
                  'poster_url', s.poster_url,
                  'genres', s.genres
                ) as similar_series
         FROM recommendation_evidence re
         JOIN series s ON s.id = re.similar_series_id
         WHERE re.candidate_id = $1 AND re.similar_series_id IS NOT NULL
         ORDER BY re.similarity DESC
         LIMIT 10`,
        [candidate.id]
      )

      const tasteInsights = await query<{
        genre: string
        watch_count: number
      }>(
        `SELECT unnest(s.genres) as genre, COUNT(DISTINCT s.id) as watch_count
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.episode_id
         JOIN series s ON s.id = e.series_id
         WHERE wh.user_id = $1 AND wh.media_type = 'episode'
         GROUP BY unnest(s.genres)
         ORDER BY watch_count DESC
         LIMIT 10`,
        [userId]
      )

      const targetSeries = await queryOne<{ genres: string[] }>(
        `SELECT genres FROM series WHERE id = $1`,
        [seriesId]
      )

      const userGenres = new Set(tasteInsights.rows.map((t) => t.genre))
      const seriesGenres = targetSeries?.genres || []
      const matchingGenres = seriesGenres.filter((g) => userGenres.has(g))
      const newGenres = seriesGenres.filter((g) => !userGenres.has(g))

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
          mediaGenres: seriesGenres,
          matchingGenres,
          newGenres,
          userTopGenres: tasteInsights.rows.slice(0, 5),
        },
      })
    }
  )
}
