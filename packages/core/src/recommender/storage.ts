import { query, queryOne, transaction } from '../lib/db.js'
import { getActiveEmbeddingModelId, getActiveEmbeddingTableName } from '../lib/ai-provider.js'
import type { Candidate, WatchedMovie } from './types.js'

/**
 * Store recommendation candidates using bulk INSERT
 * OPTIMIZED: Uses unnest() for single query instead of N individual INSERTs
 */
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

  if (toStore.length === 0) return

  // Prepare bulk data
  const data = toStore.map((c, i) => {
    const isSelected = selectedIds.has(c.movieId)
    const selectedRank = isSelected && selectedRanks ? selectedRanks.get(c.movieId) : null
    const originalRank =
      i < 100 ? i + 1 : allCandidates.findIndex((ac) => ac.movieId === c.movieId) + 1

    return {
      movieId: c.movieId,
      rank: originalRank,
      isSelected,
      selectedRank,
      finalScore: c.finalScore,
      similarity: c.similarity,
      novelty: c.novelty,
      ratingScore: c.ratingScore,
      diversityScore: c.diversityScore,
      scoreBreakdown: JSON.stringify({
        similarity: c.similarity,
        novelty: c.novelty,
        rating: c.ratingScore,
        diversity: c.diversityScore,
      }),
    }
  })

  // Bulk INSERT using unnest
  await query(
    `INSERT INTO recommendation_candidates
     (run_id, movie_id, rank, is_selected, selected_rank, final_score, similarity_score, novelty_score, rating_score, diversity_score, score_breakdown)
     SELECT $1, movie_id, rank, is_selected, selected_rank, final_score, similarity_score, novelty_score, rating_score, diversity_score, score_breakdown
     FROM unnest(
       $2::uuid[], $3::int[], $4::boolean[], $5::int[], $6::real[],
       $7::real[], $8::real[], $9::real[], $10::real[], $11::jsonb[]
     ) AS t(movie_id, rank, is_selected, selected_rank, final_score, similarity_score, novelty_score, rating_score, diversity_score, score_breakdown)`,
    [
      runId,
      data.map((d) => d.movieId),
      data.map((d) => d.rank),
      data.map((d) => d.isSelected),
      data.map((d) => d.selectedRank),
      data.map((d) => d.finalScore),
      data.map((d) => d.similarity),
      data.map((d) => d.novelty),
      data.map((d) => d.ratingScore),
      data.map((d) => d.diversityScore),
      data.map((d) => d.scoreBreakdown),
    ]
  )
}

/**
 * Store recommendation evidence
 * OPTIMIZED: Uses a single query to find all evidence, then bulk INSERT
 */
export async function storeEvidence(
  runId: string,
  selected: Candidate[],
  watched: WatchedMovie[]
): Promise<void> {
  if (selected.length === 0 || watched.length === 0) return

  // Get candidate IDs
  const candidateResult = await query<{ id: string; movie_id: string }>(
    `SELECT id, movie_id FROM recommendation_candidates WHERE run_id = $1 AND is_selected = true`,
    [runId]
  )

  const candidateMap = new Map(candidateResult.rows.map((r) => [r.movie_id, r.id]))

  // Create a map of watched movies for fast lookup
  const watchedMap = new Map(watched.map((w) => [w.movieId, w]))
  const watchedIds = watched.map((w) => w.movieId)

  // Get active embedding model
  const modelId = await getActiveEmbeddingModelId()
  if (!modelId) {
    // Skip evidence storage if no embedding model configured
    return
  }

  // Get the embedding table name
  const tableName = await getActiveEmbeddingTableName('embeddings')

  // Get all evidence in a single query using LATERAL join
  // This finds the top 3 similar watched movies for each selected movie in one query
  const selectedIds = selected.map((s) => s.movieId)
  const evidenceResult = await query<{
    selected_movie_id: string
    similar_movie_id: string
    similarity: number
  }>(
    `SELECT selected_movie_id, similar_movie_id, similarity
     FROM unnest($1::uuid[]) AS sel(selected_movie_id)
     CROSS JOIN LATERAL (
       SELECT e2.movie_id as similar_movie_id, 
              1 - (e2.embedding <=> e1.embedding) as similarity
       FROM ${tableName} e1
       JOIN ${tableName} e2 ON e2.movie_id = ANY($2) AND e2.model = $3
       WHERE e1.movie_id = sel.selected_movie_id AND e1.model = $3
       ORDER BY e2.embedding <=> e1.embedding
       LIMIT 3
     ) AS evidence`,
    [selectedIds, watchedIds, modelId]
  )

  if (evidenceResult.rows.length === 0) return

  // Prepare bulk insert data
  const evidenceToInsert: {
    candidateId: string
    similarMovieId: string
    similarity: number
    evidenceType: string
  }[] = []

  for (const ev of evidenceResult.rows) {
    const candidateId = candidateMap.get(ev.selected_movie_id)
    if (!candidateId) continue

    const watchedItem = watchedMap.get(ev.similar_movie_id)
    const evidenceType = watchedItem?.isFavorite
      ? 'favorite'
      : watchedItem?.playCount && watchedItem.playCount > 1
        ? 'highly_rated'
        : 'watched'

    evidenceToInsert.push({
      candidateId,
      similarMovieId: ev.similar_movie_id,
      similarity: ev.similarity,
      evidenceType,
    })
  }

  // Bulk INSERT all evidence records
  if (evidenceToInsert.length > 0) {
    await query(
      `INSERT INTO recommendation_evidence (candidate_id, similar_movie_id, similarity, evidence_type)
       SELECT candidate_id, similar_movie_id, similarity, evidence_type
       FROM unnest($1::uuid[], $2::uuid[], $3::real[], $4::text[])
         AS t(candidate_id, similar_movie_id, similarity, evidence_type)`,
      [
        evidenceToInsert.map((e) => e.candidateId),
        evidenceToInsert.map((e) => e.similarMovieId),
        evidenceToInsert.map((e) => e.similarity),
        evidenceToInsert.map((e) => e.evidenceType),
      ]
    )
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

