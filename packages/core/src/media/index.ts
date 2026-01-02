import { EmbyProvider } from './EmbyProvider.js'
import { JellyfinProvider } from './JellyfinProvider.js'
import type { MediaServerProvider } from './MediaServerProvider.js'
import type { MediaServerType } from './types.js'

export { EmbyProvider } from './EmbyProvider.js'
export { JellyfinProvider } from './JellyfinProvider.js'
export type { MediaServerProvider } from './MediaServerProvider.js'
export * from './types.js'

/**
 * Create a media server provider based on type
 */
export function createMediaServerProvider(
  type: MediaServerType,
  baseUrl: string
): MediaServerProvider {
  switch (type) {
    case 'emby':
      return new EmbyProvider(baseUrl)
    case 'jellyfin':
      return new JellyfinProvider(baseUrl)
    default:
      throw new Error(`Unknown media server type: ${type}`)
  }
}

/**
 * Get provider instance from environment configuration
 */
export function getMediaServerProvider(): MediaServerProvider {
  const type = (process.env.MEDIA_SERVER_TYPE || 'emby') as MediaServerType
  const baseUrl = process.env.MEDIA_SERVER_BASE_URL

  if (!baseUrl) {
    throw new Error('MEDIA_SERVER_BASE_URL environment variable is required')
  }

  return createMediaServerProvider(type, baseUrl)
}

