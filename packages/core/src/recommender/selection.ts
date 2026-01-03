import type { Candidate } from './types.js'

export function applyDiversityAndSelect(
  candidates: Candidate[],
  count: number,
  diversityWeight: number
): Candidate[] {
  const selected: Candidate[] = []
  const selectedGenres = new Set<string>()

  // Track selected movies by title+year to avoid duplicates (different versions of same movie)
  const selectedTitleYear = new Set<string>()

  for (const candidate of candidates) {
    if (selected.length >= count) break

    // Skip if we already have this movie (by title+year) - handles different versions
    const titleYearKey = `${candidate.title.toLowerCase()}|${candidate.year || 'unknown'}`
    if (selectedTitleYear.has(titleYearKey)) {
      continue
    }

    // Calculate diversity score based on genre overlap with already selected
    const genreOverlap = candidate.genres.filter((g) => selectedGenres.has(g)).length
    const diversityScore =
      candidate.genres.length > 0 ? 1 - genreOverlap / Math.max(candidate.genres.length, 1) : 0.5

    candidate.diversityScore = diversityScore

    // Adjust final score with diversity
    const adjustedScore = candidate.finalScore + diversityScore * diversityWeight
    candidate.finalScore = adjustedScore

    // Add to selected
    selected.push(candidate)
    selectedTitleYear.add(titleYearKey)

    // Track genres
    for (const genre of candidate.genres) {
      selectedGenres.add(genre)
    }
  }

  return selected
}

