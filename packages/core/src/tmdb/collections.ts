/**
 * TMDb Collections/Franchises API Functions
 */

import { createChildLogger } from '../lib/logger.js'
import { tmdbRequest, getImageUrl } from './client.js'
import type { TMDbCollectionDetails, CollectionData } from './types.js'

const logger = createChildLogger('tmdb:collections')

/**
 * Get collection details from TMDb
 */
export async function getCollectionDetails(collectionId: number): Promise<TMDbCollectionDetails | null> {
  return tmdbRequest<TMDbCollectionDetails>(`/collection/${collectionId}`)
}

/**
 * Get collection data in our internal format
 */
export async function getCollectionData(collectionId: number): Promise<CollectionData | null> {
  const details = await getCollectionDetails(collectionId)
  if (!details) {
    logger.debug({ collectionId }, 'Could not fetch collection details from TMDb')
    return null
  }

  return {
    tmdbId: details.id,
    name: details.name,
    overview: details.overview,
    posterUrl: getImageUrl(details.poster_path),
    backdropUrl: getImageUrl(details.backdrop_path, 'original'),
    parts: details.parts.map((part) => ({
      tmdbId: part.id,
      title: part.title,
      releaseDate: part.release_date,
    })),
  }
}

/**
 * Get multiple collections in batch
 */
export async function getCollectionsData(collectionIds: number[]): Promise<Map<number, CollectionData>> {
  const results = new Map<number, CollectionData>()

  // Process in chunks to avoid overwhelming the API
  const chunkSize = 10
  for (let i = 0; i < collectionIds.length; i += chunkSize) {
    const chunk = collectionIds.slice(i, i + chunkSize)
    const promises = chunk.map(async (id) => {
      const data = await getCollectionData(id)
      if (data) {
        results.set(id, data)
      }
    })
    await Promise.all(promises)
  }

  return results
}

