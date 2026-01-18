/**
 * Series Recommendation Pipeline
 *
 * Generates TV series recommendations for users based on their
 * episode watching history, using both series and episode embeddings.
 */

import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import {
  createJobProgress,
  updateJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
} from '../../jobs/progress.js'
import { randomUUID } from 'crypto'
import { getActiveEmbeddingModelId, getActiveEmbeddingTableName } from '../../lib/ai-provider.js'
import { averageEmbeddings } from '../shared/index.js'
import {
  calculateRatingScore,
  calculateNoveltyScore,
  applyDiversitySelection,
} from '../shared/index.js'
import { storeSeriesEvidence, getSeriesOverviews } from './storage.js'
import {
  generateSeriesExplanations,
  storeSeriesExplanations,
  type SeriesForExplanation,
} from './explanations.js'
import { syncSeriesWatchHistoryForUser } from './sync.js'

// New taste profile system
import {
  getUserTasteProfile,
  storeTasteProfile as storeNewTasteProfile,
  getFranchiseBoost,
  getGenreBoost,
  getCustomInterestBoost,
  detectAndUpdateFranchises,
} from '../../taste-profile/index.js'
import { getItemFranchise } from '../../taste-profile/franchise.js'
import { getDislikedSeriesIds } from './taste.js'
import { loadConfigForUser } from '../config.js'
import type { PipelineConfig } from '../types.js'

const logger = createChildLogger('series-recommender')

// Types
export interface SeriesUser {
  id: string
  username: string
  providerUserId: string
  maxParentalRating?: number | null
}

export interface WatchedSeriesData {
  seriesId: string
  episodesWatched: number
  totalEpisodes: number | null
  isFavorite: boolean
  lastPlayedAt: Date | null
  weight: number // Computed engagement weight
}

export interface SeriesCandidate {
  seriesId: string
  id: string // Alias for seriesId - used by shared selection algorithm
  title: string
  year: number | null
  genres: string[]
  network: string | null
  status: string | null
  similarity: number
  novelty: number
  ratingScore: number
  diversityBoost: number
  finalScore: number
}

// Re-export PipelineConfig as SeriesPipelineConfig for backwards compatibility
export type SeriesPipelineConfig = PipelineConfig

/**
 * Get user's series watch history with engagement weighting
 */
async function getSeriesWatchHistory(userId: string, limit: number): Promise<WatchedSeriesData[]> {
  const result = await query<{
    series_id: string
    episodes_watched: number
    total_episodes: number | null
    has_favorites: boolean
    last_played_at: Date | null
  }>(
    `SELECT 
       e.series_id,
       COUNT(DISTINCT wh.episode_id) as episodes_watched,
       s.total_episodes,
       BOOL_OR(wh.is_favorite) as has_favorites,
       MAX(wh.last_played_at) as last_played_at
     FROM watch_history wh
     JOIN episodes e ON e.id = wh.episode_id
     JOIN series s ON s.id = e.series_id
     WHERE wh.user_id = $1 AND wh.media_type = 'episode'
     GROUP BY e.series_id, s.total_episodes
     ORDER BY MAX(wh.last_played_at) DESC NULLS LAST
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map((row) => {
    // Calculate engagement weight based on:
    // 1. Completion rate (how much of the series they watched)
    // 2. Whether they have favorites (strong signal)
    // 3. Recency (more recent = higher weight)
    let weight = 1.0

    // Completion bonus (0.5 - 2.0x based on completion %)
    if (row.total_episodes && row.total_episodes > 0) {
      const completionRate = row.episodes_watched / row.total_episodes
      weight *= 0.5 + completionRate * 1.5
    }

    // Favorites bonus (1.5x if they have any favorite episodes)
    if (row.has_favorites) {
      weight *= 1.5
    }

    return {
      seriesId: row.series_id,
      episodesWatched: Number(row.episodes_watched),
      totalEpisodes: row.total_episodes,
      isFavorite: row.has_favorites,
      lastPlayedAt: row.last_played_at,
      weight,
    }
  })
}

/**
 * Build taste profile from watched series
 *
 * Uses a hybrid approach:
 * 1. Series-level embeddings for overall taste
 * 2. Episode-level embeddings for specific interests (optional, for more precision)
 */
async function buildSeriesTasteProfile(
  watchedSeries: WatchedSeriesData[]
): Promise<number[] | null> {
  if (watchedSeries.length === 0) {
    return null
  }

  const model = await getActiveEmbeddingModelId()
  if (!model) {
    logger.warn('No embedding model configured for building series taste profile')
    return null
  }

  // Get the embedding table name
  const tableName = await getActiveEmbeddingTableName('series_embeddings')

  // Get series embeddings
  const seriesIds = watchedSeries.map((w) => w.seriesId)
  const result = await query<{ series_id: string; embedding: string }>(
    `SELECT series_id, embedding::text
     FROM ${tableName}
     WHERE series_id = ANY($1) AND model = $2`,
    [seriesIds, model]
  )

  if (result.rows.length === 0) {
    logger.warn('No series embeddings found for watched series')
    return null
  }

  // Map embeddings by series ID
  const embeddingsMap = new Map<string, number[]>()
  for (const row of result.rows) {
    const embedding = row.embedding.replace(/[[\]]/g, '').split(',').map(Number)
    embeddingsMap.set(row.series_id, embedding)
  }

  // Compute weighted average
  const embeddings: number[][] = []
  const weights: number[] = []

  for (const watched of watchedSeries) {
    const embedding = embeddingsMap.get(watched.seriesId)
    if (embedding) {
      embeddings.push(embedding)
      weights.push(watched.weight)
    }
  }

  if (embeddings.length === 0) {
    return null
  }

  return averageEmbeddings(embeddings, weights)
}

/**
 * Store series taste profile
 */
async function storeSeriesTasteProfile(userId: string, profile: number[]): Promise<void> {
  const vectorStr = `[${profile.join(',')}]`

  await query(
    `INSERT INTO user_preferences (user_id, series_taste_embedding, series_taste_embedding_updated_at)
     VALUES ($1, $2::halfvec, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       series_taste_embedding = $2::halfvec,
       series_taste_embedding_updated_at = NOW(),
       updated_at = NOW()`,
    [userId, vectorStr]
  )
}

/**
 * Get candidate series based on taste profile
 */
async function getSeriesCandidates(
  tasteProfile: number[],
  watchedSeriesIds: Set<string>,
  maxCandidates: number,
  includeWatched: boolean,
  maxParentalRating: number | null
): Promise<SeriesCandidate[]> {
  const model = await getActiveEmbeddingModelId()
  if (!model) {
    logger.warn('No embedding model configured for series candidate generation')
    return []
  }

  // Get the embedding table name
  const tableName = await getActiveEmbeddingTableName('series_embeddings')
  const vectorStr = `[${tasteProfile.join(',')}]`

  // Build query with optional parental rating filter
  let ratingFilter = ''
  const params: (string | number)[] = [vectorStr, model, maxCandidates * 2]

  if (maxParentalRating !== null) {
    // Map parental rating to content ratings
    // This is a simplified mapping - adjust based on your data
    ratingFilter = `AND (s.content_rating IS NULL OR s.content_rating IN (
      SELECT unnest(CASE 
        WHEN $4 >= 18 THEN ARRAY['TV-MA', 'TV-14', 'TV-PG', 'TV-G', 'TV-Y7', 'TV-Y']
        WHEN $4 >= 14 THEN ARRAY['TV-14', 'TV-PG', 'TV-G', 'TV-Y7', 'TV-Y']
        WHEN $4 >= 7 THEN ARRAY['TV-PG', 'TV-G', 'TV-Y7', 'TV-Y']
        ELSE ARRAY['TV-G', 'TV-Y7', 'TV-Y']
      END)
    ))`
    params.push(maxParentalRating)
  }

  const result = await query<{
    series_id: string
    title: string
    year: number | null
    genres: string[]
    network: string | null
    status: string | null
    community_rating: number | null
    similarity: number
  }>(
    `SELECT 
       s.id as series_id,
       s.title,
       s.year,
       s.genres,
       s.network,
       s.status,
       s.community_rating,
       1 - (se.embedding <=> $1::halfvec) as similarity
     FROM series s
     JOIN ${tableName} se ON se.series_id = s.id AND se.model = $2
     WHERE 1=1 ${ratingFilter}
     ORDER BY se.embedding <=> $1::halfvec
     LIMIT $3`,
    params
  )

  // Filter out watched series if not including them
  let candidates = result.rows
  if (!includeWatched) {
    candidates = candidates.filter((c) => !watchedSeriesIds.has(c.series_id))
  }

  // Limit to maxCandidates
  candidates = candidates.slice(0, maxCandidates)

  return candidates.map((row) => ({
    seriesId: row.series_id,
    id: row.series_id, // Alias for shared selection algorithm
    title: row.title,
    year: row.year,
    genres: row.genres || [],
    network: row.network,
    status: row.status,
    similarity: row.similarity,
    novelty: 0,
    ratingScore: 0,
    diversityBoost: 0,
    finalScore: 0,
  }))
}

/**
 * Score candidates using multiple factors
 * Uses shared scoring functions for consistency with movie recommendations.
 */
async function scoreSeriesCandidates(
  candidates: SeriesCandidate[],
  watchedSeries: WatchedSeriesData[],
  config: SeriesPipelineConfig
): Promise<SeriesCandidate[]> {
  // Get ratings for candidates
  const seriesIds = candidates.map((c) => c.seriesId)
  const ratingsResult = await query<{ id: string; community_rating: number | null }>(
    `SELECT id, community_rating FROM series WHERE id = ANY($1)`,
    [seriesIds]
  )

  const ratingsMap = new Map<string, number | null>()
  for (const row of ratingsResult.rows) {
    ratingsMap.set(row.id, row.community_rating)
  }

  // Compute genre distribution from watched series for novelty
  const watchedGenres = new Map<string, number>()
  const watchedSeriesResult = await query<{ genres: string[] }>(
    `SELECT genres FROM series WHERE id = ANY($1)`,
    [watchedSeries.map((w) => w.seriesId)]
  )

  let totalWatchedGenres = 0
  for (const row of watchedSeriesResult.rows) {
    for (const genre of row.genres || []) {
      watchedGenres.set(genre, (watchedGenres.get(genre) || 0) + 1)
      totalWatchedGenres++
    }
  }

  // Score each candidate using shared scoring functions
  return candidates.map((candidate) => {
    // Use shared rating score calculation (handles bad data, proper scaling)
    const ratingScore = calculateRatingScore(ratingsMap.get(candidate.seriesId))

    // Use shared novelty score calculation (handles missing genres)
    const noveltyScore = calculateNoveltyScore(candidate.genres, watchedGenres, totalWatchedGenres)

    // Compute final score
    const finalScore =
      config.similarityWeight * candidate.similarity +
      config.noveltyWeight * noveltyScore +
      config.ratingWeight * ratingScore

    return {
      ...candidate,
      novelty: noveltyScore,
      ratingScore,
      finalScore,
    }
  })
}

interface SeriesSelectionResult {
  selected: SeriesCandidate[]
  selectedRanks: Map<string, number>
}

/**
 * Apply diversity boost and select final recommendations
 *
 * Uses the shared diversity selection algorithm which:
 * 1. Preserves original base scores (no compounding)
 * 2. Re-evaluates all candidates at each selection step
 * 3. Properly blends base score with diversity
 * 4. Includes network diversity for TV series
 */
function applySeriesDiversityAndSelect(
  candidates: SeriesCandidate[],
  targetCount: number,
  diversityWeight: number
): SeriesSelectionResult {
  // Use shared diversity selection with network diversity enabled (for TV series)
  const result = applyDiversitySelection(
    candidates,
    targetCount,
    diversityWeight,
    true // Enable network diversity for TV series
  )

  return {
    selected: result.selected,
    selectedRanks: result.selectedRanks,
  }
}

/**
 * Create a series recommendation run record
 */
async function createSeriesRecommendationRun(userId: string): Promise<string> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO recommendation_runs (user_id, media_type, status)
     VALUES ($1, 'series', 'running')
     RETURNING id`,
    [userId]
  )

  return result!.id
}

/**
 * Store series recommendation candidates
 * OPTIMIZED: Uses unnest() for bulk INSERT instead of N individual queries
 */
async function storeSeriesCandidates(
  runId: string,
  candidates: SeriesCandidate[],
  selected: SeriesCandidate[],
  selectedRanks: Map<string, number>
): Promise<void> {
  if (candidates.length === 0) return

  const selectedIds = new Set(selected.map((s) => s.seriesId))

  // Prepare bulk data
  const data = candidates.map((candidate, i) => {
    const isSelected = selectedIds.has(candidate.seriesId)
    const selectedRank = isSelected ? selectedRanks.get(candidate.seriesId) || null : null

    return {
      seriesId: candidate.seriesId,
      rank: i + 1,
      similarity: candidate.similarity,
      novelty: candidate.novelty,
      ratingScore: candidate.ratingScore,
      diversityScore: candidate.diversityBoost,
      finalScore: candidate.finalScore,
      isSelected,
      selectedRank,
    }
  })

  // Bulk INSERT using unnest
  await query(
    `INSERT INTO recommendation_candidates (
       run_id, series_id, rank, similarity_score, novelty_score, rating_score,
       diversity_score, final_score, is_selected, selected_rank
     )
     SELECT $1, series_id, rank, similarity_score, novelty_score, rating_score,
            diversity_score, final_score, is_selected, selected_rank
     FROM unnest(
       $2::uuid[], $3::int[], $4::real[], $5::real[], $6::real[],
       $7::real[], $8::real[], $9::boolean[], $10::int[]
     ) AS t(series_id, rank, similarity_score, novelty_score, rating_score, 
            diversity_score, final_score, is_selected, selected_rank)`,
    [
      runId,
      data.map((d) => d.seriesId),
      data.map((d) => d.rank),
      data.map((d) => d.similarity),
      data.map((d) => d.novelty),
      data.map((d) => d.ratingScore),
      data.map((d) => d.diversityScore),
      data.map((d) => d.finalScore),
      data.map((d) => d.isSelected),
      data.map((d) => d.selectedRank),
    ]
  )
}

/**
 * Finalize a series recommendation run
 */
async function finalizeSeriesRun(
  runId: string,
  candidateCount: number,
  selectedCount: number,
  durationMs: number,
  status: 'completed' | 'failed',
  error?: string
): Promise<void> {
  await query(
    `UPDATE recommendation_runs
     SET status = $2, candidate_count = $3, selected_count = $4,
         duration_ms = $5, error_message = $6, completed_at = NOW()
     WHERE id = $1`,
    [runId, status, candidateCount, selectedCount, durationMs, error || null]
  )
}

/**
 * Generate series recommendations for a user
 */
export async function generateSeriesRecommendationsForUser(
  user: SeriesUser,
  configOverrides: Partial<SeriesPipelineConfig> = {}
): Promise<{ runId: string; recommendations: SeriesCandidate[] }> {
  // Load user-specific config (applies user overrides if enabled, falls back to admin defaults)
  const config = await loadConfigForUser(user.id, 'series')
  const cfg = { ...config, ...configOverrides }
  const startTime = Date.now()

  logger.info(
    { userId: user.id, username: user.username },
    '📺 Starting series recommendation generation'
  )

  const runId = await createSeriesRecommendationRun(user.id)
  logger.info({ runId }, '📝 Created series recommendation run record')

  try {
    // 0. Sync watch history from media server to ensure we have latest data
    if (user.providerUserId) {
      logger.info({ userId: user.id }, '🔄 Syncing series watch history before recommendations (full sync)...')
      try {
        // Use full sync to catch any items that may have been missed by delta syncs
        await syncSeriesWatchHistoryForUser(user.id, user.providerUserId, true)
        logger.info({ userId: user.id }, '✅ Series watch history synced')
      } catch (err) {
        logger.warn({ err, userId: user.id }, '⚠️ Series watch history sync failed, continuing with existing data')
      }
    }

    // 1. Get user's series watch history (now from synced data)
    logger.info({ userId: user.id }, '📊 Fetching series watch history...')
    const watchedSeries = await getSeriesWatchHistory(user.id, cfg.recentWatchLimit)
    logger.info(
      { userId: user.id, seriesCount: watchedSeries.length },
      `Found ${watchedSeries.length} watched series`
    )

    if (watchedSeries.length === 0) {
      logger.warn(
        { userId: user.id },
        '⚠️ User has no series watch history - cannot generate recommendations'
      )
      await finalizeSeriesRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    // 2. Get or build taste profile using the new persistent system
    logger.info({ userId: user.id }, '🧠 Getting series taste profile...')
    
    // Try to get stored profile first (will rebuild if stale)
    let storedProfile = await getUserTasteProfile(user.id, 'series')
    let tasteProfile: number[] | null = storedProfile?.embedding || null
    
    // If no stored profile or missing embedding, build using legacy method as fallback
    if (!tasteProfile) {
      logger.info({ userId: user.id }, '📊 No stored profile, building from watch history...')
      tasteProfile = await buildSeriesTasteProfile(watchedSeries)
      
      if (tasteProfile) {
        // Get current embedding model to store with profile
        const { getActiveEmbeddingModelId } = await import('../../lib/ai-provider.js')
        const currentModelId = await getActiveEmbeddingModelId()
        
        // Store in new system with embedding model info
        await storeNewTasteProfile(user.id, 'series', tasteProfile, currentModelId || undefined)
        // Also detect franchises
        await detectAndUpdateFranchises(user.id, 'series')
        logger.info({ userId: user.id }, '💾 Stored new taste profile and detected franchises')
      }
    } else {
      logger.info({ userId: user.id }, '✅ Using stored series taste profile')
    }

    if (!tasteProfile) {
      logger.warn(
        { userId: user.id },
        '⚠️ Could not build series taste profile - series may be missing embeddings'
      )
      await finalizeSeriesRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    // Also store in legacy location for backwards compatibility
    await storeSeriesTasteProfile(user.id, tasteProfile)
    logger.info({ userId: user.id }, '💾 Stored series taste profile (legacy)')

    // 3. Get user's preferences for including watched content and handling disliked content
    const userPrefs = await queryOne<{ include_watched: boolean; settings: { dislikeBehavior?: string } | null }>(
      `SELECT include_watched, settings FROM user_preferences WHERE user_id = $1`,
      [user.id]
    )
    const includeWatched = userPrefs?.include_watched ?? false
    const dislikeBehavior = userPrefs?.settings?.dislikeBehavior ?? 'exclude'

    // Get disliked series IDs if dislike_behavior is 'exclude'
    const dislikedIds = dislikeBehavior === 'exclude' 
      ? await getDislikedSeriesIds(user.id) 
      : new Set<string>()
    
    if (dislikedIds.size > 0) {
      logger.info(
        { userId: user.id, dislikedCount: dislikedIds.size },
        `📋 Found ${dislikedIds.size} disliked series to exclude`
      )
    }

    // Get ALL watched series IDs for filtering (not just recent ones used for taste profile)
    // This ensures we exclude ALL series the user has watched, not just the recentWatchLimit
    // Also exclude disliked series if dislike_behavior is 'exclude'
    let excludeIds: Set<string>
    if (includeWatched) {
      // Only exclude disliked series (not watched ones)
      excludeIds = new Set(dislikedIds)
    } else {
      const allWatchedResult = await query<{ series_id: string }>(
        `SELECT DISTINCT e.series_id 
         FROM watch_history wh
         JOIN episodes e ON e.id = wh.episode_id
         WHERE wh.user_id = $1 AND wh.media_type = 'episode'`,
        [user.id]
      )
      excludeIds = new Set([
        ...allWatchedResult.rows.map((r) => r.series_id),
        ...dislikedIds,
      ])
      logger.info(
        { userId: user.id, totalWatched: allWatchedResult.rows.length, dislikedCount: dislikedIds.size, excludeTotal: excludeIds.size },
        `📋 Loaded ${allWatchedResult.rows.length} watched + ${dislikedIds.size} disliked = ${excludeIds.size} series to exclude`
      )
    }

    // 4. Get candidate series
    logger.info({ userId: user.id }, '🔍 Finding candidate series...')
    const candidates = await getSeriesCandidates(
      tasteProfile,
      excludeIds,
      cfg.maxCandidates,
      includeWatched,
      user.maxParentalRating ?? null
    )
    logger.info(
      { userId: user.id, candidateCount: candidates.length },
      `Found ${candidates.length} candidate series`
    )

    if (candidates.length === 0) {
      logger.warn({ userId: user.id }, '⚠️ No candidate series found')
      await finalizeSeriesRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    // 5. Score candidates
    logger.info({ userId: user.id }, '📈 Scoring and ranking candidates...')
    const scoredCandidates = await scoreSeriesCandidates(candidates, watchedSeries, cfg)

    // 5.5 Apply franchise, genre, and custom interest preference boosts
    logger.info({ userId: user.id }, '🎯 Applying preference boosts (franchise, genre, custom interests)...')
    let franchiseBoostCount = 0
    let genreBoostCount = 0
    let interestBoostCount = 0
    
    // Get embeddings for top candidates to apply custom interest boost
    // (only fetch for top 100 to limit performance impact)
    const topCandidateIds = scoredCandidates.slice(0, 100).map((c) => c.seriesId)
    const { getSeriesEmbedding } = await import('./embeddings.js')
    
    for (const candidate of scoredCandidates) {
      // Get franchise boost (1.0 = neutral, up to 1.5 for loved franchises)
      const franchiseName = await getItemFranchise(candidate.seriesId, 'series')
      const franchiseBoost = await getFranchiseBoost(user.id, franchiseName, 'series')
      
      // Get genre boost (1.0 = neutral, 0.5-1.5 range)
      const genreBoost = await getGenreBoost(user.id, candidate.genres || [])
      
      // Get custom interest boost (only for top candidates with embeddings)
      let interestBoost = 1.0
      if (topCandidateIds.includes(candidate.seriesId)) {
        const embedding = await getSeriesEmbedding(candidate.seriesId)
        if (embedding) {
          interestBoost = await getCustomInterestBoost(user.id, embedding)
        }
      }
      
      // Apply boosts to final score
      const originalScore = candidate.finalScore
      candidate.finalScore = originalScore * franchiseBoost * genreBoost * interestBoost
      
      if (franchiseBoost !== 1.0) {
        franchiseBoostCount++
        logger.debug(
          { title: candidate.title, franchiseName, franchiseBoost: franchiseBoost.toFixed(2) },
          'Applied franchise boost'
        )
      }
      if (genreBoost !== 1.0) {
        genreBoostCount++
      }
      if (interestBoost !== 1.0) {
        interestBoostCount++
        logger.debug(
          { title: candidate.title, interestBoost: interestBoost.toFixed(2) },
          'Applied custom interest boost'
        )
      }
    }
    
    // Re-sort after applying boosts
    scoredCandidates.sort((a, b) => b.finalScore - a.finalScore)
    
    logger.info(
      { userId: user.id, franchiseBoostCount, genreBoostCount, interestBoostCount },
      `Applied ${franchiseBoostCount} franchise, ${genreBoostCount} genre, ${interestBoostCount} interest boosts`
    )

    // 6. Apply diversity and select
    // Use smart diversity adjustment if user hasn't set custom weights
    const { getSmartDiversityWeight } = await import('../../lib/userAlgorithmSettings.js')
    const effectiveDiversityWeight = await getSmartDiversityWeight(user.id, 'series', cfg.diversityWeight)
    
    logger.info(
      { userId: user.id, targetCount: cfg.selectedCount, diversityWeight: effectiveDiversityWeight },
      '🎲 Applying diversity and selecting...'
    )
    const { selected, selectedRanks } = applySeriesDiversityAndSelect(
      scoredCandidates,
      cfg.selectedCount,
      effectiveDiversityWeight
    )

    // Log selected series
    logger.info(
      { userId: user.id, selectedCount: selected.length },
      `Selected ${selected.length} series:`
    )
    for (let i = 0; i < Math.min(selected.length, 10); i++) {
      const s = selected[i]
      logger.info(
        { rank: i + 1, title: s.title, year: s.year, score: s.finalScore.toFixed(3) },
        `  ${i + 1}. ${s.title} (${s.year}) - Score: ${s.finalScore.toFixed(3)}`
      )
    }

    // 7. Store results
    logger.info({ runId }, '💾 Storing candidates...')
    await storeSeriesCandidates(runId, scoredCandidates, selected, selectedRanks)

    // 8. Store evidence (similar watched series for each recommendation)
    logger.info({ runId }, '📊 Storing recommendation evidence...')
    await storeSeriesEvidence(runId, selected, watchedSeries)

    // 9. Generate AI explanations for selected recommendations
    logger.info({ runId }, '🤖 Generating AI explanations...')
    try {
      // Fetch overviews for selected series
      const seriesOverviews = await getSeriesOverviews(selected.map((s) => s.seriesId))

      // Prepare data for explanation generation
      const seriesForExplanation: SeriesForExplanation[] = selected.map((s) => ({
        seriesId: s.seriesId,
        title: s.title,
        year: s.year,
        genres: s.genres,
        overview: seriesOverviews.get(s.seriesId) || null,
        network: s.network,
        status: s.status,
        similarity: s.similarity,
        novelty: s.novelty,
        ratingScore: s.ratingScore,
      }))

      // Generate explanations using embedding-based evidence
      const explanations = await generateSeriesExplanations(runId, user.id, seriesForExplanation)
      await storeSeriesExplanations(runId, explanations)
      logger.info({ runId, count: explanations.length }, '✅ AI explanations stored')
    } catch (explanationError) {
      // Don't fail the whole run if explanations fail
      logger.warn(
        { runId, error: explanationError },
        '⚠️ Failed to generate explanations, continuing without'
      )
    }

    const duration = Date.now() - startTime
    await finalizeSeriesRun(runId, scoredCandidates.length, selected.length, duration, 'completed')

    logger.info(
      { userId: user.id, username: user.username, selected: selected.length, duration },
      `🎉 Series recommendations complete: ${selected.length} picks in ${duration}ms`
    )

    return { runId, recommendations: selected }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ userId: user.id, err }, `❌ Series recommendation generation failed: ${error}`)
    await finalizeSeriesRun(runId, 0, 0, Date.now() - startTime, 'failed', error)
    throw err
  }
}

/**
 * Generate series recommendations for all enabled users
 */
export async function generateSeriesRecommendationsForAllUsers(jobId?: string): Promise<{
  success: number
  failed: number
  totalRecommendations: number
  jobId: string
}> {
  const actualJobId = jobId || randomUUID()

  createJobProgress(actualJobId, 'generate-series-recommendations', 2)

  try {
    setJobStep(actualJobId, 0, 'Finding enabled users')
    addLog(actualJobId, 'info', '🔍 Finding enabled users...')

    const result = await query<{
      id: string
      username: string
      provider_user_id: string
      max_parental_rating: number | null
    }>(
      `SELECT id, username, provider_user_id, max_parental_rating FROM users WHERE is_enabled = true AND series_enabled = true`
    )

    const totalUsers = result.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No enabled users found')
      completeJob(actualJobId, { success: 0, failed: 0, totalRecommendations: 0 })
      return { success: 0, failed: 0, totalRecommendations: 0, jobId: actualJobId }
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} enabled user(s)`)
    setJobStep(actualJobId, 1, 'Generating series recommendations', totalUsers)

    let success = 0
    let failed = 0
    let totalRecommendations = 0

    for (let i = 0; i < result.rows.length; i++) {
      const user = result.rows[i]

      try {
        addLog(actualJobId, 'info', `📺 Generating series recommendations for ${user.username}...`)

        const recResult = await generateSeriesRecommendationsForUser({
          id: user.id,
          username: user.username,
          providerUserId: user.provider_user_id,
          maxParentalRating: user.max_parental_rating,
        })

        success++
        totalRecommendations += recResult.recommendations.length
        addLog(
          actualJobId,
          'info',
          `✅ Generated ${recResult.recommendations.length} series recommendations for ${user.username}`
        )
        updateJobProgress(
          actualJobId,
          i + 1,
          totalUsers,
          `${success}/${totalUsers} users (${totalRecommendations} recommendations)`
        )
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to generate series recommendations')
        addLog(actualJobId, 'error', `❌ Failed for ${user.username}: ${error}`)
        failed++
        updateJobProgress(
          actualJobId,
          i + 1,
          totalUsers,
          `${success}/${totalUsers} users (${failed} failed)`
        )
      }
    }

    const finalResult = { success, failed, totalRecommendations, jobId: actualJobId }
    completeJob(actualJobId, finalResult)
    addLog(actualJobId, 'info', `🎉 Complete: ${success} succeeded, ${failed} failed, ${totalRecommendations} total recommendations`)

    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(actualJobId, error)
    throw err
  }
}

/**
 * Clear series recommendations for a user
 */
export async function clearUserSeriesRecommendations(userId: string): Promise<void> {
  await query(`DELETE FROM recommendation_runs WHERE user_id = $1 AND media_type = 'series'`, [
    userId,
  ])
  logger.info({ userId }, 'Cleared series recommendations for user')
}

/**
 * Clear all series recommendations
 */
export async function clearAllSeriesRecommendations(): Promise<void> {
  await query(`DELETE FROM recommendation_runs WHERE media_type = 'series'`)
  logger.info('Cleared all series recommendations')
}

/**
 * Regenerate series recommendations for a user (user-initiated)
 */
export async function regenerateUserSeriesRecommendations(userId: string): Promise<{
  runId: string
  count: number
}> {
  // Get user info
  const user = await queryOne<{
    id: string
    username: string
    provider_user_id: string
    max_parental_rating: number | null
  }>('SELECT id, username, provider_user_id, max_parental_rating FROM users WHERE id = $1', [
    userId,
  ])

  if (!user) {
    throw new Error('User not found')
  }

  logger.info(
    { userId, username: user.username },
    '🔄 User-initiated series recommendation regeneration'
  )

  // Clear existing series recommendations for this user
  await clearUserSeriesRecommendations(userId)

  // Generate new recommendations
  const result = await generateSeriesRecommendationsForUser({
    id: user.id,
    username: user.username,
    providerUserId: user.provider_user_id,
    maxParentalRating: user.max_parental_rating,
  })

  logger.info(
    { userId, username: user.username, count: result.recommendations.length },
    '✅ Series recommendations regenerated'
  )

  return {
    runId: result.runId,
    count: result.recommendations.length,
  }
}
