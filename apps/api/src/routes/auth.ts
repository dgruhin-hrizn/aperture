import type { FastifyPluginAsync } from 'fastify'
import { getMediaServerProvider, type AuthResult } from '@aperture/core'
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
}

interface LoginResponse {
  user: SessionUser
}

interface MeResponse {
  user: SessionUser
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/auth/login
   * Authenticate with media server credentials
   */
  fastify.post<{ Body: LoginBody; Reply: LoginResponse }>(
    '/api/auth/login',
    async (request, reply) => {
      const { username, password } = request.body

      if (!username || !password) {
        return reply.status(400).send({ error: 'Username and password are required' } as never)
      }

      // Get media server provider
      let provider
      try {
        provider = getMediaServerProvider()
      } catch (err) {
        fastify.log.error({ err }, 'Failed to get media server provider')
        return reply.status(500).send({ error: 'Media server not configured' } as never)
      }

      // Authenticate with media server
      let authResult: AuthResult
      try {
        authResult = await provider.authenticateByName(username, password)
      } catch (err) {
        fastify.log.warn({ err, username }, 'Authentication failed')
        return reply.status(401).send({ error: 'Invalid username or password' } as never)
      }

      // Fetch full user details to get parental rating settings
      const apiKey = process.env.MEDIA_SERVER_API_KEY
      if (!apiKey) {
        fastify.log.error('Media server API key not configured')
        return reply.status(500).send({ error: 'Media server not configured' } as never)
      }
      const providerUser = await provider.getUserById(apiKey, authResult.userId)

      // Upsert user in our database
      const existingUser = await queryOne<UserRow>(
        `SELECT id, username, display_name, provider, provider_user_id, is_admin, is_enabled
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
           RETURNING id, username, display_name, provider, provider_user_id, is_admin, is_enabled`,
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
           RETURNING id, username, display_name, provider, provider_user_id, is_admin, is_enabled`,
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

      const sessionUser: SessionUser = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        provider: user.provider,
        providerUserId: user.provider_user_id,
        isAdmin: user.is_admin,
        isEnabled: user.is_enabled,
      }

      return reply.send({ user: sessionUser })
    }
  )

  /**
   * POST /api/auth/logout
   * End current session
   */
  fastify.post('/api/auth/logout', async (request, reply) => {
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
    { preHandler: requireAuth },
    async (request, reply) => {
      return reply.send({ user: request.user! })
    }
  )

  /**
   * GET /api/auth/check
   * Check if user is authenticated (does not require auth, returns null if not)
   */
  fastify.get('/api/auth/check', async (request, reply) => {
    if (request.user) {
      return reply.send({ authenticated: true, user: request.user })
    }
    return reply.send({ authenticated: false, user: null })
  })
}

export default authRoutes
