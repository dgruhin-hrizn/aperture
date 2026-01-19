/**
 * Jellyseerr API Types
 */

export interface JellyseerrConfig {
  url: string
  apiKey: string
  enabled: boolean
}

export interface JellyseerrUser {
  id: number
  email: string
  username: string
  plexToken: string | null
  jellyfinUsername: string | null
  jellyfinUserId: string | null
  permissions: number
  avatar: string | null
  createdAt: string
  updatedAt: string
}

export interface JellyseerrMediaInfo {
  id: number
  tmdbId: number
  tvdbId?: number
  imdbId?: string
  status: JellyseerrMediaStatus
  mediaType: 'movie' | 'tv'
  requests?: JellyseerrMediaRequest[]
}

export type JellyseerrMediaStatus = 
  | 1 // UNKNOWN
  | 2 // PENDING
  | 3 // PROCESSING
  | 4 // PARTIALLY_AVAILABLE
  | 5 // AVAILABLE

export interface JellyseerrMediaRequest {
  id: number
  status: JellyseerrRequestStatus
  media: {
    id: number
    tmdbId: number
    mediaType: 'movie' | 'tv'
    status: JellyseerrMediaStatus
  }
  requestedBy: JellyseerrUser
  createdAt: string
  updatedAt: string
  is4k: boolean
}

export type JellyseerrRequestStatus = 
  | 1 // PENDING
  | 2 // APPROVED
  | 3 // DECLINED

export interface JellyseerrSearchResult {
  page: number
  totalPages: number
  totalResults: number
  results: JellyseerrSearchItem[]
}

export interface JellyseerrSearchItem {
  id: number
  mediaType: 'movie' | 'tv' | 'person'
  title?: string // For movies
  name?: string // For TV/person
  originalTitle?: string
  originalName?: string
  overview?: string
  posterPath?: string
  backdropPath?: string
  releaseDate?: string // For movies
  firstAirDate?: string // For TV
  voteAverage?: number
  voteCount?: number
  popularity?: number
  genreIds?: number[]
  mediaInfo?: JellyseerrMediaInfo
}

export interface JellyseerrMovieDetails {
  id: number
  imdbId?: string
  title: string
  originalTitle: string
  overview?: string
  posterPath?: string
  backdropPath?: string
  releaseDate?: string
  runtime?: number
  voteAverage?: number
  voteCount?: number
  genres: { id: number; name: string }[]
  mediaInfo?: JellyseerrMediaInfo
}

/**
 * Season information from Jellyseerr TV details
 */
export interface JellyseerrSeason {
  id: number
  seasonNumber: number
  episodeCount: number
  airDate?: string
  name: string
  overview?: string
  posterPath?: string
  // Per-season status (available from mediaInfo.seasons in Jellyseerr)
  status?: JellyseerrMediaStatus
}

export interface JellyseerrTVDetails {
  id: number
  name: string
  originalName: string
  overview?: string
  posterPath?: string
  backdropPath?: string
  firstAirDate?: string
  lastAirDate?: string
  numberOfSeasons?: number
  numberOfEpisodes?: number
  voteAverage?: number
  voteCount?: number
  genres: { id: number; name: string }[]
  networks: { id: number; name: string; logoPath?: string }[]
  mediaInfo?: JellyseerrMediaInfo
  // Detailed season information
  seasons?: JellyseerrSeason[]
}

export interface JellyseerrRequestBody {
  mediaType: 'movie' | 'tv'
  mediaId: number
  tvdbId?: number
  seasons?: number[] // For TV - all seasons requested
  is4k?: boolean
}

export interface JellyseerrRequestResponse {
  id: number
  status: JellyseerrRequestStatus
  createdAt: string
  updatedAt: string
  media: {
    id: number
    tmdbId: number
    tvdbId?: number
    status: JellyseerrMediaStatus
    mediaType: 'movie' | 'tv'
  }
  requestedBy: JellyseerrUser
}

export const JELLYSEERR_MEDIA_STATUS = {
  1: 'unknown',
  2: 'pending',
  3: 'processing',
  4: 'partially_available',
  5: 'available',
} as const

export const JELLYSEERR_REQUEST_STATUS = {
  1: 'pending',
  2: 'approved',
  3: 'declined',
} as const

export type MediaStatusLabel = typeof JELLYSEERR_MEDIA_STATUS[keyof typeof JELLYSEERR_MEDIA_STATUS]
export type RequestStatusLabel = typeof JELLYSEERR_REQUEST_STATUS[keyof typeof JELLYSEERR_REQUEST_STATUS]

export function getMediaStatusLabel(status: JellyseerrMediaStatus): MediaStatusLabel {
  return JELLYSEERR_MEDIA_STATUS[status] ?? 'unknown'
}

export function getRequestStatusLabel(status: JellyseerrRequestStatus): RequestStatusLabel {
  return JELLYSEERR_REQUEST_STATUS[status] ?? 'pending'
}

