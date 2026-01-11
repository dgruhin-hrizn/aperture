import type { Movie } from './types.js'

/**
 * Sanitize a filename for filesystem use
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate a user folder name using hybrid format: DisplayName_providerUserId
 * This makes folders human-readable while maintaining uniqueness.
 *
 * Example: "John Smith" + "abc123def456" -> "John Smith_abc123def456"
 *
 * @param displayName - User's display name (will be sanitized)
 * @param providerUserId - Unique provider user ID
 * @returns Folder name in format "DisplayName_providerUserId"
 */
export function getUserFolderName(displayName: string, providerUserId: string): string {
  // Sanitize the display name (remove invalid filesystem characters, limit length)
  const safeName = displayName
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filesystem characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 30) // Limit to 30 chars for readability

  // Ensure we have a valid name, fall back to just ID if empty
  if (!safeName) {
    return providerUserId
  }

  return `${safeName}_${providerUserId}`
}

/**
 * Extract the provider user ID from a hybrid folder name
 * Handles both old-style (just ID) and new-style (DisplayName_ID) formats
 *
 * @param folderName - The folder name to parse
 * @returns The provider user ID portion
 */
export function extractProviderUserIdFromFolderName(folderName: string): string {
  // If the folder name contains an underscore, the ID is after the last underscore
  const lastUnderscoreIndex = folderName.lastIndexOf('_')
  if (lastUnderscoreIndex !== -1) {
    return folderName.substring(lastUnderscoreIndex + 1)
  }
  // Otherwise, the entire name is the ID (old format)
  return folderName
}

/**
 * Check if a folder name is in the old format (just the provider user ID)
 * vs the new format (DisplayName_providerUserId)
 *
 * @param folderName - The folder name to check
 * @param providerUserId - The known provider user ID
 * @returns true if old format, false if new format
 */
export function isOldFolderFormat(folderName: string, providerUserId: string): boolean {
  return folderName === providerUserId
}

/**
 * Build base filename for a movie (without extension)
 */
export function buildBaseFilename(movie: Movie): string {
  const title = sanitizeFilename(movie.title)
  const year = movie.year ? ` (${movie.year})` : ''
  return `${title}${year} [${movie.providerItemId}]`
}

/**
 * Build STRM file path for a movie
 */
export function buildStrmFilename(movie: Movie): string {
  return `${buildBaseFilename(movie)}.strm`
}

/**
 * Build NFO file path for a movie
 */
export function buildNfoFilename(movie: Movie): string {
  return `${buildBaseFilename(movie)}.nfo`
}

/**
 * Build poster image filename for a movie
 * Emby looks for <basename>-poster.jpg
 */
export function buildPosterFilename(movie: Movie): string {
  return `${buildBaseFilename(movie)}-poster.jpg`
}

/**
 * Build backdrop/fanart image filename for a movie
 * Emby looks for <basename>-fanart.jpg or backdrop.jpg
 */
export function buildBackdropFilename(movie: Movie): string {
  return `${buildBaseFilename(movie)}-fanart.jpg`
}

/**
 * Get the content to write inside the STRM file.
 * Uses the original file path when available (for local deployments with filesystem access).
 * Falls back to streaming URL for remote deployments.
 */
export function getStrmContent(filePath: string | null | undefined): string {
  if (filePath) {
    return filePath
  }
  throw new Error('No file path available for STRM content')
}
