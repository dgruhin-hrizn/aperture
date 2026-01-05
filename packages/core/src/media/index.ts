import { EmbyProvider } from './emby/EmbyProvider.js'
import { JellyfinProvider } from './jellyfin/JellyfinProvider.js'
import type { MediaServerProvider } from './MediaServerProvider.js'
import type { MediaServerType } from './types.js'

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

// Export Emby mark unplayed functions
export {
  markMovieUnplayed as embyMarkMovieUnplayed,
} from './emby/movies.js'
export {
  markEpisodeUnplayed as embyMarkEpisodeUnplayed,
  markSeasonUnplayed as embyMarkSeasonUnplayed,
  markSeriesUnplayed as embyMarkSeriesUnplayed,
} from './emby/series.js'

// Export Jellyfin types with namespace
export * as JellyfinTypes from './jellyfin/types.js'
export {
  mapJellyfinItemToMovie,
  mapJellyfinItemToSeries,
  mapJellyfinItemToEpisode,
} from './jellyfin/mappers.js'

// Export Jellyfin mark unplayed functions
export {
  markMovieUnplayed as jellyfinMarkMovieUnplayed,
} from './jellyfin/movies.js'
export {
  markEpisodeUnplayed as jellyfinMarkEpisodeUnplayed,
  markSeasonUnplayed as jellyfinMarkSeasonUnplayed,
  markSeriesUnplayed as jellyfinMarkSeriesUnplayed,
} from './jellyfin/series.js'

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
