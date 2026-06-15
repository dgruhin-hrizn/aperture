export type PopularitySource = 
  | 'emby_history'      // Local watch history (renamed from 'local')
  | 'tmdb_popular'      // TMDB most popular
  | 'tmdb_trending_day' // TMDB trending today
  | 'tmdb_trending_week'// TMDB trending this week
  | 'tmdb_top_rated'    // TMDB highest rated
  | 'mdblist'           // User-selected MDBList
  | 'hybrid'            // Local + one external source

// External sources that can be used in hybrid mode
export type HybridExternalSource = 
  | 'tmdb_popular'
  | 'tmdb_trending_day'
  | 'tmdb_trending_week'
  | 'tmdb_top_rated'
  | 'mdblist'

export interface TopPicksConfig {
  isEnabled: boolean
  // Movies-specific settings
  moviesPopularitySource: PopularitySource
  moviesTimeWindowDays: number
  moviesMinUniqueViewers: number
  moviesUseAllMatches: boolean
  moviesCount: number
  moviesHybridExternalSource: HybridExternalSource
  // Series-specific settings
  seriesPopularitySource: PopularitySource
  seriesTimeWindowDays: number
  seriesMinUniqueViewers: number
  seriesUseAllMatches: boolean
  seriesCount: number
  seriesHybridExternalSource: HybridExternalSource
  // Shared weights
  uniqueViewersWeight: number
  playCountWeight: number
  completionWeight: number
  refreshCron: string
  lastRefreshedAt: string | null
  moviesLibraryName: string
  seriesLibraryName: string
  // Output format settings (separate for movies and series)
  moviesUseSymlinks: boolean
  seriesUseSymlinks: boolean
  // Movies output modes
  moviesLibraryEnabled: boolean
  moviesCollectionEnabled: boolean
  moviesPlaylistEnabled: boolean
  // Series output modes
  seriesLibraryEnabled: boolean
  seriesCollectionEnabled: boolean
  seriesPlaylistEnabled: boolean
  // Collection/Playlist names
  moviesCollectionName: string
  seriesCollectionName: string
  // MDBList list selections
  mdblistMoviesListId: number | null
  mdblistSeriesListId: number | null
  mdblistMoviesListName: string | null
  mdblistSeriesListName: string | null
  // MDBList sort order
  mdblistMoviesSort: string
  mdblistSeriesSort: string
  // Hybrid mode weights
  hybridLocalWeight: number
  hybridExternalWeight: number
  // Auto-request settings
  moviesAutoRequestEnabled: boolean
  moviesAutoRequestLimit: number
  seriesAutoRequestEnabled: boolean
  seriesAutoRequestLimit: number
  autoRequestCron: string
  // Language filters
  moviesLanguages: string[]
  moviesIncludeUnknownLanguage: boolean
  seriesLanguages: string[]
  seriesIncludeUnknownLanguage: boolean
}

export type PreviewCountConfig = Pick<
  TopPicksConfig,
  | 'moviesPopularitySource'
  | 'moviesMinUniqueViewers'
  | 'moviesTimeWindowDays'
  | 'seriesPopularitySource'
  | 'seriesMinUniqueViewers'
  | 'seriesTimeWindowDays'
>

export interface PreviewCounts {
  movies: number
  series: number
  recommendedMoviesMinViewers: number
  recommendedSeriesMinViewers: number
}

export interface LibraryImageInfo {
  url?: string
  isDefault?: boolean
}

export interface SortOption {
  value: string
  label: string
}

export interface LibraryMatchResult {
  total: number
  matched: number
  missing: Array<{
    title: string
    year: number | null
    tmdbid?: number
    imdbid?: string
    mediatype: string
  }>
}

// Source options for dropdown
export interface SourceOption {
  value: PopularitySource
  label: string
  description: string
  icon: 'home' | 'tmdb' | 'mdblist' | 'hybrid'
  requiresMdblist?: boolean
}

// External sources for hybrid mode
export interface HybridSourceOption {
  value: HybridExternalSource
  label: string
  requiresMdblist?: boolean
}
export type TopPicksMediaType = 'movies' | 'series'
