/**
 * Series Route Types
 * 
 * TypeScript interfaces for series-related API endpoints.
 */

export interface SeriesRow {
  id: string
  provider_item_id: string
  title: string
  original_title: string | null
  year: number | null
  end_year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  status: string | null
  total_seasons: number | null
  total_episodes: number | null
  network: string | null
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

export interface SeriesDetailRow extends SeriesRow {
  tagline: string | null
  content_rating: string | null
  critic_rating: number | null
  studios: string[]
  directors: string[]
  writers: string[]
  actors: Array<{ name: string; role?: string; thumb?: string }>
  imdb_id: string | null
  tmdb_id: string | null
  tvdb_id: string | null
  air_days: string[]
  production_countries: string[]
  awards: string | null
  // TMDb enrichment
  keywords: string[] | null
  // OMDb enrichment
  rt_critic_score: number | null
  rt_audience_score: number | null
  rt_consensus: string | null
  metacritic_score: number | null
  awards_summary: string | null
  languages: string[] | null
  // MDBList enrichment
  letterboxd_score: number | null
  mdblist_score: number | null
  streaming_providers: StreamingProvider[] | null
}

export interface SeriesListResponse {
  series: SeriesRow[]
  total: number
  page: number
  pageSize: number
}

export interface SeriesListQuerystring {
  page?: string
  pageSize?: string
  search?: string
  genre?: string
  network?: string
  status?: string
  minRtScore?: string
  showAll?: string
  hasAwards?: string
  minYear?: string
  maxYear?: string
  contentRating?: string | string[]
  minSeasons?: string
  maxSeasons?: string
  minCommunityRating?: string
  minMetacritic?: string
  sortBy?: 'title' | 'year' | 'rating' | 'rtScore' | 'metacritic' | 'seasons' | 'added'
  sortOrder?: 'asc' | 'desc'
}

export interface EpisodeRow {
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

export interface EpisodesResponse {
  episodes: EpisodeRow[]
  seasons: Record<number, EpisodeRow[]>
  totalEpisodes: number
  seasonCount: number
}

export interface SeriesWatchStatsResponse {
  currentlyWatching: number
  totalViewers: number
  completedViewers: number
  totalEpisodes: number
  totalEpisodePlays: number
  favoritedEpisodes: number
  firstWatched: Date | null
  lastWatched: Date | null
  averageUserRating: number | null
  totalRatings: number
  averageProgress: number
  watchPercentage: number
  totalUsers: number
}

export interface SeriesFilterRangesResponse {
  year: { min: number; max: number }
  seasons: { min: number; max: number }
  rating: { min: number; max: number }
}
