/**
 * Shows You Watch API Routes
 * 
 * Handles CRUD operations for user's watching series list
 * and library management.
 */

import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne } from '../lib/db.js'
import { requireAuth } from '../plugins/auth.js'
import {
  getUpcomingEpisodes,
  reconcileWatchingFavoritesForUser,
  favoriteWatchingSeriesOnMediaServer,
  unfavoriteWatchingSeriesOnMediaServer,
} from '@aperture/core/watching'

interface WatchingSeriesRow {
  id: string
  series_id: string
  title: string
  year: number | null
  poster_url: string | null
  backdrop_url: string | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  network: string | null
  status: string | null
  total_seasons: number | null
  total_episodes: number | null
  added_at: string
  tmdb_id: string | null
}

interface WatchingSeriesResponse {
  id: string
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  genres: string[]
  overview: string | null
  communityRating: number | null
  network: string | null
  status: string | null
  totalSeasons: number | null
  totalEpisodes: number | null
  addedAt: string
  upcomingEpisode: {
    seasonNumber: number
    episodeNumber: number
    title: string
    airDate: string
    source: 'emby' | 'tmdb'
  } | null
}

const watchingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/watching
   * List user's watching series with upcoming episode info
   */
  fastify.get<{
    Reply: { series: WatchingSeriesResponse[]; total: number }
  }>('/api/watching', { preHandler: requireAuth, schema: { tags: ["watching"] } }, async (request, reply) => {
    const userId = request.user!.id

    // Get user's watching series
    const result = await query<WatchingSeriesRow>(
      `SELECT uws.id, uws.series_id, uws.added_at,
              s.title, s.year, s.poster_url, s.backdrop_url, s.genres,
              s.overview, s.community_rating, s.network, s.status,
              s.total_seasons, s.total_episodes, s.tmdb_id
       FROM user_watching_series uws
       JOIN series s ON s.id = uws.series_id
       WHERE uws.user_id = $1
       ORDER BY uws.added_at DESC`,
      [userId]
    )

    // Get upcoming episodes for all series
    const seriesIds = result.rows.map((r) => r.series_id)
    const upcomingEpisodes = await getUpcomingEpisodes(seriesIds)

    const series: WatchingSeriesResponse[] = result.rows.map((row) => {
      const upcoming = upcomingEpisodes.get(row.series_id)
      return {
        id: row.id,
        seriesId: row.series_id,
        title: row.title,
        year: row.year,
        posterUrl: row.poster_url,
        backdropUrl: row.backdrop_url,
        genres: row.genres || [],
        overview: row.overview,
        communityRating: row.community_rating,
        network: row.network,
        status: row.status,
        totalSeasons: row.total_seasons,
        totalEpisodes: row.total_episodes,
        addedAt: row.added_at,
        upcomingEpisode: upcoming ? {
          seasonNumber: upcoming.seasonNumber,
          episodeNumber: upcoming.episodeNumber,
          title: upcoming.title,
          airDate: upcoming.airDate,
          source: upcoming.source,
        } : null,
      }
    })

    return reply.send({ series, total: series.length })
  })

  /**
   * GET /api/watching/ids
   * Get list of series IDs the user is watching (for quick UI checks)
   */
  fastify.get<{
    Reply: { seriesIds: string[] }
  }>('/api/watching/ids', { preHandler: requireAuth, schema: { tags: ["watching"] } }, async (request, reply) => {
    const userId = request.user!.id

    const result = await query<{ series_id: string }>(
      `SELECT series_id FROM user_watching_series WHERE user_id = $1`,
      [userId]
    )

    return reply.send({ seriesIds: result.rows.map((r) => r.series_id) })
  })

  /**
   * POST /api/watching/:seriesId
   * Add series to user's watching list
   */
  fastify.post<{
    Params: { seriesId: string }
    Reply: { success: boolean; message: string }
  }>('/api/watching/:seriesId', { preHandler: requireAuth, schema: { tags: ["watching"] } }, async (request, reply) => {
    const userId = request.user!.id
    const { seriesId } = request.params

    // Check if series exists
    const series = await queryOne<{ id: string; title: string }>(
      'SELECT id, title FROM series WHERE id = $1',
      [seriesId]
    )

    if (!series) {
      return reply.status(404).send({ success: false, message: 'Series not found' })
    }

    // Check if already watching
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM user_watching_series WHERE user_id = $1 AND series_id = $2',
      [userId, seriesId]
    )

    if (existing) {
      return reply.send({ success: true, message: 'Already in watching list' })
    }

    // Add to watching list
    await query(
      'INSERT INTO user_watching_series (user_id, series_id) VALUES ($1, $2)',
      [userId, seriesId]
    )

    fastify.log.info({ userId, seriesId, title: series.title }, 'Added series to watching list')

    try {
      await favoriteWatchingSeriesOnMediaServer(request.user!.providerUserId, seriesId)
    } catch (err) {
      fastify.log.warn({ err, userId, seriesId }, 'Failed to favorite series on media server (watching saved)')
    }

    return reply.send({ success: true, message: `Added "${series.title}" to watching list` })
  })

  /**
   * DELETE /api/watching/:seriesId
   * Remove series from user's watching list
   */
  fastify.delete<{
    Params: { seriesId: string }
    Reply: { success: boolean; message: string }
  }>('/api/watching/:seriesId', { preHandler: requireAuth, schema: { tags: ["watching"] } }, async (request, reply) => {
    const userId = request.user!.id
    const { seriesId } = request.params

    const result = await query(
      'DELETE FROM user_watching_series WHERE user_id = $1 AND series_id = $2',
      [userId, seriesId]
    )

    if (result.rowCount === 0) {
      return reply.status(404).send({ success: false, message: 'Series not in watching list' })
    }

    fastify.log.info({ userId, seriesId }, 'Removed series from watching list')

    try {
      await unfavoriteWatchingSeriesOnMediaServer(request.user!.providerUserId, seriesId)
    } catch (err) {
      fastify.log.warn({ err, userId, seriesId }, 'Failed to unfavorite series on media server (watching removed)')
    }

    return reply.send({ success: true, message: 'Removed from watching list' })
  })

  /**
   * POST /api/watching/refresh
   * Reconcile Shows You Watch with media server series favorites
   */
  fastify.post<{
    Reply: {
      success: boolean
      message: string
      skipped: boolean
      reason?: string
      pushedToServer: number
      removedFromDb: number
      pulledIntoDb: number
      pushErrors: number
    }
  }>('/api/watching/refresh', { preHandler: requireAuth, schema: { tags: ["watching"] } }, async (request, reply) => {
    const user = request.user!

    try {
      const result = await reconcileWatchingFavoritesForUser(user.id, user.providerUserId)

      if (result.skipped) {
        const msg =
          result.reason === 'watching_disabled'
            ? 'Shows You Watch is disabled'
            : result.reason === 'no_api_key'
              ? 'Media server API key not configured'
              : result.reason === 'no_provider_user_id'
                ? 'Account is not linked to the media server'
                : result.reason === 'list_favorites_failed'
                  ? 'Could not read favorites from media server'
                  : 'Sync skipped'
        return reply.send({
          success: true,
          message: msg,
          skipped: true,
          reason: result.reason,
          pushedToServer: 0,
          removedFromDb: 0,
          pulledIntoDb: 0,
          pushErrors: 0,
        })
      }

      return reply.send({
        success: true,
        message: 'Shows You Watch synced with media server favorites',
        skipped: false,
        pushedToServer: result.pushedToServer,
        removedFromDb: result.removedFromDb,
        pulledIntoDb: result.pulledIntoDb,
        pushErrors: result.pushErrors,
      })
    } catch (err) {
      fastify.log.error({ err, userId: user.id }, 'Failed to sync watching favorites')
      return reply.status(500).send({
        success: false,
        message: 'Failed to sync with media server',
        skipped: false,
        pushedToServer: 0,
        removedFromDb: 0,
        pulledIntoDb: 0,
        pushErrors: 0,
      })
    }
  })

  /**
   * GET /api/watching/check/:seriesId
   * Check if a specific series is in user's watching list
   */
  fastify.get<{
    Params: { seriesId: string }
    Reply: { isWatching: boolean }
  }>('/api/watching/check/:seriesId', { preHandler: requireAuth, schema: { tags: ["watching"] } }, async (request, reply) => {
    const userId = request.user!.id
    const { seriesId } = request.params

    const result = await queryOne<{ id: string }>(
      'SELECT id FROM user_watching_series WHERE user_id = $1 AND series_id = $2',
      [userId, seriesId]
    )

    return reply.send({ isWatching: !!result })
  })
}

export default watchingRoutes

