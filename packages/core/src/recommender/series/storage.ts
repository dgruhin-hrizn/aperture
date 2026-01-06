/**
 * Series Recommendation Storage
 *
 * Storage functions for series recommendations, mirroring the movies storage.ts
 * Handles storing evidence linking recommended series to similar watched series.
 */

import { query, queryOne } from '../../lib/db.js'
import { createChildLogger } from '../../lib/logger.js'
import { getSeriesEmbedding } from './embeddings.js'
import type { SeriesCandidate, WatchedSeriesData } from './pipeline.js'

const logger = createChildLogger('series-storage')

/**
 * Store evidence for series recommendations
 * Links each recommended series to the most similar watched series
 */
export async function storeSeriesEvidence(
  runId: string,
  selected: SeriesCandidate[],
  watched: WatchedSeriesData[]
): Promise<void> {
  // Get candidate IDs for selected series
  const candidateResult = await query<{ id: string; series_id: string }>(
    `SELECT id, series_id FROM recommendation_candidates WHERE run_id = $1 AND is_selected = true`,
    [runId]
  )

  const candidateMap = new Map(candidateResult.rows.map((r) => [r.series_id, r.id]))

  // For each selected series, find most similar watched series as evidence
  for (const sel of selected) {
    const candidateId = candidateMap.get(sel.seriesId)
    if (!candidateId) continue

    const selEmbedding = await getSeriesEmbedding(sel.seriesId)
    if (!selEmbedding) continue

    const vectorStr = `[${selEmbedding.join(',')}]`

    // Find top 3 similar watched series using series_embeddings table
    const evidence = await query<{ series_id: string; similarity: number }>(
      `SELECT e.series_id, 1 - (e.embedding <=> $1::halfvec) as similarity
       FROM series_embeddings e
       WHERE e.series_id = ANY($2)
       ORDER BY e.embedding <=> $1::halfvec
       LIMIT 3`,
      [vectorStr, watched.map((w) => w.seriesId)]
    )

    for (const ev of evidence.rows) {
      const watchedItem = watched.find((w) => w.seriesId === ev.series_id)
      const evidenceType = watchedItem?.isFavorite
        ? 'favorite'
        : watchedItem?.episodesWatched && watchedItem.episodesWatched > 5
          ? 'highly_rated'
          : 'watched'

      await query(
        `INSERT INTO recommendation_evidence (candidate_id, similar_series_id, similarity, evidence_type)
         VALUES ($1, $2, $3, $4)`,
        [candidateId, ev.series_id, ev.similarity, evidenceType]
      )
    }
  }

  logger.info({ runId, selectedCount: selected.length }, 'Stored series recommendation evidence')
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

