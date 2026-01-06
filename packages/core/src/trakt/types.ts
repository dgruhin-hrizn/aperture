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

