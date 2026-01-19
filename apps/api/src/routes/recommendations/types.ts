/**
 * Recommendations TypeScript Interfaces
 */

export interface MovieRecommendationCandidate {
  id: string
  movie_id: string
  rank: number
  is_selected: boolean
  final_score: number
  similarity_score: number | null
  novelty_score: number | null
  rating_score: number | null
  diversity_score: number | null
  score_breakdown: Record<string, unknown>
  movie: {
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    community_rating: number | null
    overview: string | null
  }
}

export interface SeriesRecommendationCandidate {
  id: string
  series_id: string
  rank: number
  is_selected: boolean
  final_score: number
  similarity_score: number | null
  novelty_score: number | null
  rating_score: number | null
  diversity_score: number | null
  score_breakdown: Record<string, unknown>
  series: {
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    community_rating: number | null
    overview: string | null
  }
}

export interface RecommendationRun {
  id: string
  user_id: string
  run_type: string
  channel_id: string | null
  candidate_count: number
  selected_count: number
  duration_ms: number | null
  status: string
  error_message: string | null
  created_at: Date
}

export interface UserPreferences {
  include_watched: boolean
  preferred_genres: string[]
  excluded_genres: string[]
  novelty_weight: number
  rating_weight: number
}
