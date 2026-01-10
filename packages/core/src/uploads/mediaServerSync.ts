/**
 * Media Server Image Sync
 * Pushes images to Emby/Jellyfin for libraries, collections, and playlists
 */

import fs from 'fs/promises'
import path from 'path'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'
import { createChildLogger } from '../lib/logger.js'
import { getEffectiveImage, getImageBuffer, type EntityType } from './index.js'

const logger = createChildLogger('media-server-image-sync')

export interface ImageSyncResult {
  success: boolean
  itemId: string
  imageType: string
  error?: string
}

/**
 * Build authorization header for Emby/Jellyfin
 */
function getAuthHeader(apiKey: string): string {
  return `MediaBrowser Client="Aperture", Device="Aperture Server", DeviceId="aperture-server", Version="1.0.0", Token="${apiKey}"`
}

/**
 * Push an image to the media server
 * Note: Emby expects base64-encoded image data, not raw binary
 */
export async function pushImageToMediaServer(
  itemId: string,
  imageType: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<ImageSyncResult> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    return {
      success: false,
      itemId,
      imageType,
      error: 'MEDIA_SERVER_API_KEY not set',
    }
  }

  try {
    // Emby/Jellyfin API: POST /Items/{itemId}/Images/{imageType}
    // The body must be base64-encoded
    const url = `${provider.baseUrl}/Items/${itemId}/Images/${imageType}`
    const base64Data = imageBuffer.toString('base64')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Emby-Authorization': getAuthHeader(apiKey),
        'Content-Type': mimeType,
      },
      body: base64Data,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    logger.info({ itemId, imageType }, 'Image pushed to media server')

    return {
      success: true,
      itemId,
      imageType,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err, itemId, imageType }, 'Failed to push image to media server')

    return {
      success: false,
      itemId,
      imageType,
      error: errorMessage,
    }
  }
}

/**
 * Delete an image from the media server
 */
export async function deleteImageFromMediaServer(
  itemId: string,
  imageType: string
): Promise<ImageSyncResult> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    return {
      success: false,
      itemId,
      imageType,
      error: 'MEDIA_SERVER_API_KEY not set',
    }
  }

  try {
    const url = `${provider.baseUrl}/Items/${itemId}/Images/${imageType}`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Emby-Authorization': getAuthHeader(apiKey),
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    logger.info({ itemId, imageType }, 'Image deleted from media server')

    return {
      success: true,
      itemId,
      imageType,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err, itemId, imageType }, 'Failed to delete image from media server')

    return {
      success: false,
      itemId,
      imageType,
      error: errorMessage,
    }
  }
}

/**
 * Sync an entity's effective image to the media server
 * This pushes either the user's custom image or the default to the media server
 */
export async function syncEntityImageToMediaServer(
  entityType: EntityType,
  entityId: string,
  imageType: string,
  userId?: string
): Promise<ImageSyncResult> {
  // Get the effective image (user override or default)
  const image = await getEffectiveImage(entityType, entityId, imageType, userId)

  if (!image) {
    // No image to sync - could optionally delete from media server
    logger.debug({ entityType, entityId, imageType }, 'No image to sync')
    return {
      success: true,
      itemId: entityId,
      imageType,
    }
  }

  // Read the image file
  const buffer = await getImageBuffer(image.filePath)

  if (!buffer) {
    return {
      success: false,
      itemId: entityId,
      imageType,
      error: 'Image file not found',
    }
  }

  // Push to media server
  return pushImageToMediaServer(entityId, imageType, buffer, image.mimeType)
}

/**
 * Sync all images for an entity to the media server
 */
export async function syncAllEntityImagesToMediaServer(
  entityType: EntityType,
  entityId: string,
  userId?: string
): Promise<ImageSyncResult[]> {
  const imageTypes = ['Primary', 'Backdrop', 'Banner']
  const results: ImageSyncResult[] = []

  for (const imageType of imageTypes) {
    const result = await syncEntityImageToMediaServer(entityType, entityId, imageType, userId)
    results.push(result)
  }

  return results
}

/**
 * Library type identifiers for global library images
 */
export type LibraryType = 'ai-recs-movies' | 'ai-recs-series' | 'top-picks-movies' | 'top-picks-series' | 'watching'

/**
 * Bundled default library images (relative to web app public folder or data directory)
 * These are used when no custom image has been uploaded
 */
const BUNDLED_LIBRARY_DEFAULTS: Record<LibraryType, string> = {
  'ai-recs-movies': 'AI_MOVIE_PICKS.png',
  'ai-recs-series': 'AI_SERIES_PICKS.png',
  'top-picks-movies': 'TOP_10_MOVIES_THIS_WEEK.png',
  'top-picks-series': 'TOP_10_SERIES_THIS_WEEKpng.png',
  'watching': 'Shows_You_Watch.png',
}

/**
 * Get possible paths for bundled default library images
 */
function getBundledImagePaths(filename: string): string[] {
  // Check multiple possible locations for bundled defaults
  const possiblePaths = [
    // Data directory (production - copied during build/deploy)
    path.join(process.env.DATA_DIR || '/data', 'library-defaults', filename),
    // Web app public directory (development)
    path.join(process.cwd(), 'apps/web/public', filename),
    // Relative to workspace root
    path.join(process.cwd(), '..', '..', 'apps/web/public', filename),
    // Docker volume mount location
    path.join('/app/apps/web/public', filename),
  ]
  return possiblePaths
}

/**
 * Try to read a bundled default image
 */
async function getBundledDefaultImage(libraryType: LibraryType): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const filename = BUNDLED_LIBRARY_DEFAULTS[libraryType]
  if (!filename) {
    return null
  }

  const possiblePaths = getBundledImagePaths(filename)
  
  for (const imagePath of possiblePaths) {
    try {
      const buffer = await fs.readFile(imagePath)
      const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      logger.debug({ libraryType, path: imagePath }, 'Found bundled default library image')
      return { buffer, mimeType }
    } catch {
      // File doesn't exist at this path, try next
    }
  }

  logger.debug({ libraryType, triedPaths: possiblePaths }, 'No bundled default library image found')
  return null
}

/**
 * Sync a global library type image to a specific media server library
 * 
 * This looks up the image stored under the library TYPE (e.g., 'ai-recs-movies')
 * and pushes it to a specific library ID in the media server.
 * Falls back to bundled default images if no custom image has been uploaded.
 * 
 * @param libraryType - The global library type (e.g., 'ai-recs-movies')
 * @param providerLibraryId - The actual Emby/Jellyfin library ID to push the image to
 */
export async function syncLibraryTypeImage(
  libraryType: LibraryType,
  providerLibraryId: string
): Promise<ImageSyncResult> {
  // First try: Look up custom image from database
  const image = await getEffectiveImage('library', libraryType, 'Primary')

  if (image) {
    // Custom image found in database - use it
    const buffer = await getImageBuffer(image.filePath)

    if (buffer) {
      logger.info({ libraryType, providerLibraryId }, 'Pushing custom library image to media server')
      return pushImageToMediaServer(providerLibraryId, 'Primary', buffer, image.mimeType)
    }

    logger.warn({ libraryType, providerLibraryId, filePath: image.filePath }, 'Custom library image file not found, falling back to bundled default')
  }

  // Second try: Fall back to bundled default image
  const bundledDefault = await getBundledDefaultImage(libraryType)

  if (bundledDefault) {
    logger.info({ libraryType, providerLibraryId }, 'Pushing bundled default library image to media server')
    return pushImageToMediaServer(providerLibraryId, 'Primary', bundledDefault.buffer, bundledDefault.mimeType)
  }

  // No image available
  logger.debug({ libraryType, providerLibraryId }, 'No library image available (custom or bundled)')
  return {
    success: true,
    itemId: providerLibraryId,
    imageType: 'Primary',
  }
}

