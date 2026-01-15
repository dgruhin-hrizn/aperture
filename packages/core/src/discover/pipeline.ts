/**
 * Discovery Pipeline
 * 
 * Main orchestration for generating discovery suggestions
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { fetchAllCandidates } from './sources.js'
import { filterCandidates } from './filter.js'
import { scoreCandidates } from './scorer.js'
import {
  createDiscoveryRun,
  updateDiscoveryRunStats,
  finalizeDiscoveryRun,
  storeDiscoveryCandidates,
} from './storage.js'
import type {
  MediaType,
  DiscoveryConfig,
  DiscoveryPipelineResult,
  DiscoveryUser,
  DEFAULT_DISCOVERY_CONFIG,
} from './types.js'

const logger = createChildLogger('discover:pipeline')

/**
 * Generate discovery suggestions for a single user
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
    // Step 1: Fetch candidates from all sources
    logger.info({ userId: user.id }, 'Fetching candidates from sources...')
    const rawCandidates = await fetchAllCandidates(user.id, mediaType, config)
    
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

    // Step 3: Score and rank candidates
    logger.info({ userId: user.id }, 'Scoring candidates...')
    const scoredCandidates = await scoreCandidates(user.id, mediaType, filteredCandidates, config)
    
    await updateDiscoveryRunStats(runId, { candidatesScored: scoredCandidates.length })

    // Step 4: Store results
    logger.info({ userId: user.id }, 'Storing candidates...')
    const storedCount = await storeDiscoveryCandidates(runId, user.id, scoredCandidates, mediaType)
    
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
      candidatesScored: scoredCandidates.length,
      candidatesStored: storedCount,
      durationMs,
    }, 'Discovery generation complete')

    return {
      runId,
      candidates: scoredCandidates,
      candidatesFetched: rawCandidates.length,
      candidatesFiltered: filteredCandidates.length,
      candidatesScored: scoredCandidates.length,
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

  logger.info({ userCount: users.length }, 'Starting discovery generation for all users')

  let success = 0
  let failed = 0

  for (const user of users) {
    // Generate for both movies and series
    for (const mediaType of ['movie', 'series'] as MediaType[]) {
      try {
        await generateDiscoveryForUser(user, mediaType, config, 'scheduled')
        success++
      } catch (err) {
        logger.error({ userId: user.id, username: user.username, mediaType, err }, 'Failed to generate discovery')
        failed++
      }
    }
  }

  logger.info({ success, failed, jobId: actualJobId }, 'Discovery generation for all users complete')

  return { success, failed, jobId: actualJobId }
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

