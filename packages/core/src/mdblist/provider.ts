/**
 * MDBList API Provider
 * Handles API requests, configuration, and rate limiting
 */

import { createChildLogger } from '../lib/logger.js'
import { getSystemSetting, setSystemSetting } from '../settings/systemSettings.js'
import {
  MDBLIST_API_BASE_URL,
  type MDBListConfig,
  type MDBListUserInfo,
  type MDBListMediaInfo,
  type MDBListItem,
  type MDBListListInfo,
  type MDBListSearchResult,
  type MDBListEnrichmentData,
} from './types.js'

const logger = createChildLogger('mdblist')

// ============================================================================
// Rate Limiting
// ============================================================================

// Rate limits per tier (requests per second)
const RATE_LIMIT_FREE_MS = 100 // 10 req/sec (conservative for 1k/day)
const RATE_LIMIT_SUPPORTER_MS = 25 // 40 req/sec
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Cached tier status
let cachedSupporterTier: boolean | null = null
let lastTierCheck = 0
const TIER_CHECK_INTERVAL_MS = 60000

// Simple rate limiter
let lastRequestTime = 0

async function getRateLimitDelay(): Promise<number> {
  const now = Date.now()
  if (cachedSupporterTier === null || now - lastTierCheck > TIER_CHECK_INTERVAL_MS) {
    cachedSupporterTier = await isMDBListSupporterTier()
    lastTierCheck = now
    if (cachedSupporterTier) {
      logger.debug('MDBList supporter tier detected - using faster rate limit')
    }
  }
  return cachedSupporterTier ? RATE_LIMIT_SUPPORTER_MS : RATE_LIMIT_FREE_MS
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

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Get MDBList configuration
 */
export async function getMDBListConfig(): Promise<MDBListConfig> {
  const apiKey = await getSystemSetting('mdblist_api_key')
  const enabled = await getSystemSetting('mdblist_enabled')
  const supporterTier = await getSystemSetting('mdblist_supporter_tier')

  return {
    apiKey: apiKey || null,
    enabled: enabled !== 'false' && !!apiKey,
    hasApiKey: !!apiKey,
    supporterTier: supporterTier === 'true',
  }
}

/**
 * Get MDBList API key
 */
export async function getMDBListApiKey(): Promise<string | null> {
  return await getSystemSetting('mdblist_api_key')
}

/**
 * Set MDBList configuration
 */
export async function setMDBListConfig(config: {
  apiKey?: string
  enabled?: boolean
  supporterTier?: boolean
}): Promise<MDBListConfig> {
  if (config.apiKey !== undefined) {
    await setSystemSetting(
      'mdblist_api_key',
      config.apiKey,
      'MDBList API key for rankings and metadata enrichment'
    )
  }
  if (config.enabled !== undefined) {
    await setSystemSetting('mdblist_enabled', String(config.enabled), 'Enable MDBList integration')
  }
  if (config.supporterTier !== undefined) {
    await setSystemSetting(
      'mdblist_supporter_tier',
      String(config.supporterTier),
      'Whether using MDBList supporter tier (higher rate limits)'
    )
  }
  logger.info('MDBList config updated')
  // Clear cached tier status
  cachedSupporterTier = null
  return getMDBListConfig()
}

/**
 * Check if user has MDBList supporter tier
 */
export async function isMDBListSupporterTier(): Promise<boolean> {
  const supporterTier = await getSystemSetting('mdblist_supporter_tier')
  return supporterTier === 'true'
}

// ============================================================================
// API Requests
// ============================================================================

interface MDBListRequestOptions {
  apiKey?: string
}

/**
 * Make a rate-limited request to the MDBList API
 */
async function mdblistRequest<T>(
  endpoint: string,
  options: MDBListRequestOptions = {}
): Promise<T | null> {
  const apiKey = options.apiKey || (await getMDBListApiKey())

  if (!apiKey) {
    logger.warn('MDBList API key not configured')
    return null
  }

  // Add API key to URL
  const url = new URL(endpoint, MDBLIST_API_BASE_URL)
  url.searchParams.set('apikey', apiKey)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await rateLimit()

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
      })

      if (response.status === 429) {
        // Rate limit hit
        const retryAfter = response.headers.get('Retry-After')
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAY_MS * attempt
        logger.warn({ attempt, waitMs }, 'MDBList rate limit hit, waiting...')
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        continue
      }

      if (!response.ok) {
        logger.error({ status: response.status, endpoint }, 'MDBList API request failed')
        return null
      }

      return (await response.json()) as T
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        logger.error({ err, endpoint }, 'MDBList API request failed after retries')
        return null
      }
      logger.warn({ err, attempt, endpoint }, 'MDBList API request failed, retrying...')
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
    }
  }

  return null
}

// ============================================================================
// User & Connection Testing
// ============================================================================

/**
 * Test MDBList API connection and get user info
 */
export async function testMDBListConnection(
  apiKey?: string
): Promise<{ success: boolean; userInfo?: MDBListUserInfo; error?: string }> {
  try {
    const key = apiKey || (await getMDBListApiKey())
    if (!key) {
      return { success: false, error: 'No API key configured' }
    }

    const userInfo = await mdblistRequest<MDBListUserInfo>('/user', { apiKey: key })

    if (!userInfo) {
      return { success: false, error: 'Failed to connect to MDBList API' }
    }

    return { success: true, userInfo }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.warn({ err }, 'MDBList connection test failed')
    return { success: false, error }
  }
}

// ============================================================================
// Lists API
// ============================================================================

/**
 * Get top/popular public lists
 */
export async function getTopLists(mediatype?: 'movie' | 'show'): Promise<MDBListListInfo[]> {
  const endpoint = mediatype ? `/lists/top?mediatype=${mediatype}` : '/lists/top'
  const result = await mdblistRequest<MDBListListInfo[]>(endpoint)
  return result || []
}

/**
 * Search public lists
 */
export async function searchLists(
  query: string,
  mediatype?: 'movie' | 'show'
): Promise<MDBListSearchResult[]> {
  let endpoint = `/lists/search?query=${encodeURIComponent(query)}`
  if (mediatype) {
    endpoint += `&mediatype=${mediatype}`
  }
  const result = await mdblistRequest<MDBListSearchResult[]>(endpoint)
  return result || []
}

/**
 * Get list info by ID
 */
export async function getListInfo(listId: number): Promise<MDBListListInfo | null> {
  return mdblistRequest<MDBListListInfo>(`/lists/${listId}`)
}

/**
 * Get items from a list
 */
export async function getListItems(
  listId: number,
  options: { limit?: number; offset?: number } = {}
): Promise<MDBListItem[]> {
  let endpoint = `/lists/${listId}/items`
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.offset) params.set('offset', String(options.offset))

  if (params.toString()) {
    endpoint += `?${params.toString()}`
  }

  const result = await mdblistRequest<MDBListItem[]>(endpoint)
  return result || []
}

/**
 * Get user's own lists
 */
export async function getMyLists(): Promise<MDBListListInfo[]> {
  const result = await mdblistRequest<MDBListListInfo[]>('/lists/user')
  return result || []
}

// ============================================================================
// Media Info API
// ============================================================================

/**
 * Get media info by IMDB ID
 */
export async function getMediaInfoByImdb(imdbId: string): Promise<MDBListMediaInfo | null> {
  return mdblistRequest<MDBListMediaInfo>(`/?i=${imdbId}`)
}

/**
 * Get media info by TMDB ID
 */
export async function getMediaInfoByTmdb(
  tmdbId: number,
  mediatype: 'movie' | 'show'
): Promise<MDBListMediaInfo | null> {
  const type = mediatype === 'movie' ? 'movie' : 'show'
  return mdblistRequest<MDBListMediaInfo>(`/?tm=${tmdbId}&m=${type}`)
}

/**
 * Get media info by TVDB ID
 */
export async function getMediaInfoByTvdb(tvdbId: number): Promise<MDBListMediaInfo | null> {
  return mdblistRequest<MDBListMediaInfo>(`/?tv=${tvdbId}`)
}

/**
 * Batch get media info by IMDB IDs (up to 200 at a time)
 */
export async function getMediaInfoBatch(imdbIds: string[]): Promise<MDBListMediaInfo[]> {
  if (imdbIds.length === 0) return []

  // API supports up to 200 items per request
  const batchSize = 200
  const results: MDBListMediaInfo[] = []

  for (let i = 0; i < imdbIds.length; i += batchSize) {
    const batch = imdbIds.slice(i, i + batchSize)
    const idsParam = batch.join(',')
    const batchResult = await mdblistRequest<MDBListMediaInfo[]>(`/?i=${idsParam}`)
    if (batchResult) {
      results.push(...batchResult)
    }
  }

  return results
}

// ============================================================================
// Data Extraction Helpers
// ============================================================================

/**
 * Extract enrichment data from MDBList media info
 */
export function extractEnrichmentData(info: MDBListMediaInfo): MDBListEnrichmentData {
  // Extract ratings by source
  let letterboxdScore: number | null = null
  let rtCriticScore: number | null = null
  let rtAudienceScore: number | null = null
  let metacriticScore: number | null = null

  if (info.ratings) {
    for (const rating of info.ratings) {
      if (rating.source === 'letterboxd' && rating.value !== null) {
        letterboxdScore = rating.value
      } else if (rating.source === 'tomatoes' && rating.score !== null) {
        rtCriticScore = rating.score
      } else if (rating.source === 'tomatoesaudience' && rating.score !== null) {
        rtAudienceScore = rating.score
      } else if (rating.source === 'metacritic' && rating.score !== null) {
        metacriticScore = rating.score
      }
    }
  }

  // Extract streaming providers
  const streamingProviders = (info.watch_providers || info.streams || []).map((p) => ({
    id: p.id,
    name: p.name,
  }))

  // Extract keywords
  const keywords = (info.keywords || []).map((k) => k.name)

  return {
    letterboxdScore,
    mdblistScore: info.score || null,
    rtCriticScore,
    rtAudienceScore,
    metacriticScore,
    streamingProviders,
    keywords,
  }
}

/**
 * Check if MDBList is configured and enabled
 */
export async function isMDBListConfigured(): Promise<boolean> {
  const config = await getMDBListConfig()
  return config.enabled && config.hasApiKey
}
