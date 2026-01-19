import type { FastifyPluginAsync } from 'fastify'
import { getMediaServerProvider, getMediaServerConfig, getSystemSetting, type AuthResult } from '@aperture/core'
import { queryOne } from '../../lib/db.js'
import {
  createSession,
  deleteSession,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  type SessionUser,
} from '../../plugins/auth.js'
import {
  authSchemas,
  loginOptionsSchema,
  loginSchema,
  logoutSchema,
  getMeSchema,
  getPreferencesSchema,
  updatePreferencesSchema,
  createFilterPresetSchema,
  updateFilterPresetSchema,
  deleteFilterPresetSchema,
  authCheckSchema,
} from './schemas.js'

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
  // Register schemas
  for (const [name, schema] of Object.entries(authSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * GET /api/auth/login-options
   */
  fastify.get('/api/auth/login-options', { schema: loginOptionsSchema }, async (_request, reply) => {
    const allowPasswordlessLogin = await getSystemSetting('allow_passwordless_login')
    return reply.send({
      allowPasswordlessLogin: allowPasswordlessLogin === 'true',
    })
  })

  /**
   * POST /api/auth/login
   */
  fastify.post<{ Body: LoginBody; Reply: LoginResponse }>(
    '/api/auth/login',
    { schema: loginSchema },
    async (request, reply) => {
      const { username, password } = request.body

      const allowPasswordlessLogin = await getSystemSetting('allow_passwordless_login')
      const passwordRequired = allowPasswordlessLogin !== 'true'

      if (!username) {
        return reply.status(400).send({ error: 'Username is required' } as never)
      }

      if (passwordRequired && !password) {
        return reply.status(400).send({ error: 'Password is required' } as never)
      }

      let provider
      try {
        provider = await getMediaServerProvider()
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get media server provider')
        return reply.status(500).send({ error: 'Media server not configured' } as never)
      }

      let authResult: AuthResult
      try {
        authResult = await provider.authenticateByName(username, password || '')
      } catch (err) {
        fastify.log.warn({ err, username }, 'Authentication failed')
        return reply.status(401).send({ error: 'Invalid username or password' } as never)
      }

      const config = await getMediaServerConfig()
      if (!config.apiKey) {
        fastify.log.error('Media server API key not configured')
        return reply.status(500).send({ error: 'Media server not configured' } as never)
      }
      const providerUser = await provider.getUserById(config.apiKey, authResult.userId)

      const existingUser = await queryOne<UserRow>(
        `SELECT id, username, display_name, provider, provider_user_id, is_admin, is_enabled, can_manage_watch_history
         FROM users WHERE provider = $1 AND provider_user_id = $2`,
        [provider.type, authResult.userId]
      )

      let user: UserRow

      if (existingUser) {
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

      const sessionId = await createSession(user.id)
      setSessionCookie(reply, sessionId)

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
   */
  fastify.post('/api/auth/logout', { schema: logoutSchema }, async (request, reply) => {
    if (request.sessionId) {
      await deleteSession(request.sessionId)
    }
    clearSessionCookie(reply)
    return reply.send({ success: true })
  })

  /**
   * GET /api/auth/me
   */
  fastify.get<{ Reply: MeResponse }>(
    '/api/auth/me',
    { preHandler: requireAuth, schema: getMeSchema },
    async (request, reply) => {
      return reply.send({ user: request.user! })
    }
  )

  /**
   * GET /api/auth/me/preferences
   */
  fastify.get<{ Reply: { sidebarCollapsed?: boolean } }>(
    '/api/auth/me/preferences',
    { preHandler: requireAuth, schema: getPreferencesSchema },
    async (request, reply) => {
      const { getUserUiPreferences } = await import('@aperture/core')
      const preferences = await getUserUiPreferences(request.user!.id)
      return reply.send(preferences)
    }
  )

  /**
   * PATCH /api/auth/me/preferences
   */
  fastify.patch(
    '/api/auth/me/preferences',
    { preHandler: requireAuth, schema: updatePreferencesSchema },
    async (request, reply) => {
      const { updateUserUiPreferences, getUserUiPreferences } = await import('@aperture/core')
      type UserUiPreferences = Awaited<ReturnType<typeof getUserUiPreferences>>
      const body = request.body as Partial<UserUiPreferences>
      
      const currentPrefs = await getUserUiPreferences(request.user!.id)
      const updates: Partial<UserUiPreferences> = { ...body }
      
      if (body.viewModes) {
        updates.viewModes = {
          ...currentPrefs.viewModes,
          ...body.viewModes,
        }
      }
      
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
   */
  fastify.post(
    '/api/auth/me/filter-presets',
    { preHandler: requireAuth, schema: createFilterPresetSchema },
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
   */
  fastify.patch<{ Params: { id: string } }>(
    '/api/auth/me/filter-presets/:id',
    { preHandler: requireAuth, schema: updateFilterPresetSchema },
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
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/auth/me/filter-presets/:id',
    { preHandler: requireAuth, schema: deleteFilterPresetSchema },
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
   */
  fastify.get('/api/auth/check', { schema: authCheckSchema }, async (request, reply) => {
    if (request.user) {
      return reply.send({ authenticated: true, user: request.user })
    }
    
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
