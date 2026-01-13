// Studios can be either strings or objects with id/name
export type StudioItem = string | { id?: string; name: string }

export interface StreamingProvider {
  id: number
  name: string
}

export interface Series {
  id: string
  provider_item_id: string
  title: string
  original_title: string | null
  year: number | null
  end_year: number | null
  genres: string[]
  overview: string | null
  tagline: string | null
  community_rating: number | null
  critic_rating: number | null
  content_rating: string | null
  status: string | null
  total_seasons: number | null
  total_episodes: number | null
  network: string | null
  studios: StudioItem[]
  directors: string[]
  writers: string[]
  actors: Array<{ name: string; role?: string; thumb?: string }>
  imdb_id: string | null
  tmdb_id: string | null
  tvdb_id: string | null
  air_days: string[]
  production_countries: string[]
  awards: string | null
  poster_url: string | null
  backdrop_url: string | null
  // TMDb enrichment
  keywords?: string[]
  // OMDb enrichment
  rt_critic_score?: number | null
  rt_audience_score?: number | null
  rt_consensus?: string | null
  metacritic_score?: number | null
  awards_summary?: string | null
  languages?: string[] | null
  // MDBList enrichment
  letterboxd_score?: number | null
  mdblist_score?: number | null
  streaming_providers?: StreamingProvider[] | null
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

export interface SimilarSeries {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  genres: string[]
  network: string | null
  similarity: number
}

export interface MediaServerInfo {
  baseUrl: string
  type: string
  serverId: string
  serverName: string
  webClientUrl: string
}

