import type { Movie, StrmConfig } from './types.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey } from '../settings/systemSettings.js'

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
 * Get the content to write inside the STRM file
 */
export async function getStrmContent(movie: Movie, config: StrmConfig): Promise<string> {
  // If streaming URL is preferred
  if (config.useStreamingUrl) {
    const provider = await getMediaServerProvider()
    const apiKey = (await getMediaServerApiKey()) || ''
    return provider.getStreamUrl(apiKey, movie.providerItemId)
  }

  // Try to get the actual file path
  if (movie.mediaSources && movie.mediaSources.length > 0) {
    const mediaPath = movie.mediaSources[0].path
    if (mediaPath) {
      return mediaPath
    }
  }

  if (movie.path) {
    return movie.path
  }

  // Fallback to streaming URL
  const provider = await getMediaServerProvider()
  const apiKey = (await getMediaServerApiKey()) || ''
  return provider.getStreamUrl(apiKey, movie.providerItemId)
}
