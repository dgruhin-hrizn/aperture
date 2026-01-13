// Unified types for both Movies and Series

export type MediaType = 'movie' | 'series'

export type StudioItem = string | { id?: string; name: string }

export interface StreamingProvider {
  id: number
  name: string
}

export interface Actor {
  name: string
  role?: string
  thumb?: string
}

// Base media interface with shared properties
export interface BaseMedia {
  id: string
  provider_item_id: string
  title: string
  original_title: string | null
  year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  poster_url: string | null
  backdrop_url: string | null
  // Crew
  directors?: string[]
  writers?: string[]
  // TMDb enrichment
  keywords?: string[]
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

// Movie-specific properties
export interface Movie extends BaseMedia {
  type: 'movie'
  runtime_minutes: number | null
  cinematographers?: string[]
  composers?: string[]
  editors?: string[]
  collection_id?: string | null
  collection_name?: string | null
  actors?: Actor[]
  studios?: StudioItem[]
  imdb_id?: string | null
  tmdb_id?: string | null
}

// Series-specific properties
export interface Series extends BaseMedia {
  type: 'series'
  end_year: number | null
  tagline: string | null
  critic_rating: number | null
  content_rating: string | null
  status: string | null
  total_seasons: number | null
  total_episodes: number | null
  network: string | null
  studios: StudioItem[]
  actors: Actor[]
  imdb_id: string | null
  tmdb_id: string | null
  tvdb_id: string | null
  air_days: string[]
  awards: string | null
}

// Union type for any media item
export type Media = Movie | Series

// Type guards
export function isMovie(media: Media): media is Movie {
  return media.type === 'movie'
}

export function isSeries(media: Media): media is Series {
  return media.type === 'series'
}

export interface Episode {
  id: string
  season_number: number
  episode_number: number
  title: string
  overview: string | null
  premiere_date: string | null
  runtime_minutes: number | null
  community_rating: number | null
  poster_url: string | null
}

export interface WatchStatus {
  isWatched: boolean
  playCount: number
  lastWatched: string | null
}

export interface SimilarItem {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  genres?: string[]
  network?: string | null
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

// Watch statistics
export interface MovieWatchStats {
  totalWatchers: number
  totalPlays: number
  favoritesCount: number
  firstWatched: string | null
  lastWatched: string | null
  averageUserRating: number | null
  totalRatings: number
  watchPercentage: number
  totalUsers: number
}

export interface SeriesWatchStats {
  currentlyWatching: number
  totalViewers: number
  completedViewers: number
  totalEpisodes: number
  totalEpisodePlays: number
  favoritedEpisodes: number
  firstWatched: string | null
  lastWatched: string | null
  averageUserRating: number | null
  totalRatings: number
  averageProgress: number
  watchPercentage: number
  totalUsers: number
}

