/**
 * Seerr API Types
 */

export interface SeerrConfig {
  url: string
  apiKey: string
  enabled: boolean
}

export interface SeerrUser {
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

/** Response shape for GET /user */
export interface SeerrUserListResponse {
  pageInfo: { page: number; pages: number; results: number }
  results: SeerrUser[]
}

export interface SeerrMediaInfo {
  id: number
  tmdbId: number
  tvdbId?: number
  imdbId?: string
  status: SeerrMediaStatus
  /** Jellyseerr / multi-Radarr: separate 4K availability (HD may stay UNKNOWN while 4K is requested). */
  status4k?: SeerrMediaStatus
  mediaType: 'movie' | 'tv'
  requests?: SeerrMediaRequest[]
}

export type SeerrMediaStatus = 
  | 1 // UNKNOWN
  | 2 // PENDING
  | 3 // PROCESSING
  | 4 // PARTIALLY_AVAILABLE
  | 5 // AVAILABLE

export interface SeerrMediaRequest {
  id: number
  status: SeerrRequestStatus
  media: {
    id: number
    tmdbId: number
    mediaType: 'movie' | 'tv'
    status: SeerrMediaStatus
  }
  requestedBy: SeerrUser
  createdAt: string
  updatedAt: string
  is4k: boolean
}

export type SeerrRequestStatus = 
  | 1 // PENDING
  | 2 // APPROVED
  | 3 // DECLINED

export interface SeerrSearchResult {
  page: number
  totalPages: number
  totalResults: number
  results: SeerrSearchItem[]
}

export interface SeerrSearchItem {
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
  mediaInfo?: SeerrMediaInfo
}

export interface SeerrMovieDetails {
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
  mediaInfo?: SeerrMediaInfo
}

/**
 * Season information from Seerr TV details
 */
export interface SeerrSeason {
  id: number
  seasonNumber: number
  episodeCount: number
  airDate?: string
  name: string
  overview?: string
  posterPath?: string
  // Per-season status (available from mediaInfo.seasons in Seerr)
  status?: SeerrMediaStatus
}

export interface SeerrTVDetails {
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
  mediaInfo?: SeerrMediaInfo
  // Detailed season information
  seasons?: SeerrSeason[]
}

/** Optional fields aligned with Seerr POST /request (OpenAPI). */
export interface SeerrRequestBody {
  mediaType: 'movie' | 'tv'
  mediaId: number
  tvdbId?: number
  seasons?: number[] | 'all' // For TV
  is4k?: boolean
  /** When set (with admin API key), request is attributed to this Seerr user */
  userId?: number
  /** Radarr/Sonarr instance id when multiple servers exist */
  serverId?: number
  /** Quality profile id (Radarr or Sonarr) */
  profileId?: number
  /** Root folder path string (e.g. /movies) */
  rootFolder?: string
  /** Sonarr language profile (TV) */
  languageProfileId?: number
}

/** GET /service/radarr list item (non-sensitive subset) */
export interface SeerrRadarrServerSummary {
  id: number
  name: string
  is4k: boolean
  isDefault: boolean
  activeDirectory: string
  activeProfileId: number
  activeTags?: number[]
}

/** GET /service/sonarr list item */
export interface SeerrSonarrServerSummary {
  id: number
  name: string
  is4k: boolean
  isDefault: boolean
  activeDirectory: string
  activeProfileId: number
  activeAnimeProfileId?: number | null
  activeAnimeDirectory?: string | null
  activeLanguageProfileId?: number
  activeAnimeLanguageProfileId?: number | null
  activeTags?: number[]
}

export interface SeerrServiceProfile {
  id: number
  name: string
}

export interface SeerrRootFolder {
  id: number
  path: string
  freeSpace?: number
  totalSpace?: number
}

export interface SeerrLanguageProfile {
  id: number
  name: string
}

/** GET /service/radarr/:id */
export interface SeerrRadarrServerDetailsResponse {
  server: SeerrRadarrServerSummary
  profiles: SeerrServiceProfile[]
  rootFolders: SeerrRootFolder[]
  tags?: unknown[]
}

/** GET /service/sonarr/:id — languageProfiles null on Sonarr v4+ */
export interface SeerrSonarrServerDetailsResponse {
  server: SeerrSonarrServerSummary
  profiles: SeerrServiceProfile[]
  rootFolders: SeerrRootFolder[]
  languageProfiles: SeerrLanguageProfile[] | null
  tags?: unknown[]
}

/** Options passed through to createRequest (subset of SeerrRequestBody). */
export type SeerrCreateRequestOptions = {
  seasons?: number[]
  is4k?: boolean
  userId?: number
  rootFolder?: string
  profileId?: number
  serverId?: number
  languageProfileId?: number
}

export interface SeerrRequestResponse {
  id: number
  status: SeerrRequestStatus
  createdAt: string
  updatedAt: string
  media: {
    id: number
    tmdbId: number
    tvdbId?: number
    status: SeerrMediaStatus
    mediaType: 'movie' | 'tv'
  }
  requestedBy: SeerrUser
}

export const SEERR_MEDIA_STATUS = {
  1: 'unknown',
  2: 'pending',
  3: 'processing',
  4: 'partially_available',
  5: 'available',
} as const

export const SEERR_REQUEST_STATUS = {
  1: 'pending',
  2: 'approved',
  3: 'declined',
} as const

export type MediaStatusLabel = typeof SEERR_MEDIA_STATUS[keyof typeof SEERR_MEDIA_STATUS]
export type RequestStatusLabel = typeof SEERR_REQUEST_STATUS[keyof typeof SEERR_REQUEST_STATUS]

export function getMediaStatusLabel(status: SeerrMediaStatus): MediaStatusLabel {
  return SEERR_MEDIA_STATUS[status] ?? 'unknown'
}

export function getRequestStatusLabel(status: SeerrRequestStatus): RequestStatusLabel {
  return SEERR_REQUEST_STATUS[status] ?? 'pending'
}

