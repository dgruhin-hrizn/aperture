import type { Candidate } from '../types.js'
import { applyDiversitySelection, type SelectionResult } from '../shared/index.js'

export interface MovieSelectionResult {
  selected: Candidate[]
  selectedRanks: Map<string, number>
}

/**
 * Apply diversity-aware selection to choose the best movie candidates.
 *
 * Uses the shared selection algorithm which:
 * 1. Preserves original base scores (no compounding)
 * 2. Re-evaluates all candidates at each selection step
 * 3. Properly blends base score with diversity
 * 4. Can promote more diverse candidates over higher-scored similar ones
 *
 * Returns both the selected candidates and their selection ranks.
 */
export function applyDiversityAndSelect(
  candidates: Candidate[],
  count: number,
  diversityWeight: number
): MovieSelectionResult {
  // Use shared diversity selection (without network diversity for movies)
  const result: SelectionResult<Candidate> = applyDiversitySelection(
    candidates,
    count,
    diversityWeight,
    false // Movies don't have network diversity
  )

  // Copy diversityBoost to diversityScore for backward compatibility
  for (const candidate of result.selected) {
    candidate.diversityScore = candidate.diversityBoost
  }

  return {
    selected: result.selected,
    selectedRanks: result.selectedRanks,
  }
}

