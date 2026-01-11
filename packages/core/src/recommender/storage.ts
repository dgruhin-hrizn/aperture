import { query, queryOne, transaction } from '../lib/db.js'
import { getMovieEmbedding } from './movies/embeddings.js'
import type { Candidate, WatchedMovie } from './types.js'

export async function storeCandidates(
  runId: string,
  allCandidates: Candidate[],
  selected: Candidate[],
  selectedRanks?: Map<string, number>
): Promise<void> {
  const selectedIds = new Set(selected.map((s) => s.movieId))

  // Store top 100 candidates plus any selected movies not in top 100
  // (diversity algorithm can select movies from beyond top 100)
  const top100 = allCandidates.slice(0, 100)
  const top100Ids = new Set(top100.map((c) => c.movieId))
  
  // Find selected movies that aren't in top 100
  const selectedNotInTop100 = selected.filter((s) => !top100Ids.has(s.movieId))
  
  // Combine: top 100 + any selected movies not already included
  const toStore = [...top100, ...selectedNotInTop100]

  for (let i = 0; i < toStore.length; i++) {
    const c = toStore[i]
    const isSelected = selectedIds.has(c.movieId)
    const selectedRank = isSelected && selectedRanks ? selectedRanks.get(c.movieId) : null
    
    // For candidates beyond top 100, use their position in the full list
    const originalRank = i < 100 ? i + 1 : allCandidates.findIndex((ac) => ac.movieId === c.movieId) + 1

    await query(
      `INSERT INTO recommendation_candidates
       (run_id, movie_id, rank, is_selected, selected_rank, final_score, similarity_score, novelty_score, rating_score, diversity_score, score_breakdown)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        runId,
        c.movieId,
        originalRank,
        isSelected,
        selectedRank,
        c.finalScore,
        c.similarity,
        c.novelty,
        c.ratingScore,
        c.diversityScore,
        JSON.stringify({
          similarity: c.similarity,
          novelty: c.novelty,
          rating: c.ratingScore,
          diversity: c.diversityScore,
        }),
      ]
    )
  }
}

export async function storeEvidence(
  runId: string,
  selected: Candidate[],
  watched: WatchedMovie[]
): Promise<void> {
  // Get candidate IDs
  const candidateResult = await query<{ id: string; movie_id: string }>(
    `SELECT id, movie_id FROM recommendation_candidates WHERE run_id = $1 AND is_selected = true`,
    [runId]
  )

  const candidateMap = new Map(candidateResult.rows.map((r) => [r.movie_id, r.id]))

  // For each selected movie, find most similar watched movies as evidence
  for (const sel of selected) {
    const candidateId = candidateMap.get(sel.movieId)
    if (!candidateId) continue

    const selEmbedding = await getMovieEmbedding(sel.movieId)
    if (!selEmbedding) continue

    const vectorStr = `[${selEmbedding.join(',')}]`

    // Find top 3 similar watched movies
    const evidence = await query<{ movie_id: string; similarity: number }>(
      `SELECT e.movie_id, 1 - (e.embedding <=> $1::halfvec) as similarity
       FROM embeddings e
       WHERE e.movie_id = ANY($2)
       ORDER BY e.embedding <=> $1::halfvec
       LIMIT 3`,
      [vectorStr, watched.map((w) => w.movieId)]
    )

    for (const ev of evidence.rows) {
      const watchedItem = watched.find((w) => w.movieId === ev.movie_id)
      const evidenceType = watchedItem?.isFavorite
        ? 'favorite'
        : watchedItem?.playCount && watchedItem.playCount > 1
          ? 'highly_rated'
          : 'watched'

      await query(
        `INSERT INTO recommendation_evidence (candidate_id, similar_movie_id, similarity, evidence_type)
         VALUES ($1, $2, $3, $4)`,
        [candidateId, ev.movie_id, ev.similarity, evidenceType]
      )
    }
  }
}

export async function finalizeRun(
  runId: string,
  candidateCount: number,
  selectedCount: number,
  durationMs: number,
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE recommendation_runs
     SET candidate_count = $2, selected_count = $3, duration_ms = $4, status = $5, error_message = $6
     WHERE id = $1`,
    [runId, candidateCount, selectedCount, durationMs, status, errorMessage || null]
  )
}

export async function createRecommendationRun(userId: string): Promise<string> {
  const run = await queryOne<{ id: string }>(
    `INSERT INTO recommendation_runs (user_id, run_type, status)
     VALUES ($1, 'scheduled', 'running')
     RETURNING id`,
    [userId]
  )

  if (!run) {
    throw new Error('Failed to create recommendation run')
  }

  return run.id
}

export async function clearUserRecommendations(userId: string): Promise<void> {
  await transaction(async (client) => {
    // Delete evidence first (FK constraint)
    await client.query(
      `DELETE FROM recommendation_evidence 
       WHERE candidate_id IN (
         SELECT rc.id FROM recommendation_candidates rc
         JOIN recommendation_runs rr ON rc.run_id = rr.id
         WHERE rr.user_id = $1
       )`,
      [userId]
    )

    // Delete candidates
    await client.query(
      `DELETE FROM recommendation_candidates 
       WHERE run_id IN (SELECT id FROM recommendation_runs WHERE user_id = $1)`,
      [userId]
    )

    // Delete runs
    await client.query(`DELETE FROM recommendation_runs WHERE user_id = $1`, [userId])

    // Clear taste profile
    await client.query(`DELETE FROM user_preferences WHERE user_id = $1`, [userId])
  })
}

export async function clearAllRecommendations(): Promise<void> {
  await transaction(async (client) => {
    await client.query('DELETE FROM recommendation_evidence')
    await client.query('DELETE FROM recommendation_candidates')
    await client.query('DELETE FROM recommendation_runs')
    await client.query('DELETE FROM user_preferences')
  })
}

export async function getMovieOverviews(movieIds: string[]): Promise<Map<string, string>> {
  if (movieIds.length === 0) return new Map()

  const result = await query<{ id: string; overview: string | null }>(
    `SELECT id, overview FROM movies WHERE id = ANY($1)`,
    [movieIds]
  )

  const map = new Map<string, string>()
  for (const row of result.rows) {
    if (row.overview) {
      map.set(row.id, row.overview)
    }
  }
  return map
}

