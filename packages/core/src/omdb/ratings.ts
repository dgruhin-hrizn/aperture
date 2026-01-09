/**
 * OMDb Ratings API Functions
 */

import { createChildLogger } from '../lib/logger.js'
import { omdbRequest } from './client.js'
import type { OMDbMovieResponse, RatingsData } from './types.js'

const logger = createChildLogger('omdb:ratings')

/**
 * Parse Rotten Tomatoes score from OMDb rating string
 * e.g., "85%" -> 85
 */
function parsePercentage(value: string | undefined): number | null {
  if (!value) return null
  const match = value.match(/^(\d+)%$/)
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

/**
 * Parse Metacritic score from OMDb Metascore string
 * e.g., "74" -> 74, "N/A" -> null
 */
function parseMetascore(value: string | undefined): number | null {
  if (!value || value === 'N/A') return null
  const num = parseInt(value, 10)
  return isNaN(num) ? null : num
}

/**
 * Parse awards summary from OMDb
 * e.g., "Won 4 Oscars. 12 nominations total."
 */
function parseAwards(value: string | undefined): string | null {
  if (!value || value === 'N/A') return null
  return value
}

/**
 * Extract ratings data from OMDb response
 */
export function extractRatingsData(data: OMDbMovieResponse): RatingsData {
  // Find Rotten Tomatoes rating
  const rtRating = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')
  const rtCriticScore = parsePercentage(rtRating?.Value)

  // OMDb doesn't provide RT Audience Score directly
  // We could potentially scrape it, but for now we'll leave it null
  const rtAudienceScore: number | null = null

  // Get Metacritic score
  const metacriticScore = parseMetascore(data.Metascore)

  // Get awards summary
  const awardsSummary = parseAwards(data.Awards)

  return {
    rtCriticScore,
    rtAudienceScore,
    metacriticScore,
    awardsSummary,
  }
}

/**
 * Get ratings data for a movie/series by IMDB ID
 */
export async function getRatingsData(imdbId: string): Promise<RatingsData | null> {
  const data = await omdbRequest(imdbId)
  if (!data) {
    return null
  }

  return extractRatingsData(data)
}

/**
 * Get ratings data for multiple IMDB IDs in batch
 * Returns a map of IMDB ID -> RatingsData
 */
export async function getRatingsDataBatch(
  imdbIds: string[]
): Promise<Map<string, RatingsData>> {
  const results = new Map<string, RatingsData>()

  // Process in chunks to respect rate limits
  const chunkSize = 10
  for (let i = 0; i < imdbIds.length; i += chunkSize) {
    const chunk = imdbIds.slice(i, i + chunkSize)
    const promises = chunk.map(async (imdbId) => {
      const data = await getRatingsData(imdbId)
      if (data) {
        results.set(imdbId, data)
      }
    })
    await Promise.all(promises)
  }

  return results
}

/**
 * Get full OMDb data for a movie/series by IMDB ID
 */
export async function getOMDbData(imdbId: string): Promise<OMDbMovieResponse | null> {
  return omdbRequest(imdbId)
}

