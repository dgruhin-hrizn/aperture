/**
 * Jellyseerr API Provider
 * 
 * Handles communication with Jellyseerr for content requests
 * Uses API Key authentication (admin-configured)
 */

import { createChildLogger } from '../lib/logger.js'
import { getSystemSetting, setSystemSetting } from '../settings/systemSettings.js'
import type {
  JellyseerrConfig,
  JellyseerrSearchResult,
  JellyseerrSearchItem,
  JellyseerrMovieDetails,
  JellyseerrTVDetails,
  JellyseerrMediaInfo,
  JellyseerrRequestBody,
  JellyseerrRequestResponse,
  JellyseerrMediaStatus,
  JellyseerrRequestStatus,
} from './types.js'

const logger = createChildLogger('jellyseerr')

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get Jellyseerr configuration from system settings
 */
export async function getJellyseerrConfig(): Promise<JellyseerrConfig | null> {
  const url = await getSystemSetting('jellyseerr_url')
  const apiKey = await getSystemSetting('jellyseerr_api_key')
  const enabled = await getSystemSetting('jellyseerr_enabled')

  if (!url || !apiKey) {
    return null
  }

  return {
    url: url.replace(/\/$/, ''), // Remove trailing slash
    apiKey,
    enabled: enabled === 'true',
  }
}

/**
 * Set Jellyseerr configuration in system settings
 */
export async function setJellyseerrConfig(config: Partial<JellyseerrConfig>): Promise<void> {
  if (config.url !== undefined) {
    await setSystemSetting('jellyseerr_url', config.url.replace(/\/$/, ''))
  }
  if (config.apiKey !== undefined) {
    await setSystemSetting('jellyseerr_api_key', config.apiKey)
  }
  if (config.enabled !== undefined) {
    await setSystemSetting('jellyseerr_enabled', String(config.enabled))
  }
}

/**
 * Check if Jellyseerr is configured and enabled
 */
export async function isJellyseerrConfigured(): Promise<boolean> {
  const config = await getJellyseerrConfig()
  return config !== null && config.enabled && !!config.apiKey
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Make a request to the Jellyseerr API
 */
async function jellyseerrRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: Record<string, unknown>
    config?: JellyseerrConfig
  } = {}
): Promise<T | null> {
  const config = options.config || await getJellyseerrConfig()
  
  if (!config) {
    logger.warn('Jellyseerr not configured')
    return null
  }

  const url = `${config.url}/api/v1${endpoint}`
  
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      logger.error({ status: response.status, endpoint, error: errorText }, 'Jellyseerr API request failed')
      return null
    }

    return (await response.json()) as T
  } catch (err) {
    logger.error({ err, endpoint }, 'Jellyseerr API request error')
    return null
  }
}

/**
 * Test connection to Jellyseerr
 */
export async function testJellyseerrConnection(config?: JellyseerrConfig): Promise<{
  success: boolean
  message?: string
  serverName?: string
}> {
  const testConfig = config || await getJellyseerrConfig()
  
  if (!testConfig) {
    return { success: false, message: 'Jellyseerr not configured' }
  }

  try {
    const response = await fetch(`${testConfig.url}/api/v1/settings/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': testConfig.apiKey,
      },
    })

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid API key' }
      }
      return { success: false, message: `Server returned ${response.status}` }
    }

    const data = await response.json() as { applicationTitle?: string }
    return {
      success: true,
      message: 'Connected successfully',
      serverName: data.applicationTitle,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return { success: false, message }
  }
}

// ============================================================================
// Search & Media Info
// ============================================================================

/**
 * Search for movies and TV shows
 */
export async function searchContent(
  query: string,
  page: number = 1
): Promise<JellyseerrSearchResult | null> {
  return jellyseerrRequest<JellyseerrSearchResult>(
    `/search?query=${encodeURIComponent(query)}&page=${page}`
  )
}

/**
 * Get movie details by TMDb ID
 */
export async function getMovieDetails(tmdbId: number): Promise<JellyseerrMovieDetails | null> {
  return jellyseerrRequest<JellyseerrMovieDetails>(`/movie/${tmdbId}`)
}

/**
 * Get TV show details by TMDb ID
 */
export async function getTVDetails(tmdbId: number): Promise<JellyseerrTVDetails | null> {
  return jellyseerrRequest<JellyseerrTVDetails>(`/tv/${tmdbId}`)
}

/**
 * Get media status (availability and request info)
 */
export async function getMediaStatus(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<{
  exists: boolean
  status: 'unknown' | 'pending' | 'processing' | 'partially_available' | 'available'
  requested: boolean
  requestStatus?: 'pending' | 'approved' | 'declined'
  requestId?: number
} | null> {
  const details = mediaType === 'movie' 
    ? await getMovieDetails(tmdbId)
    : await getTVDetails(tmdbId)

  if (!details) {
    return null
  }

  const mediaInfo = details.mediaInfo
  
  if (!mediaInfo) {
    return {
      exists: false,
      status: 'unknown',
      requested: false,
    }
  }

  const statusMap: Record<number, 'unknown' | 'pending' | 'processing' | 'partially_available' | 'available'> = {
    1: 'unknown',
    2: 'pending',
    3: 'processing',
    4: 'partially_available',
    5: 'available',
  }

  const requestStatusMap: Record<number, 'pending' | 'approved' | 'declined'> = {
    1: 'pending',
    2: 'approved',
    3: 'declined',
  }

  const latestRequest = mediaInfo.requests?.[0]

  return {
    exists: mediaInfo.status >= 4,
    status: statusMap[mediaInfo.status] ?? 'unknown',
    requested: !!latestRequest,
    requestStatus: latestRequest ? requestStatusMap[latestRequest.status] : undefined,
    requestId: latestRequest?.id,
  }
}

// ============================================================================
// Request Management
// ============================================================================

/**
 * Create a new content request
 */
export async function createRequest(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  options: {
    seasons?: number[] // For TV shows
    is4k?: boolean
  } = {}
): Promise<{
  success: boolean
  requestId?: number
  message?: string
}> {
  const body: JellyseerrRequestBody = {
    mediaType,
    mediaId: tmdbId,
    is4k: options.is4k,
  }

  // For TV shows, Jellyseerr requires the seasons array
  // If not provided, fetch the show details and request all seasons
  if (mediaType === 'tv') {
    if (options.seasons && options.seasons.length > 0) {
      body.seasons = options.seasons
    } else {
      // Fetch TV details to get the number of seasons
      const tvDetails = await getTVDetails(tmdbId)
      if (tvDetails && tvDetails.numberOfSeasons && tvDetails.numberOfSeasons > 0) {
        // Request all seasons (1 through numberOfSeasons)
        body.seasons = Array.from({ length: tvDetails.numberOfSeasons }, (_, i) => i + 1)
        logger.info({ tmdbId, seasons: body.seasons }, 'Requesting all seasons for TV show')
      } else {
        // Fallback: request season 1 if we can't determine the number of seasons
        body.seasons = [1]
        logger.warn({ tmdbId }, 'Could not determine number of seasons, requesting season 1 only')
      }
    }
  }

  const result = await jellyseerrRequest<JellyseerrRequestResponse>('/request', {
    method: 'POST',
    body: body as unknown as Record<string, unknown>,
  })

  if (!result) {
    return { success: false, message: 'Failed to create request' }
  }

  return {
    success: true,
    requestId: result.id,
    message: 'Request created successfully',
  }
}

/**
 * Get a specific request by ID
 */
export async function getRequest(requestId: number): Promise<JellyseerrRequestResponse | null> {
  return jellyseerrRequest<JellyseerrRequestResponse>(`/request/${requestId}`)
}

/**
 * Get request status
 */
export async function getRequestStatus(requestId: number): Promise<{
  status: 'pending' | 'approved' | 'declined'
  mediaStatus: 'unknown' | 'pending' | 'processing' | 'partially_available' | 'available'
} | null> {
  const request = await getRequest(requestId)
  
  if (!request) {
    return null
  }

  const requestStatusMap: Record<number, 'pending' | 'approved' | 'declined'> = {
    1: 'pending',
    2: 'approved',
    3: 'declined',
  }

  const mediaStatusMap: Record<number, 'unknown' | 'pending' | 'processing' | 'partially_available' | 'available'> = {
    1: 'unknown',
    2: 'pending',
    3: 'processing',
    4: 'partially_available',
    5: 'available',
  }

  return {
    status: requestStatusMap[request.status] ?? 'pending',
    mediaStatus: mediaStatusMap[request.media.status] ?? 'unknown',
  }
}

/**
 * Delete/cancel a request
 */
export async function deleteRequest(requestId: number): Promise<boolean> {
  const result = await jellyseerrRequest<{ success: boolean }>(`/request/${requestId}`, {
    method: 'DELETE',
  })

  return result !== null
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Check media status for multiple TMDb IDs
 */
export async function batchGetMediaStatus(
  items: { tmdbId: number; mediaType: 'movie' | 'tv' }[]
): Promise<Map<number, {
  exists: boolean
  status: string
  requested: boolean
}>> {
  const results = new Map<number, { exists: boolean; status: string; requested: boolean }>()

  // Process in parallel with rate limiting
  const batchSize = 5
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    const batchResults = await Promise.all(
      batch.map(async item => {
        const status = await getMediaStatus(item.tmdbId, item.mediaType)
        return { tmdbId: item.tmdbId, status }
      })
    )

    for (const { tmdbId, status } of batchResults) {
      if (status) {
        results.set(tmdbId, {
          exists: status.exists,
          status: status.status,
          requested: status.requested,
        })
      }
    }

    // Small delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

