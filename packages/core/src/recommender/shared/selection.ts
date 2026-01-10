/**
 * Shared Diversity Selection Algorithm for Recommendations
 *
 * This algorithm selects diverse recommendations by iteratively:
 * 1. Calculating diversity scores based on what's already selected
 * 2. Blending base scores with diversity to get selection scores
 * 3. Picking the best candidate and updating tracking state
 *
 * This approach ensures that diversity can actually influence
 * the selection, unlike simpler algorithms that just add diversity
 * as a bonus after selection.
 */

import type { ScoringConfig, BaseCandidate } from './scoring.js'

/**
 * Extended candidate with optional network field (for TV series)
 */
export interface SelectableCandidate extends BaseCandidate {
  network?: string | null
}

/**
 * Result of diversity selection including selection order
 */
export interface SelectionResult<T extends SelectableCandidate> {
  selected: T[]
  selectedRanks: Map<string, number> // id -> selection rank (1-based)
}

/**
 * Calculate diversity boost for a candidate based on already-selected items.
 *
 * Diversity is based on:
 * - Genre diversity: prefer items with genres not yet in selection (60% weight)
 * - Network diversity: prefer items from underrepresented networks (40% weight, TV only)
 *
 * @param candidate - The candidate to evaluate
 * @param selectedGenres - Map of genre -> count in current selection
 * @param selectedNetworks - Map of network -> count in current selection (optional)
 * @param selectionCount - Number of items already selected
 */
export function calculateDiversityBoost(
  candidate: SelectableCandidate,
  selectedGenres: Map<string, number>,
  selectedNetworks: Map<string, number> | null,
  selectionCount: number
): number {
  let diversityBoost = 0

  // Genre diversity (60% of diversity score)
  if (candidate.genres.length > 0) {
    const genreOverlap = candidate.genres.filter((g) => selectedGenres.has(g)).length
    const genreDiversity = 1 - genreOverlap / candidate.genres.length
    diversityBoost += genreDiversity * 0.6
  } else {
    // No genres = neutral diversity
    diversityBoost += 0.3
  }

  // Network diversity (40% of diversity score, TV series only)
  if (selectedNetworks !== null) {
    if (candidate.network && selectionCount > 0) {
      const networkCount = selectedNetworks.get(candidate.network) || 0
      diversityBoost += (1 - networkCount / selectionCount) * 0.4
    } else {
      // No network info or first selection = neutral
      diversityBoost += 0.2
    }
  } else {
    // Movies don't have networks, give full genre weight instead
    if (candidate.genres.length > 0) {
      const genreOverlap = candidate.genres.filter((g) => selectedGenres.has(g)).length
      const genreDiversity = 1 - genreOverlap / candidate.genres.length
      diversityBoost += genreDiversity * 0.4
    } else {
      diversityBoost += 0.2
    }
  }

  return diversityBoost
}

/**
 * Apply diversity-aware selection to choose the best candidates.
 *
 * This algorithm:
 * 1. Preserves original base scores (no compounding)
 * 2. Re-evaluates all candidates at each selection step
 * 3. Properly blends base score with diversity
 * 4. Can promote more diverse candidates over higher-scored similar ones
 *
 * @param candidates - All candidates to select from
 * @param targetCount - Number of items to select
 * @param diversityWeight - How much to weight diversity (0-1)
 * @param useNetworkDiversity - Whether to track network diversity (for TV)
 */
export function applyDiversitySelection<T extends SelectableCandidate>(
  candidates: T[],
  targetCount: number,
  diversityWeight: number,
  useNetworkDiversity: boolean = false
): SelectionResult<T> {
  const selected: T[] = []
  const selectedRanks = new Map<string, number>()
  const selectedGenres = new Map<string, number>()
  const selectedNetworks = useNetworkDiversity ? new Map<string, number>() : null

  // Store original base scores - these don't change during selection
  const baseScores = new Map<string, number>()
  for (const candidate of candidates) {
    baseScores.set(candidate.id, candidate.finalScore)
  }

  // Track which candidates are still available
  const remaining = new Set(candidates.map((c) => c.id))
  const candidateMap = new Map(candidates.map((c) => [c.id, c]))

  // Track selected titles to avoid duplicates (different versions of same content)
  const selectedTitles = new Set<string>()

  while (selected.length < targetCount && remaining.size > 0) {
    let bestId: string | null = null
    let bestScore = -Infinity
    let bestDiversityBoost = 0

    // Find the best candidate considering both base score and diversity
    for (const id of remaining) {
      const candidate = candidateMap.get(id)!
      const baseScore = baseScores.get(id)!

      // Skip duplicate titles (e.g., different versions of same movie/series)
      const titleKey = `${candidate.title.toLowerCase()}|${candidate.year || 'unknown'}`
      if (selectedTitles.has(titleKey)) {
        continue
      }

      // Calculate diversity boost based on current selection
      const diversityBoost = calculateDiversityBoost(
        candidate,
        selectedGenres,
        selectedNetworks,
        selected.length
      )

      // Calculate selection score: blend base score with diversity
      const selectionScore = baseScore * (1 - diversityWeight) + diversityBoost * diversityWeight

      if (selectionScore > bestScore) {
        bestScore = selectionScore
        bestId = id
        bestDiversityBoost = diversityBoost
      }
    }

    // If no valid candidate found (all remaining are duplicates), break
    if (bestId === null) {
      break
    }

    // Select the best candidate
    const best = candidateMap.get(bestId)!
    remaining.delete(bestId)

    // Update candidate with selection info
    best.diversityBoost = bestDiversityBoost
    best.finalScore = bestScore // Update to selection score

    // Track for duplicate detection
    const titleKey = `${best.title.toLowerCase()}|${best.year || 'unknown'}`
    selectedTitles.add(titleKey)

    // Track selected genres for diversity calculation
    for (const genre of best.genres) {
      selectedGenres.set(genre, (selectedGenres.get(genre) || 0) + 1)
    }

    // Track selected networks for diversity calculation (TV only)
    if (selectedNetworks !== null && best.network) {
      selectedNetworks.set(best.network, (selectedNetworks.get(best.network) || 0) + 1)
    }

    // Record selection rank (1-based)
    const rank = selected.length + 1
    selectedRanks.set(bestId, rank)

    selected.push(best)
  }

  return { selected, selectedRanks }
}

/**
 * Simple greedy selection without diversity re-evaluation.
 * This is faster but less effective at diversifying.
 * Kept for comparison/fallback purposes.
 */
export function applySimpleSelection<T extends SelectableCandidate>(
  candidates: T[],
  targetCount: number,
  diversityWeight: number
): SelectionResult<T> {
  const selected: T[] = []
  const selectedRanks = new Map<string, number>()
  const selectedGenres = new Map<string, number>()
  const selectedTitles = new Set<string>()

  // Sort by base score descending
  const sorted = [...candidates].sort((a, b) => b.finalScore - a.finalScore)

  for (const candidate of sorted) {
    if (selected.length >= targetCount) break

    // Skip duplicates
    const titleKey = `${candidate.title.toLowerCase()}|${candidate.year || 'unknown'}`
    if (selectedTitles.has(titleKey)) {
      continue
    }

    // Calculate diversity bonus (additive only)
    const genreOverlap = candidate.genres.filter((g) => selectedGenres.has(g)).length
    const diversityScore =
      candidate.genres.length > 0 ? 1 - genreOverlap / candidate.genres.length : 0.5

    candidate.diversityBoost = diversityScore

    // Add diversity bonus to score
    candidate.finalScore = candidate.finalScore + diversityScore * diversityWeight

    // Track
    selectedTitles.add(titleKey)
    for (const genre of candidate.genres) {
      selectedGenres.set(genre, (selectedGenres.get(genre) || 0) + 1)
    }

    const rank = selected.length + 1
    selectedRanks.set(candidate.id, rank)
    selected.push(candidate)
  }

  return { selected, selectedRanks }
}



