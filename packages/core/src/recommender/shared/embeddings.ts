/**
 * Shared Embedding Utilities
 *
 * Common embedding operations used by both movie and series recommendation pipelines.
 */

import { query } from '../../lib/db.js'
import { getActiveEmbeddingModelId, getActiveEmbeddingTableName } from '../../lib/ai-provider.js'

/** Fetch the vectors needed for custom-interest scoring in one batch. */
export async function getCandidateEmbeddings(
  candidateIds: string[],
  mediaType: 'movie' | 'series'
): Promise<Map<string, number[]>> {
  if (candidateIds.length === 0) return new Map()

  const modelId = (await getActiveEmbeddingModelId()) || 'unknown'
  const tableName = await getActiveEmbeddingTableName(mediaType === 'movie' ? 'embeddings' : 'series_embeddings')
  const idColumn = mediaType === 'movie' ? 'movie_id' : 'series_id'
  const result = await query<{ id: string; embedding: string }>(
    `SELECT ${idColumn} AS id, embedding::text FROM ${tableName}
     WHERE ${idColumn} = ANY($1::uuid[]) AND model = $2`,
    [candidateIds, modelId]
  )
  return new Map(result.rows.map((row) => [
    row.id,
    row.embedding.replace(/[[\]]/g, '').split(',').map(Number),
  ]))
}

/**
 * Average multiple embeddings, optionally with weights
 * Used to create a unified "taste vector" from multiple watched items
 */
export function averageEmbeddings(embeddings: number[][], weights?: number[]): number[] {
  if (embeddings.length === 0) {
    throw new Error('Cannot average empty embeddings array')
  }

  const dimensions = embeddings[0].length
  const result = new Array(dimensions).fill(0)

  // Normalize weights if provided
  const totalWeight = weights?.reduce((sum, weight) => sum + weight, 0) ?? 1
  const normalizedWeights = weights
    ? weights.map((w) => w / totalWeight)
    : embeddings.map(() => 1 / embeddings.length)

  for (let i = 0; i < embeddings.length; i++) {
    const weight = normalizedWeights[i]
    for (let d = 0; d < dimensions; d++) {
      result[d] += embeddings[i][d] * weight
    }
  }

  // Normalize the result vector
  const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let d = 0; d < dimensions; d++) {
      result[d] /= magnitude
    }
  }

  return result
}


