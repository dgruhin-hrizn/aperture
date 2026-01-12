/**
 * useProxiedImageUrl Hook
 *
 * Re-exports the image proxying utilities from @aperture/ui for convenience.
 * These utilities rewrite Emby/Jellyfin image URLs to use the local proxy endpoint,
 * eliminating mixed content issues when accessing Aperture through a reverse proxy.
 */

// Re-export from @aperture/ui
export { getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'

/**
 * Hook version of getProxiedImageUrl for use in React components
 * This is a simple wrapper that can be extended with caching/memoization if needed
 */
import { getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'

export function useProxiedImageUrl(
  url: string | null | undefined,
  fallback: string = FALLBACK_POSTER_URL
): string {
  return getProxiedImageUrl(url, fallback)
}

