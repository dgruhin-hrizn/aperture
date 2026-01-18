/**
 * Discovery Page Types
 */

export type MediaType = 'movie' | 'series'

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
  source: string
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
  // Cast/crew metadata for detail popper
  castMembers: CastMember[]
  directors: string[]
  runtimeMinutes: number | null
  tagline: string | null
  createdAt: string
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
  status: 'running' | 'completed' | 'failed'
  errorMessage: string | null
  createdAt: string
}

export interface DiscoveryStatus {
  enabled: boolean
  requestEnabled: boolean
  movieRun: DiscoveryRun | null
  seriesRun: DiscoveryRun | null
  movieCount: number
  seriesCount: number
}

export interface JellyseerrMediaStatus {
  exists: boolean
  status: 'unknown' | 'pending' | 'processing' | 'partially_available' | 'available'
  requested: boolean
  requestStatus?: 'pending' | 'approved' | 'declined'
  requestId?: number
}

export interface DiscoveryRequest {
  id: string
  userId: string
  mediaType: MediaType
  tmdbId: number
  title: string
  jellyseerrRequestId: number | null
  jellyseerrMediaId: number | null
  status: 'pending' | 'submitted' | 'approved' | 'declined' | 'available' | 'failed'
  statusMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface DiscoveryFilterOptions {
  languages?: string[]
  genreIds?: number[]
  yearStart?: number
  yearEnd?: number
  minSimilarity?: number
}

