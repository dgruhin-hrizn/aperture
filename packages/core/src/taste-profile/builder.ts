/**
 * Taste Profile Builder
 *
 * Builds user taste profiles from watch history with engagement weighting.
 * The algorithm considers:
 * - Episode/movie count (logarithmic scaling)
 * - Completion rate (finished series = strong signal)
 * - Favorites (explicit positive signal)
 * - User ratings
 * - Recency (more recent = higher weight)
 */

import { query } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { getActiveEmbeddingModelId, getActiveEmbeddingTableName } from '../lib/ai-provider.js'
import type { MediaType, WatchedItem } from './types.js'

const logger = createChildLogger('taste-profile-builder')

// ============================================================================
// Main Build Function
// ============================================================================

/**
 * Build a taste profile embedding from watch history
 */
export async function buildTasteProfile(
  userId: string,
  mediaType: MediaType
): Promise<number[] | null> {
  logger.info({ userId, mediaType }, 'Building taste profile')

  // Get watch history with engagement data
  const watchedItems =
    mediaType === 'movie'
      ? await getMovieWatchHistory(userId)
      : await getSeriesWatchHistory(userId)

  if (watchedItems.length === 0) {
    logger.warn({ userId, mediaType }, 'No watch history found, cannot build profile')
    return null
  }

  logger.info(
    { userId, mediaType, itemCount: watchedItems.length },
    `Found ${watchedItems.length} watched items for profile`
  )

  // Calculate engagement weights
  const weightedItems = watchedItems.map((item) => ({
    ...item,
    weight: calculateEngagementWeight(item, mediaType),
  }))

  // Sort by weight to prioritize most engaging content
  weightedItems.sort((a, b) => b.weight - a.weight)

  // Log top weighted items for debugging
  const top5 = weightedItems.slice(0, 5)
  logger.debug(
    { userId, mediaType, topItems: top5.map((i) => ({ title: i.title, weight: i.weight.toFixed(3) })) },
    'Top 5 weighted items for profile'
  )

  // Get embeddings for watched items
  const embeddings = await getItemEmbeddings(
    weightedItems.map((i) => i.id),
    mediaType
  )

  if (embeddings.size === 0) {
    logger.warn({ userId, mediaType }, 'No embeddings found for watched items')
    return null
  }

  // Build weighted average embedding
  const profile = buildWeightedAverageEmbedding(weightedItems, embeddings)

  if (!profile) {
    logger.warn({ userId, mediaType }, 'Failed to build profile embedding')
    return null
  }

  logger.info(
    { userId, mediaType, embeddingDim: profile.length },
    'Successfully built taste profile'
  )

  return profile
}

// ============================================================================
// Engagement Weight Calculation
// ============================================================================

/**
 * Calculate engagement weight for a watched item
 *
 * Factors:
 * - Episode/movie count (log scale to prevent runaway)
 * - Completion rate (finished = strong signal)
 * - Favorites (explicit positive signal)
 * - User rating (if available)
 * - Recency (half-life decay)
 */
export function calculateEngagementWeight(item: WatchedItem, mediaType: MediaType): number {
  let weight = 1.0

  if (mediaType === 'series') {
    // Episode count weight (logarithmic to prevent runaway)
    // 10 episodes = 2.0, 100 episodes = 3.0, 1000 episodes = 4.0
    const episodeCount = item.episodeCount || 1
    weight *= 1 + Math.log10(Math.max(episodeCount, 1))

    // Completion bonus (finished series = very strong signal)
    if (item.completionRate !== undefined && item.completionRate > 0.9) {
      weight *= 1.5
    } else if (item.completionRate !== undefined && item.completionRate > 0.5) {
      weight *= 1.2
    }
  } else {
    // Movie: play count matters
    const playCount = item.playCount || 1
    weight *= 1 + Math.log10(Math.max(playCount, 1)) * 0.5
  }

  // Favorites bonus (explicit positive signal)
  if (item.hasFavorites) {
    weight *= 1.5
  }

  // User rating bonus (if they bothered to rate it, it matters to them)
  if (item.rating !== undefined) {
    // Ratings typically 1-10 or 1-5
    // High rating = boost, low rating = penalty
    const normalizedRating = item.rating > 5 ? item.rating / 10 : item.rating / 5
    // 0.5 rating = 0.75x, 1.0 rating = 1.25x
    weight *= 0.5 + normalizedRating * 0.75
  }

  // Recency factor (half-life of 180 days)
  // Items watched recently get higher weight
  if (item.lastPlayedAt) {
    const daysSince = (Date.now() - item.lastPlayedAt.getTime()) / (1000 * 60 * 60 * 24)
    // Half-life decay: weight halves every 180 days
    // But don't let it go below 0.25 (old items still matter somewhat)
    const recencyFactor = Math.max(0.25, Math.pow(0.5, daysSince / 180))
    weight *= recencyFactor
  }

  return weight
}

// ============================================================================
// Watch History Retrieval
// ============================================================================

/**
 * Get movie watch history with engagement data
 * Excludes movies from user-excluded libraries
 */
async function getMovieWatchHistory(userId: string): Promise<WatchedItem[]> {
  // Get user's excluded library IDs
  const { getUserExcludedLibraries } = await import('../lib/libraryExclusions.js')
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  
  // Build the exclusion clause
  const libraryExclusionClause = excludedLibraryIds.length > 0
    ? `AND (m.provider_library_id IS NULL OR m.provider_library_id NOT IN (${excludedLibraryIds.map((_, i) => `$${i + 2}`).join(', ')}))`
    : ''
  
  const result = await query<{
    id: string
    title: string
    play_count: number
    is_favorite: boolean
    last_played_at: Date | null
    user_rating: number | null
    genres: string[]
    collection_name: string | null
  }>(
    `SELECT 
       m.id,
       m.title,
       COALESCE(wh.play_count, 1) as play_count,
       COALESCE(wh.is_favorite, false) as is_favorite,
       wh.last_played_at,
       ur.rating as user_rating,
       m.genres,
       m.collection_name
     FROM watch_history wh
     JOIN movies m ON m.id = wh.movie_id
     LEFT JOIN user_ratings ur ON ur.movie_id = m.id AND ur.user_id = wh.user_id
     WHERE wh.user_id = $1 AND wh.media_type = 'movie'
     ${libraryExclusionClause}
     ORDER BY wh.last_played_at DESC NULLS LAST`,
    [userId, ...excludedLibraryIds]
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    playCount: row.play_count,
    hasFavorites: row.is_favorite,
    lastPlayedAt: row.last_played_at,
    rating: row.user_rating ?? undefined,
    genres: row.genres || [],
    collectionName: row.collection_name ?? undefined,
  }))
}

/**
 * Get series watch history with engagement data
 * Excludes series from user-excluded libraries
 */
async function getSeriesWatchHistory(userId: string): Promise<WatchedItem[]> {
  // Get user's excluded library IDs
  const { getUserExcludedLibraries } = await import('../lib/libraryExclusions.js')
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  
  // Build the HAVING clause for library exclusion (since we're using GROUP BY)
  const libraryExclusionClause = excludedLibraryIds.length > 0
    ? `HAVING (MAX(s.provider_library_id) IS NULL OR MAX(s.provider_library_id) NOT IN (${excludedLibraryIds.map((_, i) => `$${i + 2}`).join(', ')}))`
    : ''
  
  const result = await query<{
    id: string
    title: string
    episodes_watched: number
    total_episodes: number | null
    has_favorites: boolean
    last_played_at: Date | null
    user_rating: number | null
    genres: string[]
  }>(
    `SELECT 
       s.id,
       s.title,
       COUNT(DISTINCT wh.episode_id) as episodes_watched,
       s.total_episodes,
       BOOL_OR(wh.is_favorite) as has_favorites,
       MAX(wh.last_played_at) as last_played_at,
       MAX(ur.rating) as user_rating,
       s.genres
     FROM watch_history wh
     JOIN episodes e ON e.id = wh.episode_id
     JOIN series s ON s.id = e.series_id
     LEFT JOIN user_ratings ur ON ur.series_id = s.id AND ur.user_id = wh.user_id
     WHERE wh.user_id = $1 AND wh.media_type = 'episode'
     GROUP BY s.id, s.title, s.total_episodes, s.genres
     ${libraryExclusionClause}
     ORDER BY MAX(wh.last_played_at) DESC NULLS LAST`,
    [userId, ...excludedLibraryIds]
  )

  return result.rows.map((row) => {
    const episodesWatched = parseInt(String(row.episodes_watched), 10)
    const totalEpisodes = row.total_episodes || undefined

    return {
      id: row.id,
      title: row.title,
      episodeCount: episodesWatched,
      totalEpisodes,
      completionRate: totalEpisodes ? episodesWatched / totalEpisodes : undefined,
      playCount: episodesWatched,
      hasFavorites: row.has_favorites,
      lastPlayedAt: row.last_played_at,
      rating: row.user_rating ?? undefined,
      genres: row.genres || [],
    }
  })
}

// ============================================================================
// Embedding Retrieval and Averaging
// ============================================================================

/**
 * Get embeddings for a list of items
 */
async function getItemEmbeddings(
  itemIds: string[],
  mediaType: MediaType
): Promise<Map<string, number[]>> {
  if (itemIds.length === 0) return new Map()

  const modelId = await getActiveEmbeddingModelId()
  if (!modelId) {
    logger.warn('No embedding model configured')
    return new Map()
  }

  const tableName =
    mediaType === 'movie'
      ? await getActiveEmbeddingTableName('embeddings')
      : await getActiveEmbeddingTableName('series_embeddings')

  const idColumn = mediaType === 'movie' ? 'movie_id' : 'series_id'

  const result = await query<{ item_id: string; embedding: string }>(
    `SELECT ${idColumn} as item_id, embedding::text as embedding
     FROM ${tableName}
     WHERE ${idColumn} = ANY($1) AND model = $2`,
    [itemIds, modelId]
  )

  const embeddings = new Map<string, number[]>()
  for (const row of result.rows) {
    embeddings.set(row.item_id, parseEmbedding(row.embedding))
  }

  return embeddings
}

/**
 * Build weighted average embedding from items and their weights
 */
function buildWeightedAverageEmbedding(
  items: Array<{ id: string; weight: number }>,
  embeddings: Map<string, number[]>
): number[] | null {
  // Get dimension from first embedding
  const firstEmbedding = embeddings.values().next().value
  if (!firstEmbedding) return null

  const dimension = firstEmbedding.length
  const result = new Array(dimension).fill(0)
  let totalWeight = 0

  for (const item of items) {
    const embedding = embeddings.get(item.id)
    if (!embedding) continue

    for (let i = 0; i < dimension; i++) {
      result[i] += embedding[i] * item.weight
    }
    totalWeight += item.weight
  }

  if (totalWeight === 0) return null

  // Normalize
  for (let i = 0; i < dimension; i++) {
    result[i] /= totalWeight
  }

  // L2 normalize for cosine similarity
  const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0))
  if (norm > 0) {
    for (let i = 0; i < dimension; i++) {
      result[i] /= norm
    }
  }

  return result
}

/**
 * Parse embedding string from database
 */
function parseEmbedding(embeddingStr: string): number[] {
  const cleaned = embeddingStr.replace(/[\[\]]/g, '')
  return cleaned.split(',').map((n) => parseFloat(n.trim()))
}

