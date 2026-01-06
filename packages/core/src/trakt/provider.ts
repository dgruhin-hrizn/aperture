/**
 * Trakt API Provider
 * Handles OAuth authentication and ratings sync
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getSystemSetting, setSystemSetting } from '../settings/systemSettings.js'
import type { TraktConfig, TraktTokens, TraktUser, TraktRating, TraktSyncResult } from './types.js'

const logger = createChildLogger('trakt')

const TRAKT_API_BASE = 'https://api.trakt.tv'
const TRAKT_AUTH_URL = 'https://trakt.tv/oauth/authorize'
const TRAKT_TOKEN_URL = 'https://api.trakt.tv/oauth/token'

/**
 * Get Trakt configuration from system settings
 */
export async function getTraktConfig(): Promise<TraktConfig | null> {
  const clientId = await getSystemSetting('trakt_client_id')
  const clientSecret = await getSystemSetting('trakt_client_secret')
  const redirectUri = await getSystemSetting('trakt_redirect_uri')

  if (!clientId || !clientSecret) {
    return null
  }

  return {
    clientId,
    clientSecret,
    redirectUri: redirectUri || '',
  }
}

/**
 * Set Trakt configuration in system settings
 */
export async function setTraktConfig(config: Partial<TraktConfig>): Promise<void> {
  if (config.clientId !== undefined) {
    await setSystemSetting('trakt_client_id', config.clientId)
  }
  if (config.clientSecret !== undefined) {
    await setSystemSetting('trakt_client_secret', config.clientSecret)
  }
  if (config.redirectUri !== undefined) {
    await setSystemSetting('trakt_redirect_uri', config.redirectUri)
  }
}

/**
 * Generate OAuth authorization URL
 */
export async function getAuthorizationUrl(state: string): Promise<string | null> {
  const config = await getTraktConfig()
  if (!config) {
    logger.warn('Trakt not configured - cannot generate auth URL')
    return null
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  })

  return `${TRAKT_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<TraktTokens | null> {
  const config = await getTraktConfig()
  if (!config) {
    logger.error('Trakt not configured - cannot exchange code')
    return null
  }

  try {
    const response = await fetch(TRAKT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error({ status: response.status, error }, 'Failed to exchange Trakt code for tokens')
      return null
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  } catch (err) {
    logger.error({ err }, 'Error exchanging Trakt code for tokens')
    return null
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshTokens(refreshToken: string): Promise<TraktTokens | null> {
  const config = await getTraktConfig()
  if (!config) {
    return null
  }

  try {
    const response = await fetch(TRAKT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      logger.error({ status: response.status }, 'Failed to refresh Trakt tokens')
      return null
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  } catch (err) {
    logger.error({ err }, 'Error refreshing Trakt tokens')
    return null
  }
}

/**
 * Get user's Trakt profile
 */
export async function getTraktUser(accessToken: string): Promise<TraktUser | null> {
  const config = await getTraktConfig()
  if (!config) {
    return null
  }

  try {
    const response = await fetch(`${TRAKT_API_BASE}/users/me`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      logger.error({ status: response.status }, 'Failed to get Trakt user profile')
      return null
    }

    return (await response.json()) as TraktUser
  } catch (err) {
    logger.error({ err }, 'Error getting Trakt user profile')
    return null
  }
}

/**
 * Get user's ratings from Trakt
 */
export async function getTraktRatings(
  accessToken: string,
  type: 'movies' | 'shows'
): Promise<TraktRating[]> {
  const config = await getTraktConfig()
  if (!config) {
    return []
  }

  try {
    const response = await fetch(`${TRAKT_API_BASE}/users/me/ratings/${type}`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      logger.error({ status: response.status, type }, 'Failed to get Trakt ratings')
      return []
    }

    return (await response.json()) as TraktRating[]
  } catch (err) {
    logger.error({ err, type }, 'Error getting Trakt ratings')
    return []
  }
}

/**
 * Store Trakt tokens for a user
 */
export async function storeUserTraktTokens(
  userId: string,
  tokens: TraktTokens,
  username: string
): Promise<void> {
  await query(
    `UPDATE users SET 
      trakt_access_token = $2,
      trakt_refresh_token = $3,
      trakt_token_expires_at = $4,
      trakt_username = $5
     WHERE id = $1`,
    [userId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt, username]
  )
}

/**
 * Get user's Trakt tokens (refreshing if needed)
 */
export async function getUserTraktTokens(userId: string): Promise<TraktTokens | null> {
  const user = await queryOne<{
    trakt_access_token: string | null
    trakt_refresh_token: string | null
    trakt_token_expires_at: Date | null
    trakt_username: string | null
  }>(
    `SELECT trakt_access_token, trakt_refresh_token, trakt_token_expires_at, trakt_username FROM users WHERE id = $1`,
    [userId]
  )

  if (!user?.trakt_access_token || !user?.trakt_refresh_token) {
    return null
  }

  // Check if token is expired or expiring soon (within 1 hour)
  const expiresAt = user.trakt_token_expires_at
    ? new Date(user.trakt_token_expires_at)
    : new Date(0)
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000)

  if (expiresAt < oneHourFromNow) {
    // Refresh tokens
    logger.info({ userId }, 'Refreshing Trakt tokens')
    const newTokens = await refreshTokens(user.trakt_refresh_token)
    if (newTokens && user.trakt_username) {
      await storeUserTraktTokens(userId, newTokens, user.trakt_username)
      return newTokens
    }
    // Refresh failed - tokens are invalid
    return null
  }

  return {
    accessToken: user.trakt_access_token,
    refreshToken: user.trakt_refresh_token,
    expiresAt,
  }
}

/**
 * Disconnect Trakt from a user account
 */
export async function disconnectTrakt(userId: string): Promise<void> {
  await query(
    `UPDATE users SET 
      trakt_access_token = NULL,
      trakt_refresh_token = NULL,
      trakt_token_expires_at = NULL,
      trakt_username = NULL,
      trakt_synced_at = NULL
     WHERE id = $1`,
    [userId]
  )
}

/**
 * Sync ratings from Trakt for a user
 */
export async function syncTraktRatings(userId: string): Promise<TraktSyncResult> {
  const result: TraktSyncResult = {
    moviesImported: 0,
    moviesUpdated: 0,
    moviesSkipped: 0,
    seriesImported: 0,
    seriesUpdated: 0,
    seriesSkipped: 0,
  }

  const tokens = await getUserTraktTokens(userId)
  if (!tokens) {
    logger.warn({ userId }, 'No valid Trakt tokens for user')
    return result
  }

  logger.info({ userId }, 'Starting Trakt ratings sync')

  // Get movie ratings
  const movieRatings = await getTraktRatings(tokens.accessToken, 'movies')
  logger.info({ userId, count: movieRatings.length }, 'Fetched movie ratings from Trakt')

  for (const rating of movieRatings) {
    if (!rating.movie) continue

    // Try to find movie by IMDB ID
    let movie = await queryOne<{ id: string }>(`SELECT id FROM movies WHERE imdb_id = $1`, [
      rating.movie.ids.imdb,
    ])

    // Fallback to TMDB ID
    if (!movie && rating.movie.ids.tmdb) {
      movie = await queryOne<{ id: string }>(`SELECT id FROM movies WHERE tmdb_id = $1`, [
        String(rating.movie.ids.tmdb),
      ])
    }

    if (!movie) {
      result.moviesSkipped++
      continue
    }

    // Upsert rating
    const upsertResult = await query(
      `INSERT INTO user_ratings (user_id, movie_id, rating, source)
       VALUES ($1, $2, $3, 'trakt')
       ON CONFLICT (user_id, movie_id) WHERE movie_id IS NOT NULL
       DO UPDATE SET rating = EXCLUDED.rating, source = 'trakt', updated_at = NOW()
       RETURNING (xmax = 0) as is_insert`,
      [userId, movie.id, rating.rating]
    )

    if (upsertResult.rows[0]?.is_insert) {
      result.moviesImported++
    } else {
      result.moviesUpdated++
    }
  }

  // Get show ratings
  const showRatings = await getTraktRatings(tokens.accessToken, 'shows')
  logger.info({ userId, count: showRatings.length }, 'Fetched show ratings from Trakt')

  for (const rating of showRatings) {
    if (!rating.show) continue

    // Try to find series by IMDB ID
    let series = await queryOne<{ id: string }>(`SELECT id FROM series WHERE imdb_id = $1`, [
      rating.show.ids.imdb,
    ])

    // Fallback to TVDB ID
    if (!series && rating.show.ids.tvdb) {
      series = await queryOne<{ id: string }>(`SELECT id FROM series WHERE tvdb_id = $1`, [
        String(rating.show.ids.tvdb),
      ])
    }

    // Fallback to TMDB ID
    if (!series && rating.show.ids.tmdb) {
      series = await queryOne<{ id: string }>(`SELECT id FROM series WHERE tmdb_id = $1`, [
        String(rating.show.ids.tmdb),
      ])
    }

    if (!series) {
      result.seriesSkipped++
      continue
    }

    // Upsert rating
    const upsertResult = await query(
      `INSERT INTO user_ratings (user_id, series_id, rating, source)
       VALUES ($1, $2, $3, 'trakt')
       ON CONFLICT (user_id, series_id) WHERE series_id IS NOT NULL
       DO UPDATE SET rating = EXCLUDED.rating, source = 'trakt', updated_at = NOW()
       RETURNING (xmax = 0) as is_insert`,
      [userId, series.id, rating.rating]
    )

    if (upsertResult.rows[0]?.is_insert) {
      result.seriesImported++
    } else {
      result.seriesUpdated++
    }
  }

  // Update sync timestamp
  await query(`UPDATE users SET trakt_synced_at = NOW() WHERE id = $1`, [userId])

  logger.info({ userId, result }, 'Completed Trakt ratings sync')
  return result
}

/**
 * Check if Trakt is configured for the system
 */
export async function isTraktConfigured(): Promise<boolean> {
  const config = await getTraktConfig()
  return config !== null && !!config.clientId && !!config.clientSecret
}

/**
 * Get Trakt connection status for a user
 */
export async function getUserTraktStatus(userId: string): Promise<{
  connected: boolean
  username: string | null
  syncedAt: Date | null
}> {
  const user = await queryOne<{
    trakt_username: string | null
    trakt_synced_at: Date | null
    trakt_access_token: string | null
  }>(`SELECT trakt_username, trakt_synced_at, trakt_access_token FROM users WHERE id = $1`, [
    userId,
  ])

  return {
    connected: !!user?.trakt_access_token,
    username: user?.trakt_username || null,
    syncedAt: user?.trakt_synced_at || null,
  }
}

/**
 * Push a rating to Trakt (bidirectional sync)
 */
export async function pushRatingToTrakt(
  userId: string,
  options: {
    movieId?: string
    seriesId?: string
    rating: number
  }
): Promise<boolean> {
  const tokens = await getUserTraktTokens(userId)
  if (!tokens) {
    logger.debug({ userId }, 'No Trakt tokens - skipping push')
    return false
  }

  const config = await getTraktConfig()
  if (!config) {
    return false
  }

  try {
    // Get the external IDs for the movie/series
    let externalIds: { imdb?: string; tmdb?: number } | null = null
    let itemType: 'movies' | 'shows' = 'movies'

    if (options.movieId) {
      const movie = await queryOne<{ imdb_id: string | null; tmdb_id: string | null }>(
        `SELECT imdb_id, tmdb_id FROM movies WHERE id = $1`,
        [options.movieId]
      )
      if (movie?.imdb_id) {
        externalIds = { imdb: movie.imdb_id }
      } else if (movie?.tmdb_id) {
        externalIds = { tmdb: parseInt(movie.tmdb_id, 10) }
      }
    } else if (options.seriesId) {
      const series = await queryOne<{
        imdb_id: string | null
        tmdb_id: string | null
        tvdb_id: string | null
      }>(`SELECT imdb_id, tmdb_id, tvdb_id FROM series WHERE id = $1`, [options.seriesId])
      if (series?.imdb_id) {
        externalIds = { imdb: series.imdb_id }
      } else if (series?.tmdb_id) {
        externalIds = { tmdb: parseInt(series.tmdb_id, 10) }
      }
      itemType = 'shows'
    }

    if (!externalIds) {
      logger.debug({ userId, ...options }, 'No external IDs found - cannot push to Trakt')
      return false
    }

    // Build request body
    const body: Record<string, unknown[]> = {}
    const ratedAt = new Date().toISOString()

    if (itemType === 'movies') {
      body.movies = [
        {
          ids: externalIds,
          rating: options.rating,
          rated_at: ratedAt,
        },
      ]
    } else {
      body.shows = [
        {
          ids: externalIds,
          rating: options.rating,
          rated_at: ratedAt,
        },
      ]
    }

    // Push to Trakt
    const response = await fetch(`${TRAKT_API_BASE}/sync/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId,
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error({ status: response.status, error }, 'Failed to push rating to Trakt')
      return false
    }

    logger.info({ userId, itemType, rating: options.rating }, 'Rating pushed to Trakt')
    return true
  } catch (err) {
    logger.error({ err }, 'Error pushing rating to Trakt')
    return false
  }
}

/**
 * Remove a rating from Trakt
 */
export async function removeRatingFromTrakt(
  userId: string,
  options: {
    movieId?: string
    seriesId?: string
  }
): Promise<boolean> {
  const tokens = await getUserTraktTokens(userId)
  if (!tokens) {
    return false
  }

  const config = await getTraktConfig()
  if (!config) {
    return false
  }

  try {
    let externalIds: { imdb?: string; tmdb?: number } | null = null
    let itemType: 'movies' | 'shows' = 'movies'

    if (options.movieId) {
      const movie = await queryOne<{ imdb_id: string | null; tmdb_id: string | null }>(
        `SELECT imdb_id, tmdb_id FROM movies WHERE id = $1`,
        [options.movieId]
      )
      if (movie?.imdb_id) {
        externalIds = { imdb: movie.imdb_id }
      } else if (movie?.tmdb_id) {
        externalIds = { tmdb: parseInt(movie.tmdb_id, 10) }
      }
    } else if (options.seriesId) {
      const series = await queryOne<{ imdb_id: string | null; tmdb_id: string | null }>(
        `SELECT imdb_id, tmdb_id FROM series WHERE id = $1`,
        [options.seriesId]
      )
      if (series?.imdb_id) {
        externalIds = { imdb: series.imdb_id }
      } else if (series?.tmdb_id) {
        externalIds = { tmdb: parseInt(series.tmdb_id, 10) }
      }
      itemType = 'shows'
    }

    if (!externalIds) {
      return false
    }

    const body: Record<string, unknown[]> = {}
    if (itemType === 'movies') {
      body.movies = [{ ids: externalIds }]
    } else {
      body.shows = [{ ids: externalIds }]
    }

    const response = await fetch(`${TRAKT_API_BASE}/sync/ratings/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId,
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      logger.error({ status: response.status }, 'Failed to remove rating from Trakt')
      return false
    }

    logger.info({ userId, itemType }, 'Rating removed from Trakt')
    return true
  } catch (err) {
    logger.error({ err }, 'Error removing rating from Trakt')
    return false
  }
}
