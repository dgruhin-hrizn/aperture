import { query, transaction } from './db.js'
import { createChildLogger } from './logger.js'
import { VALID_EMBEDDING_DIMENSIONS } from './ai-provider.js'

const logger = createChildLogger('purge')

export interface PurgeResult {
  // Content
  moviesDeleted: number
  seriesDeleted: number
  episodesDeleted: number
  // AI Embeddings
  movieEmbeddingsDeleted: number
  seriesEmbeddingsDeleted: number
  episodeEmbeddingsDeleted: number
  // User Data
  watchHistoryDeleted: number
  userRatingsDeleted: number
  recommendationsDeleted: number
  userPreferencesCleared: number
  // Assistant
  assistantConversationsDeleted: number
  assistantMessagesDeleted: number
}

/**
 * Purge all content data from the database.
 * This includes: movies, series, episodes, all embeddings, watch history, 
 * ratings, recommendations, taste profiles, and assistant conversations.
 * Library configs and users are preserved.
 * 
 * Use this to reset the content database and start fresh.
 */
export async function purgeMovieDatabase(): Promise<PurgeResult> {
  logger.warn('🗑️ Starting full content database purge...')

  const result: PurgeResult = {
    moviesDeleted: 0,
    seriesDeleted: 0,
    episodesDeleted: 0,
    movieEmbeddingsDeleted: 0,
    seriesEmbeddingsDeleted: 0,
    episodeEmbeddingsDeleted: 0,
    watchHistoryDeleted: 0,
    userRatingsDeleted: 0,
    recommendationsDeleted: 0,
    userPreferencesCleared: 0,
    assistantConversationsDeleted: 0,
    assistantMessagesDeleted: 0,
  }

  await transaction(async (client) => {
    // 1. Delete assistant messages (FK to conversations)
    const messagesResult = await client.query('DELETE FROM assistant_messages')
    result.assistantMessagesDeleted = messagesResult.rowCount || 0
    logger.info(`Deleted ${result.assistantMessagesDeleted} assistant messages`)

    // 2. Delete assistant conversations
    const conversationsResult = await client.query('DELETE FROM assistant_conversations')
    result.assistantConversationsDeleted = conversationsResult.rowCount || 0
    logger.info(`Deleted ${result.assistantConversationsDeleted} assistant conversations`)

    // 3. Delete assistant suggestions
    await client.query('DELETE FROM assistant_suggestions')
    logger.info('Deleted assistant suggestions')

    // 4. Delete recommendation evidence (FK to candidates)
    const evidenceResult = await client.query('DELETE FROM recommendation_evidence')
    logger.info(`Deleted ${evidenceResult.rowCount} recommendation evidence rows`)

    // 5. Delete recommendation candidates (FK to runs)
    const candidatesResult = await client.query('DELETE FROM recommendation_candidates')
    result.recommendationsDeleted = candidatesResult.rowCount || 0
    logger.info(`Deleted ${result.recommendationsDeleted} recommendation candidates`)

    // 6. Delete recommendation runs
    const runsResult = await client.query('DELETE FROM recommendation_runs')
    logger.info(`Deleted ${runsResult.rowCount} recommendation runs`)

    // 7. Clear user preferences (taste profiles)
    const prefsResult = await client.query('DELETE FROM user_preferences')
    result.userPreferencesCleared = prefsResult.rowCount || 0
    logger.info(`Cleared ${result.userPreferencesCleared} user preference records`)

    // 8. Delete user ratings
    const ratingsResult = await client.query('DELETE FROM user_ratings')
    result.userRatingsDeleted = ratingsResult.rowCount || 0
    logger.info(`Deleted ${result.userRatingsDeleted} user ratings`)

    // 9. Delete watch history
    const watchResult = await client.query('DELETE FROM watch_history')
    result.watchHistoryDeleted = watchResult.rowCount || 0
    logger.info(`Deleted ${result.watchHistoryDeleted} watch history records`)

    // 10. Delete episode embeddings from all dimension-specific tables (FK to episodes)
    let episodeEmbeddingsDeleted = 0
    for (const dim of VALID_EMBEDDING_DIMENSIONS) {
      const res = await client.query(`DELETE FROM episode_embeddings_${dim}`)
      episodeEmbeddingsDeleted += res.rowCount || 0
    }
    // Also try legacy table if it exists
    try {
      const legacyRes = await client.query('DELETE FROM episode_embeddings_legacy')
      episodeEmbeddingsDeleted += legacyRes.rowCount || 0
    } catch { /* table may not exist */ }
    result.episodeEmbeddingsDeleted = episodeEmbeddingsDeleted
    logger.info(`Deleted ${result.episodeEmbeddingsDeleted} episode embeddings`)

    // 11. Delete series embeddings from all dimension-specific tables (FK to series)
    let seriesEmbeddingsDeleted = 0
    for (const dim of VALID_EMBEDDING_DIMENSIONS) {
      const res = await client.query(`DELETE FROM series_embeddings_${dim}`)
      seriesEmbeddingsDeleted += res.rowCount || 0
    }
    // Also try legacy table if it exists
    try {
      const legacyRes = await client.query('DELETE FROM series_embeddings_legacy')
      seriesEmbeddingsDeleted += legacyRes.rowCount || 0
    } catch { /* table may not exist */ }
    result.seriesEmbeddingsDeleted = seriesEmbeddingsDeleted
    logger.info(`Deleted ${result.seriesEmbeddingsDeleted} series embeddings`)

    // 12. Delete movie embeddings from all dimension-specific tables (FK to movies)
    let movieEmbeddingsDeleted = 0
    for (const dim of VALID_EMBEDDING_DIMENSIONS) {
      const res = await client.query(`DELETE FROM embeddings_${dim}`)
      movieEmbeddingsDeleted += res.rowCount || 0
    }
    // Also try legacy table if it exists
    try {
      const legacyRes = await client.query('DELETE FROM embeddings_legacy')
      movieEmbeddingsDeleted += legacyRes.rowCount || 0
    } catch { /* table may not exist */ }
    result.movieEmbeddingsDeleted = movieEmbeddingsDeleted
    logger.info(`Deleted ${result.movieEmbeddingsDeleted} movie embeddings`)

    // 13. Delete episodes (FK to series)
    const episodesResult = await client.query('DELETE FROM episodes')
    result.episodesDeleted = episodesResult.rowCount || 0
    logger.info(`Deleted ${result.episodesDeleted} episodes`)

    // 14. Delete series
    const seriesResult = await client.query('DELETE FROM series')
    result.seriesDeleted = seriesResult.rowCount || 0
    logger.info(`Deleted ${result.seriesDeleted} series`)

    // 15. Delete movies
    const moviesResult = await client.query('DELETE FROM movies')
    result.moviesDeleted = moviesResult.rowCount || 0
    logger.info(`Deleted ${result.moviesDeleted} movies`)
  })

  logger.warn({ ...result }, '✅ Content database purge complete')

  return result
}

export interface DatabaseStats {
  // Content
  movies: number
  series: number
  episodes: number
  // AI Embeddings
  movieEmbeddings: number
  seriesEmbeddings: number
  episodeEmbeddings: number
  // User Data
  watchHistory: number
  userRatings: number
  recommendations: number
  userPreferences: number
  // Assistant
  assistantConversations: number
  assistantMessages: number
}

/**
 * Count embeddings across all dimension-specific tables
 */
async function countAllEmbeddings(baseTable: 'embeddings' | 'series_embeddings' | 'episode_embeddings'): Promise<number> {
  let total = 0
  for (const dim of VALID_EMBEDDING_DIMENSIONS) {
    try {
      const result = await query<{ count: string }>(`SELECT COUNT(*) FROM ${baseTable}_${dim}`)
      total += parseInt(result.rows[0]?.count || '0', 10)
    } catch { /* table may not exist */ }
  }
  // Also check legacy table
  try {
    const result = await query<{ count: string }>(`SELECT COUNT(*) FROM ${baseTable}_legacy`)
    total += parseInt(result.rows[0]?.count || '0', 10)
  } catch { /* table may not exist */ }
  return total
}

/**
 * Get current database stats for display before purge
 */
export async function getMovieDatabaseStats(): Promise<DatabaseStats> {
  const [
    movies,
    series,
    episodes,
    movieEmbeddings,
    seriesEmbeddings,
    episodeEmbeddings,
    watchHistory,
    userRatings,
    recommendations,
    userPreferences,
    assistantConversations,
    assistantMessages,
  ] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) FROM movies'),
    query<{ count: string }>('SELECT COUNT(*) FROM series'),
    query<{ count: string }>('SELECT COUNT(*) FROM episodes'),
    countAllEmbeddings('embeddings'),
    countAllEmbeddings('series_embeddings'),
    countAllEmbeddings('episode_embeddings'),
    query<{ count: string }>('SELECT COUNT(*) FROM watch_history'),
    query<{ count: string }>('SELECT COUNT(*) FROM user_ratings'),
    query<{ count: string }>('SELECT COUNT(*) FROM recommendation_candidates'),
    query<{ count: string }>('SELECT COUNT(*) FROM user_preferences'),
    query<{ count: string }>('SELECT COUNT(*) FROM assistant_conversations'),
    query<{ count: string }>('SELECT COUNT(*) FROM assistant_messages'),
  ])

  return {
    movies: parseInt(movies.rows[0]?.count || '0', 10),
    series: parseInt(series.rows[0]?.count || '0', 10),
    episodes: parseInt(episodes.rows[0]?.count || '0', 10),
    movieEmbeddings, // Already a number from countAllEmbeddings
    seriesEmbeddings, // Already a number from countAllEmbeddings
    episodeEmbeddings, // Already a number from countAllEmbeddings
    watchHistory: parseInt(watchHistory.rows[0]?.count || '0', 10),
    userRatings: parseInt(userRatings.rows[0]?.count || '0', 10),
    recommendations: parseInt(recommendations.rows[0]?.count || '0', 10),
    userPreferences: parseInt(userPreferences.rows[0]?.count || '0', 10),
    assistantConversations: parseInt(assistantConversations.rows[0]?.count || '0', 10),
    assistantMessages: parseInt(assistantMessages.rows[0]?.count || '0', 10),
  }
}

