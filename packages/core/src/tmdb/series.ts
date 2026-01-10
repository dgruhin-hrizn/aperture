/**
 * TMDb TV Series API Functions
 */

import { createChildLogger } from '../lib/logger.js'
import { tmdbRequest, findTVByImdbId, findTVByTvdbId, type ApiLogCallback } from './client.js'
import type {
  TMDbTVDetails,
  TMDbTVKeywordsResponse,
  SeriesEnrichmentData,
} from './types.js'

const logger = createChildLogger('tmdb:series')

/**
 * Get TV series details from TMDb
 */
export async function getTVDetails(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVDetails | null> {
  return tmdbRequest<TMDbTVDetails>(`/tv/${tmdbId}`, options)
}

/**
 * Get TV series keywords from TMDb
 */
export async function getTVKeywords(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<string[]> {
  const result = await tmdbRequest<TMDbTVKeywordsResponse>(
    `/tv/${tmdbId}/keywords`,
    options
  )
  if (!result?.results) return []
  return result.results.map((k) => k.name)
}

/**
 * Get all enrichment data for a TV series
 */
export async function getSeriesEnrichmentData(
  tmdbId: number | null,
  imdbId: string | null,
  tvdbId: string | null,
  options: { onLog?: ApiLogCallback } = {}
): Promise<SeriesEnrichmentData | null> {
  const { onLog } = options
  
  // If we don't have a TMDB ID, try to find one via external IDs
  let resolvedTmdbId = tmdbId

  if (!resolvedTmdbId && imdbId) {
    resolvedTmdbId = await findTVByImdbId(imdbId, { onLog })
  }

  if (!resolvedTmdbId && tvdbId) {
    resolvedTmdbId = await findTVByTvdbId(tvdbId, { onLog })
  }

  if (!resolvedTmdbId) {
    logger.debug({ imdbId, tvdbId }, 'Could not find TMDb ID for series')
    return null
  }

  // Fetch keywords
  const keywords = await getTVKeywords(resolvedTmdbId, { onLog })

  return {
    keywords,
  }
}

/**
 * Get series enrichment data by IMDB ID
 */
export async function getSeriesEnrichmentByImdbId(
  imdbId: string,
  options: { onLog?: ApiLogCallback } = {}
): Promise<SeriesEnrichmentData | null> {
  return getSeriesEnrichmentData(null, imdbId, null, options)
}

/**
 * Get series enrichment data by TMDb ID
 */
export async function getSeriesEnrichmentByTmdbId(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<SeriesEnrichmentData | null> {
  return getSeriesEnrichmentData(tmdbId, null, null, options)
}

/**
 * Get series enrichment data by TVDB ID
 */
export async function getSeriesEnrichmentByTvdbId(
  tvdbId: string,
  options: { onLog?: ApiLogCallback } = {}
): Promise<SeriesEnrichmentData | null> {
  return getSeriesEnrichmentData(null, null, tvdbId, options)
}


