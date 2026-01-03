export interface Movie {
  id: string
  provider_item_id: string
  title: string
  original_title: string | null
  year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  runtime_minutes: number | null
  poster_url: string | null
  backdrop_url: string | null
}

export interface SimilarMovie {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  similarity: number
}

export interface RecommendationInsights {
  isRecommended: boolean
  isSelected?: boolean
  rank?: number
  message?: string
  scores?: {
    final: number
    similarity: number | null
    novelty: number | null
    rating: number | null
    diversity: number | null
  }
  scoreBreakdown?: Record<string, unknown>
  evidence?: Array<{
    id: string
    similar_movie_id: string
    similarity: number
    evidence_type: string
    similar_movie: {
      id: string
      title: string
      year: number | null
      poster_url: string | null
      genres: string[]
    }
  }>
  genreAnalysis?: {
    movieGenres: string[]
    matchingGenres: string[]
    newGenres: string[]
    userTopGenres: Array<{ genre: string; weight: number }>
  }
}

export interface MediaServerInfo {
  baseUrl: string
  type: string
  serverId: string
  serverName: string
  webClientUrl: string
}

