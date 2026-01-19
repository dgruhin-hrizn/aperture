/**
 * Recommendations Preferences Handlers
 */

import type { FastifyInstance } from 'fastify'
import { query, queryOne } from '../../../lib/db.js'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import { recommendationSchemas } from '../schemas.js'

export async function registerPreferencesHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/recommendations/:userId/preferences
   * Get user's recommendation preferences
   */
  fastify.get<{ Params: { userId: string } }>(
    '/api/recommendations/:userId/preferences',
    { preHandler: requireAuth, schema: recommendationSchemas.getPreferences },
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
    { preHandler: requireAuth, schema: recommendationSchemas.updatePreferences },
    async (request, reply) => {
      const { userId } = request.params
      const currentUser = request.user as SessionUser

      if (userId !== currentUser.id && !currentUser.isAdmin) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const { includeWatched, preferredGenres, excludedGenres, noveltyWeight, ratingWeight } =
        request.body

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
