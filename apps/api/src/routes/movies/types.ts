/**
 * Movies Route Types
 * 
 * TypeScript interfaces for movie-related API endpoints.
 */

export interface MovieRow {
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
  created_at: Date
  updated_at: Date
  // Enrichment fields for discovery pages
  rt_critic_score: number | null
  awards_summary: string | null
}

export interface StreamingProvider {
  id: number
  name: string
}

export interface Actor {
  name: string
  role?: string
  thumb?: string
}

export interface Studio {
  id?: string
  name: string
}

export interface MovieDetailRow extends MovieRow {
  // Cast & Crew
  actors: Actor[] | null
  directors: string[] | null
  writers: string[] | null
  cinematographers: string[] | null
  composers: string[] | null
  editors: string[] | null
  studios: Studio[] | null
  // External IDs
  imdb_id: string | null
  tmdb_id: string | null
  // TMDb enrichment
  keywords: string[] | null
  collection_id: string | null
  collection_name: string | null
  // OMDb enrichment
  rt_critic_score: number | null
  rt_audience_score: number | null
  rt_consensus: string | null
  metacritic_score: number | null
  awards_summary: string | null
  languages: string[] | null
  production_countries: string[] | null
  // MDBList enrichment
  letterboxd_score: number | null
  mdblist_score: number | null
  streaming_providers: StreamingProvider[] | null
}

export interface MoviesListResponse {
  movies: MovieRow[]
  total: number
  page: number
  pageSize: number
}

export interface MoviesListQuerystring {
  page?: string
  pageSize?: string
  search?: string
  genre?: string
  collection?: string
  minRtScore?: string
  showAll?: string
  hasAwards?: string
  minYear?: string
  maxYear?: string
  contentRating?: string | string[]
  minRuntime?: string
  maxRuntime?: string
  minCommunityRating?: string
  minMetacritic?: string
  resolution?: string | string[]
  sortBy?: 'title' | 'year' | 'releaseDate' | 'rating' | 'rtScore' | 'metacritic' | 'runtime' | 'added'
  sortOrder?: 'asc' | 'desc'
}

export interface FranchisesQuerystring {
  page?: string
  pageSize?: string
  search?: string
  sortBy?: 'name' | 'total' | 'progress' | 'unwatched'
  showCompleted?: string
}

export interface FranchiseMovie {
  id: string
  title: string
  year: number | null
  posterUrl: string | null
  rating: number | null
  rtScore: number | null
  watched: boolean
}

export interface Franchise {
  name: string
  movies: FranchiseMovie[]
  totalMovies: number
  watchedMovies: number
  progress: number
}

export interface FranchisesResponse {
  franchises: Franchise[]
  total: number
  page: number
  pageSize: number
  stats: {
    totalFranchises: number
    completedFranchises: number
    totalMovies: number
    watchedMovies: number
  }
}

export interface WatchStatsResponse {
  totalWatchers: number
  totalPlays: number
  favoritesCount: number
  firstWatched: Date | null
  lastWatched: Date | null
  averageUserRating: number | null
  totalRatings: number
  watchPercentage: number
  totalUsers: number
}

export interface FilterRangesResponse {
  year: { min: number; max: number }
  runtime: { min: number; max: number }
  rating: { min: number; max: number }
}
