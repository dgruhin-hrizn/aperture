/**
 * Poster Repair Module
 * Identifies items with missing posters in Emby and fetches them from TMDB
 */

import { createChildLogger } from '../lib/logger.js'
import { getMediaServerProvider, getMediaServerApiKey } from '../index.js'
import { tmdbRequest, getImageUrl } from '../tmdb/client.js'
import { pushImageToMediaServer } from '../uploads/mediaServerSync.js'
import type { TMDbMovieDetails, TMDbTVDetails } from '../tmdb/types.js'

const logger = createChildLogger('poster-repair')

export interface MissingPosterItem {
  id: string           // Emby item ID
  title: string
  year: number | null
  type: 'movie' | 'series'
  tmdbId: string | null
  imdbId: string | null
  hasBackdrop: boolean
}

export interface RepairResult {
  id: string
  title: string
  success: boolean
  error?: string
}

export interface ScanResult {
  movies: MissingPosterItem[]
  series: MissingPosterItem[]
  totalMissing: number
  scannedAt: string
}

interface EmbyItemWithImageTags {
  Id: string
  Name: string
  ProductionYear?: number
  Type: string
  ProviderIds?: {
    Imdb?: string
    Tmdb?: string
    [key: string]: string | undefined
  }
  ImageTags?: {
    Primary?: string
    Backdrop?: string
  }
  BackdropImageTags?: string[]
}

interface EmbyItemsResponse {
  Items: EmbyItemWithImageTags[]
  TotalRecordCount: number
}

/**
 * Scan Emby for items with missing Primary (poster) images
 */
export async function scanMissingPosters(): Promise<ScanResult> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('Media server API key not configured')
  }

  logger.info('Starting scan for missing posters')

  const movies: MissingPosterItem[] = []
  const series: MissingPosterItem[] = []

  // Scan movies
  logger.info('Scanning movies for missing posters...')
  let startIndex = 0
  const pageSize = 500

  while (true) {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Movie',
      Recursive: 'true',
      Fields: 'ProviderIds,ImageTags,BackdropImageTags,ProductionYear',
      StartIndex: String(startIndex),
      Limit: String(pageSize),
    })

    const url = `${provider.baseUrl}/Items?${params}`
    const response = await fetch(url, {
      headers: {
        'X-Emby-Authorization': `MediaBrowser Client="Aperture", Device="Aperture Server", DeviceId="aperture-server", Version="1.0.0", Token="${apiKey}"`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch movies: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as EmbyItemsResponse

    for (const item of data.Items) {
      // Check if Primary image is missing
      if (!item.ImageTags?.Primary) {
        movies.push({
          id: item.Id,
          title: item.Name,
          year: item.ProductionYear ?? null,
          type: 'movie',
          tmdbId: item.ProviderIds?.Tmdb ?? null,
          imdbId: item.ProviderIds?.Imdb ?? null,
          hasBackdrop: !!(item.ImageTags?.Backdrop || (item.BackdropImageTags && item.BackdropImageTags.length > 0)),
        })
      }
    }

    startIndex += data.Items.length
    if (startIndex >= data.TotalRecordCount) {
      break
    }
  }

  logger.info({ count: movies.length }, 'Found movies with missing posters')

  // Scan series
  logger.info('Scanning series for missing posters...')
  startIndex = 0

  while (true) {
    const params = new URLSearchParams({
      IncludeItemTypes: 'Series',
      Recursive: 'true',
      Fields: 'ProviderIds,ImageTags,BackdropImageTags,ProductionYear',
      StartIndex: String(startIndex),
      Limit: String(pageSize),
    })

    const url = `${provider.baseUrl}/Items?${params}`
    const response = await fetch(url, {
      headers: {
        'X-Emby-Authorization': `MediaBrowser Client="Aperture", Device="Aperture Server", DeviceId="aperture-server", Version="1.0.0", Token="${apiKey}"`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch series: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as EmbyItemsResponse

    for (const item of data.Items) {
      // Check if Primary image is missing
      if (!item.ImageTags?.Primary) {
        series.push({
          id: item.Id,
          title: item.Name,
          year: item.ProductionYear ?? null,
          type: 'series',
          tmdbId: item.ProviderIds?.Tmdb ?? null,
          imdbId: item.ProviderIds?.Imdb ?? null,
          hasBackdrop: !!(item.ImageTags?.Backdrop || (item.BackdropImageTags && item.BackdropImageTags.length > 0)),
        })
      }
    }

    startIndex += data.Items.length
    if (startIndex >= data.TotalRecordCount) {
      break
    }
  }

  logger.info({ count: series.length }, 'Found series with missing posters')

  const result: ScanResult = {
    movies,
    series,
    totalMissing: movies.length + series.length,
    scannedAt: new Date().toISOString(),
  }

  logger.info({ totalMissing: result.totalMissing }, 'Scan complete')

  return result
}

/**
 * Fetch poster image from TMDB and return as buffer
 * Images are streamed directly to memory - no disk storage
 */
async function fetchPosterFromTmdb(
  posterPath: string,
  size: 'w500' | 'original' = 'original'
): Promise<Buffer | null> {
  const imageUrl = getImageUrl(posterPath, size)
  if (!imageUrl) return null

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      logger.warn({ posterPath, status: response.status }, 'Failed to fetch poster from TMDB')
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    logger.error({ err, posterPath }, 'Error fetching poster from TMDB')
    return null
  }
}

/**
 * Repair a single item by fetching poster from TMDB and pushing to Emby
 */
async function repairSingleItem(item: MissingPosterItem): Promise<RepairResult> {
  const { id, title, type, tmdbId } = item

  if (!tmdbId) {
    return {
      id,
      title,
      success: false,
      error: 'No TMDB ID available',
    }
  }

  try {
    // Get poster path from TMDB
    let posterPath: string | null = null

    if (type === 'movie') {
      const details = await tmdbRequest<TMDbMovieDetails>(`/movie/${tmdbId}`)
      posterPath = details?.poster_path ?? null
    } else {
      const details = await tmdbRequest<TMDbTVDetails>(`/tv/${tmdbId}`)
      posterPath = details?.poster_path ?? null
    }

    if (!posterPath) {
      return {
        id,
        title,
        success: false,
        error: 'No poster available on TMDB',
      }
    }

    // Fetch poster image into memory buffer (no disk storage)
    const imageBuffer = await fetchPosterFromTmdb(posterPath, 'original')
    if (!imageBuffer) {
      return {
        id,
        title,
        success: false,
        error: 'Failed to download poster from TMDB',
      }
    }

    // Determine MIME type from poster path
    const mimeType = posterPath.endsWith('.png') ? 'image/png' : 'image/jpeg'

    // Push directly to Emby (buffer is discarded after this)
    const result = await pushImageToMediaServer(id, 'Primary', imageBuffer, mimeType)

    if (!result.success) {
      return {
        id,
        title,
        success: false,
        error: result.error || 'Failed to push image to media server',
      }
    }

    logger.info({ id, title, type }, 'Successfully repaired poster')

    return {
      id,
      title,
      success: true,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err, id, title }, 'Error repairing poster')

    return {
      id,
      title,
      success: false,
      error: errorMessage,
    }
  }
}

export interface RepairProgress {
  total: number
  completed: number
  successful: number
  failed: number
  results: RepairResult[]
}

/**
 * Repair posters for selected items
 * Fetches from TMDB and pushes directly to Emby (no local storage)
 */
export async function repairPosters(
  items: MissingPosterItem[],
  onProgress?: (progress: RepairProgress) => void
): Promise<RepairProgress> {
  const progress: RepairProgress = {
    total: items.length,
    completed: 0,
    successful: 0,
    failed: 0,
    results: [],
  }

  logger.info({ total: items.length }, 'Starting poster repair')

  for (const item of items) {
    const result = await repairSingleItem(item)
    progress.results.push(result)
    progress.completed++

    if (result.success) {
      progress.successful++
    } else {
      progress.failed++
    }

    onProgress?.(progress)

    // Small delay to respect TMDB rate limits
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  logger.info(
    { total: progress.total, successful: progress.successful, failed: progress.failed },
    'Poster repair complete'
  )

  return progress
}

