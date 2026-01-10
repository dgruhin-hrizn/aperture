import type { FastifyInstance } from 'fastify'
import { requireAuth, type SessionUser } from '../../../plugins/auth.js'
import {
  generateAIPreferences,
  generateAIPlaylistName,
  generateAIPlaylistDescription,
} from '@aperture/core'

export function registerAiHandlers(fastify: FastifyInstance) {
  /**
   * POST /api/channels/ai-preferences
   * Generate AI-powered text preferences based on taste profile, genres, and example movies
   */
  fastify.post<{
    Body: {
      genres: string[]
      exampleMovieIds: string[]
    }
  }>(
    '/api/channels/ai-preferences',
    { preHandler: requireAuth },
    async (request, reply) => {
      const currentUser = request.user as SessionUser
      const { genres, exampleMovieIds } = request.body

      try {
        const preferences = await generateAIPreferences(
          currentUser.id,
          genres || [],
          exampleMovieIds || []
        )

        return reply.send({ preferences })
      } catch (err) {
        request.log.error({ err, userId: currentUser.id }, 'Failed to generate AI preferences')
        return reply.status(500).send({ error: 'Failed to generate AI preferences' })
      }
    }
  )

  /**
   * POST /api/channels/ai-name
   * Generate AI-powered playlist name based on genres, example movies, and preferences
   */
  fastify.post<{
    Body: {
      genres: string[]
      exampleMovieIds: string[]
      textPreferences?: string
    }
  }>(
    '/api/channels/ai-name',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { genres, exampleMovieIds, textPreferences } = request.body

      try {
        const name = await generateAIPlaylistName(
          genres || [],
          exampleMovieIds || [],
          textPreferences
        )

        return reply.send({ name })
      } catch (err) {
        request.log.error({ err }, 'Failed to generate AI playlist name')
        return reply.status(500).send({ error: 'Failed to generate playlist name' })
      }
    }
  )

  /**
   * POST /api/channels/ai-description
   * Generate AI-powered playlist description based on genres, example movies, preferences, and name
   */
  fastify.post<{
    Body: {
      genres: string[]
      exampleMovieIds: string[]
      textPreferences?: string
      playlistName?: string
    }
  }>(
    '/api/channels/ai-description',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { genres, exampleMovieIds, textPreferences, playlistName } = request.body

      try {
        const description = await generateAIPlaylistDescription(
          genres || [],
          exampleMovieIds || [],
          textPreferences,
          playlistName
        )

        return reply.send({ description })
      } catch (err) {
        request.log.error({ err }, 'Failed to generate AI playlist description')
        return reply.status(500).send({ error: 'Failed to generate playlist description' })
      }
    }
  )
}



