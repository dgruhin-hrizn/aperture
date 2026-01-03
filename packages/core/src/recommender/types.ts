export interface User {
  id: string
  username: string
  providerUserId: string
  maxParentalRating?: number | null
}

export interface WatchedMovie {
  movieId: string
  lastPlayedAt: Date | null
  playCount: number
  isFavorite: boolean
}

export interface Candidate {
  movieId: string
  title: string
  year: number | null
  genres: string[]
  communityRating: number | null
  similarity: number
  novelty: number
  ratingScore: number
  diversityScore: number
  finalScore: number
}

export interface PipelineConfig {
  maxCandidates: number
  selectedCount: number
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
  recentWatchLimit: number
}

// Fallback defaults (used only if DB fetch fails)
export const FALLBACK_CONFIG: PipelineConfig = {
  maxCandidates: 50000,
  selectedCount: 50,
  similarityWeight: 0.4,
  noveltyWeight: 0.2,
  ratingWeight: 0.2,
  diversityWeight: 0.2,
  recentWatchLimit: 50,
}

