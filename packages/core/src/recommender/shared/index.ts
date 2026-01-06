/**
 * Shared Recommendation Algorithm Components
 *
 * This module provides unified scoring and selection algorithms
 * that are used by both movie and series recommendation pipelines.
 */

export {
  calculateRatingScore,
  calculateNoveltyScore,
  calculateBaseScore,
  type ScoringConfig,
  type BaseCandidate,
} from './scoring.js'

export {
  calculateDiversityBoost,
  applyDiversitySelection,
  applySimpleSelection,
  type SelectableCandidate,
  type SelectionResult,
} from './selection.js'

export { averageEmbeddings } from './embeddings.js'

