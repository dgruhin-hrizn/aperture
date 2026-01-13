/**
 * MDBList API Types
 * https://mdblist.com/api
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface MDBListConfig {
  apiKey: string | null
  enabled: boolean
  hasApiKey: boolean
  /** Whether user has a supporter tier (higher rate limits, rating filters) */
  supporterTier: boolean
}

// ============================================================================
// API Response Types
// ============================================================================

export interface MDBListUserInfo {
  user_id: number
  user_name: string
  patron_status: string
  api_requests: number
  api_requests_count: number
}

export interface MDBListRating {
  source: 'imdb' | 'metacritic' | 'trakt' | 'tomatoes' | 'tomatoesaudience' | 'tmdb' | 'letterboxd' | 'rogerebert' | 'myanimelist'
  value: number | null
  score: number | null
  votes: number | null
  popular?: number
  url?: string
}

export interface MDBListStream {
  id: number
  name: string
}

export interface MDBListWatchProvider {
  id: number
  name: string
}

export interface MDBListKeyword {
  id: number
  name: string
}

export interface MDBListMediaInfo {
  id: number
  title: string
  year: number
  released?: string
  released_digital?: string
  description?: string
  runtime?: number
  score?: number
  score_average?: number
  ratings: MDBListRating[]
  streams?: MDBListStream[]
  watch_providers?: MDBListWatchProvider[]
  keywords?: MDBListKeyword[]
  language?: string
  spoken_language?: string
  country?: string
  certification?: string
  status?: string
  imdbid?: string
  traktid?: number
  tmdbid?: number
  tvdbid?: number
  mal_id?: number
  type?: 'movie' | 'show'
  poster?: string
  backdrop?: string
  trailer?: string
  // Series-specific
  first_air_date?: string
  last_air_date?: string
  network?: string
}

export interface MDBListItem {
  id: number
  rank: number
  title?: string
  year?: number
  imdbid?: string
  tmdbid?: number
  traktid?: number
  tvdbid?: number
  mediatype?: 'movie' | 'show'
  // Full media info when using extended=true
  adult?: boolean
  description?: string
  runtime?: number
  score?: number
  score_average?: number
  released?: string
  ratings?: MDBListRating[]
}

export interface MDBListListInfo {
  id: number
  name: string
  slug?: string
  user_id?: number
  user_name?: string
  mediatype?: 'movie' | 'show' | 'mixed'
  items?: number
  likes?: number
  dynamic?: boolean
  private?: boolean
  description?: string
}

export interface MDBListSearchResult {
  id: number
  name: string
  slug: string
  user_id: number
  user_name: string
  mediatype: 'movie' | 'show' | 'mixed'
  items: number
  likes: number
  dynamic: boolean
  description?: string
}

// ============================================================================
// Internal Types
// ============================================================================

export interface MDBListEnrichmentData {
  letterboxdScore: number | null
  mdblistScore: number | null
  rtCriticScore: number | null
  rtAudienceScore: number | null
  metacriticScore: number | null
  streamingProviders: { id: number; name: string }[]
  keywords: string[]
}

// ============================================================================
// Constants
// ============================================================================

export const MDBLIST_API_BASE_URL = 'https://api.mdblist.com'

// Rate limits (requests per day)
export const MDBLIST_RATE_LIMIT_FREE = 1000
export const MDBLIST_RATE_LIMIT_SUPPORTER = 100000 // Varies by tier

// Default batch size for enrichment
export const MDBLIST_BATCH_SIZE = 200

