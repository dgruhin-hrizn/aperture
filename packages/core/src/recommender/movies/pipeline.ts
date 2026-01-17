// Re-organized pipeline - imports from modular files
import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import {
  generateExplanations,
  storeExplanations,
  type MovieForExplanation,
} from './explanations.js'
import {
  createJobProgress,
  updateJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
} from '../../jobs/progress.js'
import { randomUUID } from 'crypto'

// Import from modular files
import { loadConfigForUser } from '../config.js'
import { getWatchHistory, buildTasteProfile as buildLegacyTasteProfile, storeTasteProfile as storeLegacyTasteProfile, getUserMovieRatings, getDislikedMovieIds } from './taste.js'
import { getCandidates } from './candidates.js'
import { scoreCandidates } from './scoring.js'
import { applyDiversityAndSelect } from './selection.js'
import {
  storeCandidates,
  storeEvidence,
  finalizeRun,
  createRecommendationRun,
  clearUserRecommendations,
  clearAllRecommendations,
  getMovieOverviews,
} from '../storage.js'
import { syncWatchHistoryForUser } from './sync.js'

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

// Re-export types
export * from '../types.js'

// Re-export functions for backwards compatibility
export { loadConfig } from '../config.js'
export { getWatchHistory, buildTasteProfile as buildLegacyTasteProfile, storeTasteProfile as storeLegacyTasteProfile, getUserMovieRatings, getDislikedMovieIds } from './taste.js'
// Also export as original names for backwards compatibility
export { buildTasteProfile, storeTasteProfile } from './taste.js'
export { getCandidates } from './candidates.js'
export { scoreCandidates } from './scoring.js'
export { applyDiversityAndSelect } from './selection.js'
export {
  storeCandidates,
  storeEvidence,
  finalizeRun,
  clearUserRecommendations,
  clearAllRecommendations,
} from '../storage.js'

import type { User, Candidate, PipelineConfig } from '../types.js'

const logger = createChildLogger('recommender')

/**
 * Generate recommendations for a user
 */
export async function generateRecommendationsForUser(
  user: User,
  configOverrides: Partial<PipelineConfig> = {}
): Promise<{ runId: string; recommendations: Candidate[] }> {
  // Load user-specific config (applies user overrides if enabled, falls back to admin defaults)
  const dbConfig = await loadConfigForUser(user.id, 'movie')
  const cfg = { ...dbConfig, ...configOverrides }
  const startTime = Date.now()

  logger.info({ userId: user.id, username: user.username }, '🎬 Starting recommendation generation')

  // Create recommendation run record
  const runId = await createRecommendationRun(user.id)
  logger.info({ runId }, '📝 Created recommendation run record')

  try {
    // 0. Sync watch history from media server to ensure we have latest data
    if (user.providerUserId) {
      logger.info({ userId: user.id }, '🔄 Syncing watch history before recommendations (full sync)...')
      try {
        // Use full sync to catch any items that may have been missed by delta syncs
        await syncWatchHistoryForUser(user.id, user.providerUserId, true)
        logger.info({ userId: user.id }, '✅ Watch history synced')
      } catch (err) {
        logger.warn({ err, userId: user.id }, '⚠️ Watch history sync failed, continuing with existing data')
      }
    }

    // 1. Get user's recommendation preferences
    const userPrefs = await queryOne<{ include_watched: boolean; dislike_behavior: string }>(
      `SELECT include_watched, COALESCE(dislike_behavior, 'exclude') as dislike_behavior FROM user_preferences WHERE user_id = $1`,
      [user.id]
    )
    const includeWatched = userPrefs?.include_watched ?? false
    const dislikeBehavior = userPrefs?.dislike_behavior ?? 'exclude'
    logger.info(
      { userId: user.id, includeWatched, dislikeBehavior },
      `📋 User preferences: include_watched=${includeWatched}, dislike_behavior=${dislikeBehavior}`
    )

    // 2. Get user's watch history and ratings (now from synced data)
    logger.info({ userId: user.id }, '📊 Fetching watch history and ratings...')
    const [watched, userRatings, dislikedIds] = await Promise.all([
      getWatchHistory(user.id, cfg.recentWatchLimit),
      getUserMovieRatings(user.id),
      dislikeBehavior === 'exclude' ? getDislikedMovieIds(user.id) : Promise.resolve(new Set<string>()),
    ])
    logger.info(
      { userId: user.id, watchedCount: watched.length, ratingsCount: userRatings.size, dislikedCount: dislikedIds.size },
      `Found ${watched.length} watched movies, ${userRatings.size} ratings, ${dislikedIds.size} disliked`
    )

    if (watched.length === 0) {
      logger.warn(
        { userId: user.id },
        '⚠️ User has no watch history - cannot generate recommendations'
      )
      await finalizeRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    // 2. Get or build taste profile using the new persistent system
    logger.info({ userId: user.id }, '🧠 Getting taste profile...')
    
    // Try to get stored profile first (will rebuild if stale)
    let storedProfile = await getUserTasteProfile(user.id, 'movie')
    let tasteProfile: number[] | null = storedProfile?.embedding || null
    
    // If no stored profile or missing embedding, build using legacy method as fallback
    if (!tasteProfile) {
      logger.info({ userId: user.id }, '📊 No stored profile, building from watch history...')
      tasteProfile = await buildLegacyTasteProfile(watched, userRatings.size > 0 ? userRatings : undefined)
      
      if (tasteProfile) {
        // Store in new system
        await storeNewTasteProfile(user.id, 'movie', tasteProfile)
        // Also detect franchises
        await detectAndUpdateFranchises(user.id, 'movie')
        logger.info({ userId: user.id }, '💾 Stored new taste profile and detected franchises')
      }
    } else {
      logger.info({ userId: user.id }, '✅ Using stored taste profile')
    }

    if (!tasteProfile) {
      logger.warn(
        { userId: user.id },
        '⚠️ Could not build taste profile - movies may be missing embeddings'
      )
      await finalizeRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    // Also store in legacy location for backwards compatibility
    await storeLegacyTasteProfile(user.id, tasteProfile)
    logger.info({ userId: user.id }, '💾 Stored taste profile (legacy)')

    // 3. Get candidate movies (optionally including watched based on user preference)
    logger.info(
      { userId: user.id, maxCandidates: cfg.maxCandidates, includeWatched },
      `🔍 Finding candidate movies using vector similarity (${includeWatched ? 'including' : 'excluding'} watched)...`
    )

    // Get ALL watched movie IDs for filtering (not just the ones used for taste profile)
    // Also exclude disliked movies if dislike_behavior is 'exclude'
    let excludeIds: Set<string>
    if (includeWatched) {
      // Only exclude disliked movies (not watched ones)
      excludeIds = new Set(dislikedIds)
    } else {
      const allWatchedResult = await query<{ movie_id: string }>(
        `SELECT movie_id FROM watch_history WHERE user_id = $1 AND media_type = 'movie'`,
        [user.id]
      )
      excludeIds = new Set([
        ...allWatchedResult.rows.map((r) => r.movie_id),
        ...dislikedIds,
      ])
      logger.info(
        { userId: user.id, totalWatched: allWatchedResult.rows.length, excludeTotal: excludeIds.size },
        `📋 Loaded ${allWatchedResult.rows.length} watched + ${dislikedIds.size} disliked = ${excludeIds.size} movies to exclude`
      )
    }

    const candidates = await getCandidates(
      tasteProfile,
      excludeIds,
      cfg.maxCandidates,
      includeWatched,
      user.maxParentalRating ?? null
    )
    logger.info(
      { userId: user.id, candidateCount: candidates.length },
      `Found ${candidates.length} candidate movies`
    )

    if (candidates.length === 0) {
      logger.warn(
        { userId: user.id },
        '⚠️ No candidate movies found - may need to sync movies or generate embeddings'
      )
      await finalizeRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    // 4. Score and rank candidates
    logger.info({ userId: user.id }, '📈 Scoring and ranking candidates...')
    logger.info(
      {
        weights: {
          similarity: cfg.similarityWeight,
          novelty: cfg.noveltyWeight,
          rating: cfg.ratingWeight,
          diversity: cfg.diversityWeight,
        },
      },
      'Using scoring weights'
    )
    const scoredCandidates = await scoreCandidates(candidates, watched, cfg)

    // 4.5 Apply franchise, genre, and custom interest preference boosts
    logger.info({ userId: user.id }, '🎯 Applying preference boosts (franchise, genre, custom interests)...')
    let franchiseBoostCount = 0
    let genreBoostCount = 0
    let interestBoostCount = 0
    
    // Get embeddings for top candidates to apply custom interest boost
    // (only fetch for top 100 to limit performance impact)
    const topCandidateIds = scoredCandidates.slice(0, 100).map((c) => c.id)
    const { getMovieEmbedding } = await import('./embeddings.js')
    
    for (const candidate of scoredCandidates) {
      // Get franchise boost (1.0 = neutral, up to 1.5 for loved franchises)
      const franchiseName = await getItemFranchise(candidate.id, 'movie')
      const franchiseBoost = await getFranchiseBoost(user.id, franchiseName, 'movie')
      
      // Get genre boost (1.0 = neutral, 0.5-1.5 range)
      const genreBoost = await getGenreBoost(user.id, candidate.genres || [])
      
      // Get custom interest boost (only for top candidates with embeddings)
      let interestBoost = 1.0
      if (topCandidateIds.includes(candidate.id)) {
        const embedding = await getMovieEmbedding(candidate.id)
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

    // Log top candidates
    const top5 = scoredCandidates.slice(0, 5)
    for (const c of top5) {
      logger.info(
        {
          title: c.title,
          year: c.year,
          similarity: c.similarity.toFixed(3),
          novelty: c.novelty.toFixed(3),
          rating: c.ratingScore.toFixed(3),
          finalScore: c.finalScore.toFixed(3),
        },
        `🎯 Top candidate: ${c.title}`
      )
    }

    // 5. Apply diversity boost and select final recommendations
    // Use smart diversity adjustment if user hasn't set custom weights
    const { getSmartDiversityWeight } = await import('../../lib/userAlgorithmSettings.js')
    const effectiveDiversityWeight = await getSmartDiversityWeight(user.id, 'movie', cfg.diversityWeight)
    
    logger.info(
      { userId: user.id, targetCount: cfg.selectedCount, diversityWeight: effectiveDiversityWeight },
      '🎲 Applying diversity and selecting final recommendations...'
    )
    const { selected, selectedRanks } = applyDiversityAndSelect(
      scoredCandidates,
      cfg.selectedCount,
      effectiveDiversityWeight
    )

    // Log selected movies
    logger.info(
      { userId: user.id, selectedCount: selected.length },
      `Selected ${selected.length} movies for recommendation:`
    )
    for (let i = 0; i < Math.min(selected.length, 10); i++) {
      const s = selected[i]
      logger.info(
        {
          rank: i + 1,
          title: s.title,
          year: s.year,
          genres: s.genres.join(', '),
          finalScore: s.finalScore.toFixed(3),
        },
        `  ${i + 1}. ${s.title} (${s.year}) - Score: ${s.finalScore.toFixed(3)}`
      )
    }

    // 6. Store results
    logger.info({ runId }, '💾 Storing candidates and evidence...')
    await storeCandidates(runId, scoredCandidates, selected, selectedRanks)
    await storeEvidence(runId, selected, watched)

    // 7. Generate AI explanations for selected recommendations
    logger.info({ runId }, '🤖 Generating AI explanations...')
    try {
      // Fetch overviews for selected movies
      const movieOverviews = await getMovieOverviews(selected.map((s) => s.movieId))

      // Prepare data for explanation generation
      const moviesForExplanation: MovieForExplanation[] = selected.map((s) => ({
        movieId: s.movieId,
        title: s.title,
        year: s.year,
        genres: s.genres,
        overview: movieOverviews.get(s.movieId) || null,
        similarity: s.similarity,
        novelty: s.novelty,
        ratingScore: s.ratingScore,
      }))

      // Generate explanations using embedding-based evidence
      const explanations = await generateExplanations(runId, user.id, moviesForExplanation)
      await storeExplanations(runId, explanations)
      logger.info({ runId, count: explanations.length }, '✅ AI explanations stored')
    } catch (explanationError) {
      // Don't fail the whole run if explanations fail
      logger.warn(
        { runId, error: explanationError },
        '⚠️ Failed to generate explanations, continuing without'
      )
    }

    const duration = Date.now() - startTime
    await finalizeRun(runId, scoredCandidates.length, selected.length, duration, 'completed')

    logger.info(
      {
        userId: user.id,
        username: user.username,
        candidates: scoredCandidates.length,
        selected: selected.length,
        duration,
      },
      `🎉 Recommendations complete for ${user.username}: ${selected.length} picks in ${duration}ms`
    )

    return { runId, recommendations: selected }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ userId: user.id, err }, `❌ Recommendation generation failed: ${error}`)
    await finalizeRun(runId, 0, 0, Date.now() - startTime, 'failed', error)
    throw err
  }
}

/**
 * Generate recommendations for all enabled users
 */
export async function generateRecommendationsForAllUsers(jobId?: string): Promise<{
  success: number
  failed: number
  totalRecommendations: number
  jobId: string
}> {
  const actualJobId = jobId || crypto.randomUUID()

  // Initialize job progress
  createJobProgress(actualJobId, 'generate-movie-recommendations', 2)

  try {
    setJobStep(actualJobId, 0, 'Finding enabled users')
    addLog(actualJobId, 'info', '🔍 Finding enabled users...')

    const result = await query<{
      id: string
      username: string
      provider_user_id: string
      max_parental_rating: number | null
    }>(
      `SELECT id, username, provider_user_id, max_parental_rating FROM users WHERE is_enabled = true AND movies_enabled = true`
    )

    const totalUsers = result.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No enabled users found')
      completeJob(actualJobId, { success: 0, failed: 0, totalRecommendations: 0 })
      return { success: 0, failed: 0, totalRecommendations: 0, jobId: actualJobId }
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} enabled user(s)`)
    setJobStep(actualJobId, 1, 'Generating recommendations', totalUsers)

    let success = 0
    let failed = 0
    let totalRecommendations = 0

    for (let i = 0; i < result.rows.length; i++) {
      const user = result.rows[i]

      try {
        addLog(actualJobId, 'info', `🎬 Generating recommendations for ${user.username}...`)

        const recResult = await generateRecommendationsForUser({
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
          `✅ Generated ${recResult.recommendations.length} recommendations for ${user.username}`
        )
        updateJobProgress(
          actualJobId,
          i + 1,
          totalUsers,
          `${success}/${totalUsers} users (${totalRecommendations} recommendations)`
        )
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to generate recommendations')
        addLog(actualJobId, 'error', `❌ Failed for ${user.username}: ${errorMsg}`)
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

    if (failed > 0) {
      addLog(
        actualJobId,
        'warn',
        `⚠️ Completed with ${failed} failure(s): ${success} succeeded, ${failed} failed, ${totalRecommendations} total recommendations`
      )
    } else {
      addLog(actualJobId, 'info', `🎉 All ${success} user(s) processed successfully! ${totalRecommendations} total recommendations`)
    }

    completeJob(actualJobId, finalResult)
    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    addLog(actualJobId, 'error', `❌ Job failed: ${error}`)
    failJob(actualJobId, error)
    throw err
  }
}

/**
 * Clear and rebuild recommendations for all users (admin function)
 */
export async function clearAndRebuildAllRecommendations(existingJobId?: string): Promise<{
  cleared: number
  success: number
  failed: number
  jobId: string
}> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'rebuild-movie-recommendations', 3)

  try {
    // Step 1: Count existing
    setJobStep(jobId, 0, 'Counting existing recommendations')
    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) FROM recommendation_runs'
    )
    const existingCount = parseInt(countResult?.count || '0', 10)
    addLog(jobId, 'info', `📊 Found ${existingCount} existing recommendation runs`)

    // Step 2: Clear all
    setJobStep(jobId, 1, 'Clearing all recommendations')
    addLog(jobId, 'info', '🗑️ Clearing all recommendation data...')
    await clearAllRecommendations()
    addLog(jobId, 'info', '✅ All recommendations cleared')

    // Step 3: Regenerate for all users
    setJobStep(jobId, 2, 'Regenerating recommendations')
    const result = await query<{
      id: string
      username: string
      provider_user_id: string
      max_parental_rating: number | null
    }>(
      `SELECT id, username, provider_user_id, max_parental_rating FROM users WHERE is_enabled = true`
    )
    const users = result.rows
    addLog(jobId, 'info', `👥 Regenerating for ${users.length} enabled user(s)`)

    let success = 0
    let failed = 0

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      updateJobProgress(jobId, i, users.length, user.username)

      try {
        addLog(jobId, 'info', `🧠 Generating for ${user.username}...`)
        await generateRecommendationsForUser({
          id: user.id,
          username: user.username,
          providerUserId: user.provider_user_id,
          maxParentalRating: user.max_parental_rating,
        })
        success++
        addLog(jobId, 'info', `✅ Done: ${user.username}`)
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        addLog(jobId, 'error', `❌ ${user.username}: ${error}`)
        failed++
      }
    }

    updateJobProgress(jobId, users.length, users.length)
    const finalResult = { cleared: existingCount, success, failed, jobId }
    completeJob(jobId, finalResult)
    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    addLog(jobId, 'error', `❌ Job failed: ${error}`)
    failJob(jobId, error)
    throw err
  }
}

/**
 * Regenerate recommendations for a single user (user-initiated)
 */
export async function regenerateUserRecommendations(userId: string): Promise<{
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

  logger.info({ userId, username: user.username }, '🔄 User-initiated recommendation regeneration')

  // Clear existing recommendations for this user
  await clearUserRecommendations(userId)

  // Generate new recommendations
  const result = await generateRecommendationsForUser({
    id: user.id,
    username: user.username,
    providerUserId: user.provider_user_id,
    maxParentalRating: user.max_parental_rating,
  })

  return {
    runId: result.runId,
    count: result.recommendations.length,
  }
}
