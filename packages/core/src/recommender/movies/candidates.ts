import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getActiveEmbeddingModelId, getActiveEmbeddingTableName } from '../../lib/ai-provider.js'
import type { Candidate } from '../types.js'

const logger = createChildLogger('recommender-candidates')

export async function getCandidates(
  tasteProfile: number[],
  watchedIds: Set<string>,
  limit: number,
  includeWatched: boolean = false,
  maxParentalRating: number | null = null
): Promise<Candidate[]> {
  const vectorStr = `[${tasteProfile.join(',')}]`

  // Get active embedding model
  const modelId = await getActiveEmbeddingModelId()
  if (!modelId) {
    logger.warn('No embedding model configured for candidate generation')
    return []
  }

  // Get the embedding table name
  const tableName = await getActiveEmbeddingTableName('embeddings')

  // Check if any library configs exist
  const configCheck = await queryOne<{ count: string }>('SELECT COUNT(*) FROM library_config')
  const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0

  // Calculate query limit - if excluding watched, need more results to filter from
  const queryLimit = includeWatched ? limit : limit + watchedIds.size

  // Build parental rating filter clause
  const parentalFilter =
    maxParentalRating !== null
      ? ` AND (m.content_rating IS NULL OR COALESCE((
          SELECT prv.rating_value FROM parental_rating_values prv 
          WHERE prv.rating_name = m.content_rating LIMIT 1
        ), 0) <= ${maxParentalRating})`
      : ''

  // Use pgvector to find similar movies, filtered by enabled libraries, parental rating, and model
  const result = await query<{
    id: string
    title: string
    year: number | null
    genres: string[]
    community_rating: number | null
    similarity: number
  }>(
    hasLibraryConfigs
      ? `SELECT m.id, m.title, m.year, m.genres, m.community_rating,
                1 - (e.embedding <=> $1::halfvec) as similarity
         FROM ${tableName} e
         JOIN movies m ON m.id = e.movie_id
         WHERE e.model = $3 AND EXISTS (
           SELECT 1 FROM library_config lc 
           WHERE lc.provider_library_id = m.provider_library_id 
           AND lc.is_enabled = true
         )${parentalFilter}
         ORDER BY e.embedding <=> $1::halfvec
         LIMIT $2`
      : `SELECT m.id, m.title, m.year, m.genres, m.community_rating,
                1 - (e.embedding <=> $1::halfvec) as similarity
         FROM ${tableName} e
         JOIN movies m ON m.id = e.movie_id
         WHERE e.model = $3${parentalFilter}
         ORDER BY e.embedding <=> $1::halfvec
         LIMIT $2`,
    [vectorStr, queryLimit, modelId]
  )

  // Filter out watched movies if not including them
  const filteredRows = includeWatched
    ? result.rows
    : result.rows.filter((row) => !watchedIds.has(row.id))

  return filteredRows.slice(0, limit).map((row) => ({
    movieId: row.id,
    id: row.id, // Alias for shared selection algorithm
    title: row.title,
    year: row.year,
    genres: row.genres || [],
    communityRating: row.community_rating,
    similarity: row.similarity,
    novelty: 0,
    ratingScore: 0,
    diversityScore: 0,
    diversityBoost: 0,
    finalScore: 0,
  }))
}

