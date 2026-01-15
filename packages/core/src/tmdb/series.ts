/**
 * TMDb TV Series API Functions
 */

import { createChildLogger } from '../lib/logger.js'
import { tmdbRequest, findTVByImdbId, findTVByTvdbId, type ApiLogCallback } from './client.js'
import type {
  TMDbTVDetails,
  TMDbTVKeywordsResponse,
  TMDbTVCreditsResponse,
  TMDbExternalIds,
  SeriesEnrichmentData,
  NetworkData,
  ProductionCompanyData,
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
 * Get TV series external IDs (IMDb, TVDB, etc.)
 */
export async function getTVExternalIds(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbExternalIds | null> {
  return tmdbRequest<TMDbExternalIds>(`/tv/${tmdbId}/external_ids`, options)
}

/**
 * Get TV series credits (cast and crew) from TMDb
 */
export async function getTVCredits(
  tmdbId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TMDbTVCreditsResponse | null> {
  return tmdbRequest<TMDbTVCreditsResponse>(`/tv/${tmdbId}/credits`, options)
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

  // Fetch all data in parallel
  const [details, keywords] = await Promise.all([
    getTVDetails(resolvedTmdbId, { onLog }),
    getTVKeywords(resolvedTmdbId, { onLog }),
  ])

  // Extract networks
  const networks: NetworkData[] = details?.networks?.map((network) => ({
    tmdbId: network.id,
    name: network.name,
    logoPath: network.logo_path,
    originCountry: network.origin_country,
  })) || []

  // Extract production companies
  const productionCompanies: ProductionCompanyData[] = details?.production_companies?.map((company) => ({
    tmdbId: company.id,
    name: company.name,
    logoPath: company.logo_path,
    originCountry: company.origin_country,
  })) || []

  return {
    keywords,
    networks,
    productionCompanies,
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


