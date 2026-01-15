/**
 * Discovery Routes (Missing Content Suggestions)
 * 
 * API routes for suggesting content not in the user's library
 */

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth, requireAdmin, type SessionUser } from '../plugins/auth.js'
import { queryOne, query } from '../lib/db.js'
import {
  getDiscoveryCandidates,
  getDiscoveryCandidateCount,
  getLatestDiscoveryRun,
  regenerateUserDiscovery,
  isJellyseerrConfigured,
} from '@aperture/core'

const discoveryRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/discovery/movies
   * Get discovery suggestions for movies not in the library
   */
  fastify.get<{
    Querystring: { limit?: string; offset?: string }
  }>(
    '/api/discovery/movies',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const limit = Math.min(parseInt(request.query.limit || '50', 10), 100)
      const offset = parseInt(request.query.offset || '0', 10)

      // Check if user has discovery enabled
      const user = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_enabled) {
        return reply.status(403).send({
          error: 'Discovery not enabled for your account',
          message: 'Contact your admin to enable discovery suggestions',
        })
      }

      // Get latest run
      const run = await getLatestDiscoveryRun(currentUser.id, 'movie')

      // Get candidates
      const candidates = await getDiscoveryCandidates(currentUser.id, 'movie', { limit, offset })
      const total = await getDiscoveryCandidateCount(currentUser.id, 'movie')

      return reply.send({
        run,
        candidates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + candidates.length < total,
        },
      })
    }
  )

  /**
   * GET /api/discovery/series
   * Get discovery suggestions for series not in the library
   */
  fastify.get<{
    Querystring: { limit?: string; offset?: string }
  }>(
    '/api/discovery/series',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const limit = Math.min(parseInt(request.query.limit || '50', 10), 100)
      const offset = parseInt(request.query.offset || '0', 10)

      // Check if user has discovery enabled
      const user = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_enabled) {
        return reply.status(403).send({
          error: 'Discovery not enabled for your account',
          message: 'Contact your admin to enable discovery suggestions',
        })
      }

      // Get latest run
      const run = await getLatestDiscoveryRun(currentUser.id, 'series')

      // Get candidates
      const candidates = await getDiscoveryCandidates(currentUser.id, 'series', { limit, offset })
      const total = await getDiscoveryCandidateCount(currentUser.id, 'series')

      return reply.send({
        run,
        candidates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + candidates.length < total,
        },
      })
    }
  )

  /**
   * POST /api/discovery/refresh/movies
   * Trigger regeneration of movie discovery suggestions
   */
  fastify.post(
    '/api/discovery/refresh/movies',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser

      // Check if user has discovery enabled
      const user = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_enabled) {
        return reply.status(403).send({
          error: 'Discovery not enabled for your account',
        })
      }

      try {
        const result = await regenerateUserDiscovery(currentUser.id, 'movie')
        return reply.send({
          message: 'Movie discovery suggestions regenerated',
          runId: result.runId,
          candidatesStored: result.candidatesStored,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error({ err, userId: currentUser.id }, 'Failed to regenerate movie discovery')
        return reply.status(500).send({ error: `Failed to regenerate: ${error}` })
      }
    }
  )

  /**
   * POST /api/discovery/refresh/series
   * Trigger regeneration of series discovery suggestions
   */
  fastify.post(
    '/api/discovery/refresh/series',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser

      // Check if user has discovery enabled
      const user = await queryOne<{ discover_enabled: boolean }>(
        `SELECT discover_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!user?.discover_enabled) {
        return reply.status(403).send({
          error: 'Discovery not enabled for your account',
        })
      }

      try {
        const result = await regenerateUserDiscovery(currentUser.id, 'series')
        return reply.send({
          message: 'Series discovery suggestions regenerated',
          runId: result.runId,
          candidatesStored: result.candidatesStored,
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error({ err, userId: currentUser.id }, 'Failed to regenerate series discovery')
        return reply.status(500).send({ error: `Failed to regenerate: ${error}` })
      }
    }
  )

  /**
   * GET /api/discovery/status
   * Get discovery status for the current user
   */
  fastify.get(
    '/api/discovery/status',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser

      // Get user's discovery settings
      const userSettings = await queryOne<{
        discover_enabled: boolean
        discover_request_enabled: boolean
      }>(
        `SELECT discover_enabled, discover_request_enabled FROM users WHERE id = $1`,
        [currentUser.id]
      )

      if (!userSettings?.discover_enabled) {
        return reply.send({
          enabled: false,
          requestEnabled: false,
          movieRun: null,
          seriesRun: null,
          movieCount: 0,
          seriesCount: 0,
        })
      }

      // Get latest runs
      const [movieRun, seriesRun, movieCount, seriesCount] = await Promise.all([
        getLatestDiscoveryRun(currentUser.id, 'movie'),
        getLatestDiscoveryRun(currentUser.id, 'series'),
        getDiscoveryCandidateCount(currentUser.id, 'movie'),
        getDiscoveryCandidateCount(currentUser.id, 'series'),
      ])

      return reply.send({
        enabled: true,
        requestEnabled: userSettings.discover_request_enabled,
        movieRun,
        seriesRun,
        movieCount,
        seriesCount,
      })
    }
  )

  /**
   * GET /api/discovery/prerequisites
   * Check if discovery feature prerequisites are met (admin only)
   * Used by Jobs page to show disabled state when not ready
   */
  fastify.get(
    '/api/discovery/prerequisites',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      // Check Jellyseerr configuration
      const jellyseerrConfigured = await isJellyseerrConfigured()

      // Check how many users have discovery enabled
      const usersResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE discover_enabled = true`
      )
      const enabledUserCount = parseInt(usersResult.rows[0]?.count || '0', 10)

      // Get list of enabled users for display
      const enabledUsers = await query<{ username: string }>(
        `SELECT username FROM users WHERE discover_enabled = true ORDER BY username LIMIT 10`
      )

      const ready = jellyseerrConfigured && enabledUserCount > 0

      return reply.send({
        ready,
        jellyseerrConfigured,
        enabledUserCount,
        enabledUsernames: enabledUsers.rows.map(u => u.username),
        message: !ready
          ? !jellyseerrConfigured
            ? 'Jellyseerr integration is not configured. Configure it in Settings → Integrations.'
            : 'No users have discovery enabled. Enable discovery for users in Admin → Users.'
          : null,
      })
    }
  )
}

export default discoveryRoutes

