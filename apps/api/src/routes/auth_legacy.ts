import type { FastifyPluginAsync } from 'fastify'
import { getMediaServerProvider, getMediaServerConfig, getSystemSetting, type AuthResult } from '@aperture/core'
import { queryOne } from '../lib/db.js'
import {
  createSession,
  deleteSession,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  type SessionUser,
} from '../plugins/auth.js'

interface LoginBody {
  username: string
  password: string
}

interface UserRow {
  id: string
  username: string
  display_name: string | null
  provider: 'emby' | 'jellyfin'
  provider_user_id: string
  is_admin: boolean
  is_enabled: boolean
  provider_access_token: string | null
  can_manage_watch_history: boolean
}

interface LoginResponse {
  user: SessionUser
}

interface MeResponse {
  user: SessionUser
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/auth/login-options
   * Get login options (whether passwordless login is allowed)
   * Public endpoint - no authentication required
   */
  fastify.get('/api/auth/login-options', { schema: { tags: ['auth'], security: [] } }, async (_request, reply) => {
    const allowPasswordlessLogin = await getSystemSetting('allow_passwordless_login')
    return reply.send({
      allowPasswordlessLogin: allowPasswordlessLogin === 'true',
    })
  })

  /**
   * POST /api/auth/login
   * Authenticate with media server credentials
   */
  fastify.post<{ Body: LoginBody; Reply: LoginResponse }>(
    '/api/auth/login',
    { schema: { tags: ['auth'], security: [] } },
    async (request, reply) => {
      const { username, password } = request.body

      // Check if passwordless login is allowed
      const allowPasswordlessLogin = await getSystemSetting('allow_passwordless_login')
      const passwordRequired = allowPasswordlessLogin !== 'true'

      if (!username) {
        return reply.status(400).send({ error: 'Username is required' } as never)
      }

      if (passwordRequired && !password) {
        return reply.status(400).send({ error: 'Password is required' } as never)
      }

      // Get media server provider
      let provider
      try {
        provider = await getMediaServerProvider()
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get media server provider')
        return reply.status(500).send({ error: 'Media server not configured' } as never)
      }

      // Authenticate with media server
      let authResult: AuthResult
      try {
        authResult = await provider.authenticateByName(username, password || '')
      } catch (err) {
        fastify.log.warn({ err, username }, 'Authentication failed')
        return reply.status(401).send({ error: 'Invalid username or password' } as never)
      }

      // Fetch full user details to get parental rating settings
      const config = await getMediaServerConfig()
      if (!config.apiKey) {
        fastify.log.error('Media server API key not configured')
        return reply.status(500).send({ error: 'Media server not configured' } as never)
      }
      const providerUser = await provider.getUserById(config.apiKey, authResult.userId)

      // Upsert user in our database
      const existingUser = await queryOne<UserRow>(
        `SELECT id, username, display_name, provider, provider_user_id, is_admin, is_enabled, can_manage_watch_history
         FROM users WHERE provider = $1 AND provider_user_id = $2`,
        [provider.type, authResult.userId]
      )

      let user: UserRow

      if (existingUser) {
        // Update existing user
        const updated = await queryOne<UserRow>(
          `UPDATE users SET
            username = $1,
            is_admin = $2,
            provider_access_token = $3,
            max_parental_rating = $4,
            updated_at = NOW()
           WHERE id = $5
           RETURNING id, username, display_name, provider, provider_user_id, is_admin, is_enabled, can_manage_watch_history`,
          [
            authResult.userName,
            authResult.isAdmin,
            authResult.accessToken,
            providerUser.maxParentalRating ?? null,
            existingUser.id,
          ]
        )
        user = updated!
      } else {
        // Create new user
        const created = await queryOne<UserRow>(
          `INSERT INTO users (username, display_name, provider, provider_user_id, is_admin, provider_access_token, max_parental_rating)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, username, display_name, provider, provider_user_id, is_admin, is_enabled, can_manage_watch_history`,
          [
            authResult.userName,
            authResult.userName,
            provider.type,
            authResult.userId,
            authResult.isAdmin,
            authResult.accessToken,
            providerUser.maxParentalRating ?? null,
          ]
        )
        user = created!
      }

      // Create session
      const sessionId = await createSession(user.id)

      // Set session cookie
      setSessionCookie(reply, sessionId)

      // Use local avatar proxy URL to avoid mixed content issues
      const avatarUrl = `/api/users/${user.id}/avatar`

      const sessionUser: SessionUser = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        provider: user.provider,
        providerUserId: user.provider_user_id,
        isAdmin: user.is_admin,
        isEnabled: user.is_enabled,
        canManageWatchHistory: user.can_manage_watch_history ?? false,
        avatarUrl,
      }

      return reply.send({ user: sessionUser })
    }
  )

  /**
   * POST /api/auth/logout
   * End current session
   */
  fastify.post('/api/auth/logout', { schema: { tags: ['auth'] } }, async (request, reply) => {
    if (request.sessionId) {
      await deleteSession(request.sessionId)
    }

    clearSessionCookie(reply)

    return reply.send({ success: true })
  })

  /**
   * GET /api/auth/me
   * Get current user info
   */
  fastify.get<{ Reply: MeResponse }>(
    '/api/auth/me',
    { preHandler: requireAuth, schema: { tags: ['auth'] } },
    async (request, reply) => {
      return reply.send({ user: request.user! })
    }
  )

  /**
   * GET /api/auth/me/preferences
   * Get current user's UI preferences
   */
  fastify.get<{ Reply: { sidebarCollapsed?: boolean } }>(
    '/api/auth/me/preferences',
    { preHandler: requireAuth, schema: { tags: ['auth'] } },
    async (request, reply) => {
      const { getUserUiPreferences } = await import('@aperture/core')
      const preferences = await getUserUiPreferences(request.user!.id)
      return reply.send(preferences)
    }
  )

  /**
   * PATCH /api/auth/me/preferences
   * Update current user's UI preferences
   */
  fastify.patch(
    '/api/auth/me/preferences',
    { preHandler: requireAuth, schema: { tags: ['auth'] } },
    async (request, reply) => {
      const { updateUserUiPreferences, getUserUiPreferences } = await import('@aperture/core')
      type UserUiPreferences = Awaited<ReturnType<typeof getUserUiPreferences>>
      const body = request.body as Partial<UserUiPreferences>
      
      // Get current preferences for merging
      const currentPrefs = await getUserUiPreferences(request.user!.id)
      
      // Build the update object with proper merging
      const updates: Partial<UserUiPreferences> = { ...body }
      
      // For viewModes, merge with existing to avoid overwriting other pages
      if (body.viewModes) {
        updates.viewModes = {
          ...currentPrefs.viewModes,
          ...body.viewModes,
        }
      }
      
      // For browseSort, merge with existing to preserve other media type settings
      if (body.browseSort) {
        updates.browseSort = {
          movies: body.browseSort.movies || currentPrefs.browseSort?.movies || { sortBy: 'title', sortOrder: 'asc' },
          series: body.browseSort.series || currentPrefs.browseSort?.series || { sortBy: 'title', sortOrder: 'asc' },
        }
      }
      
      const preferences = await updateUserUiPreferences(request.user!.id, updates)
      return reply.send(preferences)
    }
  )

  /**
   * POST /api/auth/me/filter-presets
   * Create a new filter preset
   */
  fastify.post(
    '/api/auth/me/filter-presets',
    { preHandler: requireAuth, schema: { tags: ['auth'] } },
    async (request, reply) => {
      const { addBrowseFilterPreset } = await import('@aperture/core')
      const body = request.body as { name: string; type: 'movies' | 'series'; filters: Record<string, unknown> }
      
      const preset = await addBrowseFilterPreset(request.user!.id, {
        name: body.name,
        type: body.type,
        filters: body.filters,
      })
      
      return reply.status(201).send(preset)
    }
  )

  /**
   * PATCH /api/auth/me/filter-presets/:id
   * Update a filter preset
   */
  fastify.patch<{ Params: { id: string } }>(
    '/api/auth/me/filter-presets/:id',
    { preHandler: requireAuth, schema: { tags: ['auth'] } },
    async (request, reply) => {
      const { updateBrowseFilterPreset } = await import('@aperture/core')
      const { id } = request.params
      const body = request.body as { name?: string; filters?: Record<string, unknown> }
      
      const preset = await updateBrowseFilterPreset(request.user!.id, id, body)
      
      if (!preset) {
        return reply.status(404).send({ error: 'Preset not found' })
      }
      
      return reply.send(preset)
    }
  )

  /**
   * DELETE /api/auth/me/filter-presets/:id
   * Delete a filter preset
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/auth/me/filter-presets/:id',
    { preHandler: requireAuth, schema: { tags: ['auth'] } },
    async (request, reply) => {
      const { deleteBrowseFilterPreset } = await import('@aperture/core')
      const { id } = request.params
      
      const deleted = await deleteBrowseFilterPreset(request.user!.id, id)
      
      if (!deleted) {
        return reply.status(404).send({ error: 'Preset not found' })
      }
      
      return reply.status(204).send()
    }
  )

  /**
   * GET /api/auth/check
   * Check if user is authenticated (does not require auth, returns null if not)
   */
  fastify.get('/api/auth/check', { schema: { tags: ['auth'], security: [] } }, async (request, reply) => {
    if (request.user) {
      return reply.send({ authenticated: true, user: request.user })
    }
    
    // If there was a session error (e.g., SESSION_SECRET changed, DB issue),
    // clear the invalid cookie and let the frontend know
    if (request.sessionError) {
      clearSessionCookie(reply)
      return reply.send({ 
        authenticated: false, 
        user: null,
        sessionError: true,
        message: 'Your session was invalid. This can happen if the server was reconfigured. Please log in again.'
      })
    }
    
    return reply.send({ authenticated: false, user: null })
  })
}

export default authRoutes
