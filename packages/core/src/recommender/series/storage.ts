/**
 * Series Recommendation Storage
 *
 * Storage functions for series recommendations, mirroring the movies storage.ts
 * Handles storing evidence linking recommended series to similar watched series.
 */

import { query } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import type { SeriesCandidate, WatchedSeriesData } from './pipeline.js'

const logger = createChildLogger('series-storage')

/**
 * Store evidence for series recommendations
 * Links each recommended series to the most similar watched series
 * OPTIMIZED: Uses single query with LATERAL join + bulk INSERT
 */
export async function storeSeriesEvidence(
  runId: string,
  selected: SeriesCandidate[],
  watched: WatchedSeriesData[]
): Promise<void> {
  if (selected.length === 0 || watched.length === 0) return

  // Get candidate IDs for selected series
  const candidateResult = await query<{ id: string; series_id: string }>(
    `SELECT id, series_id FROM recommendation_candidates WHERE run_id = $1 AND is_selected = true`,
    [runId]
  )

  const candidateMap = new Map(candidateResult.rows.map((r) => [r.series_id, r.id]))

  // Create a map of watched series for fast lookup
  const watchedMap = new Map(watched.map((w) => [w.seriesId, w]))
  const watchedIds = watched.map((w) => w.seriesId)

  // Get all evidence in a single query using LATERAL join
  const selectedIds = selected.map((s) => s.seriesId)
  const evidenceResult = await query<{
    selected_series_id: string
    similar_series_id: string
    similarity: number
  }>(
    `SELECT selected_series_id, similar_series_id, similarity
     FROM unnest($1::uuid[]) AS sel(selected_series_id)
     CROSS JOIN LATERAL (
       SELECT e2.series_id as similar_series_id,
              1 - (e2.embedding <=> e1.embedding) as similarity
       FROM series_embeddings e1
       JOIN series_embeddings e2 ON e2.series_id = ANY($2)
       WHERE e1.series_id = sel.selected_series_id
       ORDER BY e2.embedding <=> e1.embedding
       LIMIT 3
     ) AS evidence`,
    [selectedIds, watchedIds]
  )

  if (evidenceResult.rows.length === 0) {
    logger.info({ runId, selectedCount: selected.length }, 'No evidence found for series recommendations')
    return
  }

  // Prepare bulk insert data
  const evidenceToInsert: {
    candidateId: string
    similarSeriesId: string
    similarity: number
    evidenceType: string
  }[] = []

  for (const ev of evidenceResult.rows) {
    const candidateId = candidateMap.get(ev.selected_series_id)
    if (!candidateId) continue

    const watchedItem = watchedMap.get(ev.similar_series_id)
    const evidenceType = watchedItem?.isFavorite
      ? 'favorite'
      : watchedItem?.episodesWatched && watchedItem.episodesWatched > 5
        ? 'highly_rated'
        : 'watched'

    evidenceToInsert.push({
      candidateId,
      similarSeriesId: ev.similar_series_id,
      similarity: ev.similarity,
      evidenceType,
    })
  }

  // Bulk INSERT all evidence records
  if (evidenceToInsert.length > 0) {
    await query(
      `INSERT INTO recommendation_evidence (candidate_id, similar_series_id, similarity, evidence_type)
       SELECT candidate_id, similar_series_id, similarity, evidence_type
       FROM unnest($1::uuid[], $2::uuid[], $3::real[], $4::text[])
         AS t(candidate_id, similar_series_id, similarity, evidence_type)`,
      [
        evidenceToInsert.map((e) => e.candidateId),
        evidenceToInsert.map((e) => e.similarSeriesId),
        evidenceToInsert.map((e) => e.similarity),
        evidenceToInsert.map((e) => e.evidenceType),
      ]
    )
  }

  logger.info({ runId, selectedCount: selected.length, evidenceCount: evidenceToInsert.length }, 'Stored series recommendation evidence')
}

/**
 * Get series overviews for explanation generation
 */
export async function getSeriesOverviews(seriesIds: string[]): Promise<Map<string, string>> {
  if (seriesIds.length === 0) return new Map()

  const result = await query<{ id: string; overview: string | null }>(
    `SELECT id, overview FROM series WHERE id = ANY($1)`,
    [seriesIds]
  )

  const map = new Map<string, string>()
  for (const row of result.rows) {
    if (row.overview) {
      map.set(row.id, row.overview)
    }
  }
  return map
}

/**
 * Clear series recommendations for a user
 */
export async function clearUserSeriesRecommendations(userId: string): Promise<void> {
  // Get all series recommendation run IDs for this user
  const runsResult = await query<{ id: string }>(
    `SELECT id FROM recommendation_runs WHERE user_id = $1 AND media_type = 'series'`,
    [userId]
  )

  if (runsResult.rows.length === 0) {
    return
  }

  const runIds = runsResult.rows.map((r) => r.id)

  // Delete evidence for series candidates
  await query(
    `DELETE FROM recommendation_evidence 
     WHERE candidate_id IN (
       SELECT id FROM recommendation_candidates WHERE run_id = ANY($1)
     )`,
    [runIds]
  )

  // Delete candidates
  await query(`DELETE FROM recommendation_candidates WHERE run_id = ANY($1)`, [runIds])

  // Delete runs
  await query(`DELETE FROM recommendation_runs WHERE id = ANY($1)`, [runIds])

  logger.info({ userId, runsDeleted: runIds.length }, 'Cleared series recommendations for user')
}

/**
 * Finalize a series recommendation run
 */
export async function finalizeSeriesRun(
  runId: string,
  candidateCount: number,
  selectedCount: number,
  durationMs: number,
  status: 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE recommendation_runs
     SET candidate_count = $2, selected_count = $3, duration_ms = $4, status = $5, 
         error_message = $6, completed_at = NOW()
     WHERE id = $1`,
    [runId, candidateCount, selectedCount, durationMs, status, errorMessage || null]
  )
}



