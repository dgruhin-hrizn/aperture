/**
 * OMDb API Client
 * Handles API requests with rate limiting and error handling
 *
 * Rate limits:
 * - Free tier: 1,000 requests/day → conservative 10 req/sec
 * - Paid tier: 100,000 requests/day → aggressive 40 req/sec
 */

import { createChildLogger } from '../lib/logger.js'
import { getOMDbApiKey, isOMDbPaidTier } from '../settings/systemSettings.js'
import { OMDB_API_BASE_URL } from './types.js'
import type { OMDbMovieResponse } from './types.js'
import type { ApiLogCallback } from '../tmdb/client.js'

const logger = createChildLogger('omdb')

// Rate limiting configuration
// Free tier: 1,000 requests/day → ~10 req/sec to be safe
// Paid tier: 100,000 requests/day → ~40 req/sec (could go higher but matching TMDb)
const RATE_LIMIT_FREE_MS = 100 // 10 requests/second
const RATE_LIMIT_PAID_MS = 25 // 40 requests/second
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Cached tier status (refreshed periodically)
let cachedPaidTier: boolean | null = null
let lastTierCheck = 0
const TIER_CHECK_INTERVAL_MS = 60000 // Re-check tier setting every minute

// Simple rate limiter with dynamic delay
let lastRequestTime = 0

async function getRateLimitDelay(): Promise<number> {
  const now = Date.now()
  // Refresh cached tier status periodically
  if (cachedPaidTier === null || now - lastTierCheck > TIER_CHECK_INTERVAL_MS) {
    cachedPaidTier = await isOMDbPaidTier()
    lastTierCheck = now
    if (cachedPaidTier) {
      logger.debug('OMDb paid tier detected - using faster rate limit')
    }
  }
  return cachedPaidTier ? RATE_LIMIT_PAID_MS : RATE_LIMIT_FREE_MS
}

async function rateLimit(): Promise<void> {
  const delay = await getRateLimitDelay()
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < delay) {
    await new Promise((resolve) => setTimeout(resolve, delay - timeSinceLastRequest))
  }
  lastRequestTime = Date.now()
}

/**
 * Make a rate-limited request to the OMDb API
 */
export async function omdbRequest(
  imdbId: string,
  options: { apiKey?: string; onLog?: ApiLogCallback } = {}
): Promise<OMDbMovieResponse | null> {
  const apiKey = options.apiKey || (await getOMDbApiKey())
  const { onLog } = options
  
  if (!apiKey) {
    logger.warn('OMDb API key not configured')
    return null
  }

  const url = `${OMDB_API_BASE_URL}/?apikey=${apiKey}&i=${imdbId}&plot=short`

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await rateLimit()

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        logger.error({ status: response.status, imdbId }, 'OMDb API request failed')
        onLog?.('omdb', imdbId, 'error', `HTTP ${response.status}`)
        return null
      }

      const data = (await response.json()) as OMDbMovieResponse

      if (data.Response === 'False') {
        // Not found or error
        if (data.Error !== 'Movie not found!' && data.Error !== 'Incorrect IMDb ID.') {
          logger.warn({ imdbId, error: data.Error }, 'OMDb API error')
        }
        onLog?.('omdb', imdbId, 'not_found')
        return null
      }

      // Build details string with ratings info
      const details: string[] = []
      const rtRating = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')
      if (rtRating) details.push(`RT: ${rtRating.Value}`)
      if (data.Metascore && data.Metascore !== 'N/A') details.push(`MC: ${data.Metascore}`)
      
      onLog?.('omdb', imdbId, 'success', details.length > 0 ? details.join(', ') : undefined)
      return data
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        logger.error({ err, imdbId }, 'OMDb API request failed after retries')
        onLog?.('omdb', imdbId, 'error', err instanceof Error ? err.message : 'Unknown error')
        return null
      }
      logger.warn({ err, attempt, imdbId }, 'OMDb API request failed, retrying...')
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
    }
  }

  return null
}


