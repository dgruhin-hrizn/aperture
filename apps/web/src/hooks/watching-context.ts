import { createContext } from 'react'

export interface UpcomingEpisode {
  seasonNumber: number
  episodeNumber: number
  title: string
  airDate: string
  source: 'emby' | 'tmdb'
}

export interface WatchingSeries {
  id: string
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  genres: string[]
  overview: string | null
  communityRating: number | null
  network: string | null
  status: string | null
  totalSeasons: number | null
  totalEpisodes: number | null
  addedAt: string
  upcomingEpisode: UpcomingEpisode | null
}

/** Response from POST /api/watching/refresh (favorites reconcile) */
export interface WatchingRefreshResult {
  success: boolean
  message: string
  skipped: boolean
  reason?: string
  pushedToServer: number
  removedFromDb: number
  pulledIntoDb: number
  pushErrors: number
}

export interface WatchingContextValue {
  /** Set of series IDs the user is watching */
  watchingIds: Set<string>
  /** Full series data with enrichment */
  series: WatchingSeries[]
  /** Whether initial data is loading */
  loading: boolean
  /** Error message if any */
  error: string | null
  /** Whether a refresh is in progress */
  refreshing: boolean
  /** Check if a series is in the watching list */
  isWatching: (seriesId: string) => boolean
  /** Add a series to the watching list */
  addToWatching: (seriesId: string) => Promise<void>
  /** Remove a series from the watching list */
  removeFromWatching: (seriesId: string) => Promise<void>
  /** Toggle watching status for a series */
  toggleWatching: (seriesId: string) => Promise<void>
  /** Force refresh from server (invalidates cache) */
  refresh: () => Promise<void>
  /** Reconcile Shows You Watch with media server series favorites */
  refreshLibrary: () => Promise<WatchingRefreshResult>
}

export const WatchingContext = createContext<WatchingContextValue | null>(null)
