import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth, type SessionUser } from '../plugins/auth.js'
import { regenerateUserRecommendations } from '@aperture/core'

interface RecommendationCandidate {
  id: string
  movie_id: string
  rank: number
  is_selected: boolean
  final_score: number
  similarity_score: number | null
  novelty_score: number | null
  rating_score: number | null
  diversity_score: number | null
  score_breakdown: Record<string, unknown>
  movie: {
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    community_rating: number | null
    overview: string | null
  }
}

interface RecommendationRun {
  id: string
  user_id: string
  run_type: string
  channel_id: string | null
  candidate_count: number
  selected_count: number
  duration_ms: number | null
  status: string
  error_message: string | null
  created_at: Date
}

const recommendationsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/recommendations/:userId
   * Get user's latest recommendations
   */
  fastify.get<{ Params: { userId: string }; Querystring: { runId?: string } }>(
    '/api/recommendations/:userId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.params
      const { runId } = request.query
      const currentUser = request.user as SessionUser

      // Allow access to own recommendations or admin
      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Get the run (either specific or latest)
      let run: RecommendationRun | null

      if (runId) {
        run = await queryOne<RecommendationRun>(
          `SELECT * FROM recommendation_runs WHERE id = $1 AND user_id = $2`,
          [runId, userId]
        )
      } else {
        run = await queryOne<RecommendationRun>(
          `SELECT * FROM recommendation_runs
           WHERE user_id = $1 AND status = 'completed'
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

      // Get selected candidates with movie info - only from enabled libraries
      const candidates = await query<RecommendationCandidate>(
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
           AND (
             -- Include if no library configs exist (no filtering)
             NOT EXISTS (SELECT 1 FROM library_config)
             -- Or if movie's library is enabled
             OR lc.is_enabled = true
             -- Or if movie has no library assigned (legacy data)
             OR m.provider_library_id IS NULL
           )
         ORDER BY rc.rank ASC`,
        [run.id]
      )

      return reply.send({
        run,
        recommendations: candidates.rows,
      })
    }
  )

  /**
   * GET /api/recommendations/:userId/history
   * Get user's recommendation run history
   */
  fastify.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
    '/api/recommendations/:userId/history',
    { preHandler: requireAuth },
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
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId, candidateId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Verify candidate belongs to user
      const candidate = await queryOne(
        `SELECT rc.* FROM recommendation_candidates rc
         JOIN recommendation_runs rr ON rr.id = rc.run_id
         WHERE rc.id = $1 AND rr.user_id = $2`,
        [candidateId, userId]
      )

      if (!candidate) {
        return reply.status(404).send({ error: 'Candidate not found' })
      }

      // Get evidence with similar movie info
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

  /**
   * POST /api/recommendations/:userId/regenerate
   * Regenerate recommendations for a user (user can regenerate their own)
   */
  fastify.post<{ Params: { userId: string } }>(
    '/api/recommendations/:userId/regenerate',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.params
      const currentUser = request.user as SessionUser

      // Users can only regenerate their own recommendations
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
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId, movieId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Get the latest recommendation run for this user
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

      // Check if this movie is in the recommendations
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

      // Get the evidence - movies from your watch history that are similar
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

      // Get the user's top genres from their watch history
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

      // Get the movie's genres to show overlap with taste
      const movie = await queryOne<{ genres: string[] }>(
        `SELECT genres FROM movies WHERE id = $1`,
        [movieId]
      )

      // Calculate genre overlap
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

  /**
   * GET /api/recommendations/:userId/preferences
   * Get user's recommendation preferences
   */
  fastify.get<{ Params: { userId: string } }>(
    '/api/recommendations/:userId/preferences',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const prefs = await queryOne<{
        include_watched: boolean
        preferred_genres: string[]
        excluded_genres: string[]
        novelty_weight: number
        rating_weight: number
      }>(
        `SELECT include_watched, preferred_genres, excluded_genres, novelty_weight, rating_weight
         FROM user_preferences WHERE user_id = $1`,
        [userId]
      )

      // Return defaults if no preferences exist yet
      return reply.send({
        includeWatched: prefs?.include_watched ?? false,
        preferredGenres: prefs?.preferred_genres ?? [],
        excludedGenres: prefs?.excluded_genres ?? [],
        noveltyWeight: prefs?.novelty_weight ?? 0.3,
        ratingWeight: prefs?.rating_weight ?? 0.2,
      })
    }
  )

  /**
   * PATCH /api/recommendations/:userId/preferences
   * Update user's recommendation preferences
   */
  fastify.patch<{
    Params: { userId: string }
    Body: {
      includeWatched?: boolean
      preferredGenres?: string[]
      excludedGenres?: string[]
      noveltyWeight?: number
      ratingWeight?: number
    }
  }>(
    '/api/recommendations/:userId/preferences',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const { includeWatched, preferredGenres, excludedGenres, noveltyWeight, ratingWeight } =
        request.body

      // Build dynamic update query
      const updates: string[] = []
      const values: unknown[] = [userId]
      let paramIndex = 2

      if (includeWatched !== undefined) {
        updates.push(`include_watched = $${paramIndex++}`)
        values.push(includeWatched)
      }
      if (preferredGenres !== undefined) {
        updates.push(`preferred_genres = $${paramIndex++}`)
        values.push(preferredGenres)
      }
      if (excludedGenres !== undefined) {
        updates.push(`excluded_genres = $${paramIndex++}`)
        values.push(excludedGenres)
      }
      if (noveltyWeight !== undefined) {
        updates.push(`novelty_weight = $${paramIndex++}`)
        values.push(noveltyWeight)
      }
      if (ratingWeight !== undefined) {
        updates.push(`rating_weight = $${paramIndex++}`)
        values.push(ratingWeight)
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No preferences to update' })
      }

      // Upsert: create if not exists, update if exists
      await query(
        `INSERT INTO user_preferences (user_id, ${updates.map((u) => u.split(' = ')[0]).join(', ')})
         VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()`,
        values
      )

      return reply.send({ message: 'Preferences updated successfully' })
    }
  )
}

export default recommendationsRoutes

