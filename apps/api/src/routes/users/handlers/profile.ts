import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { getTasteSynopsis, generateTasteSynopsis } from '@aperture/core'

export function registerProfileHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/:id/watch-history
   * Get user's watch history with pagination
   */
  fastify.get<{ 
    Params: { id: string }
    Querystring: { page?: string; pageSize?: string; sortBy?: string }
  }>(
    '/api/users/:id/watch-history',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser
      const page = parseInt(request.query.page || '1', 10)
      const pageSize = Math.min(parseInt(request.query.pageSize || '50', 10), 100)
      const sortBy = request.query.sortBy || 'recent' // recent, plays, title

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Get total count (only from enabled libraries)
      const countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND lc.is_enabled = true`,
        [id]
      )
      const total = parseInt(countResult?.count || '0', 10)

      // Build ORDER BY clause
      let orderBy = 'wh.last_played_at DESC NULLS LAST'
      if (sortBy === 'plays') {
        orderBy = 'wh.play_count DESC, wh.last_played_at DESC NULLS LAST'
      } else if (sortBy === 'title') {
        orderBy = 'm.title ASC'
      }

      const offset = (page - 1) * pageSize

      const result = await query(
        `SELECT 
           wh.movie_id,
           wh.play_count,
           wh.is_favorite,
           wh.last_played_at,
           m.title,
           m.year,
           m.poster_url,
           m.genres,
           m.community_rating,
           m.overview
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND lc.is_enabled = true
         ORDER BY ${orderBy}
         LIMIT $2 OFFSET $3`,
        [id, pageSize, offset]
      )

      return reply.send({ 
        history: result.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      })
    }
  )

  /**
   * GET /api/users/:id/preferences
   * Get user's preferences
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/preferences',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const prefs = await queryOne(
        `SELECT * FROM user_preferences WHERE user_id = $1`,
        [id]
      )

      return reply.send({ preferences: prefs || null })
    }
  )

  /**
   * GET /api/users/:id/stats
   * Get user's stats (watched count, favorites, recommendations)
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // Get watched count (from enabled libraries only)
      const watchedResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND lc.is_enabled = true`,
        [id]
      )

      // Get favorites count (from enabled libraries only)
      const favoritesResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM watch_history wh
         JOIN movies m ON m.id = wh.movie_id
         JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE wh.user_id = $1 AND wh.is_favorite = true AND lc.is_enabled = true`,
        [id]
      )

      // Get recommendations count from latest run
      const recsResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM recommendation_candidates rc
         JOIN recommendation_runs rr ON rr.id = rc.run_id
         JOIN movies m ON m.id = rc.movie_id
         LEFT JOIN library_config lc ON lc.provider_library_id = m.provider_library_id
         WHERE rr.user_id = $1 
           AND rc.is_selected = true
           AND rr.id = (SELECT id FROM recommendation_runs WHERE user_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1)
           AND (
             NOT EXISTS (SELECT 1 FROM library_config)
             OR lc.is_enabled = true
             OR m.provider_library_id IS NULL
           )`,
        [id]
      )

      return reply.send({
        watchedCount: parseInt(watchedResult?.count || '0', 10),
        favoritesCount: parseInt(favoritesResult?.count || '0', 10),
        recommendationsCount: parseInt(recsResult?.count || '0', 10),
      })
    }
  )

  /**
   * GET /api/users/:id/taste-profile
   * Get user's AI-generated taste synopsis
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/taste-profile',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Users can only get their own taste profile unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const profile = await getTasteSynopsis(id)
        return reply.send(profile)
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get taste profile')
        return reply.status(500).send({ error: 'Failed to generate taste profile' })
      }
    }
  )

  /**
   * POST /api/users/:id/taste-profile/regenerate
   * Force regenerate user's taste synopsis
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/taste-profile/regenerate',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Users can only regenerate their own taste profile unless admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      try {
        const profile = await generateTasteSynopsis(id)
        return reply.send(profile)
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to regenerate taste profile')
        return reply.status(500).send({ error: 'Failed to regenerate taste profile' })
      }
    }
  )
}

