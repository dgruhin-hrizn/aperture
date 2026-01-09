/**
 * OMDb API Client
 * Handles API requests with rate limiting and error handling
 */

import { createChildLogger } from '../lib/logger.js'
import { getOMDbApiKey } from '../settings/systemSettings.js'
import { OMDB_API_BASE_URL } from './types.js'
import type { OMDbMovieResponse } from './types.js'

const logger = createChildLogger('omdb')

// Rate limiting configuration
// OMDb free tier: 1,000 requests/day, paid: unlimited
// We'll be conservative with ~10 requests/second
const RATE_LIMIT_DELAY_MS = 100
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Simple rate limiter
let lastRequestTime = 0

async function rateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest))
  }
  lastRequestTime = Date.now()
}

/**
 * Make a rate-limited request to the OMDb API
 */
export async function omdbRequest(
  imdbId: string,
  options: { apiKey?: string } = {}
): Promise<OMDbMovieResponse | null> {
  const apiKey = options.apiKey || (await getOMDbApiKey())
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
        return null
      }

      const data = (await response.json()) as OMDbMovieResponse

      if (data.Response === 'False') {
        // Not found or error
        if (data.Error !== 'Movie not found!' && data.Error !== 'Incorrect IMDb ID.') {
          logger.warn({ imdbId, error: data.Error }, 'OMDb API error')
        }
        return null
      }

      return data
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        logger.error({ err, imdbId }, 'OMDb API request failed after retries')
        return null
      }
      logger.warn({ err, attempt, imdbId }, 'OMDb API request failed, retrying...')
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
    }
  }

  return null
}

