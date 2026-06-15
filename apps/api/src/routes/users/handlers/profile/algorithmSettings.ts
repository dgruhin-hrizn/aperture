import type { FastifyInstance } from 'fastify'
import { requireAuth, type SessionUser } from '../../../../plugins/auth.js'
import { requireSelfOrAdmin } from './shared.js'

export function registerAlgorithmSettingsHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/:id/algorithm-settings
   * Get user's custom algorithm settings
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/algorithm-settings',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      try {
        const {
          getUserAlgorithmSettings,
          getAdminDefaultConfig
        } = await import('@aperture/core')

        const settings = await getUserAlgorithmSettings(id)
        const movieDefaults = await getAdminDefaultConfig('movie')
        const seriesDefaults = await getAdminDefaultConfig('series')

        return reply.send({
          settings: settings || { enabled: false },
          defaults: {
            movie: movieDefaults,
            series: seriesDefaults,
          },
        })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get algorithm settings')
        return reply.status(500).send({ error: 'Failed to get algorithm settings' })
      }
    }
  )

  /**
   * PATCH /api/users/:id/algorithm-settings
   * Update user's custom algorithm settings
   */
  fastify.patch<{
    Params: { id: string }
    Body: {
      enabled?: boolean
      movie?: {
        similarityWeight?: number
        noveltyWeight?: number
        ratingWeight?: number
        diversityWeight?: number
        recentWatchLimit?: number
      }
      series?: {
        similarityWeight?: number
        noveltyWeight?: number
        ratingWeight?: number
        diversityWeight?: number
        recentWatchLimit?: number
      }
    }
  }>(
    '/api/users/:id/algorithm-settings',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser
      const body = request.body

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      try {
        const {
          getUserAlgorithmSettings,
          setUserAlgorithmSettings
        } = await import('@aperture/core')

        const current = await getUserAlgorithmSettings(id)

        const newSettings = {
          enabled: body.enabled ?? current?.enabled ?? false,
          movie: body.movie ? { ...current?.movie, ...body.movie } : current?.movie,
          series: body.series ? { ...current?.series, ...body.series } : current?.series,
        }

        await setUserAlgorithmSettings(id, newSettings)

        return reply.send({ success: true, settings: newSettings })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to update algorithm settings')
        return reply.status(500).send({ error: 'Failed to update algorithm settings' })
      }
    }
  )

  /**
   * POST /api/users/:id/algorithm-settings/reset
   * Reset user's algorithm settings to admin defaults
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/users/:id/algorithm-settings/reset',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      try {
        const { resetUserAlgorithmSettings } = await import('@aperture/core')
        await resetUserAlgorithmSettings(id)
        return reply.send({ success: true, message: 'Algorithm settings reset to defaults' })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to reset algorithm settings')
        return reply.status(500).send({ error: 'Failed to reset algorithm settings' })
      }
    }
  )
}
