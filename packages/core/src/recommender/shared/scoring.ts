/**
 * Shared Scoring Functions for Recommendation Algorithm
 *
 * These functions provide consistent scoring behavior for both
 * movies and series recommendations.
 */

/**
 * Calculate rating score using absolute 0-10 scale with tiered scoring.
 * Handles bad data (ratings > 10) and missing ratings gracefully.
 *
 * Score ranges:
 * - 8.0-10.0: 0.8-1.0 (excellent)
 * - 7.0-8.0:  0.6-0.8 (good)
 * - 6.0-7.0:  0.4-0.6 (average)
 * - 5.0-6.0:  0.2-0.4 (below average)
 * - 0.0-5.0:  0.0-0.2 (poor)
 * - null:     0.4 (neutral default)
 */
export function calculateRatingScore(rating: number | null | undefined): number {
  if (rating == null) {
    return 0.4 // Neutral default - doesn't advantage or disadvantage
  }

  // Clamp rating to 0-10 range (handles bad data like 101.00)
  const clampedRating = Math.min(Math.max(rating, 0), 10)

  if (clampedRating >= 8) {
    return 0.8 + (clampedRating - 8) * 0.1 // 8.0 -> 0.8, 10.0 -> 1.0
  } else if (clampedRating >= 7) {
    return 0.6 + (clampedRating - 7) * 0.2 // 7.0 -> 0.6, 8.0 -> 0.8
  } else if (clampedRating >= 6) {
    return 0.4 + (clampedRating - 6) * 0.2 // 6.0 -> 0.4, 7.0 -> 0.6
  } else if (clampedRating >= 5) {
    return 0.2 + (clampedRating - 5) * 0.2 // 5.0 -> 0.2, 6.0 -> 0.4
  } else {
    return clampedRating / 25 // 0.0 -> 0.0, 5.0 -> 0.2
  }
}

/**
 * Calculate novelty score based on genre overlap with watched content.
 *
 * The novelty score rewards items that introduce some new genres while
 * still having some familiar genres (partial novelty is best).
 *
 * @param itemGenres - Genres of the candidate item
 * @param watchedGenreCounts - Map of genre -> count from user's watch history
 * @param totalWatchedGenres - Total genre occurrences in watch history
 */
export function calculateNoveltyScore(
  itemGenres: string[],
  watchedGenreCounts: Map<string, number>,
  totalWatchedGenres: number
): number {
  // Default for items without genre data - neutral score
  if (!itemGenres || itemGenres.length === 0) {
    return 0.5
  }

  // Calculate how novel each genre is (1 = completely new, 0 = very common)
  const genreNovelties = itemGenres.map((genre) => {
    const count = watchedGenreCounts.get(genre) || 0
    if (totalWatchedGenres === 0) return 0.5 // No watch history = neutral
    return 1 - count / totalWatchedGenres
  })

  // Average novelty across all genres
  const avgNovelty = genreNovelties.reduce((a, b) => a + b, 0) / genreNovelties.length

  // Count completely novel genres (not in watch history at all)
  const novelGenreCount = itemGenres.filter((g) => !watchedGenreCounts.has(g)).length
  const noveltyRatio = novelGenreCount / itemGenres.length

  // Reward partial novelty (some new genres, some familiar)
  // Pure novelty (all new) is risky, no novelty is boring
  if (noveltyRatio > 0 && noveltyRatio < 0.7) {
    // Sweet spot: 1-70% new genres
    return 0.5 + avgNovelty * 0.4 // 0.5-0.9 range
  } else if (noveltyRatio >= 0.7) {
    // Too novel - user hasn't shown interest in these genres
    return 0.3 + avgNovelty * 0.2 // 0.3-0.5 range
  } else {
    // No novelty - all familiar genres
    return 0.4 + avgNovelty * 0.2 // 0.4-0.6 range
  }
}

/**
 * Configuration for scoring weights
 */
export interface ScoringConfig {
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
}

/**
 * Base candidate interface that both movies and series extend
 */
export interface BaseCandidate {
  id: string
  title: string
  year: number | null
  genres: string[]
  similarity: number
  novelty: number
  ratingScore: number
  diversityBoost: number
  finalScore: number
}

/**
 * Calculate the base score for a candidate (before diversity).
 * This combines similarity, novelty, and rating using the configured weights.
 */
export function calculateBaseScore(
  similarity: number,
  novelty: number,
  ratingScore: number,
  config: Pick<ScoringConfig, 'similarityWeight' | 'noveltyWeight' | 'ratingWeight'>
): number {
  return (
    config.similarityWeight * similarity +
    config.noveltyWeight * novelty +
    config.ratingWeight * ratingScore
  )
}


