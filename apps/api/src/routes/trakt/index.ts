import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import { requireAuth, requireAdmin, type SessionUser } from '../../plugins/auth.js'
import {
  getTraktConfig,
  setTraktConfig,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getTraktUser,
  storeUserTraktTokens,
  disconnectTrakt,
  syncTraktRatings,
  isTraktConfigured,
  getUserTraktStatus,
  query,
  createJobProgress,
  updateJobProgress,
  setJobStep,
  completeJob,
  failJob,
  createChildLogger,
} from '@aperture/core'
import {
  traktSchemas,
  getTraktConfigSchema,
  updateTraktConfigSchema,
  getTraktStatusSchema,
  getTraktAuthUrlSchema,
  traktCallbackSchema,
  disconnectTraktSchema,
  syncTraktSchema,
} from './schemas.js'

const logger = createChildLogger('trakt-sync')

// Store state tokens temporarily
const stateTokens = new Map<string, { userId: string; createdAt: Date }>()

// Clean up old state tokens periodically
setInterval(() => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  for (const [key, value] of stateTokens.entries()) {
    if (value.createdAt < fiveMinutesAgo) {
      stateTokens.delete(key)
    }
  }
}, 60 * 1000)

const traktRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas
  for (const [name, schema] of Object.entries(traktSchemas)) {
    fastify.addSchema({ $id: name, ...schema })
  }

  /**
   * GET /api/trakt/config
   */
  fastify.get('/api/trakt/config', { preHandler: requireAdmin, schema: getTraktConfigSchema }, async (_request, reply) => {
    try {
      const config = await getTraktConfig()
      const configured = await isTraktConfigured()
      
      return reply.send({
        configured,
        clientId: config?.clientId ? '••••••••' + config.clientId.slice(-4) : null,
        redirectUri: config?.redirectUri || null,
        hasClientSecret: !!config?.clientSecret,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get Trakt config')
      return reply.status(500).send({ error: 'Failed to get Trakt configuration' })
    }
  })

  /**
   * PATCH /api/trakt/config
   */
  fastify.patch<{
    Body: {
      clientId?: string
      clientSecret?: string
      redirectUri?: string
    }
  }>('/api/trakt/config', { preHandler: requireAdmin, schema: updateTraktConfigSchema }, async (request, reply) => {
    try {
      const { clientId, clientSecret, redirectUri } = request.body

      await setTraktConfig({
        clientId,
        clientSecret,
        redirectUri,
      })

      const configured = await isTraktConfigured()

      return reply.send({
        configured,
        message: 'Trakt configuration updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update Trakt config')
      return reply.status(500).send({ error: 'Failed to update Trakt configuration' })
    }
  })

  /**
   * GET /api/trakt/status
   */
  fastify.get('/api/trakt/status', { preHandler: requireAuth, schema: getTraktStatusSchema }, async (request, reply) => {
    try {
      const user = request.user as SessionUser
      const configured = await isTraktConfigured()
      
      if (!configured) {
        return reply.send({
          traktConfigured: false,
          connected: false,
          username: null,
          syncedAt: null,
        })
      }

      const status = await getUserTraktStatus(user.id)
      
      return reply.send({
        traktConfigured: true,
        ...status,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get Trakt status')
      return reply.status(500).send({ error: 'Failed to get Trakt status' })
    }
  })

  /**
   * GET /api/trakt/auth-url
   */
  fastify.get('/api/trakt/auth-url', { preHandler: requireAuth, schema: getTraktAuthUrlSchema }, async (request, reply) => {
    try {
      const user = request.user as SessionUser
      const configured = await isTraktConfigured()
      
      if (!configured) {
        return reply.status(400).send({ error: 'Trakt is not configured. Please contact your administrator.' })
      }

      const state = randomUUID()
      stateTokens.set(state, { userId: user.id, createdAt: new Date() })

      const authUrl = await getAuthorizationUrl(state)
      
      if (!authUrl) {
        return reply.status(500).send({ error: 'Failed to generate authorization URL' })
      }

      return reply.send({ authUrl })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get Trakt auth URL')
      return reply.status(500).send({ error: 'Failed to get authorization URL' })
    }
  })

  /**
   * GET /api/trakt/callback
   */
  fastify.get<{
    Querystring: {
      code?: string
      state?: string
      error?: string
    }
  }>('/api/trakt/callback', { schema: traktCallbackSchema }, async (request, reply) => {
    try {
      const { code, state, error } = request.query

      if (error) {
        fastify.log.warn({ error }, 'Trakt OAuth error')
        return reply.redirect('/#/settings?trakt=error&message=' + encodeURIComponent(error))
      }

      if (!state || !stateTokens.has(state)) {
        return reply.redirect('/#/settings?trakt=error&message=' + encodeURIComponent('Invalid state token'))
      }

      const stateData = stateTokens.get(state)!
      stateTokens.delete(state)

      if (!code) {
        return reply.redirect('/#/settings?trakt=error&message=' + encodeURIComponent('No authorization code received'))
      }

      const tokens = await exchangeCodeForTokens(code)
      if (!tokens) {
        return reply.redirect('/#/settings?trakt=error&message=' + encodeURIComponent('Failed to exchange authorization code'))
      }

      const traktUser = await getTraktUser(tokens.accessToken)
      if (!traktUser) {
        return reply.redirect('/#/settings?trakt=error&message=' + encodeURIComponent('Failed to get Trakt user info'))
      }

      await storeUserTraktTokens(stateData.userId, tokens, traktUser.username)

      return reply.redirect('/#/settings?trakt=success&username=' + encodeURIComponent(traktUser.username))
    } catch (err) {
      fastify.log.error({ err }, 'Failed to handle Trakt callback')
      return reply.redirect('/#/settings?trakt=error&message=' + encodeURIComponent('An unexpected error occurred'))
    }
  })

  /**
   * POST /api/trakt/disconnect
   */
  fastify.post('/api/trakt/disconnect', { preHandler: requireAuth, schema: disconnectTraktSchema }, async (request, reply) => {
    try {
      const user = request.user as SessionUser
      
      await disconnectTrakt(user.id)
      
      return reply.send({
        success: true,
        message: 'Trakt disconnected successfully',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to disconnect Trakt')
      return reply.status(500).send({ error: 'Failed to disconnect Trakt' })
    }
  })

  /**
   * POST /api/trakt/sync
   */
  fastify.post('/api/trakt/sync', { preHandler: requireAuth, schema: syncTraktSchema }, async (request, reply) => {
    try {
      const user = request.user as SessionUser
      
      const status = await getUserTraktStatus(user.id)
      if (!status.connected) {
        return reply.status(400).send({ error: 'Trakt is not connected' })
      }

      const result = await syncTraktRatings(user.id)
      
      return reply.send({
        success: true,
        ...result,
        message: `Synced ${result.moviesImported + result.moviesUpdated} movies and ${result.seriesImported + result.seriesUpdated} series from Trakt`,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to sync Trakt ratings')
      return reply.status(500).send({ error: 'Failed to sync ratings from Trakt' })
    }
  })
}

export default traktRoutes

/**
 * Sync Trakt ratings for all users with connected accounts
 */
export async function syncAllTraktRatings(jobId: string): Promise<{
  usersProcessed: number
  ratingsImported: number
  errors: number
}> {
  createJobProgress(jobId, 'sync-trakt-ratings', 2)
  setJobStep(jobId, 0, 'Finding users with Trakt connected')

  try {
    const result = await query<{ id: string; display_name: string; trakt_username: string }>(
      `SELECT id, display_name, trakt_username 
       FROM users 
       WHERE trakt_access_token IS NOT NULL 
         AND trakt_username IS NOT NULL`
    )

    const users = result.rows
    setJobStep(jobId, 1, 'Syncing ratings from Trakt', users.length)

    let totalRatingsImported = 0
    let errors = 0

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      
      try {
        const syncResult = await syncTraktRatings(user.id)
        totalRatingsImported += syncResult.moviesImported + syncResult.seriesImported
        logger.info(
          { userId: user.id, username: user.trakt_username, ...syncResult },
          'Trakt ratings synced for user'
        )
      } catch (err) {
        errors++
        logger.error(
          { err, userId: user.id, username: user.trakt_username },
          'Failed to sync Trakt ratings for user'
        )
      }

      updateJobProgress(jobId, i + 1, users.length, user.display_name || user.trakt_username)
    }

    completeJob(jobId)
    
    return {
      usersProcessed: users.length,
      ratingsImported: totalRatingsImported,
      errors,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    throw err
  }
}
