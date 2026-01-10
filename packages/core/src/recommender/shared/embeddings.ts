/**
 * Shared Embedding Utilities
 *
 * Common embedding operations used by both movie and series recommendation pipelines.
 */

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
  const normalizedWeights = weights
    ? weights.map((w) => w / weights.reduce((a, b) => a + b, 0))
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


