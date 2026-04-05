/**
 * Seerr API Provider
 * 
 * Handles communication with Seerr for content requests
 * Uses API Key authentication (admin-configured)
 */

import { createChildLogger } from '../lib/logger.js'
import { getSystemSetting, setSystemSetting } from '../settings/systemSettings.js'
import type {
  SeerrConfig,
  SeerrSearchResult,
  SeerrSearchItem,
  SeerrMovieDetails,
  SeerrTVDetails,
  SeerrMediaInfo,
  SeerrRequestBody,
  SeerrRequestResponse,
  SeerrMediaStatus,
  SeerrRequestStatus,
  SeerrUser,
  SeerrUserListResponse,
  SeerrRadarrServerSummary,
  SeerrSonarrServerSummary,
  SeerrRadarrServerDetailsResponse,
  SeerrSonarrServerDetailsResponse,
  SeerrCreateRequestOptions,
} from './types.js'
import {
  matchApertureProfileToSeerrUser,
  type ApertureUserProfileForSeerr,
} from './userMapping.js'

const logger = createChildLogger('seerr')

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get Seerr configuration from system settings
 */
export async function getSeerrConfig(): Promise<SeerrConfig | null> {
  const url = await getSystemSetting('seerr_url')
  const apiKey = await getSystemSetting('seerr_api_key')
  const enabled = await getSystemSetting('seerr_enabled')

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
 * Set Seerr configuration in system settings
 */
export async function setSeerrConfig(config: Partial<SeerrConfig>): Promise<void> {
  if (config.url !== undefined) {
    await setSystemSetting('seerr_url', config.url.replace(/\/$/, ''))
  }
  if (config.apiKey !== undefined) {
    await setSystemSetting('seerr_api_key', config.apiKey)
  }
  if (config.enabled !== undefined) {
    await setSystemSetting('seerr_enabled', String(config.enabled))
  }
}

/**
 * Check if Seerr is configured and enabled
 */
export async function isSeerrConfigured(): Promise<boolean> {
  const config = await getSeerrConfig()
  return config !== null && config.enabled && !!config.apiKey
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Make a request to the Seerr API
 */
async function seerrRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: Record<string, unknown>
    config?: SeerrConfig
  } = {}
): Promise<T | null> {
  const config = options.config || await getSeerrConfig()
  
  if (!config) {
    logger.warn('Seerr not configured')
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
      logger.error({ status: response.status, endpoint, error: errorText }, 'Seerr API request failed')
      return null
    }

    return (await response.json()) as T
  } catch (err) {
    logger.error({ err, endpoint }, 'Seerr API request error')
    return null
  }
}

/**
 * Test connection to Seerr
 */
export async function testSeerrConnection(config?: SeerrConfig): Promise<{
  success: boolean
  message?: string
  serverName?: string
}> {
  const testConfig = config || await getSeerrConfig()
  
  if (!testConfig) {
    return { success: false, message: 'Seerr not configured' }
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
): Promise<SeerrSearchResult | null> {
  return seerrRequest<SeerrSearchResult>(
    `/search?query=${encodeURIComponent(query)}&page=${page}`
  )
}

/**
 * Get movie details by TMDb ID
 */
export async function getMovieDetails(tmdbId: number): Promise<SeerrMovieDetails | null> {
  return seerrRequest<SeerrMovieDetails>(`/movie/${tmdbId}`)
}

/**
 * Get TV show details by TMDb ID
 */
export async function getTVDetails(tmdbId: number): Promise<SeerrTVDetails | null> {
  return seerrRequest<SeerrTVDetails>(`/tv/${tmdbId}`)
}

/** Jellyseerr / JSON may surface status as number or string; normalize for comparisons. */
function mediaStatusCode(s: unknown): number | undefined {
  if (s == null || s === '') return undefined
  const n = typeof s === 'number' ? s : Number(s)
  return Number.isFinite(n) ? n : undefined
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

  const status4k = mediaInfo.status4k
  const hd = mediaStatusCode(mediaInfo.status)
  const fourK = mediaStatusCode(status4k)
  const inLibrary = (s: number | undefined) => s != null && s >= 4
  const inPipeline = (s: number | undefined) => s === 2 || s === 3

  return {
    exists: inLibrary(hd) || inLibrary(fourK),
    status: statusMap[hd ?? 1] ?? 'unknown',
    requested:
      Boolean(mediaInfo.requests?.length) ||
      inPipeline(hd) ||
      inPipeline(fourK),
    requestStatus: latestRequest ? requestStatusMap[latestRequest.status] : undefined,
    requestId: latestRequest?.id,
  }
}

// ============================================================================
// Seerr users (for mapping Aperture user ↔ Seerr user id)
// ============================================================================

/**
 * Paginate GET /user until all Seerr users are loaded (admin API key).
 */
export async function listAllSeerrUsers(): Promise<SeerrUser[]> {
  const all: SeerrUser[] = []
  let skip = 0
  const take = 50
  while (true) {
    const res = await seerrRequest<SeerrUserListResponse>(
      `/user?take=${take}&skip=${skip}`
    )
    if (!res?.results?.length) break
    all.push(...res.results)
    skip += res.results.length
    const total = res.pageInfo?.results ?? skip
    if (skip >= total) break
    if (res.results.length < take) break
  }
  return all
}

/**
 * Resolve Seerr user id for an Aperture profile using GET /user (cached in DB by API).
 */
export async function resolveSeerrUserIdForProfile(
  profile: ApertureUserProfileForSeerr
): Promise<number | null> {
  const users = await listAllSeerrUsers()
  return matchApertureProfileToSeerrUser(profile, users)
}

// ============================================================================
// Radarr / Sonarr service lists (for request UI)
// ============================================================================

/**
 * List configured Radarr instances (GET /service/radarr).
 */
export async function listRadarrServers(): Promise<SeerrRadarrServerSummary[] | null> {
  return seerrRequest<SeerrRadarrServerSummary[]>('/service/radarr')
}

/**
 * Quality profiles and root folders for a Radarr server (GET /service/radarr/:id).
 */
export async function getRadarrServerDetails(radarrId: number): Promise<SeerrRadarrServerDetailsResponse | null> {
  return seerrRequest<SeerrRadarrServerDetailsResponse>(`/service/radarr/${radarrId}`)
}

/**
 * List configured Sonarr instances (GET /service/sonarr).
 */
export async function listSonarrServers(): Promise<SeerrSonarrServerSummary[] | null> {
  return seerrRequest<SeerrSonarrServerSummary[]>('/service/sonarr')
}

/**
 * Quality profiles, root folders, and language profiles for a Sonarr server (GET /service/sonarr/:id).
 */
export async function getSonarrServerDetails(sonarrId: number): Promise<SeerrSonarrServerDetailsResponse | null> {
  return seerrRequest<SeerrSonarrServerDetailsResponse>(`/service/sonarr/${sonarrId}`)
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
  options: SeerrCreateRequestOptions = {}
): Promise<{
  success: boolean
  requestId?: number
  message?: string
}> {
  const body: SeerrRequestBody = {
    mediaType,
    mediaId: tmdbId,
    is4k: options.is4k,
  }
  if (options.userId !== undefined) {
    body.userId = options.userId
  }
  if (options.rootFolder !== undefined) {
    body.rootFolder = options.rootFolder
  }
  if (options.profileId !== undefined) {
    body.profileId = options.profileId
  }
  if (options.serverId !== undefined) {
    body.serverId = options.serverId
  }
  if (options.languageProfileId !== undefined) {
    body.languageProfileId = options.languageProfileId
  }

  // For TV shows, Seerr requires the seasons array
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

  const result = await seerrRequest<SeerrRequestResponse>('/request', {
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
export async function getRequest(requestId: number): Promise<SeerrRequestResponse | null> {
  return seerrRequest<SeerrRequestResponse>(`/request/${requestId}`)
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
  const result = await seerrRequest<{ success: boolean }>(`/request/${requestId}`, {
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
      batch.map(async (item) => {
        const id = Number(item.tmdbId)
        if (!Number.isFinite(id)) {
          return { tmdbId: id, status: null }
        }
        const status = await getMediaStatus(id, item.mediaType)
        return { tmdbId: id, status }
      })
    )

    for (const { tmdbId, status } of batchResults) {
      if (status && Number.isFinite(tmdbId)) {
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

