/**
 * OMDb API Types
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface OMDbRating {
  Source: string
  Value: string
}

export interface OMDbMovieResponse {
  Response: 'True' | 'False'
  Error?: string
  Title: string
  Year: string
  Rated: string
  Released: string
  Runtime: string
  Genre: string
  Director: string
  Writer: string
  Actors: string
  Plot: string
  Language: string
  Country: string
  Awards: string
  Poster: string
  Ratings: OMDbRating[]
  Metascore: string
  imdbRating: string
  imdbVotes: string
  imdbID: string
  Type: 'movie' | 'series' | 'episode'
  DVD?: string
  BoxOffice?: string
  Production?: string
  Website?: string
  totalSeasons?: string
}

// ============================================================================
// Internal Types
// ============================================================================

export interface RatingsData {
  rtCriticScore: number | null
  rtAudienceScore: number | null
  metacriticScore: number | null
  awardsSummary: string | null
}

// ============================================================================
// Configuration
// ============================================================================

export const OMDB_API_BASE_URL = 'https://www.omdbapi.com'

