/**
 * Discovery Feature Types
 * 
 * Types for suggesting content not in the user's library
 */

export type MediaType = 'movie' | 'series'

export type DiscoverySource = 
  | 'tmdb_recommendations'
  | 'tmdb_similar'
  | 'tmdb_discover'
  | 'trakt_trending'
  | 'trakt_popular'
  | 'trakt_recommendations'
  | 'mdblist'

export type DiscoveryRunStatus = 'running' | 'completed' | 'failed'

export type DiscoveryRequestStatus = 
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'declined'
  | 'available'
  | 'failed'

export interface CastMember {
  id: number
  name: string
  character: string
  profilePath: string | null
}

export interface DiscoveryCandidate {
  id: string
  runId: string
  userId: string
  mediaType: MediaType
  tmdbId: number
  imdbId: string | null
  rank: number
  finalScore: number
  similarityScore: number | null
  popularityScore: number | null
  recencyScore: number | null
  sourceScore: number | null
  source: DiscoverySource
  sourceMediaId: number | null
  title: string
  originalTitle: string | null
  originalLanguage: string | null
  releaseYear: number | null
  posterPath: string | null
  backdropPath: string | null
  overview: string | null
  genres: { id: number; name: string }[]
  voteAverage: number | null
  voteCount: number | null
  scoreBreakdown: Record<string, number>
  // Cast/crew metadata for detail popper (only for enriched candidates)
  castMembers: CastMember[]
  directors: string[]
  runtimeMinutes: number | null
  tagline: string | null
  // Whether this candidate has been fully enriched with metadata
  isEnriched: boolean
  createdAt: Date
}

export interface DiscoveryRun {
  id: string
  userId: string
  mediaType: MediaType
  runType: 'scheduled' | 'manual'
  candidatesFetched: number
  candidatesFiltered: number
  candidatesScored: number
  candidatesStored: number
  durationMs: number | null
  status: DiscoveryRunStatus
  errorMessage: string | null
  createdAt: Date
}

export interface DiscoveryRequest {
  id: string
  userId: string
  mediaType: MediaType
  tmdbId: number
  title: string
  jellyseerrRequestId: number | null
  jellyseerrMediaId: number | null
  status: DiscoveryRequestStatus
  statusMessage: string | null
  discoveryCandidateId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DiscoveryUser {
  id: string
  username: string
  providerUserId: string
  maxParentalRating: number | null
  discoverEnabled: boolean
  discoverRequestEnabled: boolean
  // For Trakt integration (if user has linked)
  traktAccessToken?: string | null
}

export interface DiscoveryConfig {
  // How many candidates to fetch from each source
  maxCandidatesPerSource: number
  // Maximum total candidates to store (before filtering)
  maxTotalCandidates: number
  // How many candidates to enrich with full metadata (cast, directors, etc.)
  // Only the top N scored candidates get enriched to save API calls
  maxEnrichedCandidates: number
  // Target number of results to display after filtering
  targetDisplayCount: number
  // Minimum vote count for TMDb discover
  minVoteCount: number
  // Minimum vote average for TMDb discover
  minVoteAverage: number
  // Scoring weights
  similarityWeight: number
  popularityWeight: number
  recencyWeight: number
  // Time period for Trakt trending/popular
  traktPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'
}

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  maxCandidatesPerSource: 50,
  maxTotalCandidates: 200,
  maxEnrichedCandidates: 75,
  targetDisplayCount: 50,
  minVoteCount: 50,
  minVoteAverage: 5.0,
  similarityWeight: 0.5,
  popularityWeight: 0.3,
  recencyWeight: 0.2,
  traktPeriod: 'weekly',
}

export interface RawCandidate {
  tmdbId: number
  imdbId: string | null
  title: string
  originalTitle: string | null
  originalLanguage: string | null
  overview: string | null
  releaseYear: number | null
  posterPath: string | null
  backdropPath: string | null
  genres: { id: number; name: string }[]
  voteAverage: number
  voteCount: number
  popularity: number
  source: DiscoverySource
  sourceMediaId?: number
  // Cast/crew metadata
  castMembers?: CastMember[]
  directors?: string[]
  runtimeMinutes?: number | null
  tagline?: string | null
}

export interface ScoredCandidate extends RawCandidate {
  finalScore: number
  similarityScore: number
  popularityScore: number
  recencyScore: number
  sourceScore: number
  scoreBreakdown: Record<string, number>
  // Whether this candidate has been fully enriched with metadata
  isEnriched: boolean
}

export interface DiscoveryPipelineResult {
  runId: string
  candidates: ScoredCandidate[]
  candidatesFetched: number
  candidatesFiltered: number
  candidatesScored: number
  candidatesStored: number
  durationMs: number
}

/**
 * Filter options for retrieving discovery candidates
 */
export interface DiscoveryFilterOptions {
  limit?: number
  offset?: number
  // Filter by original language (ISO 639-1 codes, e.g., 'en', 'ko', 'ja')
  languages?: string[]
  // Include content with unknown/NULL language when filtering (default: true)
  includeUnknownLanguage?: boolean
  // Filter by genre IDs
  genreIds?: number[]
  // Filter by year range
  yearStart?: number
  yearEnd?: number
  // Minimum similarity score (0-1)
  minSimilarity?: number
}
