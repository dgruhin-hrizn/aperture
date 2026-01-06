/**
 * Series Recommendation Pipeline
 *
 * Generates TV series recommendations for users based on their
 * episode watching history, using both series and episode embeddings.
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import {
  createJobProgress,
  updateJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
} from '../jobs/progress.js'
import { randomUUID } from 'crypto'
import { getEmbeddingModel } from '../settings/systemSettings.js'
import { averageEmbeddings } from './shared/index.js'

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

export interface SeriesPipelineConfig {
  maxCandidates: number
  selectedCount: number
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
  recentWatchLimit: number
}

const DEFAULT_CONFIG: SeriesPipelineConfig = {
  maxCandidates: 150,
  selectedCount: 12,
  similarityWeight: 0.45,
  noveltyWeight: 0.15,
  ratingWeight: 0.25,
  diversityWeight: 0.15,
  recentWatchLimit: 100,
}

/**
 * Load series recommendation config from database
 */
async function loadSeriesConfig(): Promise<SeriesPipelineConfig> {
  const result = await queryOne<{ config: SeriesPipelineConfig }>(
    `SELECT config FROM recommendation_config WHERE config_type = 'series'`
  )

  if (result?.config) {
    return { ...DEFAULT_CONFIG, ...result.config }
  }

  return DEFAULT_CONFIG
}

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

  const model = await getEmbeddingModel()

  // Get series embeddings
  const seriesIds = watchedSeries.map((w) => w.seriesId)
  const result = await query<{ series_id: string; embedding: string }>(
    `SELECT series_id, embedding::text
     FROM series_embeddings
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
  const model = await getEmbeddingModel()
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
     JOIN series_embeddings se ON se.series_id = s.id AND se.model = $2
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
 */
async function scoreSeriesCandidates(
  candidates: SeriesCandidate[],
  watchedSeries: WatchedSeriesData[],
  config: SeriesPipelineConfig
): Promise<SeriesCandidate[]> {
  // Get rating normalization stats
  const ratingStats = await queryOne<{ min_rating: number; max_rating: number }>(
    `SELECT MIN(community_rating) as min_rating, MAX(community_rating) as max_rating
     FROM series WHERE community_rating IS NOT NULL`
  )

  const minRating = ratingStats?.min_rating ?? 0
  const maxRating = ratingStats?.max_rating ?? 10
  const ratingRange = maxRating - minRating || 1

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

  for (const row of watchedSeriesResult.rows) {
    for (const genre of row.genres || []) {
      watchedGenres.set(genre, (watchedGenres.get(genre) || 0) + 1)
    }
  }

  const totalWatchedGenres = Array.from(watchedGenres.values()).reduce((a, b) => a + b, 0) || 1

  // Score each candidate
  return candidates.map((candidate) => {
    // Novelty: prefer series with genres the user hasn't seen much
    let noveltyScore = 0
    if (candidate.genres.length > 0) {
      const genreNovelty = candidate.genres.map((g) => {
        const count = watchedGenres.get(g) || 0
        return 1 - count / totalWatchedGenres
      })
      noveltyScore = genreNovelty.reduce((a, b) => a + b, 0) / genreNovelty.length
    }

    // Rating score (normalized)
    const rating = ratingsMap.get(candidate.seriesId)
    const ratingScore = rating != null ? (rating - minRating) / ratingRange : 0.5

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

/**
 * Apply diversity boost and select final recommendations
 */
function applySeriesDiversityAndSelect(
  candidates: SeriesCandidate[],
  targetCount: number,
  diversityWeight: number
): SeriesCandidate[] {
  const selected: SeriesCandidate[] = []
  const remaining = [...candidates].sort((a, b) => b.finalScore - a.finalScore)
  const selectedGenres = new Map<string, number>()
  const selectedNetworks = new Map<string, number>()

  while (selected.length < targetCount && remaining.length > 0) {
    // Score remaining candidates with diversity boost
    for (const candidate of remaining) {
      let diversityBoost = 0

      // Genre diversity
      const genreOverlap = candidate.genres.filter((g) => selectedGenres.has(g)).length
      const genreDiversity = 1 - genreOverlap / Math.max(candidate.genres.length, 1)
      diversityBoost += genreDiversity * 0.6

      // Network diversity
      if (candidate.network) {
        const networkCount = selectedNetworks.get(candidate.network) || 0
        diversityBoost += (1 - networkCount / (selected.length || 1)) * 0.4
      } else {
        diversityBoost += 0.4
      }

      candidate.diversityBoost = diversityBoost
      candidate.finalScore =
        candidate.finalScore * (1 - diversityWeight) + diversityBoost * diversityWeight
    }

    // Re-sort and pick best
    remaining.sort((a, b) => b.finalScore - a.finalScore)
    const best = remaining.shift()!

    // Update genre/network counts
    for (const genre of best.genres) {
      selectedGenres.set(genre, (selectedGenres.get(genre) || 0) + 1)
    }
    if (best.network) {
      selectedNetworks.set(best.network, (selectedNetworks.get(best.network) || 0) + 1)
    }

    selected.push(best)
  }

  return selected
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
 */
async function storeSeriesCandidates(
  runId: string,
  candidates: SeriesCandidate[],
  selected: SeriesCandidate[]
): Promise<void> {
  const selectedIds = new Set(selected.map((s) => s.seriesId))

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    const isSelected = selectedIds.has(candidate.seriesId)
    const selectedRank = isSelected
      ? selected.findIndex((s) => s.seriesId === candidate.seriesId) + 1
      : null

    await query(
      `INSERT INTO recommendation_candidates (
         run_id, series_id, similarity_score, novelty_score, rating_score,
         diversity_score, final_score, is_selected, selected_rank
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        runId,
        candidate.seriesId,
        candidate.similarity,
        candidate.novelty,
        candidate.ratingScore,
        candidate.diversityBoost,
        candidate.finalScore,
        isSelected,
        selectedRank,
      ]
    )
  }
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
  const config = await loadSeriesConfig()
  const cfg = { ...config, ...configOverrides }
  const startTime = Date.now()

  logger.info(
    { userId: user.id, username: user.username },
    '📺 Starting series recommendation generation'
  )

  const runId = await createSeriesRecommendationRun(user.id)
  logger.info({ runId }, '📝 Created series recommendation run record')

  try {
    // 1. Get user's series watch history
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

    // 2. Build taste profile
    logger.info({ userId: user.id }, '🧠 Building series taste profile...')
    const tasteProfile = await buildSeriesTasteProfile(watchedSeries)

    if (!tasteProfile) {
      logger.warn(
        { userId: user.id },
        '⚠️ Could not build series taste profile - series may be missing embeddings'
      )
      await finalizeSeriesRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    logger.info({ userId: user.id }, '✅ Series taste profile built successfully')
    await storeSeriesTasteProfile(user.id, tasteProfile)

    // 3. Get user's preference for including watched content
    const userPrefs = await queryOne<{ include_watched: boolean }>(
      `SELECT include_watched FROM user_preferences WHERE user_id = $1`,
      [user.id]
    )
    const includeWatched = userPrefs?.include_watched ?? false

    // Get all watched series IDs for filtering
    const allWatchedIds = new Set(watchedSeries.map((w) => w.seriesId))

    // 4. Get candidate series
    logger.info({ userId: user.id }, '🔍 Finding candidate series...')
    const candidates = await getSeriesCandidates(
      tasteProfile,
      allWatchedIds,
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

    // 6. Apply diversity and select
    logger.info(
      { userId: user.id, targetCount: cfg.selectedCount },
      '🎲 Applying diversity and selecting...'
    )
    const selected = applySeriesDiversityAndSelect(
      scoredCandidates,
      cfg.selectedCount,
      cfg.diversityWeight
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
    await storeSeriesCandidates(runId, scoredCandidates, selected)

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
      `SELECT id, username, provider_user_id, max_parental_rating FROM users WHERE is_enabled = true`
    )

    const totalUsers = result.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No enabled users found')
      completeJob(actualJobId, { success: 0, failed: 0 })
      return { success: 0, failed: 0, jobId: actualJobId }
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} enabled user(s)`)
    setJobStep(actualJobId, 1, 'Generating series recommendations', totalUsers)

    let success = 0
    let failed = 0

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
        addLog(
          actualJobId,
          'info',
          `✅ Generated ${recResult.recommendations.length} series recommendations for ${user.username}`
        )
        updateJobProgress(
          actualJobId,
          success + failed,
          totalUsers,
          `${success + failed}/${totalUsers} users`
        )
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to generate series recommendations')
        addLog(actualJobId, 'error', `❌ Failed for ${user.username}: ${error}`)
        failed++
      }
    }

    const finalResult = { success, failed, jobId: actualJobId }
    completeJob(actualJobId, finalResult)
    addLog(actualJobId, 'info', `🎉 Complete: ${success} succeeded, ${failed} failed`)

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
