import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerConfig } from '@aperture/core'

export interface SessionUser {
  id: string
  username: string
  displayName: string | null
  provider: 'emby' | 'jellyfin'
  providerUserId: string
  isAdmin: boolean
  isEnabled: boolean
  canManageWatchHistory: boolean
  avatarUrl: string | null
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser
    sessionId?: string
  }
}

interface SessionRow {
  id: string
  user_id: string
  expires_at: Date
}

interface UserRow {
  id: string
  username: string
  display_name: string | null
  provider: 'emby' | 'jellyfin'
  provider_user_id: string
  is_admin: boolean
  is_enabled: boolean
  can_manage_watch_history: boolean
}

const SESSION_COOKIE_NAME = 'aperture_session'
const SESSION_DURATION_DAYS = 30

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  const result = await queryOne<{ id: string }>(
    `INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id`,
    [userId, expiresAt]
  )

  if (!result) {
    throw new Error('Failed to create session')
  }

  return result.id
}

export async function deleteSession(sessionId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE id = $1', [sessionId])
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId])
}

async function getSessionUser(sessionId: string): Promise<SessionUser | null> {
  // Get session and check expiry
  const session = await queryOne<SessionRow>(
    'SELECT id, user_id, expires_at FROM sessions WHERE id = $1',
    [sessionId]
  )

  if (!session || new Date(session.expires_at) < new Date()) {
    // Session not found or expired
    if (session) {
      await deleteSession(sessionId)
    }
    return null
  }

  // Get user
  const user = await queryOne<UserRow>(
    `SELECT id, username, display_name, provider, provider_user_id, is_admin, is_enabled, can_manage_watch_history
     FROM users WHERE id = $1`,
    [session.user_id]
  )

  if (!user) {
    await deleteSession(sessionId)
    return null
  }

  // Get media server base URL for avatar
  let avatarUrl: string | null = null
  try {
    const config = await getMediaServerConfig()
    if (config.baseUrl && user.provider_user_id) {
      avatarUrl = `${config.baseUrl}/Users/${user.provider_user_id}/Images/Primary`
    }
  } catch {
    // Ignore - avatar URL is optional
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    provider: user.provider,
    providerUserId: user.provider_user_id,
    isAdmin: user.is_admin,
    isEnabled: user.is_enabled,
    canManageWatchHistory: user.can_manage_watch_history,
    avatarUrl,
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Add hook to parse session from cookie
  fastify.addHook('onRequest', async (request) => {
    const sessionId = request.cookies[SESSION_COOKIE_NAME]

    if (sessionId) {
      request.sessionId = sessionId
      request.user = (await getSessionUser(sessionId)) || undefined
    }
  })
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['@fastify/cookie'],
})

// Middleware to require authentication
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

// Middleware to require admin
// Allows internal requests (from fastify.inject) to bypass auth during setup
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Allow internal requests (used by setup wizard to run jobs before user is logged in)
  const isInternalRequest = request.headers['x-internal-request'] === 'true'
  if (isInternalRequest) {
    return // Allow through
  }

  if (!request.user) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  if (!request.user.isAdmin) {
    return reply.status(403).send({ error: 'Forbidden: Admin access required' })
  }
}

// Helper to set session cookie
export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60 // seconds
  // Only use secure cookies if APP_BASE_URL is HTTPS
  const appBaseUrl = process.env.APP_BASE_URL || ''
  const useSecureCookies = appBaseUrl.startsWith('https://')

  reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookies,
    path: '/',
    maxAge,
  })
}

// Helper to clear session cookie
export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
  })
}

export { SESSION_COOKIE_NAME }

