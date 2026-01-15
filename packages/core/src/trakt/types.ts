/**
 * Trakt API types
 */

export interface TraktConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface TraktTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface TraktUser {
  username: string
  private: boolean
  name: string
  vip: boolean
  ids: {
    slug: string
  }
}

export interface TraktRating {
  rated_at: string
  rating: number // 1-10
  type: 'movie' | 'show'
  movie?: TraktMovie
  show?: TraktShow
}

export interface TraktMovie {
  title: string
  year: number
  ids: {
    trakt: number
    slug: string
    imdb: string
    tmdb: number
  }
}

export interface TraktShow {
  title: string
  year: number
  ids: {
    trakt: number
    slug: string
    imdb: string
    tmdb: number
    tvdb: number
  }
}

export interface TraktAuthState {
  userId: string
  returnUrl?: string
}

export interface TraktSyncResult {
  moviesImported: number
  moviesUpdated: number
  moviesSkipped: number
  seriesImported: number
  seriesUpdated: number
  seriesSkipped: number
}

// ============================================================================
// Trakt Discovery Types (trending, popular, recommendations)
// ============================================================================

export interface TraktMovieWithStats {
  watchers?: number // For trending
  watcher_count?: number // For most watched
  collected_count?: number // For most collected
  collector_count?: number // For most collected
  play_count?: number // For most played
  list_count?: number // For most anticipated/favorited
  movie: TraktMovie
}

export interface TraktShowWithStats {
  watchers?: number // For trending
  watcher_count?: number // For most watched
  collected_count?: number // For most collected
  collector_count?: number // For most collected
  play_count?: number // For most played
  list_count?: number // For most anticipated/favorited
  show: TraktShow
}

export interface TraktRecommendedMovie {
  user_count: number
  movie: TraktMovie
}

export interface TraktRecommendedShow {
  user_count: number
  show: TraktShow
}

export type TraktTimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'

export interface TraktDiscoveryOptions {
  page?: number
  limit?: number
  period?: TraktTimePeriod
}


