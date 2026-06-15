import type { FastifyInstance } from 'fastify'
import { requireAuth, type SessionUser } from '../../../../plugins/auth.js'
import { requireSelfOrAdmin } from './shared.js'

export function registerLibraryExclusionsHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/users/:id/accessible-libraries
   * Get libraries accessible to the user (excluding Aperture-created ones)
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/users/:id/accessible-libraries',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      try {
        const { getUserAccessibleLibraries } = await import('@aperture/core')
        const libraries = await getUserAccessibleLibraries(id)
        return reply.send({ libraries })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to get accessible libraries')
        return reply.status(500).send({ error: 'Failed to get accessible libraries' })
      }
    }
  )

  /**
   * PUT /api/users/:id/excluded-libraries
   * Set the libraries to exclude from watch history
   */
  fastify.put<{
    Params: { id: string }
    Body: { excludedLibraryIds: string[] }
  }>(
    '/api/users/:id/excluded-libraries',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id } = request.params
      const { excludedLibraryIds } = request.body
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      if (!Array.isArray(excludedLibraryIds)) {
        return reply.status(400).send({ error: 'excludedLibraryIds must be an array' })
      }

      try {
        const { setUserExcludedLibraries } = await import('@aperture/core')
        await setUserExcludedLibraries(id, excludedLibraryIds)
        return reply.send({ success: true })
      } catch (error) {
        fastify.log.error({ error, userId: id }, 'Failed to set excluded libraries')
        return reply.status(500).send({ error: 'Failed to set excluded libraries' })
      }
    }
  )

  /**
   * PATCH /api/users/:id/excluded-libraries/:libraryId
   * Toggle a single library's exclusion status
   */
  fastify.patch<{
    Params: { id: string; libraryId: string }
    Body: { excluded: boolean }
  }>(
    '/api/users/:id/excluded-libraries/:libraryId',
    { preHandler: requireAuth, schema: { tags: ['users'] } },
    async (request, reply) => {
      const { id, libraryId } = request.params
      const { excluded } = request.body
      const currentUser = request.user as SessionUser

      if (!requireSelfOrAdmin(id, currentUser, reply)) return

      if (typeof excluded !== 'boolean') {
        return reply.status(400).send({ error: 'excluded must be a boolean' })
      }

      try {
        const { toggleLibraryExclusion } = await import('@aperture/core')
        await toggleLibraryExclusion(id, libraryId, excluded)
        return reply.send({ success: true, libraryId, excluded })
      } catch (error) {
        fastify.log.error({ error, userId: id, libraryId }, 'Failed to toggle library exclusion')
        return reply.status(500).send({ error: 'Failed to toggle library exclusion' })
      }
    }
  )
}
