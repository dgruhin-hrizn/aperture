import type { StrmConfig } from './types.js'

export function getConfig(): StrmConfig {
  return {
    strmRoot: process.env.MEDIA_SERVER_STRM_ROOT || '/strm',
    libraryRoot: process.env.MEDIA_SERVER_LIBRARY_ROOT || '/mnt/media',
    libraryNamePrefix: process.env.AI_LIBRARY_NAME_PREFIX || 'AI Picks - ',
    libraryPathPrefix: process.env.AI_LIBRARY_PATH_PREFIX || '/strm/aperture/',
    useStreamingUrl: process.env.STRM_USE_STREAMING_URL === 'true',
    downloadImages: process.env.STRM_DOWNLOAD_IMAGES === 'true',
    // Path mapping: convert media server paths to local paths for symlinks
    // e.g., /mnt/Television/Show -> /Volumes/Media/Television/Show
    mediaServerPathPrefix: process.env.MEDIA_SERVER_PATH_PREFIX || '/mnt/',
    localMediaPathPrefix: process.env.LOCAL_MEDIA_PATH_PREFIX || '/mnt/',
  }
}


