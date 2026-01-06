/**
 * Media Server Image Sync
 * Pushes images to Emby/Jellyfin for libraries, collections, and playlists
 */

import { getMediaServerProvider } from '../media/index.js'
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
 */
export async function pushImageToMediaServer(
  itemId: string,
  imageType: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<ImageSyncResult> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

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
    const url = `${provider.baseUrl}/Items/${itemId}/Images/${imageType}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Emby-Authorization': getAuthHeader(apiKey),
        'Content-Type': mimeType,
      },
      body: imageBuffer,
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
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

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

