/**
 * TMDb TV Series API Functions
 */

import { createChildLogger } from '../lib/logger.js'
import { tmdbRequest, findTVByImdbId, findTVByTvdbId } from './client.js'
import type {
  TMDbTVDetails,
  TMDbTVKeywordsResponse,
  SeriesEnrichmentData,
} from './types.js'

const logger = createChildLogger('tmdb:series')

/**
 * Get TV series details from TMDb
 */
export async function getTVDetails(tmdbId: number): Promise<TMDbTVDetails | null> {
  return tmdbRequest<TMDbTVDetails>(`/tv/${tmdbId}`)
}

/**
 * Get TV series keywords from TMDb
 */
export async function getTVKeywords(tmdbId: number): Promise<string[]> {
  const result = await tmdbRequest<TMDbTVKeywordsResponse>(`/tv/${tmdbId}/keywords`)
  if (!result?.results) return []
  return result.results.map((k) => k.name)
}

/**
 * Get all enrichment data for a TV series
 */
export async function getSeriesEnrichmentData(
  tmdbId: number | null,
  imdbId: string | null,
  tvdbId: string | null
): Promise<SeriesEnrichmentData | null> {
  // If we don't have a TMDB ID, try to find one via external IDs
  let resolvedTmdbId = tmdbId

  if (!resolvedTmdbId && imdbId) {
    resolvedTmdbId = await findTVByImdbId(imdbId)
  }

  if (!resolvedTmdbId && tvdbId) {
    resolvedTmdbId = await findTVByTvdbId(tvdbId)
  }

  if (!resolvedTmdbId) {
    logger.debug({ imdbId, tvdbId }, 'Could not find TMDb ID for series')
    return null
  }

  // Fetch keywords
  const keywords = await getTVKeywords(resolvedTmdbId)

  return {
    keywords,
  }
}

/**
 * Get series enrichment data by IMDB ID
 */
export async function getSeriesEnrichmentByImdbId(imdbId: string): Promise<SeriesEnrichmentData | null> {
  return getSeriesEnrichmentData(null, imdbId, null)
}

/**
 * Get series enrichment data by TMDb ID
 */
export async function getSeriesEnrichmentByTmdbId(tmdbId: number): Promise<SeriesEnrichmentData | null> {
  return getSeriesEnrichmentData(tmdbId, null, null)
}

/**
 * Get series enrichment data by TVDB ID
 */
export async function getSeriesEnrichmentByTvdbId(tvdbId: string): Promise<SeriesEnrichmentData | null> {
  return getSeriesEnrichmentData(null, null, tvdbId)
}


