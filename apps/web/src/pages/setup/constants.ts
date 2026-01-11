import type { SetupStepId } from './types'

// Default library cover images (bundled with the app)
export const DEFAULT_LIBRARY_IMAGES: Record<string, string> = {
  'ai-recs-movies': '/AI_MOVIE_PICKS.png',
  'ai-recs-series': '/AI_SERIES_PICKS.png',
  'top-picks-movies': '/TOP_10_MOVIES_THIS_WEEK.png',
  'top-picks-series': '/TOP_10_SERIES_THIS_WEEKpng.png',
  'watching': '/Shows_You_Watch.png',
}

export const STEP_ORDER: Array<{ id: SetupStepId; label: string }> = [
  { id: 'mediaServer', label: 'Connect' },
  { id: 'mediaLibraries', label: 'Libraries' },
  { id: 'aiRecsLibraries', label: 'For You' },
  { id: 'outputConfig', label: 'Output' },
  { id: 'users', label: 'Users' },
  { id: 'topPicks', label: 'Top 10' },
  { id: 'openai', label: 'AI' },
  { id: 'initialJobs', label: 'Sync' },
  { id: 'complete', label: 'Done' },
]

export const DEFAULT_AI_RECS_OUTPUT = {
  moviesUseSymlinks: true,
  seriesUseSymlinks: true,
}

export const DEFAULT_OUTPUT_PATH_CONFIG = {
  apertureLibrariesPath: '/aperture-libraries',
  mediaServerLibrariesPath: '/mnt/ApertureLibraries/',
  mediaServerPathPrefix: '/mnt/',
  moviesUseSymlinks: true,
  seriesUseSymlinks: true,
}

export const DEFAULT_TOP_PICKS = {
  isEnabled: false,
  moviesLibraryEnabled: true,
  moviesCollectionEnabled: false,
  moviesPlaylistEnabled: false,
  moviesUseSymlinks: false,
  seriesLibraryEnabled: true,
  seriesCollectionEnabled: false,
  seriesPlaylistEnabled: false,
  seriesUseSymlinks: false,
}

export const DEFAULT_MEDIA_SERVER_TYPES = [
  { id: 'emby', name: 'Emby' },
  { id: 'jellyfin', name: 'Jellyfin' },
]

