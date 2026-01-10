import { EmbyProvider } from './emby/EmbyProvider.js'
import { JellyfinProvider } from './jellyfin/JellyfinProvider.js'
import type { MediaServerProvider } from './MediaServerProvider.js'
import type { MediaServerType } from './types.js'
import { getMediaServerConfig } from '../settings/systemSettings.js'

// Export provider classes
export { EmbyProvider } from './emby/EmbyProvider.js'
export { EmbyProviderBase } from './emby/base.js'
export { JellyfinProvider } from './jellyfin/JellyfinProvider.js'
export { JellyfinProviderBase } from './jellyfin/base.js'

// Export interface
export type { MediaServerProvider } from './MediaServerProvider.js'

// Export shared types
export * from './types.js'

// Export Emby types with namespace
export * as EmbyTypes from './emby/types.js'
export { mapEmbyItemToMovie, mapEmbyItemToSeries, mapEmbyItemToEpisode } from './emby/mappers.js'

// Export Jellyfin types with namespace
export * as JellyfinTypes from './jellyfin/types.js'
export {
  mapJellyfinItemToMovie,
  mapJellyfinItemToSeries,
  mapJellyfinItemToEpisode,
} from './jellyfin/mappers.js'

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
 * Get provider instance from database configuration (with env fallback)
 */
export async function getMediaServerProvider(): Promise<MediaServerProvider> {
  const config = await getMediaServerConfig()

  if (!config.type || !config.baseUrl) {
    throw new Error('Media server is not configured. Please configure it in Settings > Media Server.')
  }

  return createMediaServerProvider(config.type, config.baseUrl)
}
