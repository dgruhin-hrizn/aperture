/**
 * Taste Profile Settings Handlers
 * 
 * Endpoints:
 * - GET /api/settings/taste-profile - Get user's taste profile
 * - POST /api/settings/taste-profile/rebuild - Force rebuild taste profile
 * - PATCH /api/settings/taste-profile - Update profile settings
 * - PUT /api/settings/taste-profile/franchises - Update franchise preferences
 * - DELETE /api/settings/taste-profile/franchises/:franchiseName - Delete franchise preference
 * - PUT /api/settings/taste-profile/genres - Update genre weights
 * - DELETE /api/settings/taste-profile/genres/:genre - Delete genre weight
 * - POST /api/settings/taste-profile/interests - Add custom interest
 * - DELETE /api/settings/taste-profile/interests/:id - Remove custom interest
 */
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../../../plugins/auth.js'
import {
  tasteProfileSchema,
  addTasteProfileItemSchema,
  updateTasteProfileItemSchema,
  deleteTasteProfileItemSchema,
  customInterestsSchema,
  addCustomInterestSchema,
  updateCustomInterestSchema,
  deleteCustomInterestSchema,
} from '../schemas.js'

export function registerTasteProfileHandlers(fastify: FastifyInstance) {
  /**
   * GET /api/settings/taste-profile
   */
  fastify.get<{
    Querystring: { mediaType?: 'movie' | 'series' }
  }>('/api/settings/taste-profile', { preHandler: requireAuth, schema: tasteProfileSchema }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const mediaType = (request.query.mediaType || 'movie') as 'movie' | 'series'

      const { getUserTasteData, REFRESH_INTERVAL_OPTIONS, MIN_FRANCHISE_ITEMS_OPTIONS, MIN_FRANCHISE_SIZE_OPTIONS } = await import('@aperture/core')
      const tasteData = await getUserTasteData(userId, mediaType)

      return reply.send({
        profile: tasteData.profile
          ? {
              id: tasteData.profile.id,
              mediaType: tasteData.profile.mediaType,
              hasEmbedding: !!tasteData.profile.embedding,
              embeddingModel: tasteData.profile.embeddingModel,
              autoUpdatedAt: tasteData.profile.autoUpdatedAt,
              userModifiedAt: tasteData.profile.userModifiedAt,
              isLocked: tasteData.profile.isLocked,
              refreshIntervalDays: tasteData.profile.refreshIntervalDays,
              minFranchiseItems: tasteData.profile.minFranchiseItems,
              minFranchiseSize: tasteData.profile.minFranchiseSize,
              createdAt: tasteData.profile.createdAt,
            }
          : null,
        franchises: tasteData.franchises.map((f) => ({
          id: f.id,
          franchiseName: f.franchiseName,
          mediaType: f.mediaType,
          preferenceScore: f.preferenceScore,
          isUserSet: f.isUserSet,
          itemsWatched: f.itemsWatched,
          totalEngagement: f.totalEngagement,
        })),
        genres: tasteData.genres.map((g) => ({
          id: g.id,
          genre: g.genre,
          weight: g.weight,
          isUserSet: g.isUserSet,
        })),
        customInterests: tasteData.customInterests.map((i) => ({
          id: i.id,
          interestText: i.interestText,
          hasEmbedding: !!i.embedding,
          weight: i.weight,
          createdAt: i.createdAt,
        })),
        refreshIntervalOptions: REFRESH_INTERVAL_OPTIONS,
        minFranchiseItemsOptions: MIN_FRANCHISE_ITEMS_OPTIONS,
        minFranchiseSizeOptions: MIN_FRANCHISE_SIZE_OPTIONS,
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to get taste profile')
      return reply.status(500).send({ error: 'Failed to get taste profile' })
    }
  })

  /**
   * POST /api/settings/taste-profile/rebuild
   */
  fastify.post<{
    Body: { mediaType: 'movie' | 'series'; mode?: 'reset' | 'merge' }
  }>('/api/settings/taste-profile/rebuild', { preHandler: requireAuth, schema: addTasteProfileItemSchema }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { mediaType, mode = 'reset' } = request.body

      if (!mediaType || !['movie', 'series'].includes(mediaType)) {
        return reply.status(400).send({ error: 'mediaType must be "movie" or "series"' })
      }

      if (mode && !['reset', 'merge'].includes(mode)) {
        return reply.status(400).send({ error: 'mode must be "reset" or "merge"' })
      }

      const { getUserTasteProfile, detectAndUpdateFranchises, detectAndUpdateGenres, getUserFranchisePreferences, getUserGenreWeights, getStoredProfile, DEFAULT_MIN_FRANCHISE_ITEMS, DEFAULT_MIN_FRANCHISE_SIZE } = await import('@aperture/core')

      const storedProfile = await getStoredProfile(userId, mediaType)
      const minFranchiseItems = storedProfile?.minFranchiseItems ?? DEFAULT_MIN_FRANCHISE_ITEMS
      const minFranchiseSize = storedProfile?.minFranchiseSize ?? DEFAULT_MIN_FRANCHISE_SIZE

      const profile = await getUserTasteProfile(userId, mediaType, {
        forceRebuild: true,
        skipLockCheck: true,
      })

      const franchiseResult = await detectAndUpdateFranchises(userId, mediaType, { mode, minFranchiseItems, minFranchiseSize })
      const genreResult = await detectAndUpdateGenres(userId, mediaType, { mode })

      const [updatedFranchises, updatedGenres] = await Promise.all([
        getUserFranchisePreferences(userId),
        getUserGenreWeights(userId),
      ])

      const filteredFranchises = updatedFranchises.filter(
        (f) => f.mediaType === mediaType || f.mediaType === 'both'
      )

      return reply.send({
        success: true,
        profile: profile
          ? {
              id: profile.id,
              mediaType: profile.mediaType,
              hasEmbedding: !!profile.embedding,
              autoUpdatedAt: profile.autoUpdatedAt,
            }
          : null,
        franchisesUpdated: franchiseResult.updated,
        genresUpdated: genreResult.updated,
        newFranchises: franchiseResult.newItems,
        newGenres: genreResult.newItems,
        franchises: filteredFranchises.map((f) => ({
          id: f.id,
          franchiseName: f.franchiseName,
          preferenceScore: f.preferenceScore,
          itemsWatched: f.itemsWatched,
        })),
        genres: updatedGenres.map((g) => ({
          id: g.id,
          genre: g.genre,
          weight: g.weight,
        })),
        message: mode === 'merge' 
          ? `Added ${franchiseResult.newItems.length} new franchises and ${genreResult.newItems.length} new genres`
          : 'Taste profile rebuilt successfully',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to rebuild taste profile')
      return reply.status(500).send({ error: 'Failed to rebuild taste profile' })
    }
  })

  /**
   * PATCH /api/settings/taste-profile
   */
  fastify.patch<{
    Body: { mediaType: 'movie' | 'series'; isLocked?: boolean; refreshIntervalDays?: number; minFranchiseItems?: number; minFranchiseSize?: number }
  }>('/api/settings/taste-profile', { preHandler: requireAuth, schema: updateTasteProfileItemSchema }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { mediaType, isLocked, refreshIntervalDays, minFranchiseItems, minFranchiseSize } = request.body

      if (!mediaType || !['movie', 'series'].includes(mediaType)) {
        return reply.status(400).send({ error: 'mediaType must be "movie" or "series"' })
      }

      const { REFRESH_INTERVAL_OPTIONS, MIN_FRANCHISE_ITEMS_OPTIONS, MIN_FRANCHISE_SIZE_OPTIONS, updateProfileSettings } = await import('@aperture/core')
      
      if (refreshIntervalDays !== undefined && !REFRESH_INTERVAL_OPTIONS.includes(refreshIntervalDays as 7 | 14 | 30 | 60 | 90 | 180 | 365)) {
        return reply.status(400).send({
          error: `refreshIntervalDays must be one of: ${REFRESH_INTERVAL_OPTIONS.join(', ')}`,
        })
      }

      if (minFranchiseItems !== undefined && !MIN_FRANCHISE_ITEMS_OPTIONS.includes(minFranchiseItems as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)) {
        return reply.status(400).send({
          error: `minFranchiseItems must be one of: ${MIN_FRANCHISE_ITEMS_OPTIONS.join(', ')}`,
        })
      }

      if (minFranchiseSize !== undefined && !MIN_FRANCHISE_SIZE_OPTIONS.includes(minFranchiseSize as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)) {
        return reply.status(400).send({
          error: `minFranchiseSize must be one of: ${MIN_FRANCHISE_SIZE_OPTIONS.join(', ')}`,
        })
      }

      await updateProfileSettings(userId, mediaType, {
        isLocked,
        refreshIntervalDays,
        minFranchiseItems,
        minFranchiseSize,
      })

      return reply.send({
        success: true,
        message: 'Profile settings updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update profile settings')
      return reply.status(500).send({ error: 'Failed to update profile settings' })
    }
  })

  /**
   * PUT /api/settings/taste-profile/franchises
   */
  fastify.put<{
    Body: {
      franchises: Array<{
        franchiseName: string
        mediaType: 'movie' | 'series' | 'both'
        preferenceScore: number
      }>
    }
  }>('/api/settings/taste-profile/franchises', { preHandler: requireAuth, schema: { tags: ['settings'] } }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { franchises } = request.body

      if (!Array.isArray(franchises)) {
        return reply.status(400).send({ error: 'franchises must be an array' })
      }

      const { setFranchisePreference } = await import('@aperture/core')

      for (const franchise of franchises) {
        if (!franchise.franchiseName || !franchise.mediaType || franchise.preferenceScore === undefined) {
          continue
        }

        if (franchise.preferenceScore < -1 || franchise.preferenceScore > 1) {
          return reply.status(400).send({
            error: `preferenceScore for "${franchise.franchiseName}" must be between -1 and 1`,
          })
        }

        await setFranchisePreference(userId, franchise.franchiseName, franchise.mediaType, franchise.preferenceScore, true)
      }

      return reply.send({
        success: true,
        updated: franchises.length,
        message: 'Franchise preferences updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update franchise preferences')
      return reply.status(500).send({ error: 'Failed to update franchise preferences' })
    }
  })

  /**
   * DELETE /api/settings/taste-profile/franchises/:franchiseName
   */
  fastify.delete<{
    Params: { franchiseName: string }
    Querystring: { mediaType: 'movie' | 'series' | 'both' }
  }>('/api/settings/taste-profile/franchises/:franchiseName', { preHandler: requireAuth, schema: deleteTasteProfileItemSchema }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { franchiseName } = request.params
      const { mediaType } = request.query

      if (!franchiseName) {
        return reply.status(400).send({ error: 'franchiseName is required' })
      }

      if (!mediaType || !['movie', 'series', 'both'].includes(mediaType)) {
        return reply.status(400).send({ error: 'mediaType query param is required (movie, series, or both)' })
      }

      const { deleteFranchisePreference } = await import('@aperture/core')
      const deleted = await deleteFranchisePreference(userId, decodeURIComponent(franchiseName), mediaType)

      return reply.send({
        success: deleted,
        message: deleted ? 'Franchise deleted' : 'Franchise not found',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete franchise preference')
      return reply.status(500).send({ error: 'Failed to delete franchise preference' })
    }
  })

  /**
   * PUT /api/settings/taste-profile/genres
   */
  fastify.put<{
    Body: {
      genres: Array<{
        genre: string
        weight: number
      }>
    }
  }>('/api/settings/taste-profile/genres', { preHandler: requireAuth, schema: { tags: ['settings'] } }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { genres } = request.body

      if (!Array.isArray(genres)) {
        return reply.status(400).send({ error: 'genres must be an array' })
      }

      const { setGenreWeight } = await import('@aperture/core')

      for (const genre of genres) {
        if (!genre.genre || genre.weight === undefined) {
          continue
        }

        if (genre.weight < 0 || genre.weight > 2) {
          return reply.status(400).send({
            error: `weight for "${genre.genre}" must be between 0 and 2`,
          })
        }

        await setGenreWeight(userId, genre.genre, genre.weight, true)
      }

      return reply.send({
        success: true,
        updated: genres.length,
        message: 'Genre weights updated',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update genre weights')
      return reply.status(500).send({ error: 'Failed to update genre weights' })
    }
  })

  /**
   * DELETE /api/settings/taste-profile/genres/:genre
   */
  fastify.delete<{
    Params: { genre: string }
  }>('/api/settings/taste-profile/genres/:genre', { preHandler: requireAuth, schema: { tags: ['settings'] } }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { genre } = request.params

      if (!genre) {
        return reply.status(400).send({ error: 'genre is required' })
      }

      const { deleteGenreWeight } = await import('@aperture/core')
      const deleted = await deleteGenreWeight(userId, decodeURIComponent(genre))

      return reply.send({
        success: deleted,
        message: deleted ? 'Genre deleted' : 'Genre not found',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete genre weight')
      return reply.status(500).send({ error: 'Failed to delete genre weight' })
    }
  })

  /**
   * POST /api/settings/taste-profile/interests
   */
  fastify.post<{
    Body: { interestText: string; weight?: number }
  }>('/api/settings/taste-profile/interests', { preHandler: requireAuth, schema: addCustomInterestSchema }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { interestText, weight = 1.0 } = request.body

      if (!interestText || interestText.trim().length === 0) {
        return reply.status(400).send({ error: 'interestText is required' })
      }

      if (interestText.length > 500) {
        return reply.status(400).send({ error: 'interestText must be 500 characters or less' })
      }

      const { addCustomInterest, getEmbeddingModel, getEmbeddingModelInstance } = await import('@aperture/core')
      const { embed } = await import('ai')

      let embedding: number[] | undefined
      let embeddingModel: string | undefined
      try {
        const modelId = await getEmbeddingModel()
        if (modelId) {
          const model = await getEmbeddingModelInstance()
          const result = await embed({ model, value: interestText.trim() })
          embedding = result.embedding
          embeddingModel = modelId
        }
      } catch {
        fastify.log.warn('Failed to generate embedding for custom interest')
      }

      const interestId = await addCustomInterest(userId, interestText.trim(), embedding, embeddingModel, weight)

      return reply.send({
        success: true,
        id: interestId,
        message: 'Custom interest added',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to add custom interest')
      return reply.status(500).send({ error: 'Failed to add custom interest' })
    }
  })

  /**
   * DELETE /api/settings/taste-profile/interests/:id
   */
  fastify.delete<{
    Params: { id: string }
  }>('/api/settings/taste-profile/interests/:id', { preHandler: requireAuth, schema: deleteCustomInterestSchema }, async (request, reply) => {
    try {
      const userId = request.user!.id
      const { id } = request.params

      const { removeCustomInterest } = await import('@aperture/core')
      await removeCustomInterest(userId, id)

      return reply.send({
        success: true,
        message: 'Custom interest removed',
      })
    } catch (err) {
      fastify.log.error({ err }, 'Failed to remove custom interest')
      return reply.status(500).send({ error: 'Failed to remove custom interest' })
    }
  })
}
