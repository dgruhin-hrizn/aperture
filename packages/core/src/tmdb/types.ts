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

export interface TMDbProductionCompany {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

export interface TMDbNetwork {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
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
  original_language: string
  overview: string | null
  tagline: string | null
  poster_path: string | null
  backdrop_path: string | null
  release_date: string | null
  runtime: number | null
  vote_average: number
  vote_count: number
  genres: TMDbGenre[]
  belongs_to_collection: TMDbCollection | null
  production_companies: TMDbProductionCompany[]
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

export interface TMDbTVCreator {
  id: number
  name: string
  profile_path: string | null
}

export interface TMDbTVDetails {
  id: number
  name: string
  original_name: string
  original_language: string
  overview: string | null
  tagline: string | null
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
  episode_run_time: number[]
  created_by: TMDbTVCreator[]
  networks: TMDbNetwork[]
  production_companies: TMDbProductionCompany[]
}

export interface TMDbTVKeywordsResponse {
  id: number
  results: TMDbKeyword[]
}

export interface TMDbExternalIds {
  id: number
  imdb_id: string | null
  tvdb_id: number | null
  facebook_id: string | null
  instagram_id: string | null
  twitter_id: string | null
}

export interface TMDbTVCreditsResponse {
  id: number
  cast: TMDbCastMember[]
  crew: TMDbCrewMember[]
}

export interface TMDbCompanySearchResult {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

export interface TMDbCompanySearchResponse {
  page: number
  results: TMDbCompanySearchResult[]
  total_pages: number
  total_results: number
}

export interface TMDbCompanyDetails {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
  description: string
  headquarters: string
  homepage: string | null
}

export interface TMDbNetworkDetails {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
  headquarters: string
  homepage: string | null
}

// ============================================================================
// Internal Types (for our use)
// ============================================================================

export interface ProductionCompanyData {
  tmdbId: number
  name: string
  logoPath: string | null
  originCountry: string
}

export interface NetworkData {
  tmdbId: number
  name: string
  logoPath: string | null
  originCountry: string
}

export interface MovieEnrichmentData {
  keywords: string[]
  collectionId: number | null
  collectionName: string | null
  cinematographers: string[]
  composers: string[]
  editors: string[]
  productionCompanies: ProductionCompanyData[]
}

export interface SeriesEnrichmentData {
  keywords: string[]
  networks: NetworkData[]
  productionCompanies: ProductionCompanyData[]
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

// ============================================================================
// Discovery Types (for recommendations, similar, and discover endpoints)
// ============================================================================

export interface TMDbMovieResult {
  id: number
  title: string
  original_title: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  release_date: string | null
  vote_average: number
  vote_count: number
  genre_ids: number[]
  adult: boolean
  popularity: number
  original_language: string
}

export interface TMDbTVResult {
  id: number
  name: string
  original_name: string
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string | null
  vote_average: number
  vote_count: number
  genre_ids: number[]
  popularity: number
  original_language: string
  origin_country: string[]
}

export interface TMDbPaginatedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export type TMDbMovieRecommendationsResponse = TMDbPaginatedResponse<TMDbMovieResult>
export type TMDbMovieSimilarResponse = TMDbPaginatedResponse<TMDbMovieResult>
export type TMDbMovieDiscoverResponse = TMDbPaginatedResponse<TMDbMovieResult>
export type TMDbTVRecommendationsResponse = TMDbPaginatedResponse<TMDbTVResult>
export type TMDbTVSimilarResponse = TMDbPaginatedResponse<TMDbTVResult>
export type TMDbTVDiscoverResponse = TMDbPaginatedResponse<TMDbTVResult>

export interface DiscoverMovieFilters {
  sortBy?: 'popularity.desc' | 'popularity.asc' | 'vote_average.desc' | 'vote_average.asc' | 'release_date.desc' | 'release_date.asc'
  minVoteCount?: number
  minVoteAverage?: number
  releaseDateGte?: string // YYYY-MM-DD
  releaseDateLte?: string // YYYY-MM-DD
  withGenres?: number[] // Genre IDs (AND)
  withoutGenres?: number[] // Genre IDs to exclude
  withKeywords?: number[] // Keyword IDs
  withOriginalLanguage?: string // ISO 639-1 code
  page?: number
}

export interface DiscoverTVFilters {
  sortBy?: 'popularity.desc' | 'popularity.asc' | 'vote_average.desc' | 'vote_average.asc' | 'first_air_date.desc' | 'first_air_date.asc'
  minVoteCount?: number
  minVoteAverage?: number
  firstAirDateGte?: string // YYYY-MM-DD
  firstAirDateLte?: string // YYYY-MM-DD
  withGenres?: number[] // Genre IDs (AND)
  withoutGenres?: number[] // Genre IDs to exclude
  withKeywords?: number[] // Keyword IDs
  withNetworks?: number[] // Network IDs
  withOriginalLanguage?: string // ISO 639-1 code
  page?: number
}


