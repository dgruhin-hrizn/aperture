/**
 * Media Server Image Sync
 * Pushes images to Emby/Jellyfin for libraries, collections, and playlists
 */

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
export type LibraryType = 'ai-recs-movies' | 'ai-recs-series' | 'top-picks-movies' | 'top-picks-series'

/**
 * Sync a global library type image to a specific media server library
 * 
 * This looks up the image stored under the library TYPE (e.g., 'ai-recs-movies')
 * and pushes it to a specific library ID in the media server.
 * 
 * @param libraryType - The global library type (e.g., 'ai-recs-movies')
 * @param providerLibraryId - The actual Emby/Jellyfin library ID to push the image to
 */
export async function syncLibraryTypeImage(
  libraryType: LibraryType,
  providerLibraryId: string
): Promise<ImageSyncResult> {
  // Look up the global image for this library type
  const image = await getEffectiveImage('library', libraryType, 'Primary')

  if (!image) {
    logger.debug({ libraryType, providerLibraryId }, 'No global library image configured')
    return {
      success: true,
      itemId: providerLibraryId,
      imageType: 'Primary',
    }
  }

  // Read the image file
  const buffer = await getImageBuffer(image.filePath)

  if (!buffer) {
    logger.warn({ libraryType, providerLibraryId, filePath: image.filePath }, 'Library image file not found')
    return {
      success: false,
      itemId: providerLibraryId,
      imageType: 'Primary',
      error: 'Image file not found',
    }
  }

  logger.info({ libraryType, providerLibraryId }, 'Pushing global library image to media server')

  // Push to the actual library in the media server
  return pushImageToMediaServer(providerLibraryId, 'Primary', buffer, image.mimeType)
}

