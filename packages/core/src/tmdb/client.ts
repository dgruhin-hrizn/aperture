/**
 * TMDb API Client
 * Handles API requests with rate limiting and error handling
 */

import { createChildLogger } from '../lib/logger.js'
import { getTMDbApiKey } from '../settings/systemSettings.js'
import { TMDB_API_BASE_URL } from './types.js'

const logger = createChildLogger('tmdb')

// Rate limiting configuration
// TMDb allows ~50 requests per second, we use 25ms (~40/sec) to stay safe
const RATE_LIMIT_DELAY_MS = 25 // ~40 requests per second (TMDb allows ~50)
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Simple rate limiter
let lastRequestTime = 0

/**
 * Callback type for logging API calls during enrichment jobs
 */
export type ApiLogCallback = (
  service: 'tmdb' | 'omdb',
  endpoint: string,
  status: 'success' | 'error' | 'not_found',
  details?: string
) => void

async function rateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest))
  }
  lastRequestTime = Date.now()
}

/**
 * Make a rate-limited request to the TMDb API
 */
export async function tmdbRequest<T>(
  endpoint: string,
  options: { apiKey?: string; onLog?: ApiLogCallback } = {}
): Promise<T | null> {
  const apiKey = options.apiKey || (await getTMDbApiKey())
  const { onLog } = options
  
  if (!apiKey) {
    logger.warn('TMDb API key not configured')
    return null
  }

  const url = `${TMDB_API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await rateLimit()

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10)
        logger.warn({ retryAfter, attempt }, 'TMDb rate limit hit, waiting...')
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
        continue
      }

      if (response.status === 404) {
        // Not found is not an error, just return null
        onLog?.('tmdb', endpoint, 'not_found')
        return null
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        logger.error(
          { status: response.status, endpoint, error: errorText },
          'TMDb API request failed'
        )
        onLog?.('tmdb', endpoint, 'error', `HTTP ${response.status}`)
        return null
      }

      const data = (await response.json()) as T
      onLog?.('tmdb', endpoint, 'success')
      return data
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        logger.error({ err, endpoint }, 'TMDb API request failed after retries')
        onLog?.('tmdb', endpoint, 'error', err instanceof Error ? err.message : 'Unknown error')
        return null
      }
      logger.warn({ err, attempt, endpoint }, 'TMDb API request failed, retrying...')
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
    }
  }

  return null
}

/**
 * Get the full image URL for a TMDb image path
 */
export function getImageUrl(
  path: string | null,
  size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}

/**
 * Search for a movie by IMDB ID
 */
export async function findMovieByImdbId(
  imdbId: string,
  options: { onLog?: ApiLogCallback } = {}
): Promise<number | null> {
  interface FindResponse {
    movie_results?: { id: number }[]
  }

  const result = await tmdbRequest<FindResponse>(
    `/find/${imdbId}?external_source=imdb_id`,
    options
  )
  if (result && result.movie_results && result.movie_results.length > 0) {
    return result.movie_results[0].id
  }
  return null
}

/**
 * Search for a TV show by IMDB ID
 */
export async function findTVByImdbId(
  imdbId: string,
  options: { onLog?: ApiLogCallback } = {}
): Promise<number | null> {
  interface FindResponse {
    tv_results?: { id: number }[]
  }

  const result = await tmdbRequest<FindResponse>(
    `/find/${imdbId}?external_source=imdb_id`,
    options
  )
  if (result && result.tv_results && result.tv_results.length > 0) {
    return result.tv_results[0].id
  }
  return null
}

/**
 * Search for a TV show by TVDB ID
 */
export async function findTVByTvdbId(
  tvdbId: string,
  options: { onLog?: ApiLogCallback } = {}
): Promise<number | null> {
  interface FindResponse {
    tv_results?: { id: number }[]
  }

  const result = await tmdbRequest<FindResponse>(
    `/find/${tvdbId}?external_source=tvdb_id`,
    options
  )
  if (result && result.tv_results && result.tv_results.length > 0) {
    return result.tv_results[0].id
  }
  return null
}

