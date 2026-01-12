/**
 * Image Utilities
 *
 * Utilities for handling media server image URLs, including proxying
 * and fallback handling.
 */

/** Fallback image path for when no poster is available */
export const FALLBACK_POSTER_URL = '/NO_POSTER_FOUND.png'

/**
 * Check if a URL is an Emby/Jellyfin image URL that should be proxied
 */
function isMediaServerUrl(url: string): boolean {
  // Check for common Emby/Jellyfin image URL patterns
  // These URLs typically contain /Items/, /Persons/, or /Users/ followed by /Images/
  return (
    url.includes('/Items/') ||
    url.includes('/Persons/') ||
    url.includes('/Users/')
  ) && url.includes('/Images/')
}

/**
 * Extract the path portion from a full URL
 * e.g., "http://192.168.1.8:8096/Items/123/Images/Primary" -> "Items/123/Images/Primary"
 */
function extractImagePath(url: string): string {
  try {
    const urlObj = new URL(url)
    // Remove leading slash and return the path + query string
    const path = urlObj.pathname.replace(/^\//, '')
    const queryString = urlObj.search
    return path + queryString
  } catch {
    // If URL parsing fails, try to extract path manually
    // Find the first occurrence of Items/, Persons/, or Users/
    const patterns = ['/Items/', '/Persons/', '/Users/']
    for (const pattern of patterns) {
      const index = url.indexOf(pattern)
      if (index !== -1) {
        return url.substring(index + 1) // +1 to skip the leading /
      }
    }
    return url
  }
}

/**
 * Convert a media server image URL to use the local proxy
 * 
 * @param url - The original image URL (may be null/undefined, a media server URL, or already relative)
 * @param fallback - Optional custom fallback URL (defaults to FALLBACK_POSTER_URL)
 * @returns The proxied URL, or fallback if no URL provided
 */
export function getProxiedImageUrl(
  url: string | null | undefined,
  fallback: string = FALLBACK_POSTER_URL
): string {
  // Return fallback for null/undefined URLs
  if (!url) {
    return fallback
  }

  // If it's already a relative URL (starts with /), return as-is
  if (url.startsWith('/')) {
    return url
  }

  // If it's a media server URL, proxy it
  if (isMediaServerUrl(url)) {
    const imagePath = extractImagePath(url)
    return `/api/media/images/${imagePath}`
  }

  // For other URLs (like TMDB), return as-is
  return url
}

