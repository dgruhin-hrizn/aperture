/**
 * TMDb Discovery API Functions
 * 
 * Provides endpoints for discovering content:
 * - Recommendations based on a movie/series
 * - Similar titles to a movie/series
 * - General discovery with filters
 */

import { createChildLogger } from '../lib/logger.js'
import { tmdbRequest, type ApiLogCallback } from './client.js'
import type {
  TMDbMovieRecommendationsResponse,
  TMDbMovieSimilarResponse,
  TMDbMovieDiscoverResponse,
  TMDbTVRecommendationsResponse,
  TMDbTVSimilarResponse,
  TMDbTVDiscoverResponse,
  TMDbMovieResult,
  TMDbTVResult,
  DiscoverMovieFilters,
  DiscoverTVFilters,
} from './types.js'

const logger = createChildLogger('tmdb:discover')

// ============================================================================
// Top Picks Source Functions (Popular, Trending, Top Rated)
// ============================================================================

export type TrendingTimeWindow = 'day' | 'week'

interface TMDbPaginatedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

/**
 * Get popular movies from TMDB
 * Returns movies sorted by popularity
 */
export async function getPopularMovies(
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const result = await tmdbRequest<TMDbPaginatedResponse<TMDbMovieResult>>(
    `/movie/popular?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Get popular movies with multiple pages
 */
export async function getPopularMoviesBatch(
  maxPages: number = 5,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const results: TMDbMovieResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getPopularMovies(page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

/**
 * Get trending movies from TMDB
 * @param timeWindow - 'day' for today's trending, 'week' for this week's trending
 */
export async function getTrendingMovies(
  timeWindow: TrendingTimeWindow = 'week',
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const result = await tmdbRequest<TMDbPaginatedResponse<TMDbMovieResult>>(
    `/trending/movie/${timeWindow}?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Get trending movies with multiple pages
 */
export async function getTrendingMoviesBatch(
  timeWindow: TrendingTimeWindow = 'week',
  maxPages: number = 5,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const results: TMDbMovieResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getTrendingMovies(timeWindow, page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

/**
 * Get top rated movies from TMDB
 * Returns movies sorted by vote average
 */
export async function getTopRatedMovies(
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const result = await tmdbRequest<TMDbPaginatedResponse<TMDbMovieResult>>(
    `/movie/top_rated?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Get top rated movies with multiple pages
 */
export async function getTopRatedMoviesBatch(
  maxPages: number = 5,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const results: TMDbMovieResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getTopRatedMovies(page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

/**
 * Get popular TV shows from TMDB
 */
export async function getPopularTV(
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const result = await tmdbRequest<TMDbPaginatedResponse<TMDbTVResult>>(
    `/tv/popular?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Get popular TV shows with multiple pages
 */
export async function getPopularTVBatch(
  maxPages: number = 5,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const results: TMDbTVResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getPopularTV(page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

/**
 * Get trending TV shows from TMDB
 * @param timeWindow - 'day' for today's trending, 'week' for this week's trending
 */
export async function getTrendingTV(
  timeWindow: TrendingTimeWindow = 'week',
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const result = await tmdbRequest<TMDbPaginatedResponse<TMDbTVResult>>(
    `/trending/tv/${timeWindow}?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Get trending TV shows with multiple pages
 */
export async function getTrendingTVBatch(
  timeWindow: TrendingTimeWindow = 'week',
  maxPages: number = 5,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const results: TMDbTVResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getTrendingTV(timeWindow, page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

/**
 * Get top rated TV shows from TMDB
 */
export async function getTopRatedTV(
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const result = await tmdbRequest<TMDbPaginatedResponse<TMDbTVResult>>(
    `/tv/top_rated?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Get top rated TV shows with multiple pages
 */
export async function getTopRatedTVBatch(
  maxPages: number = 5,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const results: TMDbTVResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getTopRatedTV(page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

// ============================================================================
// Movie Discovery Functions
// ============================================================================

/**
 * Get movie recommendations based on a specific movie
 * These are movies similar in themes, genre, and audience
 */
export async function getMovieRecommendations(
  tmdbId: number,
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const result = await tmdbRequest<TMDbMovieRecommendationsResponse>(
    `/movie/${tmdbId}/recommendations?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Get movies similar to a specific movie
 * Based on genre and keywords
 */
export async function getSimilarMovies(
  tmdbId: number,
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const result = await tmdbRequest<TMDbMovieSimilarResponse>(
    `/movie/${tmdbId}/similar?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Discover movies with custom filters
 * General discovery endpoint for broader searches
 */
export async function discoverMovies(
  filters: DiscoverMovieFilters = {},
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieDiscoverResponse | null> {
  const params = new URLSearchParams({
    language: 'en-US',
    include_adult: 'false',
    include_video: 'false',
  })

  if (filters.sortBy) params.set('sort_by', filters.sortBy)
  if (filters.minVoteCount) params.set('vote_count.gte', filters.minVoteCount.toString())
  if (filters.minVoteAverage) params.set('vote_average.gte', filters.minVoteAverage.toString())
  if (filters.releaseDateGte) params.set('primary_release_date.gte', filters.releaseDateGte)
  if (filters.releaseDateLte) params.set('primary_release_date.lte', filters.releaseDateLte)
  if (filters.withGenres?.length) params.set('with_genres', filters.withGenres.join(','))
  if (filters.withoutGenres?.length) params.set('without_genres', filters.withoutGenres.join(','))
  if (filters.withKeywords?.length) params.set('with_keywords', filters.withKeywords.join(','))
  if (filters.withOriginalLanguage) params.set('with_original_language', filters.withOriginalLanguage)
  if (filters.page) params.set('page', filters.page.toString())

  return tmdbRequest<TMDbMovieDiscoverResponse>(
    `/discover/movie?${params.toString()}`,
    options
  )
}

/**
 * Get multiple pages of movie recommendations
 */
export async function getMovieRecommendationsBatch(
  tmdbId: number,
  maxPages: number = 3,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const results: TMDbMovieResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getMovieRecommendations(tmdbId, page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    // Avoid rate limiting
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

/**
 * Get multiple pages of similar movies
 */
export async function getSimilarMoviesBatch(
  tmdbId: number,
  maxPages: number = 3,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieResult[]> {
  const results: TMDbMovieResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getSimilarMovies(tmdbId, page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    // Avoid rate limiting
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

// ============================================================================
// TV Series Discovery Functions
// ============================================================================

/**
 * Get TV series recommendations based on a specific series
 * These are series similar in themes, genre, and audience
 */
export async function getTVRecommendations(
  tmdbId: number,
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const result = await tmdbRequest<TMDbTVRecommendationsResponse>(
    `/tv/${tmdbId}/recommendations?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Get TV series similar to a specific series
 * Based on genre and keywords
 */
export async function getSimilarTV(
  tmdbId: number,
  page: number = 1,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const result = await tmdbRequest<TMDbTVSimilarResponse>(
    `/tv/${tmdbId}/similar?page=${page}&language=en-US`,
    options
  )
  return result?.results ?? []
}

/**
 * Discover TV series with custom filters
 * General discovery endpoint for broader searches
 */
export async function discoverTV(
  filters: DiscoverTVFilters = {},
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVDiscoverResponse | null> {
  const params = new URLSearchParams({
    language: 'en-US',
    include_adult: 'false',
  })

  if (filters.sortBy) params.set('sort_by', filters.sortBy)
  if (filters.minVoteCount) params.set('vote_count.gte', filters.minVoteCount.toString())
  if (filters.minVoteAverage) params.set('vote_average.gte', filters.minVoteAverage.toString())
  if (filters.firstAirDateGte) params.set('first_air_date.gte', filters.firstAirDateGte)
  if (filters.firstAirDateLte) params.set('first_air_date.lte', filters.firstAirDateLte)
  if (filters.withGenres?.length) params.set('with_genres', filters.withGenres.join(','))
  if (filters.withoutGenres?.length) params.set('without_genres', filters.withoutGenres.join(','))
  if (filters.withKeywords?.length) params.set('with_keywords', filters.withKeywords.join(','))
  if (filters.withNetworks?.length) params.set('with_networks', filters.withNetworks.join(','))
  if (filters.withOriginalLanguage) params.set('with_original_language', filters.withOriginalLanguage)
  if (filters.page) params.set('page', filters.page.toString())

  return tmdbRequest<TMDbTVDiscoverResponse>(
    `/discover/tv?${params.toString()}`,
    options
  )
}

/**
 * Get multiple pages of TV recommendations
 */
export async function getTVRecommendationsBatch(
  tmdbId: number,
  maxPages: number = 3,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const results: TMDbTVResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getTVRecommendations(tmdbId, page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    // Avoid rate limiting
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

/**
 * Get multiple pages of similar TV series
 */
export async function getSimilarTVBatch(
  tmdbId: number,
  maxPages: number = 3,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVResult[]> {
  const results: TMDbTVResult[] = []

  for (let page = 1; page <= maxPages; page++) {
    const pageResults = await getSimilarTV(tmdbId, page, options)
    if (pageResults.length === 0) break
    results.push(...pageResults)
    
    // Avoid rate limiting
    if (page < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  return results
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract release year from a date string
 */
export function extractYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const year = parseInt(dateStr.split('-')[0], 10)
  return isNaN(year) ? null : year
}

/**
 * Normalize a TMDb movie result to a common format
 */
export function normalizeMovieResult(movie: TMDbMovieResult): {
  tmdbId: number
  title: string
  originalTitle: string
  originalLanguage: string
  overview: string | null
  releaseYear: number | null
  posterPath: string | null
  backdropPath: string | null
  genres: number[]
  voteAverage: number
  voteCount: number
  popularity: number
} {
  return {
    tmdbId: movie.id,
    title: movie.title,
    originalTitle: movie.original_title,
    originalLanguage: movie.original_language,
    overview: movie.overview,
    releaseYear: extractYear(movie.release_date),
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    genres: movie.genre_ids,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    popularity: movie.popularity,
  }
}

/**
 * Normalize a TMDb TV result to a common format
 */
export function normalizeTVResult(tv: TMDbTVResult): {
  tmdbId: number
  title: string
  originalTitle: string
  originalLanguage: string
  overview: string | null
  releaseYear: number | null
  posterPath: string | null
  backdropPath: string | null
  genres: number[]
  voteAverage: number
  voteCount: number
  popularity: number
} {
  return {
    tmdbId: tv.id,
    title: tv.name,
    originalTitle: tv.original_name,
    originalLanguage: tv.original_language,
    overview: tv.overview,
    releaseYear: extractYear(tv.first_air_date),
    posterPath: tv.poster_path,
    backdropPath: tv.backdrop_path,
    genres: tv.genre_ids,
    voteAverage: tv.vote_average,
    voteCount: tv.vote_count,
    popularity: tv.popularity,
  }
}

