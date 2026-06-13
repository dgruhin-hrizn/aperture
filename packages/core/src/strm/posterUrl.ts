/**
 * Resolve poster URLs for Top Picks / recommendation overlay generation.
 * Prefers the library's media-server poster when available; TMDB is the fallback.
 */

import { createChildLogger } from '../lib/logger.js'
import { getImageUrl } from '../tmdb/client.js'
import { getMovieDetails } from '../tmdb/movies.js'
import { getTVDetails } from '../tmdb/series.js'
import {
  getCachedTmdbPostersBatch,
  tmdbPosterCacheTtlMs,
  upsertTmdbPosterCache,
} from '../justwatch/tmdbPosterCache.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'

const logger = createChildLogger('strm-poster-url')

export interface ResolvePosterUrlOptions {
  mediaType: 'movie' | 'series'
  tmdbId: string | null
  posterUrl: string | null
}

/** True when URL points at a media-server item image (may need api_key to fetch). */
export function isMediaServerPosterUrl(url: string): boolean {
  return /\/Items\/[^/]+\/Images\/(?:Primary|Poster)/i.test(url)
}

/** Build a fetchable TMDB poster URL from a poster_path. */
export function buildTmdbPosterUrl(posterPath: string): string {
  return getImageUrl(posterPath, 'w500')!
}

/**
 * Order poster URL candidates: library (Emby/Jellyfin) first, TMDB second.
 * Exported for unit tests.
 */
export function orderPosterUrlCandidates(
  libraryPosterUrl: string | null,
  tmdbPosterUrl: string | null
): string[] {
  const candidates: string[] = []
  if (libraryPosterUrl) {
    candidates.push(libraryPosterUrl)
  }
  if (tmdbPosterUrl && !candidates.includes(tmdbPosterUrl)) {
    candidates.push(tmdbPosterUrl)
  }
  return candidates
}

/**
 * Resolve poster URL candidates for burning a rank overlay.
 * Library poster_url is tried first (already working in the user's server);
 * TMDB is used when the library has no poster or the library fetch fails.
 */
export async function resolvePosterUrlCandidates(
  options: ResolvePosterUrlOptions
): Promise<string[]> {
  const { mediaType, tmdbId, posterUrl } = options

  let libraryUrl: string | null = null
  if (posterUrl) {
    libraryUrl = await augmentMediaServerImageUrl(posterUrl)
  }

  let tmdbUrl: string | null = null
  if (tmdbId) {
    const tmdbIdNum = parseInt(tmdbId, 10)
    if (!Number.isNaN(tmdbIdNum)) {
      tmdbUrl = await resolveTmdbPosterUrl(mediaType, tmdbIdNum)
    }
  }

  return orderPosterUrlCandidates(libraryUrl, tmdbUrl)
}

/**
 * Resolve the primary poster URL for burning a rank overlay.
 */
export async function resolvePosterUrlForOverlay(
  options: ResolvePosterUrlOptions
): Promise<string | null> {
  const candidates = await resolvePosterUrlCandidates(options)
  return candidates[0] ?? null
}

async function resolveTmdbPosterUrl(
  mediaType: 'movie' | 'series',
  tmdbId: number
): Promise<string | null> {
  const cacheMediaType = mediaType === 'series' ? 'tv' : 'movie'
  const cached = await getCachedTmdbPostersBatch(cacheMediaType, [tmdbId], 'en')
  const row = cached.get(tmdbId)
  const ttl = tmdbPosterCacheTtlMs()
  const now = Date.now()

  if (row && now - row.fetchedAtMs <= ttl && row.posterPath) {
    return buildTmdbPosterUrl(row.posterPath)
  }

  let posterPath: string | null = null
  if (mediaType === 'movie') {
    const details = await getMovieDetails(tmdbId)
    posterPath = details?.poster_path ?? null
  } else {
    const details = await getTVDetails(tmdbId)
    posterPath = details?.poster_path ?? null
  }

  if (posterPath) {
    await upsertTmdbPosterCache(cacheMediaType, tmdbId, 'en', posterPath)
    return buildTmdbPosterUrl(posterPath)
  }

  logger.debug({ mediaType, tmdbId }, 'No TMDB poster_path available')
  return null
}

/** Append api_key to media-server image URLs so server-side fetch can authenticate. */
export async function augmentMediaServerImageUrl(url: string): Promise<string> {
  if (!isMediaServerPosterUrl(url)) {
    return url
  }

  if (url.includes('api_key=') || url.includes('api_key%3D')) {
    return url
  }

  const apiKey = await getMediaServerApiKey()
  if (!apiKey) {
    logger.debug({ url: url.substring(0, 80) }, 'Media server poster URL without api_key')
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}api_key=${encodeURIComponent(apiKey)}`
}
