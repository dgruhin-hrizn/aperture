import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth, requireAdmin, type SessionUser } from '../plugins/auth.js'
import { getTasteSynopsis, generateTasteSynopsis } from '@aperture/core'

interface UserRow {
  id: string
  username: string
  display_name: string | null
  provider: 'emby' | 'jellyfin'
  provider_user_id: string
  is_admin: boolean
  is_enabled: boolean
  created_at: Date
  updated_at: Date
}

interface UserListResponse {
  users: UserRow[]
  total: number
}

interface UserUpdateBody {
  displayName?: string
  isEnabled?: boolean
}

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/users
   * List all users (admin only)
   */
  fastify.get<{ Reply: UserListResponse }>(
    '/api/users',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const result = await query<UserRow>(
        `SELECT id, username, display_name, provider, provider_user_id, is_admin, is_enabled, created_at, updated_at
         FROM users
         ORDER BY username ASC`
      )

      return reply.send({
        users: result.rows,
        total: result.rows.length,
      })
    }
  )

  /**
   * GET /api/users/:id
   * Get user by ID (admin only, or own user)
   */
  fastify.get<{ Params: { id: string }; Reply: UserRow }>(
    '/api/users/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      // Allow access to own user or admin
      if (id !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' } as never)
      }

      const user = await queryOne<UserRow>(
        `SELECT id, username, display_name, provider, provider_user_id, is_admin, is_enabled, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
      )

      if (!user) {
        return reply.status(404).send({ error: 'User not found' } as never)
      }

      return reply.send(user)
    }
  )

  /**
   * PUT /api/users/:id
   * Update user (admin only)
   */
  fastify.put<{ Params: { id: string }; Body: UserUpdateBody; Reply: UserRow }>(
    '/api/users/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params
      const { displayName, isEnabled } = request.body

      // Build update query dynamically
      const updates: string[] = []
      const values: unknown[] = []
      let paramIndex = 1

      if (displayName !== undefined) {
        updates.push(`display_name = $${paramIndex++}`)
        values.push(displayName)
      }

      if (isEnabled !== undefined) {
        updates.push(`is_enabled = $${paramIndex++}`)
        values.push(isEnabled)
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' } as never)
      }

      values.push(id)
      const user = await queryOne<UserRow>(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING id, username, display_name, provider, provider_user_id, is_admin, is_enabled, created_at, updated_at`,
        values
      )

      if (!user) {
        return reply.status(404).send({ error: 'User not found' } as never)
      }

      return reply.send(user)
    }
  )

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

export default usersRoutes

