import type { StrmConfig } from './types.js'
import { getOutputPathConfig, getApertureMediaPath } from '../settings/systemSettings.js'

// Fixed container paths (set by Docker volume mounts, not configurable)
const APERTURE_LIBRARIES_PATH = '/aperture-libraries'
const APERTURE_MEDIA_PATH = '/media/'

/**
 * Get STRM configuration from database settings.
 * All configuration is done via the setup wizard - no ENV var fallbacks.
 */
export async function getConfig(): Promise<StrmConfig> {
  const pathConfig = await getOutputPathConfig()

  return {
    // Fixed path where Aperture writes libraries (inside Aperture container)
    strmRoot: APERTURE_LIBRARIES_PATH,
    // Path where media server sees Aperture libraries
    libraryPathPrefix: pathConfig.mediaServerLibrariesPath,
    // Library naming
    libraryNamePrefix: 'AI Picks - ',
    libraryRoot: APERTURE_MEDIA_PATH,
    // Output format (symlinks by default)
    useStreamingUrl: false,
    downloadImages: false,
    // Path mapping for symlinks:
    // - mediaServerPathPrefix: how media server sees files (e.g., /mnt/)
    // - localMediaPathPrefix: how Aperture sees files (fixed at /media/)
    mediaServerPathPrefix: pathConfig.mediaServerPathPrefix,
    localMediaPathPrefix: APERTURE_MEDIA_PATH,
  }
}

/**
 * Synchronous config getter - returns fixed defaults.
 * Use getConfig() for database-backed configuration.
 */
export function getConfigSync(): StrmConfig {
  return {
    strmRoot: APERTURE_LIBRARIES_PATH,
    libraryRoot: APERTURE_MEDIA_PATH,
    libraryNamePrefix: 'AI Picks - ',
    libraryPathPrefix: '/mnt/ApertureLibraries/',
    useStreamingUrl: false,
    downloadImages: false,
    mediaServerPathPrefix: '/mnt/',
    localMediaPathPrefix: APERTURE_MEDIA_PATH,
  }
}


