/**
 * TMDb configuration endpoints (countries, etc.)
 */
import { tmdbRequest, type ApiLogCallback } from './client.js'

export interface TmdbConfigurationCountry {
  iso_3166_1: string
  english_name: string
  native_name: string
}

/**
 * GET /configuration/countries — ISO 3166-1 list for Discover filters (`with_origin_country`).
 */
export async function getTmdbConfigurationCountries(
  options: { language?: string; onLog?: ApiLogCallback } = {}
): Promise<TmdbConfigurationCountry[]> {
  const lang = options.language ?? 'en-US'
  const result = await tmdbRequest<TmdbConfigurationCountry[]>(
    `/configuration/countries?language=${encodeURIComponent(lang)}`,
    options
  )
  return Array.isArray(result) ? result : []
}
