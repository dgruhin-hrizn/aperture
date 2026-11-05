/**
 * User Taste Profile System
 *
 * Provides persistent, user-editable taste profiles that power recommendations,
 * similarity graphs, explore, and discovery features.
 */

import { query, queryOne, transaction } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import type {
  TasteProfile,
  FranchisePreference,
  GenreWeight,
  CustomInterest,
  MediaType,
  UserTasteData,
  ProfileBuildOptions,
} from './types.js'

export * from './types.js'
export { 
  detectAndUpdateFranchises, 
  detectAndUpdateGenres, 
  detectFranchiseFromTitle, 
  getItemFranchise,
  type DetectionResult,
  type DetectionOptions,
} from './franchise.js'

const logger = createChildLogger('taste-profile')

// ============================================================================
// Profile Retrieval
// ============================================================================

/**
 * Get a user's taste profile, building it if needed
 */
export async function getUserTasteProfile(
  userId: string,
  mediaType: MediaType,
  options: ProfileBuildOptions = {}
): Promise<TasteProfile | null> {
  const { forceRebuild = false, skipLockCheck = false } = options

  // Try to get existing profile
  const existing = await getStoredProfile(userId, mediaType)

  let compatibleModel = true
  if (existing) {
    // Check if rebuild is needed due to staleness
    let needsRebuild = forceRebuild || isProfileStale(existing)

    // Also check if embedding model has changed (dimension mismatch prevention)
    // If the embedding exists, verify it matches the current model
    if (existing.embedding) {
      const { getActiveEmbeddingModelId } = await import('../lib/ai-provider.js')
      const currentModelId = await getActiveEmbeddingModelId()
      
      if (currentModelId) {
        // If we have no stored model info, we should rebuild to track it properly
        // If the model changed, we definitely need to rebuild
        if (!existing.embeddingModel) {
          logger.info(
            { userId, mediaType, newModel: currentModelId },
            'Profile missing embedding model info, rebuilding to ensure dimension compatibility'
          )
          needsRebuild = true
          compatibleModel = false
        } else if (currentModelId !== existing.embeddingModel) {
          logger.info(
            { userId, mediaType, oldModel: existing.embeddingModel, newModel: currentModelId },
            'Embedding model changed, profile needs rebuild to match new dimensions'
          )
          needsRebuild = true
          compatibleModel = false
        }
      }
    }

    if (!needsRebuild) {
      return existing
    }

    // Respect lock unless explicitly overridden
    if (existing.isLocked && !skipLockCheck) {
      if (!compatibleModel) {
        throw new Error('Locked taste profile uses a different or unknown embedding model. Unlock and rebuild it before generating recommendations.')
      }
      logger.debug({ userId, mediaType }, 'Profile is locked, skipping rebuild')
      return existing
    }
  }

  // Build new profile
  logger.info({ userId, mediaType, forceRebuild }, 'Building taste profile')

  // Import builder dynamically to avoid circular dependencies
  const { buildTasteProfile } = await import('./builder.js')
  const newProfile = await buildTasteProfile(userId, mediaType)

  if (newProfile) {
    // Get current embedding model to store with profile
    const { getActiveEmbeddingModelId } = await import('../lib/ai-provider.js')
    const currentModelId = await getActiveEmbeddingModelId()
    
    await storeTasteProfile(userId, mediaType, newProfile, currentModelId || undefined)
    return await getStoredProfile(userId, mediaType)
  }

  return compatibleModel ? existing : null // Never reuse a vector from another embedding space.
}

/**
 * Get stored profile from database
 */
export async function getStoredProfile(
  userId: string,
  mediaType: MediaType
): Promise<TasteProfile | null> {
  const result = await queryOne<{
    id: string
    user_id: string
    media_type: string
    embedding: string | null
    embedding_model: string | null
    auto_updated_at: Date | null
    user_modified_at: Date | null
    is_locked: boolean
    refresh_interval_days: number
    min_franchise_items: number
    min_franchise_size: number
    created_at: Date
  }>(
    `SELECT * FROM user_taste_profiles WHERE user_id = $1 AND media_type = $2`,
    [userId, mediaType]
  )

  if (!result) return null

  return {
    id: result.id,
    userId: result.user_id,
    mediaType: result.media_type as MediaType,
    embedding: result.embedding ? parseEmbedding(result.embedding) : null,
    embeddingModel: result.embedding_model,
    autoUpdatedAt: result.auto_updated_at,
    userModifiedAt: result.user_modified_at,
    isLocked: result.is_locked,
    refreshIntervalDays: result.refresh_interval_days,
    minFranchiseItems: result.min_franchise_items,
    minFranchiseSize: result.min_franchise_size,
    createdAt: result.created_at,
  }
}

/**
 * Check if a profile is stale and needs rebuilding
 */
export function isProfileStale(profile: TasteProfile): boolean {
  if (!profile.autoUpdatedAt) return true

  const daysSinceUpdate = (Date.now() - profile.autoUpdatedAt.getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceUpdate > profile.refreshIntervalDays
}

/**
 * Get all taste data for a user (profile + franchises + genres + interests)
 */
export async function getUserTasteData(
  userId: string,
  mediaType: MediaType
): Promise<UserTasteData> {
  const [profile, franchises, genres, customInterests] = await Promise.all([
    getStoredProfile(userId, mediaType),
    getUserFranchisePreferences(userId, mediaType),
    getUserGenreWeights(userId),
    getUserCustomInterests(userId),
  ])

  return { profile, franchises, genres, customInterests }
}

// ============================================================================
// Profile Storage
// ============================================================================

/**
 * Store or update a taste profile
 */
export async function storeTasteProfile(
  userId: string,
  mediaType: MediaType,
  embedding: number[],
  embeddingModel?: string
): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`

  await query(
    `INSERT INTO user_taste_profiles (user_id, media_type, embedding, embedding_model, auto_updated_at)
     VALUES ($1, $2, $3::halfvec, $4, NOW())
     ON CONFLICT (user_id, media_type) 
     DO UPDATE SET 
       embedding = $3::halfvec,
       embedding_model = $4,
       auto_updated_at = NOW()`,
    [userId, mediaType, vectorStr, embeddingModel || null]
  )

  logger.info({ userId, mediaType }, 'Stored taste profile')
}

/**
 * Update profile settings (lock, refresh interval, min franchise items/size)
 */
export async function updateProfileSettings(
  userId: string,
  mediaType: MediaType,
  settings: { isLocked?: boolean; refreshIntervalDays?: number; minFranchiseItems?: number; minFranchiseSize?: number }
): Promise<void> {
  const updates: string[] = []
  const values: (string | boolean | number)[] = [userId, mediaType]
  let paramIndex = 3

  if (settings.isLocked !== undefined) {
    updates.push(`is_locked = $${paramIndex}`)
    values.push(settings.isLocked)
    paramIndex++
  }

  if (settings.refreshIntervalDays !== undefined) {
    updates.push(`refresh_interval_days = $${paramIndex}`)
    values.push(settings.refreshIntervalDays)
    paramIndex++
  }

  if (settings.minFranchiseItems !== undefined) {
    updates.push(`min_franchise_items = $${paramIndex}`)
    values.push(settings.minFranchiseItems)
    paramIndex++
  }

  if (settings.minFranchiseSize !== undefined) {
    updates.push(`min_franchise_size = $${paramIndex}`)
    values.push(settings.minFranchiseSize)
    paramIndex++
  }

  if (updates.length === 0) return

  updates.push('user_modified_at = NOW()')

  await query(
    `UPDATE user_taste_profiles 
     SET ${updates.join(', ')}
     WHERE user_id = $1 AND media_type = $2`,
    values
  )

  logger.info({ userId, mediaType, settings }, 'Updated profile settings')
}

/**
 * Invalidate a profile (mark for rebuild on next access)
 */
export async function invalidateProfile(userId: string, mediaType: MediaType): Promise<void> {
  await query(
    `UPDATE user_taste_profiles 
     SET auto_updated_at = NULL 
     WHERE user_id = $1 AND media_type = $2`,
    [userId, mediaType]
  )

  logger.info({ userId, mediaType }, 'Invalidated taste profile')
}

// ============================================================================
// Franchise Preferences
// ============================================================================

/**
 * Get user's franchise preferences
 */
export async function getUserFranchisePreferences(
  userId: string,
  mediaType?: MediaType
): Promise<FranchisePreference[]> {
  const mediaFilter = mediaType ? `AND (media_type = $2 OR media_type = 'both')` : ''
  const params = mediaType ? [userId, mediaType] : [userId]

  const result = await query<{
    id: string
    user_id: string
    franchise_name: string
    media_type: string
    preference_score: string
    is_user_set: boolean
    items_watched: number
    total_engagement: number
    created_at: Date
    updated_at: Date
  }>(
    `SELECT * FROM user_franchise_preferences 
     WHERE user_id = $1 ${mediaFilter}
     ORDER BY total_engagement DESC`,
    params
  )

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    franchiseName: row.franchise_name,
    mediaType: row.media_type as MediaType | 'both',
    preferenceScore: parseFloat(row.preference_score),
    isUserSet: row.is_user_set,
    itemsWatched: row.items_watched,
    totalEngagement: row.total_engagement,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/**
 * Update or create a franchise preference
 */
export async function setFranchisePreference(
  userId: string,
  franchiseName: string,
  mediaType: MediaType | 'both',
  preferenceScore: number,
  isUserSet: boolean = true
): Promise<void> {
  // Clamp score to -1 to 1
  const clampedScore = Math.max(-1, Math.min(1, preferenceScore))

  await query(
    `INSERT INTO user_franchise_preferences 
       (user_id, franchise_name, media_type, preference_score, is_user_set)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, franchise_name, media_type) 
     DO UPDATE SET 
       preference_score = $4,
       is_user_set = $5`,
    [userId, franchiseName, mediaType, clampedScore, isUserSet]
  )

  logger.info({ userId, franchiseName, mediaType, preferenceScore: clampedScore }, 'Set franchise preference')
}

/**
 * Bulk update franchise preferences (from auto-detection)
 * @param clearFirst - If true, deletes franchises for the given mediaType before inserting (for reset mode)
 *                     This includes user-set franchises since reset should start completely fresh
 * @param targetMediaType - The media type to clear when clearFirst is true (only clears that type)
 */
export async function bulkUpdateFranchisePreferences(
  userId: string,
  franchises: Array<{
    franchiseName: string
    mediaType: MediaType | 'both'
    preferenceScore: number
    itemsWatched: number
    totalEngagement: number
  }>,
  clearFirst: boolean = false,
  targetMediaType?: MediaType
): Promise<number> {
  if (franchises.length === 0 && !clearFirst) return 0
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['franchise-preferences', userId])
    if (clearFirst) {
      const typeFilter = targetMediaType ? ' AND media_type = $2' : ''
      await client.query(`DELETE FROM user_franchise_preferences WHERE user_id = $1${typeFilter}`,
        targetMediaType ? [userId, targetMediaType] : [userId])
    }
    let updated = 0
    for (const batch of preferenceBatches(franchises, (item) => JSON.stringify([item.franchiseName, item.mediaType]))) {
      const result = await client.query(
        `INSERT INTO user_franchise_preferences
           (user_id, franchise_name, media_type, preference_score, is_user_set, items_watched, total_engagement)
         SELECT $1, franchise_name, media_type, preference_score, false, items_watched, total_engagement
         FROM unnest($2::text[], $3::text[], $4::numeric[], $5::int[], $6::int[])
           AS incoming(franchise_name, media_type, preference_score, items_watched, total_engagement)
         ON CONFLICT (user_id, franchise_name, media_type) DO UPDATE SET
           preference_score = CASE WHEN user_franchise_preferences.is_user_set
             THEN user_franchise_preferences.preference_score ELSE EXCLUDED.preference_score END,
           items_watched = EXCLUDED.items_watched,
           total_engagement = EXCLUDED.total_engagement
         WHERE NOT user_franchise_preferences.is_user_set
           OR user_franchise_preferences.items_watched != EXCLUDED.items_watched`,
        [userId, batch.map((item) => item.franchiseName), batch.map((item) => item.mediaType),
          batch.map((item) => item.preferenceScore), batch.map((item) => item.itemsWatched),
          batch.map((item) => item.totalEngagement)]
      )
      updated += result.rowCount ?? 0
    }
    return updated
  })
}

/**
 * Delete a franchise preference (user wants to remove it completely)
 */
export async function deleteFranchisePreference(
  userId: string,
  franchiseName: string,
  mediaType: MediaType | 'both'
): Promise<boolean> {
  const result = await query(
    `DELETE FROM user_franchise_preferences 
     WHERE user_id = $1 AND franchise_name = $2 AND media_type = $3`,
    [userId, franchiseName, mediaType]
  )
  
  logger.info({ userId, franchiseName, mediaType }, 'Deleted franchise preference')
  return (result.rowCount ?? 0) > 0
}

// ============================================================================
// Genre Weights
// ============================================================================

/**
 * Get user's genre weights
 */
export async function getUserGenreWeights(userId: string): Promise<GenreWeight[]> {
  const result = await query<{
    id: string
    user_id: string
    genre: string
    weight: string
    is_user_set: boolean
    created_at: Date
    updated_at: Date
  }>(
    `SELECT * FROM user_genre_weights WHERE user_id = $1 ORDER BY genre`,
    [userId]
  )

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    genre: row.genre,
    weight: parseFloat(row.weight),
    isUserSet: row.is_user_set,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/**
 * Set a genre weight
 */
export async function setGenreWeight(
  userId: string,
  genre: string,
  weight: number,
  isUserSet: boolean = true
): Promise<void> {
  // Clamp weight to 0 to 2
  const clampedWeight = Math.max(0, Math.min(2, weight))

  await query(
    `INSERT INTO user_genre_weights (user_id, genre, weight, is_user_set)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, genre) 
     DO UPDATE SET weight = $3, is_user_set = $4`,
    [userId, genre, clampedWeight, isUserSet]
  )

  logger.info({ userId, genre, weight: clampedWeight }, 'Set genre weight')
}

/**
 * Bulk update genre weights
 */
/**
 * Bulk update genre weights (from auto-detection)
 * @param clearFirst - If true, deletes ALL genres before inserting (for reset mode)
 *                     This includes user-set genres since reset should start completely fresh
 */
export async function bulkUpdateGenreWeights(
  userId: string,
  genres: Array<{ genre: string; weight: number }>,
  clearFirst: boolean = false
): Promise<number> {
  if (genres.length === 0 && !clearFirst) return 0
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['genre-weights', userId])
    if (clearFirst) await client.query('DELETE FROM user_genre_weights WHERE user_id = $1', [userId])
    let updated = 0
    for (const batch of preferenceBatches(genres, (item) => item.genre)) {
      const result = await client.query(
        `INSERT INTO user_genre_weights (user_id, genre, weight, is_user_set)
         SELECT $1, genre, weight, false FROM unnest($2::text[], $3::numeric[]) AS incoming(genre, weight)
         ON CONFLICT (user_id, genre) DO UPDATE SET weight = EXCLUDED.weight
         WHERE NOT user_genre_weights.is_user_set`,
        [userId, batch.map((item) => item.genre), batch.map((item) => Math.max(0, Math.min(2, item.weight)))]
      )
      updated += result.rowCount ?? 0
    }
    return updated
  })
}

/**
 * Delete a genre weight (user wants to remove it completely)
 */
export async function deleteGenreWeight(
  userId: string,
  genre: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM user_genre_weights WHERE user_id = $1 AND genre = $2`,
    [userId, genre]
  )
  
  logger.info({ userId, genre }, 'Deleted genre weight')
  return (result.rowCount ?? 0) > 0
}

// ============================================================================
// Custom Interests
// ============================================================================

/**
 * Get user's custom interests
 */
export async function getUserCustomInterests(userId: string): Promise<CustomInterest[]> {
  const result = await query<{
    id: string
    user_id: string
    interest_text: string
    embedding: string | null
    embedding_model: string | null
    weight: string
    created_at: Date
  }>(
    `SELECT * FROM user_custom_interests WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  )

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    interestText: row.interest_text,
    embedding: row.embedding ? parseEmbedding(row.embedding) : null,
    embeddingModel: row.embedding_model,
    weight: parseFloat(row.weight),
    createdAt: row.created_at,
  }))
}

/**
 * Add a custom interest
 */
export async function addCustomInterest(
  userId: string,
  interestText: string,
  embedding?: number[],
  embeddingModel?: string,
  weight: number = 1.0
): Promise<string> {
  const vectorStr = embedding ? `[${embedding.join(',')}]` : null

  const result = await queryOne<{ id: string }>(
    `INSERT INTO user_custom_interests (user_id, interest_text, embedding, embedding_model, weight)
     VALUES ($1, $2, $3::halfvec, $4, $5)
     RETURNING id`,
    [userId, interestText, vectorStr, embeddingModel || null, weight]
  )

  logger.info({ userId, interestText }, 'Added custom interest')
  return result!.id
}

/**
 * Remove a custom interest
 */
export async function removeCustomInterest(userId: string, interestId: string): Promise<void> {
  await query(
    `DELETE FROM user_custom_interests WHERE id = $1 AND user_id = $2`,
    [interestId, userId]
  )

  logger.info({ userId, interestId }, 'Removed custom interest')
}

/**
 * Update custom interest embedding (after generating it)
 */
export async function updateCustomInterestEmbedding(
  interestId: string,
  embedding: number[],
  embeddingModel: string
): Promise<void> {
  const vectorStr = `[${embedding.join(',')}]`

  await query(
    `UPDATE user_custom_interests 
     SET embedding = $2::halfvec, embedding_model = $3
     WHERE id = $1`,
    [interestId, vectorStr, embeddingModel]
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse embedding string from database
 */
function parseEmbedding(embeddingStr: string): number[] {
  // Remove brackets and split by comma
  const cleaned = embeddingStr.replace(/[[\]]/g, '')
  return cleaned.split(',').map((n) => parseFloat(n.trim()))
}

/**
 * Get the franchise boost multiplier for a given item
 */
export async function getFranchiseBoost(
  userId: string,
  franchiseName: string | null | undefined,
  mediaType: MediaType
): Promise<number> {
  if (!franchiseName) return 1.0

  const pref = await queryOne<{ preference_score: string }>(
    `SELECT preference_score FROM user_franchise_preferences 
     WHERE user_id = $1 AND franchise_name = $2 AND (media_type = $3 OR media_type = 'both')`,
    [userId, franchiseName, mediaType]
  )

  if (!pref) return 1.0

  const score = parseFloat(pref.preference_score)

  // Convert -1 to 1 score to boost multiplier
  // -1 = 0.5x (penalty), 0 = 1.0x (neutral), 1 = 1.5x (boost)
  return 1.0 + score * 0.5
}

/**
 * Get genre weight multiplier
 */
export async function getGenreBoost(userId: string, genres: string[]): Promise<number> {
  if (genres.length === 0) return 1.0

  const weights = await getUserGenreWeights(userId)
  const weightMap = new Map(weights.map((w) => [w.genre.toLowerCase(), w.weight]))
  return calculateGenreBoost(genres, weightMap)
}

function calculateGenreBoost(genres: string[], weightMap: Map<string, number>): number {
  let totalWeight = 0
  let count = 0

  for (const genre of genres) {
    const weight = weightMap.get(genre.toLowerCase())
    if (weight !== undefined) {
      totalWeight += weight
      count++
    }
  }

  if (count === 0) return 1.0

  // Average weight, then normalize around 1.0
  // 0 = 0.5x, 1 = 1.0x, 2 = 1.5x
  const avgWeight = totalWeight / count
  return 0.5 + avgWeight * 0.5
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

/**
 * Get custom interest boost for a candidate
 * 
 * Checks if the candidate's embedding is similar to any of the user's custom interests
 * (e.g., "I love time travel stories", "space opera adventures")
 * 
 * @param userId - The user ID
 * @param candidateEmbedding - The candidate's embedding vector
 * @returns Boost multiplier: 1.0 (no boost) to 1.3 (strong match)
 */
export async function getCustomInterestBoost(
  userId: string,
  candidateEmbedding: number[]
): Promise<number> {
  const interests = await getActiveEmbeddedInterests(await getUserCustomInterests(userId))
  return calculateCustomInterestBoost(candidateEmbedding, interests)
}

async function getActiveEmbeddedInterests(interests: CustomInterest[]): Promise<CustomInterest[]> {
  const embedded = interests.filter((interest) => interest.embedding?.length)
  if (embedded.length === 0) return []

  const { getActiveEmbeddingModelId } = await import('../lib/ai-provider.js')
  const modelId = await getActiveEmbeddingModelId()
  if (!modelId) return []

  // Older OpenAI interests stored only the model name, without a provider prefix.
  const legacyModelId = modelId.startsWith('openai:') ? modelId.slice('openai:'.length) : null
  return embedded.filter((interest) => interest.embeddingModel === modelId
    || (legacyModelId !== null && interest.embeddingModel === legacyModelId))
}

function calculateCustomInterestBoost(
  candidateEmbedding: number[],
  interests: CustomInterest[]
): number {
  
  // Filter to interests that have embeddings
  const interestsWithEmbeddings = interests.filter((i) => i.embedding && i.embedding.length > 0)
  if (interestsWithEmbeddings.length === 0) return 1.0
  
  // Find max similarity to any interest, weighted by user's interest weight
  let maxWeightedSimilarity = 0
  
  for (const interest of interestsWithEmbeddings) {
    if (!interest.embedding) continue
    
    const similarity = cosineSimilarity(candidateEmbedding, interest.embedding)
    const weightedSimilarity = similarity * interest.weight
    
    if (weightedSimilarity > maxWeightedSimilarity) {
      maxWeightedSimilarity = weightedSimilarity
    }
  }
  
  // Convert similarity to boost:
  // - 0.7+ similarity = 1.3x boost (strong match)
  // - 0.5-0.7 similarity = 1.15x boost (moderate match)
  // - 0.3-0.5 similarity = 1.05x boost (weak match)
  // - <0.3 similarity = 1.0x (no boost)
  if (maxWeightedSimilarity >= 0.7) return 1.3
  if (maxWeightedSimilarity >= 0.5) return 1.15
  if (maxWeightedSimilarity >= 0.3) return 1.05
  return 1.0
}

/** Load shared preferences once per scoring pass. Franchise lookups are cached per name. */
export async function loadPreferenceBoosts(userId: string, mediaType: MediaType) {
  const [weights, interests] = await Promise.all([
    getUserGenreWeights(userId),
    getUserCustomInterests(userId),
  ])
  const weightMap = new Map(weights.map((weight) => [weight.genre.toLowerCase(), weight.weight]))
  const embeddedInterests = await getActiveEmbeddedInterests(interests)
  const franchiseBoosts = new Map<string, Promise<number>>()

  return {
    hasCustomInterests: embeddedInterests.length > 0,
    getGenreBoost: (genres: string[]) => calculateGenreBoost(genres, weightMap),
    getCustomInterestBoost: (embedding: number[]) => calculateCustomInterestBoost(embedding, embeddedInterests),
    getFranchiseBoost(franchiseName: string | null): Promise<number> {
      if (!franchiseName) return Promise.resolve(1.0)
      let boost = franchiseBoosts.get(franchiseName)
      if (!boost) {
        boost = getFranchiseBoost(userId, franchiseName, mediaType)
        franchiseBoosts.set(franchiseName, boost)
      }
      return boost
    },
  }
}

/** Keep duplicate keys in input order while bounding each SQL batch. */
function preferenceBatches<T>(items: T[], key: (item: T) => string): T[][] {
  const batches: T[][] = []
  let batch: T[] = []
  const keys = new Set<string>()
  for (const item of items) {
    const itemKey = key(item)
    if (batch.length === 1000 || keys.has(itemKey)) {
      batches.push(batch)
      batch = []
      keys.clear()
    }
    batch.push(item)
    keys.add(itemKey)
  }
  if (batch.length > 0) batches.push(batch)
  return batches
}
