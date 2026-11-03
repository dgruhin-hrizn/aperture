import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getActiveEmbeddingModelId, getActiveEmbeddingTableName } from '../../lib/ai-provider.js'
import { suggestionTitleKeySql } from '../shared/suggestionHistory.js'
import type { Candidate } from '../types.js'

const logger = createChildLogger('recommender-candidates')

export async function getCandidates(
  tasteProfile: number[],
  watchedIds: Set<string>,
  limit: number,
  includeWatched: boolean = false,
  maxParentalRating: number | null = null,
  history?: { userId: string; cooldownDays: number; allowedSourceIds?: string[] }
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

  const historyJoin = history
    ? `LEFT JOIN recommendation_suggestion_history h
         ON h.user_id = $4 AND h.media_type = 'movie'
         AND h.title_key = (${suggestionTitleKeySql('m.title', 'm.year')})`
    : ''
  const historyFilter = history
    ? "AND (h.last_suggested_at IS NULL OR h.last_suggested_at <= NOW() - $5::int * INTERVAL '24 hours')"
    : ''
  const libraryFilter = history?.allowedSourceIds ? "AND m.provider_library_id = ANY($6::text[])"
    : hasLibraryConfigs
    ? `AND EXISTS (
         SELECT 1 FROM library_config lc
         WHERE lc.provider_library_id = m.provider_library_id AND lc.is_enabled = true
       )`
    : ''

  const params: unknown[] = [vectorStr, queryLimit, modelId]
  if (history) params.push(history.userId, history.cooldownDays)
  if (history?.allowedSourceIds) params.push(history.allowedSourceIds)

  // Use pgvector to find similar movies, filtered by enabled libraries, parental rating, and model
  const result = await query<{
    id: string
    title: string
    year: number | null
    genres: string[]
    community_rating: number | null
    similarity: number
    previously_suggested: boolean
  }>(
    `SELECT m.id, m.title, m.year, m.genres, m.community_rating,
            1 - (e.embedding <=> $1::halfvec) as similarity,
            ${history ? 'h.last_suggested_at IS NOT NULL' : 'FALSE'} AS previously_suggested
     FROM ${tableName} e
     JOIN movies m ON m.id = e.movie_id
     ${historyJoin}
     WHERE e.model = $3 ${libraryFilter} ${parentalFilter} ${historyFilter}
     ORDER BY e.embedding <=> $1::halfvec
     LIMIT $2`,
    params
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
    previouslySuggested: row.previously_suggested,
    novelty: 0,
    ratingScore: 0,
    diversityScore: 0,
    diversityBoost: 0,
    finalScore: 0,
  }))
}

