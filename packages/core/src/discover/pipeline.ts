/**
 * Discovery Pipeline
 * 
 * Main orchestration for generating discovery suggestions
 * Uses a two-phase approach:
 * 1. Fetch global candidates ONCE (TMDb Discover, Trakt Trending/Popular) into shared pool
 * 2. For each user: fetch personalized + merge with pool + filter + score + store
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { 
  fetchAllCandidates, 
  enrichFullData,
  fetchGlobalCandidates,
  fetchPersonalizedCandidates,
  mergeWithPool,
  enrichBasicData,
} from './sources.js'
import { filterCandidates } from './filter.js'
import { scoreCandidates } from './scorer.js'
import {
  createDiscoveryRun,
  updateDiscoveryRunStats,
  finalizeDiscoveryRun,
  storeDiscoveryCandidates,
  upsertPoolCandidates,
  getPoolCandidates,
  poolCandidateToRaw,
  getUnenrichedPoolCandidates,
  updatePoolCandidateEnrichment,
} from './storage.js'
import {
  addLog,
  updateJobProgress,
} from '../jobs/progress.js'
import type {
  MediaType,
  DiscoveryConfig,
  DiscoveryPipelineResult,
  DiscoveryUser,
  ScoredCandidate,
  RawCandidate,
  DEFAULT_DISCOVERY_CONFIG,
} from './types.js'

const logger = createChildLogger('discover:pipeline')

/**
 * Generate discovery suggestions for a single user
 * Uses lazy enrichment: only top candidates get full metadata (cast, crew, etc.)
 */
export async function generateDiscoveryForUser(
  user: DiscoveryUser,
  mediaType: MediaType,
  config: DiscoveryConfig,
  runType: 'scheduled' | 'manual' = 'scheduled'
): Promise<DiscoveryPipelineResult> {
  const startTime = Date.now()
  
  logger.info({ userId: user.id, username: user.username, mediaType }, 'Starting discovery generation')

  // Create discovery run record
  const runId = await createDiscoveryRun(user.id, mediaType, runType)
  
  try {
    // Step 1: Fetch candidates from all sources (with basic enrichment only)
    // This is faster because we skip full cast/crew enrichment at this stage
    logger.info({ userId: user.id }, 'Fetching candidates from sources...')
    const rawCandidates = await fetchAllCandidates(user.id, mediaType, config, { skipEnrichment: true })
    
    await updateDiscoveryRunStats(runId, { candidatesFetched: rawCandidates.length })
    
    if (rawCandidates.length === 0) {
      logger.warn({ userId: user.id, mediaType }, 'No candidates fetched from any source')
      const durationMs = Date.now() - startTime
      await finalizeDiscoveryRun(runId, 'completed', durationMs)
      return {
        runId,
        candidates: [],
        candidatesFetched: 0,
        candidatesFiltered: 0,
        candidatesScored: 0,
        candidatesStored: 0,
        durationMs,
      }
    }

    // Step 2: Filter out content already in library or watched
    logger.info({ userId: user.id }, 'Filtering candidates...')
    const filteredCandidates = await filterCandidates(user.id, mediaType, rawCandidates)
    
    await updateDiscoveryRunStats(runId, { candidatesFiltered: filteredCandidates.length })
    
    if (filteredCandidates.length === 0) {
      logger.warn({ userId: user.id, mediaType }, 'All candidates filtered out')
      const durationMs = Date.now() - startTime
      await finalizeDiscoveryRun(runId, 'completed', durationMs)
      return {
        runId,
        candidates: [],
        candidatesFetched: rawCandidates.length,
        candidatesFiltered: 0,
        candidatesScored: 0,
        candidatesStored: 0,
        durationMs,
      }
    }

    // Step 3: Score and rank candidates (quick scoring without full metadata)
    logger.info({ userId: user.id }, 'Scoring candidates...')
    const allScoredCandidates = await scoreCandidates(user.id, mediaType, filteredCandidates, config)
    
    // Step 4: Limit to maxTotalCandidates for storage
    const maxTotal = config.maxTotalCandidates || 200
    const candidatesToStore = allScoredCandidates.slice(0, maxTotal)
    
    await updateDiscoveryRunStats(runId, { candidatesScored: candidatesToStore.length })

    // Step 5: Lazy enrichment - only enrich top candidates with full metadata
    // This saves 60-80% of API calls compared to enriching all candidates
    const maxEnriched = config.maxEnrichedCandidates || 75
    const candidatesToEnrich = candidatesToStore.slice(0, maxEnriched)
    const candidatesToSkipEnrichment = candidatesToStore.slice(maxEnriched)
    
    logger.info({ 
      userId: user.id, 
      toEnrich: candidatesToEnrich.length,
      toSkip: candidatesToSkipEnrichment.length 
    }, 'Enriching top candidates with full metadata...')
    
    // Enrich top candidates with full metadata (cast, crew, runtime, tagline)
    // enrichFullData returns RawCandidate[], so we need to merge back with scored data
    const enrichedRawCandidates = await enrichFullData(candidatesToEnrich, mediaType)
    
    // Create a map of enriched data by tmdbId
    const enrichedMap = new Map(enrichedRawCandidates.map(c => [c.tmdbId, c]))
    
    // Mark enriched vs non-enriched candidates, preserving scoring data
    const finalCandidates: ScoredCandidate[] = [
      // For enriched candidates, merge the raw enriched data with the scoring data
      ...candidatesToEnrich.map(scored => {
        const enriched = enrichedMap.get(scored.tmdbId)
        return {
          ...scored,
          // Merge enriched data (cast, crew, runtime, tagline, etc.)
          castMembers: enriched?.castMembers ?? scored.castMembers,
          directors: enriched?.directors ?? scored.directors,
          runtimeMinutes: enriched?.runtimeMinutes ?? scored.runtimeMinutes,
          tagline: enriched?.tagline ?? scored.tagline,
          imdbId: enriched?.imdbId ?? scored.imdbId,
          posterPath: enriched?.posterPath ?? scored.posterPath,
          backdropPath: enriched?.backdropPath ?? scored.backdropPath,
          overview: enriched?.overview ?? scored.overview,
          originalLanguage: enriched?.originalLanguage ?? scored.originalLanguage,
          isEnriched: true,
        }
      }),
      ...candidatesToSkipEnrichment.map(c => ({ ...c, isEnriched: false })),
    ]
    
    // Re-sort by score after enrichment (scores shouldn't change, but ensure order)
    finalCandidates.sort((a, b) => b.finalScore - a.finalScore)

    // Step 6: Store results
    logger.info({ userId: user.id }, 'Storing candidates...')
    const storedCount = await storeDiscoveryCandidates(runId, user.id, finalCandidates, mediaType)
    
    await updateDiscoveryRunStats(runId, { candidatesStored: storedCount })

    // Finalize run
    const durationMs = Date.now() - startTime
    await finalizeDiscoveryRun(runId, 'completed', durationMs)

    logger.info({
      userId: user.id,
      username: user.username,
      mediaType,
      candidatesFetched: rawCandidates.length,
      candidatesFiltered: filteredCandidates.length,
      candidatesScored: candidatesToStore.length,
      candidatesEnriched: candidatesToEnrich.length,
      candidatesStored: storedCount,
      durationMs,
    }, 'Discovery generation complete')

    return {
      runId,
      candidates: finalCandidates,
      candidatesFetched: rawCandidates.length,
      candidatesFiltered: filteredCandidates.length,
      candidatesScored: candidatesToStore.length,
      candidatesStored: storedCount,
      durationMs,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    
    logger.error({ userId: user.id, err }, 'Discovery generation failed')
    await finalizeDiscoveryRun(runId, 'failed', durationMs, error)
    
    throw err
  }
}

/**
 * Get all users who have discovery enabled
 */
export async function getDiscoveryEnabledUsers(): Promise<DiscoveryUser[]> {
  const result = await query<{
    id: string
    username: string
    provider_user_id: string
    max_parental_rating: number | null
    discover_enabled: boolean
    discover_request_enabled: boolean
    trakt_access_token: string | null
  }>(
    `SELECT id, username, provider_user_id, max_parental_rating, 
            discover_enabled, discover_request_enabled, trakt_access_token
     FROM users 
     WHERE is_enabled = true AND discover_enabled = true`
  )

  return result.rows.map(row => ({
    id: row.id,
    username: row.username,
    providerUserId: row.provider_user_id,
    maxParentalRating: row.max_parental_rating,
    discoverEnabled: row.discover_enabled,
    discoverRequestEnabled: row.discover_request_enabled,
    traktAccessToken: row.trakt_access_token,
  }))
}

/**
 * Generate discovery suggestions for all enabled users
 * Uses two-phase approach for efficiency:
 * Phase 1: Fetch global candidates ONCE into shared pool
 * Phase 2: For each user, fetch personalized + merge + filter + score + store
 */
export async function generateDiscoveryForAllUsers(
  config: DiscoveryConfig,
  jobId?: string
): Promise<{
  success: number
  failed: number
  jobId: string
}> {
  const actualJobId = jobId || crypto.randomUUID()
  
  const users = await getDiscoveryEnabledUsers()
  
  if (users.length === 0) {
    logger.info('No users with discovery enabled')
    return { success: 0, failed: 0, jobId: actualJobId }
  }

  // Total items: 2 global phases + (users * 2 media types)
  const totalItems = 2 + (users.length * 2)
  let processedItems = 0
  
  logger.info({ userCount: users.length }, 'Starting discovery generation for all users')
  addLog(actualJobId, 'info', `👥 Found ${users.length} user(s) with discovery enabled`)

  let success = 0
  let failed = 0

  // =========================================================================
  // Phase 1: Fetch global candidates into shared pool (ONCE per media type)
  // =========================================================================
  
  for (const mediaType of ['movie', 'series'] as MediaType[]) {
    addLog(actualJobId, 'info', `🌍 Fetching global ${mediaType} candidates for shared pool...`)
    
    try {
      const globalResult = await fetchGlobalCandidates(mediaType, config)
      
      // Basic enrich Trakt candidates that lack poster/language
      const enrichedGlobal = await enrichBasicData(globalResult.candidates, mediaType)
      
      // Upsert into shared pool
      const poolResult = await upsertPoolCandidates(mediaType, enrichedGlobal)
      
      addLog(
        actualJobId, 
        'info', 
        `✅ Pool: ${poolResult.inserted} new, ${poolResult.updated} updated ${mediaType}s`
      )
      
      logger.info({
        mediaType,
        fetched: globalResult.totalFetched,
        unique: globalResult.uniqueCount,
        poolInserted: poolResult.inserted,
        poolUpdated: poolResult.updated,
      }, 'Global candidates added to pool')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      logger.error({ mediaType, err }, 'Failed to fetch global candidates')
      addLog(actualJobId, 'error', `❌ Failed to fetch global ${mediaType} candidates: ${errorMsg}`)
      // Continue with other media type
    }
    
    processedItems++
    updateJobProgress(actualJobId, processedItems, totalItems, `Pool: ${mediaType}`)
  }

  // =========================================================================
  // Phase 2: Process each user (personalized fetch + merge + filter + score)
  // =========================================================================
  
  addLog(actualJobId, 'info', `🔄 Processing ${users.length} user(s)...`)
  
  // Get pool candidates for merging (only fetch once per media type)
  const moviePoolCandidates = (await getPoolCandidates('movie')).map(poolCandidateToRaw)
  const seriesPoolCandidates = (await getPoolCandidates('series')).map(poolCandidateToRaw)
  
  addLog(actualJobId, 'info', `📦 Pool: ${moviePoolCandidates.length} movies, ${seriesPoolCandidates.length} series`)

  for (let userIndex = 0; userIndex < users.length; userIndex++) {
    const user = users[userIndex]
    
    // Generate for both movies and series
    for (const mediaType of ['movie', 'series'] as MediaType[]) {
      const poolCandidates = mediaType === 'movie' ? moviePoolCandidates : seriesPoolCandidates
      
      try {
        addLog(actualJobId, 'info', `🎬 ${user.username}: ${mediaType}...`)
        
        await generateDiscoveryForUserWithPool(user, mediaType, config, poolCandidates, 'scheduled')
        
        success++
        addLog(actualJobId, 'info', `✅ ${user.username}: ${mediaType} complete`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ userId: user.id, username: user.username, mediaType, err }, 'Failed to generate discovery')
        addLog(actualJobId, 'error', `❌ ${user.username}: ${mediaType} failed: ${errorMsg}`)
        failed++
      }
      
      processedItems++
      updateJobProgress(actualJobId, processedItems, totalItems, `${user.username}: ${mediaType}`)
    }
  }

  logger.info({ success, failed, jobId: actualJobId }, 'Discovery generation for all users complete')
  addLog(
    actualJobId, 
    success > 0 ? 'info' : 'warn', 
    `🏁 Complete: ${success} successful, ${failed} failed`
  )

  return { success, failed, jobId: actualJobId }
}

/**
 * Generate discovery for a user using pre-fetched pool candidates
 * This is faster because global candidates are already fetched
 */
async function generateDiscoveryForUserWithPool(
  user: DiscoveryUser,
  mediaType: MediaType,
  config: DiscoveryConfig,
  poolCandidates: RawCandidate[],
  runType: 'scheduled' | 'manual' = 'scheduled'
): Promise<DiscoveryPipelineResult> {
  const startTime = Date.now()
  
  logger.info({ userId: user.id, username: user.username, mediaType }, 'Starting discovery generation with pool')

  // Create discovery run record
  const runId = await createDiscoveryRun(user.id, mediaType, runType)
  
  try {
    // Step 1: Fetch personalized candidates only (TMDb/Trakt recommendations)
    logger.info({ userId: user.id }, 'Fetching personalized candidates...')
    const personalizedResult = await fetchPersonalizedCandidates(user.id, mediaType, config)
    
    // Step 2: Merge personalized with pool (personalized takes precedence)
    const mergedCandidates = mergeWithPool(personalizedResult.candidates, poolCandidates)
    
    await updateDiscoveryRunStats(runId, { candidatesFetched: mergedCandidates.length })
    
    logger.info({ 
      userId: user.id, 
      personalized: personalizedResult.totalFetched,
      pool: poolCandidates.length,
      merged: mergedCandidates.length,
    }, 'Merged candidates')
    
    if (mergedCandidates.length === 0) {
      logger.warn({ userId: user.id, mediaType }, 'No candidates available')
      const durationMs = Date.now() - startTime
      await finalizeDiscoveryRun(runId, 'completed', durationMs)
      return {
        runId,
        candidates: [],
        candidatesFetched: 0,
        candidatesFiltered: 0,
        candidatesScored: 0,
        candidatesStored: 0,
        durationMs,
      }
    }

    // Step 3: Filter out content already in library or watched
    logger.info({ userId: user.id }, 'Filtering candidates...')
    const filteredCandidates = await filterCandidates(user.id, mediaType, mergedCandidates)
    
    await updateDiscoveryRunStats(runId, { candidatesFiltered: filteredCandidates.length })
    
    if (filteredCandidates.length === 0) {
      logger.warn({ userId: user.id, mediaType }, 'All candidates filtered out')
      const durationMs = Date.now() - startTime
      await finalizeDiscoveryRun(runId, 'completed', durationMs)
      return {
        runId,
        candidates: [],
        candidatesFetched: mergedCandidates.length,
        candidatesFiltered: 0,
        candidatesScored: 0,
        candidatesStored: 0,
        durationMs,
      }
    }

    // Step 4: Score and rank candidates
    logger.info({ userId: user.id }, 'Scoring candidates...')
    const allScoredCandidates = await scoreCandidates(user.id, mediaType, filteredCandidates, config)
    
    // Limit to maxTotalCandidates for storage
    const maxTotal = config.maxTotalCandidates || 200
    const candidatesToStore = allScoredCandidates.slice(0, maxTotal)
    
    await updateDiscoveryRunStats(runId, { candidatesScored: candidatesToStore.length })

    // Step 5: Lazy enrichment - only enrich top candidates with full metadata
    const maxEnriched = config.maxEnrichedCandidates || 75
    const candidatesToEnrich = candidatesToStore.slice(0, maxEnriched)
    const candidatesToSkipEnrichment = candidatesToStore.slice(maxEnriched)
    
    logger.info({ 
      userId: user.id, 
      toEnrich: candidatesToEnrich.length,
      toSkip: candidatesToSkipEnrichment.length 
    }, 'Enriching top candidates...')
    
    const enrichedRawCandidates = await enrichFullData(candidatesToEnrich, mediaType)
    const enrichedMap = new Map(enrichedRawCandidates.map(c => [c.tmdbId, c]))
    
    // Merge enriched data with scoring data
    const finalCandidates: ScoredCandidate[] = [
      ...candidatesToEnrich.map(scored => {
        const enriched = enrichedMap.get(scored.tmdbId)
        return {
          ...scored,
          castMembers: enriched?.castMembers ?? scored.castMembers,
          directors: enriched?.directors ?? scored.directors,
          runtimeMinutes: enriched?.runtimeMinutes ?? scored.runtimeMinutes,
          tagline: enriched?.tagline ?? scored.tagline,
          imdbId: enriched?.imdbId ?? scored.imdbId,
          posterPath: enriched?.posterPath ?? scored.posterPath,
          backdropPath: enriched?.backdropPath ?? scored.backdropPath,
          overview: enriched?.overview ?? scored.overview,
          originalLanguage: enriched?.originalLanguage ?? scored.originalLanguage,
          isEnriched: true,
        }
      }),
      ...candidatesToSkipEnrichment.map(c => ({ ...c, isEnriched: false })),
    ]
    
    finalCandidates.sort((a, b) => b.finalScore - a.finalScore)

    // Step 6: Store results
    logger.info({ userId: user.id }, 'Storing candidates...')
    const storedCount = await storeDiscoveryCandidates(runId, user.id, finalCandidates, mediaType)
    
    await updateDiscoveryRunStats(runId, { candidatesStored: storedCount })

    // Finalize run
    const durationMs = Date.now() - startTime
    await finalizeDiscoveryRun(runId, 'completed', durationMs)

    logger.info({
      userId: user.id,
      username: user.username,
      mediaType,
      candidatesFetched: mergedCandidates.length,
      candidatesFiltered: filteredCandidates.length,
      candidatesScored: candidatesToStore.length,
      candidatesEnriched: candidatesToEnrich.length,
      candidatesStored: storedCount,
      durationMs,
    }, 'Discovery generation complete')

    return {
      runId,
      candidates: finalCandidates,
      candidatesFetched: mergedCandidates.length,
      candidatesFiltered: filteredCandidates.length,
      candidatesScored: candidatesToStore.length,
      candidatesStored: storedCount,
      durationMs,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    
    logger.error({ userId: user.id, err }, 'Discovery generation failed')
    await finalizeDiscoveryRun(runId, 'failed', durationMs, error)
    
    throw err
  }
}

/**
 * Regenerate discovery for a single user (user-initiated)
 */
export async function regenerateUserDiscovery(
  userId: string,
  mediaType: MediaType
): Promise<DiscoveryPipelineResult> {
  // Get user info
  const user = await queryOne<{
    id: string
    username: string
    provider_user_id: string
    max_parental_rating: number | null
    discover_enabled: boolean
    discover_request_enabled: boolean
    trakt_access_token: string | null
  }>(
    `SELECT id, username, provider_user_id, max_parental_rating, 
            discover_enabled, discover_request_enabled, trakt_access_token
     FROM users WHERE id = $1`,
    [userId]
  )

  if (!user) {
    throw new Error('User not found')
  }

  if (!user.discover_enabled) {
    throw new Error('Discovery not enabled for user')
  }

  // Import default config
  const { DEFAULT_DISCOVERY_CONFIG } = await import('./types.js')

  return generateDiscoveryForUser(
    {
      id: user.id,
      username: user.username,
      providerUserId: user.provider_user_id,
      maxParentalRating: user.max_parental_rating,
      discoverEnabled: user.discover_enabled,
      discoverRequestEnabled: user.discover_request_enabled,
      traktAccessToken: user.trakt_access_token,
    },
    mediaType,
    DEFAULT_DISCOVERY_CONFIG,
    'manual'
  )
}

