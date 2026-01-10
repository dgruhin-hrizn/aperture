/**
 * TMDb Movie API Functions
 */

import { createChildLogger } from '../lib/logger.js'
import { tmdbRequest, findMovieByImdbId, type ApiLogCallback } from './client.js'
import type {
  TMDbMovieDetails,
  TMDbMovieKeywordsResponse,
  TMDbMovieCreditsResponse,
  MovieEnrichmentData,
} from './types.js'

const logger = createChildLogger('tmdb:movies')

/**
 * Get movie details from TMDb
 */
export async function getMovieDetails(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieDetails | null> {
  return tmdbRequest<TMDbMovieDetails>(`/movie/${tmdbId}`, options)
}

/**
 * Get movie keywords from TMDb
 */
export async function getMovieKeywords(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<string[]> {
  const result = await tmdbRequest<TMDbMovieKeywordsResponse>(
    `/movie/${tmdbId}/keywords`,
    options
  )
  if (!result?.keywords) return []
  return result.keywords.map((k) => k.name)
}

/**
 * Get movie credits (cast and crew) from TMDb
 */
export async function getMovieCredits(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbMovieCreditsResponse | null> {
  return tmdbRequest<TMDbMovieCreditsResponse>(`/movie/${tmdbId}/credits`, options)
}

/**
 * Extract specific crew members by job
 */
function extractCrewByJob(credits: TMDbMovieCreditsResponse, jobs: string[]): string[] {
  return credits.crew
    .filter((c) => jobs.includes(c.job))
    .map((c) => c.name)
    .filter((name, index, arr) => arr.indexOf(name) === index) // Dedupe
}

/**
 * Get all enrichment data for a movie
 * This combines keywords, collection info, and expanded crew in a single operation
 */
export async function getMovieEnrichmentData(
  tmdbId: number | null,
  imdbId: string | null,
  options: { onLog?: ApiLogCallback } = {}
): Promise<MovieEnrichmentData | null> {
  const { onLog } = options
  
  // If we don't have a TMDB ID, try to find one via IMDB ID
  let resolvedTmdbId = tmdbId
  if (!resolvedTmdbId && imdbId) {
    resolvedTmdbId = await findMovieByImdbId(imdbId, { onLog })
    if (!resolvedTmdbId) {
      logger.debug({ imdbId }, 'Could not find TMDb ID for IMDB ID')
      return null
    }
  }

  if (!resolvedTmdbId) {
    return null
  }

  // Fetch all data in parallel
  const [details, keywords, credits] = await Promise.all([
    getMovieDetails(resolvedTmdbId, { onLog }),
    getMovieKeywords(resolvedTmdbId, { onLog }),
    getMovieCredits(resolvedTmdbId, { onLog }),
  ])

  if (!details) {
    logger.debug({ tmdbId: resolvedTmdbId }, 'Could not fetch movie details from TMDb')
    return null
  }

  // Extract crew members
  const cinematographers = credits ? extractCrewByJob(credits, ['Director of Photography', 'Cinematography']) : []
  const composers = credits ? extractCrewByJob(credits, ['Original Music Composer', 'Music']) : []
  const editors = credits ? extractCrewByJob(credits, ['Editor']) : []

  return {
    keywords,
    collectionId: details.belongs_to_collection?.id ?? null,
    collectionName: details.belongs_to_collection?.name ?? null,
    cinematographers,
    composers,
    editors,
  }
}

/**
 * Get movie enrichment data by IMDB ID
 */
export async function getMovieEnrichmentByImdbId(
  imdbId: string,
  options: { onLog?: ApiLogCallback } = {}
): Promise<MovieEnrichmentData | null> {
  return getMovieEnrichmentData(null, imdbId, options)
}

/**
 * Get movie enrichment data by TMDb ID
 */
export async function getMovieEnrichmentByTmdbId(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<MovieEnrichmentData | null> {
  return getMovieEnrichmentData(tmdbId, null, options)
}


