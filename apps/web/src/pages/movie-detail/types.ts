export interface StreamingProvider {
  id: number
  name: string
}

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
  // Crew
  directors?: string[]
  writers?: string[]
  cinematographers?: string[]
  composers?: string[]
  editors?: string[]
  // TMDb enrichment
  keywords?: string[]
  collection_id?: string | null
  collection_name?: string | null
  // OMDb enrichment
  rt_critic_score?: number | null
  rt_audience_score?: number | null
  rt_consensus?: string | null
  metacritic_score?: number | null
  awards_summary?: string | null
  languages?: string[] | null
  production_countries?: string[] | null
  // MDBList enrichment
  letterboxd_score?: number | null
  mdblist_score?: number | null
  streaming_providers?: StreamingProvider[] | null
}

export interface WatchStatus {
  isWatched: boolean
  playCount: number
  lastWatched: string | null
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

