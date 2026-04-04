/**
 * TMDb person search, profile images, combined credits, and DB-backed name cache.
 */

import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { getImageUrl, tmdbRequest, type ApiLogCallback } from './client.js'

const logger = createChildLogger('tmdb-person')

/** Combined credits JSON TTL (24h). */
export const COMBINED_CREDITS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function normalizePersonNameKey(decodedName: string): string {
  return decodedName.trim().toLowerCase()
}

export interface TmdbPersonSearchResult {
  id: number
  name: string
  profile_path: string | null
  popularity: number
}

/**
 * Search TMDb for a person by name; prefers case-insensitive exact name match, else highest popularity.
 */
export async function searchPersonByName(
  name: string,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TmdbPersonSearchResult | null> {
  interface SearchResponse {
    results?: Array<{
      id: number
      name: string
      profile_path: string | null
      popularity: number
    }>
  }

  const result = await tmdbRequest<SearchResponse>(
    `/search/person?query=${encodeURIComponent(name)}`,
    options
  )

  if (!result?.results?.length) {
    return null
  }

  const trimmed = name.trim()
  const exactMatch = result.results.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())
  if (exactMatch) {
    return exactMatch
  }

  return [...result.results].sort((a, b) => b.popularity - a.popularity)[0]
}

/** Raw combined credits from TMDb (movie + TV cast and crew). */
export interface TmdbCombinedCreditsResponse {
  id?: number
  cast?: TmdbCombinedCreditEntry[]
  crew?: TmdbCombinedCreditEntry[]
}

export interface TmdbCombinedCreditEntry {
  id: number
  media_type?: string
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  poster_path?: string | null
  backdrop_path?: string | null
  character?: string
  job?: string
  department?: string
  release_date?: string | null
  first_air_date?: string | null
  adult?: boolean
}

export async function getPersonCombinedCredits(
  personId: number,
  options: { onLog?: ApiLogCallback } = {}
): Promise<TmdbCombinedCreditsResponse | null> {
  return tmdbRequest<TmdbCombinedCreditsResponse>(
    `/person/${personId}/combined_credits`,
    options
  )
}

interface ProfileCacheRow {
  name_key: string
  tmdb_person_id: number | null
  profile_path: string | null
  not_found: boolean
  combined_credits_json: unknown
  combined_credits_cached_at: Date | null
  updated_at: Date
}

export async function getPersonTmdbCacheRow(
  nameKey: string
): Promise<ProfileCacheRow | null> {
  return queryOne<ProfileCacheRow>(
    `SELECT name_key, tmdb_person_id, profile_path, not_found,
            combined_credits_json, combined_credits_cached_at, updated_at
     FROM person_tmdb_profile_cache WHERE name_key = $1`,
    [nameKey]
  )
}

export async function upsertPersonTmdbCache(params: {
  nameKey: string
  tmdbPersonId: number | null
  profilePath: string | null
  notFound: boolean
}): Promise<void> {
  await query(
    `INSERT INTO person_tmdb_profile_cache (
       name_key, tmdb_person_id, profile_path, not_found, updated_at
     ) VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (name_key) DO UPDATE SET
       tmdb_person_id = EXCLUDED.tmdb_person_id,
       profile_path = EXCLUDED.profile_path,
       not_found = EXCLUDED.not_found,
       updated_at = NOW()`,
    [params.nameKey, params.tmdbPersonId, params.profilePath, params.notFound]
  )
}

export async function upsertPersonCombinedCreditsCache(
  nameKey: string,
  tmdbPersonId: number,
  json: TmdbCombinedCreditsResponse
): Promise<void> {
  await query(
    `INSERT INTO person_tmdb_profile_cache (
       name_key, tmdb_person_id, not_found,
       combined_credits_json, combined_credits_cached_at, updated_at
     ) VALUES ($1, $2, FALSE, $3::jsonb, NOW(), NOW())
     ON CONFLICT (name_key) DO UPDATE SET
       tmdb_person_id = COALESCE(person_tmdb_profile_cache.tmdb_person_id, EXCLUDED.tmdb_person_id),
       combined_credits_json = EXCLUDED.combined_credits_json,
       combined_credits_cached_at = EXCLUDED.combined_credits_cached_at,
       updated_at = NOW()`,
    [nameKey, tmdbPersonId, JSON.stringify(json)]
  )
}

export interface ResolveTmdbPersonProfileResult {
  imageUrl: string | null
  tmdbPersonId: number | null
}

/**
 * Resolve profile image URL from cache or TMDb search; upserts cache row.
 */
export async function resolveTmdbPersonProfileImageUrl(
  decodedName: string
): Promise<ResolveTmdbPersonProfileResult> {
  const nameKey = normalizePersonNameKey(decodedName)
  const cached = await getPersonTmdbCacheRow(nameKey)

  if (cached?.not_found) {
    return { imageUrl: null, tmdbPersonId: null }
  }

  if (cached?.tmdb_person_id != null) {
    const url = getImageUrl(cached.profile_path, 'w185')
    return { imageUrl: url, tmdbPersonId: cached.tmdb_person_id }
  }

  const found = await searchPersonByName(decodedName)
  if (!found) {
    await upsertPersonTmdbCache({
      nameKey,
      tmdbPersonId: null,
      profilePath: null,
      notFound: true,
    })
    return { imageUrl: null, tmdbPersonId: null }
  }

  await upsertPersonTmdbCache({
    nameKey,
    tmdbPersonId: found.id,
    profilePath: found.profile_path,
    notFound: false,
  })

  const imageUrl = getImageUrl(found.profile_path, 'w185')
  return { imageUrl, tmdbPersonId: found.id }
}

/**
 * Ensure we have a TMDb person id (from cache or search) without requiring a separate image resolve pass.
 */
export async function resolveTmdbPersonId(decodedName: string): Promise<number | null> {
  const nameKey = normalizePersonNameKey(decodedName)
  const cached = await getPersonTmdbCacheRow(nameKey)

  if (cached?.not_found) {
    return null
  }
  if (cached?.tmdb_person_id != null) {
    return cached.tmdb_person_id
  }

  const r = await resolveTmdbPersonProfileImageUrl(decodedName)
  return r.tmdbPersonId
}

/**
 * Combined credits with optional 24h DB cache keyed by normalized name.
 */
export async function getCachedOrFetchCombinedCredits(
  decodedName: string,
  tmdbPersonId: number
): Promise<TmdbCombinedCreditsResponse | null> {
  const nameKey = normalizePersonNameKey(decodedName)
  const row = await getPersonTmdbCacheRow(nameKey)
  const now = Date.now()

  if (
    row?.combined_credits_json &&
    row.combined_credits_cached_at &&
    now - new Date(row.combined_credits_cached_at).getTime() < COMBINED_CREDITS_CACHE_TTL_MS
  ) {
    return row.combined_credits_json as TmdbCombinedCreditsResponse
  }

  const credits = await getPersonCombinedCredits(tmdbPersonId)
  if (!credits) {
    logger.warn({ tmdbPersonId }, 'TMDb combined_credits returned null')
    return null
  }

  try {
    await upsertPersonCombinedCreditsCache(nameKey, tmdbPersonId, credits)
  } catch (err) {
    logger.warn({ err, nameKey }, 'Failed to persist combined credits cache')
  }

  return credits
}
