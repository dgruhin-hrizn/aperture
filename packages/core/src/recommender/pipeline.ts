import { createChildLogger } from '../lib/logger.js'
import { query, queryOne, transaction } from '../lib/db.js'
import { getRecommendationConfig } from '../lib/recommendationConfig.js'
import { averageEmbeddings, getMovieEmbedding } from './embeddings.js'
import { generateExplanations, storeExplanations, MovieForExplanation } from './explanations.js'
import {
  createJobProgress,
  updateJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
} from '../jobs/progress.js'
import { randomUUID } from 'crypto'

const logger = createChildLogger('recommender')

interface User {
  id: string
  username: string
  providerUserId: string
}

interface WatchedMovie {
  movieId: string
  lastPlayedAt: Date | null
  playCount: number
  isFavorite: boolean
}

interface Candidate {
  movieId: string
  title: string
  year: number | null
  genres: string[]
  communityRating: number | null
  similarity: number
  novelty: number
  ratingScore: number
  diversityScore: number
  finalScore: number
}

interface PipelineConfig {
  maxCandidates: number
  selectedCount: number
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
  recentWatchLimit: number
}

// Fallback defaults (used only if DB fetch fails)
const FALLBACK_CONFIG: PipelineConfig = {
  maxCandidates: 50000,
  selectedCount: 50,
  similarityWeight: 0.4,
  noveltyWeight: 0.2,
  ratingWeight: 0.2,
  diversityWeight: 0.2,
  recentWatchLimit: 50,
}

/**
 * Get configuration from database (with fallback)
 */
async function loadConfig(): Promise<PipelineConfig> {
  try {
    const dbConfig = await getRecommendationConfig()
    return {
      maxCandidates: dbConfig.maxCandidates,
      selectedCount: dbConfig.selectedCount,
      similarityWeight: dbConfig.similarityWeight,
      noveltyWeight: dbConfig.noveltyWeight,
      ratingWeight: dbConfig.ratingWeight,
      diversityWeight: dbConfig.diversityWeight,
      recentWatchLimit: dbConfig.recentWatchLimit,
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load recommendation config from DB, using fallback')
    return FALLBACK_CONFIG
  }
}

/**
 * Generate recommendations for a user
 */
export async function generateRecommendationsForUser(
  user: User,
  configOverrides: Partial<PipelineConfig> = {}
): Promise<{ runId: string; recommendations: Candidate[] }> {
  // Load config from database
  const dbConfig = await loadConfig()
  const cfg = { ...dbConfig, ...configOverrides }
  const startTime = Date.now()

  logger.info({ userId: user.id, username: user.username }, '🎬 Starting recommendation generation')

  // Create recommendation run record
  const run = await queryOne<{ id: string }>(
    `INSERT INTO recommendation_runs (user_id, run_type, status)
     VALUES ($1, 'scheduled', 'running')
     RETURNING id`,
    [user.id]
  )

  if (!run) {
    throw new Error('Failed to create recommendation run')
  }

  const runId = run.id
  logger.info({ runId }, '📝 Created recommendation run record')

  try {
    // 0. Get user's recommendation preferences
    const userPrefs = await queryOne<{ include_watched: boolean }>(
      `SELECT include_watched FROM user_preferences WHERE user_id = $1`,
      [user.id]
    )
    const includeWatched = userPrefs?.include_watched ?? false
    logger.info(
      { userId: user.id, includeWatched },
      `📋 User preference: include_watched=${includeWatched}`
    )

    // 1. Get user's watch history
    logger.info({ userId: user.id }, '📊 Fetching watch history...')
    const watched = await getWatchHistory(user.id, cfg.recentWatchLimit)
    logger.info(
      { userId: user.id, watchedCount: watched.length },
      `Found ${watched.length} watched movies`
    )

    if (watched.length === 0) {
      logger.warn(
        { userId: user.id },
        '⚠️ User has no watch history - cannot generate recommendations'
      )
      await finalizeRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    // 2. Build taste profile (weighted average of watched movie embeddings)
    logger.info({ userId: user.id }, '🧠 Building taste profile from watch history...')
    const tasteProfile = await buildTasteProfile(watched)

    if (!tasteProfile) {
      logger.warn(
        { userId: user.id },
        '⚠️ Could not build taste profile - movies may be missing embeddings'
      )
      await finalizeRun(runId, 0, 0, Date.now() - startTime, 'completed')
      return { runId, recommendations: [] }
    }

    logger.info({ userId: user.id }, '✅ Taste profile built successfully')

    // Store taste profile
    await storeTasteProfile(user.id, tasteProfile)
    logger.info({ userId: user.id }, '💾 Stored taste profile')

    // 3. Get candidate movies (optionally including watched based on user preference)
    logger.info(
      { userId: user.id, maxCandidates: cfg.maxCandidates, includeWatched },
      `🔍 Finding candidate movies using vector similarity (${includeWatched ? 'including' : 'excluding'} watched)...`
    )

    // Get ALL watched movie IDs for filtering (not just the ones used for taste profile)
    let allWatchedIds: Set<string>
    if (includeWatched) {
      // Don't need to load all watched IDs if we're including them anyway
      allWatchedIds = new Set()
    } else {
      const allWatchedResult = await query<{ movie_id: string }>(
        `SELECT movie_id FROM watch_history WHERE user_id = $1`,
        [user.id]
      )
      allWatchedIds = new Set(allWatchedResult.rows.map((r) => r.movie_id))
      logger.info(
        { userId: user.id, totalWatched: allWatchedIds.size },
        `📋 Loaded ${allWatchedIds.size} watched movie IDs for filtering`
      )
    }

    const candidates = await getCandidates(
      tasteProfile,
      allWatchedIds,
      cfg.maxCandidates,
      includeWatched
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
    logger.info(
      { userId: user.id, targetCount: cfg.selectedCount },
      '🎲 Applying diversity and selecting final recommendations...'
    )
    const selected = applyDiversityAndSelect(
      scoredCandidates,
      cfg.selectedCount,
      cfg.diversityWeight
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
    await storeCandidates(runId, scoredCandidates, selected)
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

async function getWatchHistory(userId: string, limit: number): Promise<WatchedMovie[]> {
  // Get ALL watch history up to limit, using a smarter ordering:
  // - Favorites first (always include these)
  // - Then by a combination of play count and recency
  // This ensures we capture the full breadth of user's taste
  const result = await query<{
    movie_id: string
    last_played_at: Date | null
    play_count: number
    is_favorite: boolean
  }>(
    `SELECT movie_id, last_played_at, play_count, is_favorite
     FROM watch_history
     WHERE user_id = $1
     ORDER BY 
       is_favorite DESC,
       play_count DESC,
       last_played_at DESC NULLS LAST
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map((row) => ({
    movieId: row.movie_id,
    lastPlayedAt: row.last_played_at,
    playCount: row.play_count,
    isFavorite: row.is_favorite,
  }))
}

async function buildTasteProfile(watched: WatchedMovie[]): Promise<number[] | null> {
  const embeddings: number[][] = []
  const weights: number[] = []

  // Get movie ratings and genres for additional context
  const movieIds = watched.map((w) => w.movieId)
  const movieDataResult = await query<{
    id: string
    community_rating: number | null
    genres: string[]
  }>(`SELECT id, community_rating, genres FROM movies WHERE id = ANY($1)`, [movieIds])
  const movieData = new Map(movieDataResult.rows.map((r) => [r.id, r]))

  // Calculate stats for normalization
  const maxPlayCount = Math.max(...watched.map((w) => w.playCount), 1)
  const favoriteCount = watched.filter((w) => w.isFavorite).length
  const totalMovies = watched.length

  logger.debug(
    {
      totalMovies,
      favoriteCount,
      maxPlayCount,
    },
    'Building taste profile from watch history'
  )

  for (let i = 0; i < watched.length; i++) {
    const movie = watched[i]
    const emb = await getMovieEmbedding(movie.movieId)
    if (emb) {
      embeddings.push(emb)

      // Balanced multi-factor weighting
      // Goal: capture full breadth of taste without over-weighting any single factor
      let weight = 1.0

      // 1. Position weight - slight preference for movies that appear earlier
      // (already sorted by favorites, play count, recency)
      // Very gentle decay so we don't ignore movies at the end
      const positionFactor = 1 - (i / totalMovies) * 0.3 // Range: 0.7 to 1.0
      weight *= positionFactor

      // 2. Play count - normalized logarithmic boost
      // Prevents a single rewatched movie from dominating
      if (movie.playCount > 1) {
        const normalizedPlayCount = Math.log2(movie.playCount + 1) / Math.log2(maxPlayCount + 1)
        weight *= 1 + normalizedPlayCount * 0.4 // Up to 40% boost for most rewatched
      }

      // 3. Favorite boost - meaningful but not overwhelming
      // If user has many favorites, reduce individual favorite weight
      if (movie.isFavorite) {
        const favoriteBoost = favoriteCount > 20 ? 1.3 : favoriteCount > 10 ? 1.5 : 1.8
        weight *= favoriteBoost
      }

      // 4. Rating influence - slight boost for critically acclaimed choices
      const data = movieData.get(movie.movieId)
      if (data?.community_rating && data.community_rating >= 7.5) {
        weight *= 1 + (data.community_rating - 7) * 0.05 // Max ~15% boost for 10-rated films
      }

      weights.push(weight)
    }
  }

  if (embeddings.length === 0) {
    return null
  }

  // Normalize weights to prevent any single movie from having outsized influence
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const avgWeight = totalWeight / weights.length
  const normalizedWeights = weights.map((w) => {
    // Cap any weight at 3x the average to ensure diversity
    return Math.min(w, avgWeight * 3)
  })

  logger.debug(
    {
      embeddingCount: embeddings.length,
      totalWeight: totalWeight.toFixed(2),
      avgWeight: avgWeight.toFixed(2),
      topWeights: normalizedWeights.slice(0, 5).map((w) => w.toFixed(2)),
    },
    'Taste profile weights calculated'
  )

  return averageEmbeddings(embeddings, normalizedWeights)
}

async function storeTasteProfile(userId: string, embedding: number[]): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`

  await query(
    `INSERT INTO user_preferences (user_id, taste_embedding, taste_embedding_updated_at)
     VALUES ($1, $2::halfvec, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       taste_embedding = EXCLUDED.taste_embedding,
       taste_embedding_updated_at = NOW()`,
    [userId, vectorStr]
  )
}

async function getCandidates(
  tasteProfile: number[],
  watchedIds: Set<string>,
  limit: number,
  includeWatched: boolean = false
): Promise<Candidate[]> {
  const vectorStr = `[${tasteProfile.join(',')}]`

  // Check if any library configs exist
  const configCheck = await queryOne<{ count: string }>('SELECT COUNT(*) FROM library_config')
  const hasLibraryConfigs = configCheck && parseInt(configCheck.count, 10) > 0

  // Calculate query limit - if excluding watched, need more results to filter from
  const queryLimit = includeWatched ? limit : limit + watchedIds.size

  // Use pgvector to find similar movies, filtered by enabled libraries
  const result = await query<{
    id: string
    title: string
    year: number | null
    genres: string[]
    community_rating: number | null
    similarity: number
  }>(
    hasLibraryConfigs
      ? `SELECT m.id, m.title, m.year, m.genres, m.community_rating,
                1 - (e.embedding <=> $1::halfvec) as similarity
         FROM embeddings e
         JOIN movies m ON m.id = e.movie_id
         WHERE EXISTS (
           SELECT 1 FROM library_config lc 
           WHERE lc.provider_library_id = m.provider_library_id 
           AND lc.is_enabled = true
         )
         ORDER BY e.embedding <=> $1::halfvec
         LIMIT $2`
      : `SELECT m.id, m.title, m.year, m.genres, m.community_rating,
                1 - (e.embedding <=> $1::halfvec) as similarity
         FROM embeddings e
         JOIN movies m ON m.id = e.movie_id
         ORDER BY e.embedding <=> $1::halfvec
         LIMIT $2`,
    [vectorStr, queryLimit]
  )

  // Filter out watched movies if not including them
  const filteredRows = includeWatched
    ? result.rows
    : result.rows.filter((row) => !watchedIds.has(row.id))

  return filteredRows.slice(0, limit).map((row) => ({
    movieId: row.id,
    title: row.title,
    year: row.year,
    genres: row.genres || [],
    communityRating: row.community_rating,
    similarity: row.similarity,
    novelty: 0,
    ratingScore: 0,
    diversityScore: 0,
    finalScore: 0,
  }))
}

async function scoreCandidates(
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

function applyDiversityAndSelect(
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

async function storeCandidates(
  runId: string,
  allCandidates: Candidate[],
  selected: Candidate[]
): Promise<void> {
  const selectedIds = new Set(selected.map((s) => s.movieId))

  // Store all candidates (or at least top 100)
  const toStore = allCandidates.slice(0, 100)

  for (let i = 0; i < toStore.length; i++) {
    const c = toStore[i]
    await query(
      `INSERT INTO recommendation_candidates
       (run_id, movie_id, rank, is_selected, final_score, similarity_score, novelty_score, rating_score, diversity_score, score_breakdown)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        runId,
        c.movieId,
        i + 1,
        selectedIds.has(c.movieId),
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

async function storeEvidence(
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

async function finalizeRun(
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

/**
 * Generate recommendations for all enabled users
 */
export async function generateRecommendationsForAllUsers(jobId?: string): Promise<{
  success: number
  failed: number
  jobId: string
}> {
  const actualJobId = jobId || crypto.randomUUID()

  // Initialize job progress
  createJobProgress(actualJobId, 'generate-recommendations', 2)

  try {
    setJobStep(actualJobId, 0, 'Finding enabled users')
    addLog(actualJobId, 'info', '🔍 Finding enabled users...')

    const result = await query<{ id: string; username: string; provider_user_id: string }>(
      `SELECT id, username, provider_user_id FROM users WHERE is_enabled = true`
    )

    const totalUsers = result.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No enabled users found')
      completeJob(actualJobId, { success: 0, failed: 0 })
      return { success: 0, failed: 0, jobId: actualJobId }
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} enabled user(s)`)
    setJobStep(actualJobId, 1, 'Generating recommendations', totalUsers)

    let success = 0
    let failed = 0

    for (let i = 0; i < result.rows.length; i++) {
      const user = result.rows[i]

      try {
        addLog(actualJobId, 'info', `🎬 Generating recommendations for ${user.username}...`)

        const recResult = await generateRecommendationsForUser({
          id: user.id,
          username: user.username,
          providerUserId: user.provider_user_id,
        })

        success++
        addLog(
          actualJobId,
          'info',
          `✅ Generated ${recResult.recommendations.length} recommendations for ${user.username}`
        )
        updateJobProgress(
          actualJobId,
          success + failed,
          totalUsers,
          `${success + failed}/${totalUsers} users`
        )
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to generate recommendations')
        addLog(actualJobId, 'error', `❌ Failed for ${user.username}: ${errorMsg}`)
        failed++
        updateJobProgress(
          actualJobId,
          success + failed,
          totalUsers,
          `${success + failed}/${totalUsers} users (${failed} failed)`
        )
      }
    }

    const finalResult = { success, failed, jobId: actualJobId }

    if (failed > 0) {
      addLog(
        actualJobId,
        'warn',
        `⚠️ Completed with ${failed} failure(s): ${success} succeeded, ${failed} failed`
      )
    } else {
      addLog(actualJobId, 'info', `🎉 All ${success} user(s) processed successfully!`)
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
 * Clear all recommendations for a specific user
 */
export async function clearUserRecommendations(userId: string): Promise<void> {
  logger.info({ userId }, '🗑️ Clearing recommendations for user')

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

  logger.info({ userId }, '✅ User recommendations cleared')
}

/**
 * Clear ALL recommendations in the system
 */
export async function clearAllRecommendations(): Promise<void> {
  logger.info('🗑️ Clearing ALL recommendations')

  await transaction(async (client) => {
    await client.query('DELETE FROM recommendation_evidence')
    await client.query('DELETE FROM recommendation_candidates')
    await client.query('DELETE FROM recommendation_runs')
    await client.query('DELETE FROM user_preferences')
  })

  logger.info('✅ All recommendations cleared')
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
  createJobProgress(jobId, 'rebuild-recommendations', 3)

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
    const result = await query<{ id: string; username: string; provider_user_id: string }>(
      `SELECT id, username, provider_user_id FROM users WHERE is_enabled = true`
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
  const user = await queryOne<{ id: string; username: string; provider_user_id: string }>(
    'SELECT id, username, provider_user_id FROM users WHERE id = $1',
    [userId]
  )

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
  })

  return {
    runId: result.runId,
    count: result.recommendations.length,
  }
}

/**
 * Get movie overviews for a list of movie IDs
 */
async function getMovieOverviews(movieIds: string[]): Promise<Map<string, string>> {
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
