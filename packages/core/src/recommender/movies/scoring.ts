import { query } from '../../lib/db.js'
import type { Candidate, WatchedMovie, PipelineConfig } from '../types.js'
import {
  calculateRatingScore,
  calculateNoveltyScore,
  calculateBaseScore,
} from '../shared/index.js'

function normalizeKeywords(keywords: string[]): Set<string> {
  return new Set(keywords.map((keyword) => keyword.toLowerCase().replace(/[-_\s]+/g, ' ').trim()).filter(Boolean))
}

export async function scoreCandidates(
  candidates: Candidate[],
  watched: WatchedMovie[],
  config: PipelineConfig
): Promise<Candidate[]> {
  // Get genres from recently watched movies with frequency counting
  const watchedMovieIds = watched.slice(0, 50).map((w) => w.movieId)
  const genreFrequency = new Map<string, number>()
  let totalGenreOccurrences = 0
  const keywordFrequency = new Map<string, number>()

  if (watchedMovieIds.length > 0) {
    const genreResult = await query<{ genres: string[]; keywords: string[] }>(
      `SELECT genres, COALESCE(keywords, '{}') || COALESCE(mdblist_keywords, '{}') AS keywords
       FROM movies WHERE id = ANY($1)`,
      [watchedMovieIds]
    )
    for (const row of genreResult.rows) {
      for (const keyword of normalizeKeywords(row.keywords)) {
        keywordFrequency.set(keyword, (keywordFrequency.get(keyword) ?? 0) + 1)
      }
      for (const genre of row.genres || []) {
        genreFrequency.set(genre, (genreFrequency.get(genre) || 0) + 1)
        totalGenreOccurrences++
      }
    }
  }

  // Score each candidate using shared scoring functions
  for (const candidate of candidates) {
    // Use shared rating score calculation (handles bad data, proper scaling)
    const ratingScore = calculateRatingScore(candidate.communityRating)

    // Use shared novelty score calculation (handles missing genres)
    const novelty = calculateNoveltyScore(
      candidate.genres,
      genreFrequency,
      totalGenreOccurrences
    )

    candidate.novelty = novelty
    candidate.ratingScore = ratingScore

    // Calculate base score using shared function
    const matchingThemes = [...normalizeKeywords(candidate.keywords ?? [])]
      .filter((keyword) => (keywordFrequency.get(keyword) ?? 0) >= 2).length
    candidate.themeBoost = Math.min(3, matchingThemes) * 0.02 * config.similarityWeight
    candidate.finalScore = calculateBaseScore(candidate.similarity, novelty, ratingScore, config) + candidate.themeBoost
  }

  // Sort by final score
  candidates.sort((a, b) => b.finalScore - a.finalScore)

  return candidates
}

