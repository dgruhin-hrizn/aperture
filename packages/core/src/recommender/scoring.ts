import { query } from '../lib/db.js'
import type { Candidate, WatchedMovie, PipelineConfig } from './types.js'

export async function scoreCandidates(
  candidates: Candidate[],
  watched: WatchedMovie[],
  config: PipelineConfig
): Promise<Candidate[]> {
  // Get genres from recently watched movies with frequency counting
  const watchedMovieIds = watched.slice(0, 30).map((w) => w.movieId)
  const genreFrequency = new Map<string, number>()
  let totalGenreOccurrences = 0

  if (watchedMovieIds.length > 0) {
    const genreResult = await query<{ genres: string[] }>(
      `SELECT genres FROM movies WHERE id = ANY($1)`,
      [watchedMovieIds]
    )
    for (const row of genreResult.rows) {
      for (const genre of row.genres || []) {
        genreFrequency.set(genre, (genreFrequency.get(genre) || 0) + 1)
        totalGenreOccurrences++
      }
    }
  }

  // Calculate genre preference scores (normalized)
  const genrePreference = new Map<string, number>()
  for (const [genre, count] of genreFrequency) {
    genrePreference.set(genre, count / totalGenreOccurrences)
  }

  // Score each candidate
  for (const candidate of candidates) {
    // Improved novelty: balance between familiar genres and discovery
    // Movies with some familiar genres are good, but not ALL the same genres
    let genreMatchScore = 0
    let novelGenres = 0

    for (const genre of candidate.genres) {
      const pref = genrePreference.get(genre) || 0
      if (pref > 0) {
        genreMatchScore += pref // Weighted by how often user watches this genre
      } else {
        novelGenres++ // Count completely new genres
      }
    }

    // Novelty rewards movies that introduce 1-2 new genres while still matching some preferences
    // Pure novelty (all new genres) is risky, some novelty is good
    const noveltyRatio = candidate.genres.length > 0 ? novelGenres / candidate.genres.length : 0
    const novelty =
      noveltyRatio > 0 && noveltyRatio < 0.7
        ? 0.5 + noveltyRatio * 0.5 // Reward partial novelty
        : noveltyRatio >= 0.7
          ? 0.3 // Penalize too much novelty (user hasn't shown interest)
          : 0.4 // No novelty is okay but not great

    // Rating score with more nuance
    // Highly rated movies get a boost, poorly rated get penalized
    let ratingScore = 0.5 // Default for no rating
    if (candidate.communityRating) {
      if (candidate.communityRating >= 8) {
        ratingScore = 0.8 + (candidate.communityRating - 8) * 0.1 // 0.8-1.0
      } else if (candidate.communityRating >= 7) {
        ratingScore = 0.6 + (candidate.communityRating - 7) * 0.2 // 0.6-0.8
      } else if (candidate.communityRating >= 6) {
        ratingScore = 0.4 + (candidate.communityRating - 6) * 0.2 // 0.4-0.6
      } else {
        ratingScore = candidate.communityRating / 15 // Low ratings get lower scores
      }
    }

    // Genre preference match bonus
    // If movie matches user's most-watched genres, boost it
    const preferenceBonus = Math.min(genreMatchScore * 0.3, 0.15)

    candidate.novelty = novelty
    candidate.ratingScore = ratingScore

    // Final score combines: similarity (core), novelty (discovery), rating (quality), preference match
    candidate.finalScore =
      candidate.similarity * config.similarityWeight +
      novelty * config.noveltyWeight +
      ratingScore * config.ratingWeight +
      preferenceBonus
  }

  // Sort by final score
  candidates.sort((a, b) => b.finalScore - a.finalScore)

  return candidates
}

