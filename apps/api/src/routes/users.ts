import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth, requireAdmin, type SessionUser } from '../plugins/auth.js'
import { 
  getTasteSynopsis, 
  generateTasteSynopsis, 
  getMediaServerProvider,
  syncWatchHistoryForUser,
  generateRecommendationsForUser,
  writeStrmFilesForUser,
  ensureUserLibrary,
  updateUserLibraryPermissions,
  refreshUserLibrary,
  createChildLogger,
} from '@aperture/core'

const logger = createChildLogger('users-api')

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

  // =========================================================================
  // Media Server Users (Emby/Jellyfin)
  // =========================================================================

  /**
   * GET /api/users/provider
   * Get all users from the media server (Emby/Jellyfin)
   * Returns users with their import status in Aperture
   */
  fastify.get(
    '/api/users/provider',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const apiKey = process.env.MEDIA_SERVER_API_KEY
      if (!apiKey) {
        return reply.status(500).send({ error: 'Media server API key not configured' })
      }

      try {
        const provider = getMediaServerProvider()
        const providerUsers = await provider.getUsers(apiKey)

        // Get existing users from our DB to check import status
        const existingResult = await query<{ provider_user_id: string; id: string; is_enabled: boolean }>(
          `SELECT provider_user_id, id, is_enabled FROM users WHERE provider = $1`,
          [provider.type]
        )
        const existingMap = new Map(
          existingResult.rows.map((row) => [row.provider_user_id, { id: row.id, isEnabled: row.is_enabled }])
        )

        // Combine provider users with import status
        const usersWithStatus = providerUsers.map((user) => {
          const existing = existingMap.get(user.id)
          return {
            providerUserId: user.id,
            name: user.name,
            isAdmin: user.isAdmin,
            isDisabled: user.isDisabled,
            lastActivityDate: user.lastActivityDate,
            // Aperture status
            apertureUserId: existing?.id || null,
            isImported: !!existing,
            isEnabled: existing?.isEnabled || false,
          }
        })

        return reply.send({
          provider: provider.type,
          users: usersWithStatus,
        })
      } catch (error) {
        fastify.log.error({ error }, 'Failed to fetch provider users')
        return reply.status(500).send({ error: 'Failed to fetch users from media server' })
      }
    }
  )

  /**
   * POST /api/users/import
   * Import a user from the media server into Aperture
   */
  fastify.post<{ Body: { providerUserId: string; isEnabled?: boolean } }>(
    '/api/users/import',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { providerUserId, isEnabled = false } = request.body

      if (!providerUserId) {
        return reply.status(400).send({ error: 'providerUserId is required' })
      }

      const apiKey = process.env.MEDIA_SERVER_API_KEY
      if (!apiKey) {
        return reply.status(500).send({ error: 'Media server API key not configured' })
      }

      try {
        const provider = getMediaServerProvider()
        
        // Check if user already exists
        const existing = await queryOne<UserRow>(
          `SELECT * FROM users WHERE provider = $1 AND provider_user_id = $2`,
          [provider.type, providerUserId]
        )

        if (existing) {
          return reply.status(409).send({ 
            error: 'User already imported',
            user: existing 
          })
        }

        // Get user info from provider
        const providerUser = await provider.getUserById(apiKey, providerUserId)

        // Insert user into our database
        const newUser = await queryOne<UserRow>(
          `INSERT INTO users (username, display_name, provider, provider_user_id, is_admin, is_enabled)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, username, display_name, provider, provider_user_id, is_admin, is_enabled, created_at, updated_at`,
          [providerUser.name, providerUser.name, provider.type, providerUserId, providerUser.isAdmin, isEnabled]
        )

        fastify.log.info({ userId: newUser?.id, providerUserId, name: providerUser.name }, 'User imported from media server')

        return reply.status(201).send({ user: newUser })
      } catch (error) {
        fastify.log.error({ error, providerUserId }, 'Failed to import user')
        return reply.status(500).send({ error: 'Failed to import user from media server' })
      }
    }
  )

  // =========================================================================
  // Per-User Jobs
  // =========================================================================

  /**
   * POST /api/users/:id/sync-history
   * Sync watch history for a specific user
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/sync-history',
    { preHandler: requireAdmin },
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
    { preHandler: requireAdmin },
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
    { preHandler: requireAdmin },
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
    { preHandler: requireAdmin },
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

export default usersRoutes

