/**
 * TMDb API Types
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface TMDbKeyword {
  id: number
  name: string
}

export interface TMDbGenre {
  id: number
  name: string
}

export interface TMDbCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TMDbCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface TMDbCollection {
  id: number
  name: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
}

export interface TMDbCollectionDetails extends TMDbCollection {
  parts: TMDbCollectionPart[]
}

export interface TMDbCollectionPart {
  id: number
  title: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  release_date: string | null
  vote_average: number
}

export interface TMDbMovieDetails {
  id: number
  imdb_id: string | null
  title: string
  original_title: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  release_date: string | null
  runtime: number | null
  vote_average: number
  vote_count: number
  genres: TMDbGenre[]
  belongs_to_collection: TMDbCollection | null
}

export interface TMDbMovieKeywordsResponse {
  id: number
  keywords: TMDbKeyword[]
}

export interface TMDbMovieCreditsResponse {
  id: number
  cast: TMDbCastMember[]
  crew: TMDbCrewMember[]
}

export interface TMDbTVDetails {
  id: number
  name: string
  original_name: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string | null
  last_air_date: string | null
  vote_average: number
  vote_count: number
  genres: TMDbGenre[]
  status: string
  number_of_seasons: number
  number_of_episodes: number
}

export interface TMDbTVKeywordsResponse {
  id: number
  results: TMDbKeyword[]
}

export interface TMDbTVCreditsResponse {
  id: number
  cast: TMDbCastMember[]
  crew: TMDbCrewMember[]
}

// ============================================================================
// Internal Types (for our use)
// ============================================================================

export interface MovieEnrichmentData {
  keywords: string[]
  collectionId: number | null
  collectionName: string | null
  cinematographers: string[]
  composers: string[]
  editors: string[]
}

export interface SeriesEnrichmentData {
  keywords: string[]
}

export interface CollectionData {
  tmdbId: number
  name: string
  overview: string | null
  posterUrl: string | null
  backdropUrl: string | null
  parts: {
    tmdbId: number
    title: string
    releaseDate: string | null
  }[]
}

// ============================================================================
// Configuration
// ============================================================================

export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'
export const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3'

export type TMDbImageSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'

