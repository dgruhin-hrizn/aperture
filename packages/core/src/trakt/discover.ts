/**
 * Trakt Discovery API Functions
 * 
 * Provides endpoints for discovering content:
 * - Trending movies and shows (currently being watched)
 * - Popular movies and shows (most watched overall)
 * - Recommended movies and shows (personalized, requires auth)
 */

import { createChildLogger } from '../lib/logger.js'
import { getTraktConfig, getUserTraktTokens } from './provider.js'
import type {
  TraktMovie,
  TraktShow,
  TraktMovieWithStats,
  TraktShowWithStats,
  TraktRecommendedMovie,
  TraktRecommendedShow,
  TraktDiscoveryOptions,
} from './types.js'

const logger = createChildLogger('trakt:discover')

const TRAKT_API_BASE = 'https://api.trakt.tv'

/**
 * Make a request to the Trakt API (no auth required for public endpoints)
 */
async function traktPublicRequest<T>(
  endpoint: string,
  options: TraktDiscoveryOptions = {}
): Promise<T | null> {
  const config = await getTraktConfig()
  if (!config) {
    logger.warn('Trakt not configured')
    return null
  }

  const params = new URLSearchParams()
  if (options.page) params.set('page', options.page.toString())
  if (options.limit) params.set('limit', options.limit.toString())
  if (options.period) params.set('period', options.period)

  const url = `${TRAKT_API_BASE}${endpoint}${params.toString() ? '?' + params.toString() : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId,
      },
    })

    if (!response.ok) {
      logger.error({ status: response.status, endpoint }, 'Trakt API request failed')
      return null
    }

    return (await response.json()) as T
  } catch (err) {
    logger.error({ err, endpoint }, 'Error making Trakt request')
    return null
  }
}

/**
 * Make an authenticated request to the Trakt API
 */
async function traktAuthRequest<T>(
  endpoint: string,
  accessToken: string,
  options: TraktDiscoveryOptions = {}
): Promise<T | null> {
  const config = await getTraktConfig()
  if (!config) {
    return null
  }

  const params = new URLSearchParams()
  if (options.page) params.set('page', options.page.toString())
  if (options.limit) params.set('limit', options.limit.toString())

  const url = `${TRAKT_API_BASE}${endpoint}${params.toString() ? '?' + params.toString() : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': config.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      logger.error({ status: response.status, endpoint }, 'Trakt authenticated API request failed')
      return null
    }

    return (await response.json()) as T
  } catch (err) {
    logger.error({ err, endpoint }, 'Error making Trakt authenticated request')
    return null
  }
}

// ============================================================================
// Movie Discovery Functions
// ============================================================================

/**
 * Get trending movies (currently being watched by users)
 */
export async function getTrendingMovies(
  options: TraktDiscoveryOptions = {}
): Promise<TraktMovieWithStats[]> {
  const result = await traktPublicRequest<TraktMovieWithStats[]>('/movies/trending', {
    limit: 50,
    ...options,
  })
  return result ?? []
}

/**
 * Get popular movies (most watched overall)
 */
export async function getPopularMovies(
  options: TraktDiscoveryOptions = {}
): Promise<TraktMovie[]> {
  const result = await traktPublicRequest<TraktMovie[]>('/movies/popular', {
    limit: 50,
    ...options,
  })
  return result ?? []
}

/**
 * Get most watched movies
 */
export async function getMostWatchedMovies(
  options: TraktDiscoveryOptions = {}
): Promise<TraktMovieWithStats[]> {
  const result = await traktPublicRequest<TraktMovieWithStats[]>('/movies/watched/' + (options.period || 'weekly'), {
    limit: 50,
    ...options,
  })
  return result ?? []
}

/**
 * Get most anticipated movies (upcoming, most list adds)
 */
export async function getAnticipatedMovies(
  options: TraktDiscoveryOptions = {}
): Promise<TraktMovieWithStats[]> {
  const result = await traktPublicRequest<TraktMovieWithStats[]>('/movies/anticipated', {
    limit: 50,
    ...options,
  })
  return result ?? []
}

/**
 * Get recommended movies for a user (requires authentication)
 */
export async function getRecommendedMovies(
  userId: string,
  options: TraktDiscoveryOptions = {}
): Promise<TraktRecommendedMovie[]> {
  const tokens = await getUserTraktTokens(userId)
  if (!tokens) {
    logger.debug({ userId }, 'No Trakt tokens - cannot get recommendations')
    return []
  }

  const result = await traktAuthRequest<TraktRecommendedMovie[]>(
    '/recommendations/movies',
    tokens.accessToken,
    { limit: 50, ...options }
  )
  return result ?? []
}

/**
 * Get movies related to a specific movie
 */
export async function getRelatedMovies(
  traktIdOrSlug: string | number,
  options: TraktDiscoveryOptions = {}
): Promise<TraktMovie[]> {
  const result = await traktPublicRequest<TraktMovie[]>(
    `/movies/${traktIdOrSlug}/related`,
    { limit: 20, ...options }
  )
  return result ?? []
}

// ============================================================================
// TV Series Discovery Functions
// ============================================================================

/**
 * Get trending TV shows (currently being watched by users)
 */
export async function getTrendingShows(
  options: TraktDiscoveryOptions = {}
): Promise<TraktShowWithStats[]> {
  const result = await traktPublicRequest<TraktShowWithStats[]>('/shows/trending', {
    limit: 50,
    ...options,
  })
  return result ?? []
}

/**
 * Get popular TV shows (most watched overall)
 */
export async function getPopularShows(
  options: TraktDiscoveryOptions = {}
): Promise<TraktShow[]> {
  const result = await traktPublicRequest<TraktShow[]>('/shows/popular', {
    limit: 50,
    ...options,
  })
  return result ?? []
}

/**
 * Get most watched TV shows
 */
export async function getMostWatchedShows(
  options: TraktDiscoveryOptions = {}
): Promise<TraktShowWithStats[]> {
  const result = await traktPublicRequest<TraktShowWithStats[]>('/shows/watched/' + (options.period || 'weekly'), {
    limit: 50,
    ...options,
  })
  return result ?? []
}

/**
 * Get most anticipated TV shows (upcoming, most list adds)
 */
export async function getAnticipatedShows(
  options: TraktDiscoveryOptions = {}
): Promise<TraktShowWithStats[]> {
  const result = await traktPublicRequest<TraktShowWithStats[]>('/shows/anticipated', {
    limit: 50,
    ...options,
  })
  return result ?? []
}

/**
 * Get recommended TV shows for a user (requires authentication)
 */
export async function getRecommendedShows(
  userId: string,
  options: TraktDiscoveryOptions = {}
): Promise<TraktRecommendedShow[]> {
  const tokens = await getUserTraktTokens(userId)
  if (!tokens) {
    logger.debug({ userId }, 'No Trakt tokens - cannot get recommendations')
    return []
  }

  const result = await traktAuthRequest<TraktRecommendedShow[]>(
    '/recommendations/shows',
    tokens.accessToken,
    { limit: 50, ...options }
  )
  return result ?? []
}

/**
 * Get shows related to a specific show
 */
export async function getRelatedShows(
  traktIdOrSlug: string | number,
  options: TraktDiscoveryOptions = {}
): Promise<TraktShow[]> {
  const result = await traktPublicRequest<TraktShow[]>(
    `/shows/${traktIdOrSlug}/related`,
    { limit: 20, ...options }
  )
  return result ?? []
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract TMDb ID from a Trakt movie
 */
export function extractMovieTmdbId(movie: TraktMovie): number | null {
  return movie.ids.tmdb ?? null
}

/**
 * Extract TMDb ID from a Trakt show
 */
export function extractShowTmdbId(show: TraktShow): number | null {
  return show.ids.tmdb ?? null
}

/**
 * Normalize a Trakt movie to a common format
 */
export function normalizeTraktMovie(movie: TraktMovie, stats?: { watchers?: number; list_count?: number }): {
  tmdbId: number | null
  imdbId: string | null
  title: string
  year: number
  popularity: number
} {
  return {
    tmdbId: movie.ids.tmdb ?? null,
    imdbId: movie.ids.imdb ?? null,
    title: movie.title,
    year: movie.year,
    popularity: stats?.watchers ?? stats?.list_count ?? 0,
  }
}

/**
 * Normalize a Trakt show to a common format
 */
export function normalizeTraktShow(show: TraktShow, stats?: { watchers?: number; list_count?: number }): {
  tmdbId: number | null
  imdbId: string | null
  tvdbId: number | null
  title: string
  year: number
  popularity: number
} {
  return {
    tmdbId: show.ids.tmdb ?? null,
    imdbId: show.ids.imdb ?? null,
    tvdbId: show.ids.tvdb ?? null,
    title: show.title,
    year: show.year,
    popularity: stats?.watchers ?? stats?.list_count ?? 0,
  }
}

