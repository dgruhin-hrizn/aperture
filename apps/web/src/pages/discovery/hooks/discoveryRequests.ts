import type { DiscoveryCandidate, DiscoveryFilterOptions, DiscoveryRun, MediaType } from '../types'

const CACHE_PREFIX = 'aperture_discovery_v4:'
const CACHE_TTL = 60 * 60_000
const MAX_CACHED_LISTS = 8

export function filterQuery(filters: DiscoveryFilterOptions): string {
  const params = new URLSearchParams()
  if (filters.languages?.length) {
    params.set('languages', [...filters.languages].sort().join(','))
    if (filters.includeUnknownLanguage === false) params.set('includeUnknownLanguage', 'false')
  }
  if (filters.genreIds?.length)
    params.set('genres', [...filters.genreIds].sort((a, b) => a - b).join(','))
  if (filters.yearStart !== undefined) params.set('yearStart', String(filters.yearStart))
  if (filters.yearEnd !== undefined) params.set('yearEnd', String(filters.yearEnd))
  if (filters.minSimilarity && filters.minSimilarity > 0)
    params.set('minSimilarity', String(filters.minSimilarity))
  return params.size ? `?${params}` : ''
}

export function requestSignal(signal: AbortSignal, timeoutMs = 15_000) {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
}

export interface CandidateResponse {
  candidates: DiscoveryCandidate[]
  run: DiscoveryRun | null
}
interface CachedCandidates {
  etag: string
  timestamp: number
  data: CandidateResponse
}

export function retireLegacyCache() {
  try {
    localStorage.removeItem('aperture_discovery_cache')
  } catch {
    /* Storage can be disabled. */
  }
}

export function invalidateDiscoveryCache(userId?: string) {
  retireLegacyCache()
  try {
    const prefix = userId ? `${CACHE_PREFIX}${userId}:` : CACHE_PREFIX
    for (const key of Object.keys(localStorage))
      if (key.startsWith(prefix)) localStorage.removeItem(key)
  } catch {
    /* Storage can be disabled. */
  }
}

/** Cached rows are never displayed until the authenticated server revalidates current exclusions. */
export async function loadCandidates(
  userId: string,
  type: MediaType,
  query: string,
  signal: AbortSignal
): Promise<CandidateResponse> {
  const key = `${CACHE_PREFIX}${userId}:${type}:${query}`
  let cached: CachedCandidates | null = null
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const entry = JSON.parse(raw) as CachedCandidates
      if (entry.etag && entry.data && Date.now() - entry.timestamp < CACHE_TTL) cached = entry
    }
  } catch {
    /* Ignore corrupt or unavailable storage. */
  }
  const response = await fetch(`/api/discovery/${type === 'movie' ? 'movies' : 'series'}${query}`, {
    credentials: 'include',
    signal: requestSignal(signal),
    headers: cached ? { 'If-None-Match': cached.etag } : {},
  })
  if (response.status === 304 && cached) return cached.data
  if (!response.ok) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    throw new Error('Failed to load discovery suggestions')
  }
  const data = (await response.json()) as CandidateResponse
  signal.throwIfAborted()
  const etag = response.headers.get('etag')
  if (etag) {
    try {
      localStorage.setItem(key, JSON.stringify({ etag, timestamp: Date.now(), data }))
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX))
      keys.sort(
        (a, b) =>
          JSON.parse(localStorage.getItem(a)!).timestamp -
          JSON.parse(localStorage.getItem(b)!).timestamp
      )
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_LISTS)))
        localStorage.removeItem(old)
    } catch {
      /* Storage full or unavailable. */
    }
  }
  return data
}

export { cachedResource as discoveryResource } from '../../../hooks/cachedResource'

export function mediaKey(type: MediaType, id: number) {
  return `${type === 'movie' ? 'movie' : 'tv'}:${id}`
}
