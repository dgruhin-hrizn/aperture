import { query, transaction } from './db.js'
import { createChildLogger } from './logger.js'

const logger = createChildLogger('purge')

export interface PurgeResult {
  moviesDeleted: number
  embeddingsDeleted: number
  watchHistoryDeleted: number
  recommendationsDeleted: number
  userPreferencesCleared: number
}

/**
 * Purge all movie-related data from the database.
 * This includes: movies, embeddings, watch history, recommendations, and taste profiles.
 * Library configs and users are preserved.
 * 
 * Use this to reset the movie database and start fresh.
 */
export async function purgeMovieDatabase(): Promise<PurgeResult> {
  logger.warn('🗑️ Starting full movie database purge...')

  const result: PurgeResult = {
    moviesDeleted: 0,
    embeddingsDeleted: 0,
    watchHistoryDeleted: 0,
    recommendationsDeleted: 0,
    userPreferencesCleared: 0,
  }

  await transaction(async (client) => {
    // 1. Delete recommendation evidence (FK to candidates)
    const evidenceResult = await client.query('DELETE FROM recommendation_evidence')
    logger.info(`Deleted ${evidenceResult.rowCount} recommendation evidence rows`)

    // 2. Delete recommendation candidates (FK to runs)
    const candidatesResult = await client.query('DELETE FROM recommendation_candidates')
    logger.info(`Deleted ${candidatesResult.rowCount} recommendation candidates`)
    result.recommendationsDeleted += candidatesResult.rowCount || 0

    // 3. Delete recommendation runs
    const runsResult = await client.query('DELETE FROM recommendation_runs')
    logger.info(`Deleted ${runsResult.rowCount} recommendation runs`)

    // 4. Clear user preferences (taste profiles)
    const prefsResult = await client.query('DELETE FROM user_preferences')
    result.userPreferencesCleared = prefsResult.rowCount || 0
    logger.info(`Cleared ${result.userPreferencesCleared} user preference records`)

    // 5. Delete watch history
    const watchResult = await client.query('DELETE FROM watch_history')
    result.watchHistoryDeleted = watchResult.rowCount || 0
    logger.info(`Deleted ${result.watchHistoryDeleted} watch history records`)

    // 6. Delete embeddings (FK to movies)
    const embeddingsResult = await client.query('DELETE FROM embeddings')
    result.embeddingsDeleted = embeddingsResult.rowCount || 0
    logger.info(`Deleted ${result.embeddingsDeleted} embeddings`)

    // 7. Delete movies
    const moviesResult = await client.query('DELETE FROM movies')
    result.moviesDeleted = moviesResult.rowCount || 0
    logger.info(`Deleted ${result.moviesDeleted} movies`)
  })

  logger.warn({ ...result }, '✅ Movie database purge complete')

  return result
}

/**
 * Get current database stats for display before purge
 */
export async function getMovieDatabaseStats(): Promise<{
  movies: number
  series: number
  episodes: number
  embeddings: number
  watchHistory: number
  recommendations: number
  userPreferences: number
}> {
  const [movies, series, episodes, embeddings, watchHistory, recommendations, userPreferences] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) FROM movies'),
    query<{ count: string }>('SELECT COUNT(*) FROM series'),
    query<{ count: string }>('SELECT COUNT(*) FROM episodes'),
    query<{ count: string }>('SELECT COUNT(*) FROM embeddings'),
    query<{ count: string }>('SELECT COUNT(*) FROM watch_history'),
    query<{ count: string }>('SELECT COUNT(*) FROM recommendation_candidates'),
    query<{ count: string }>('SELECT COUNT(*) FROM user_preferences'),
  ])

  return {
    movies: parseInt(movies.rows[0]?.count || '0', 10),
    series: parseInt(series.rows[0]?.count || '0', 10),
    episodes: parseInt(episodes.rows[0]?.count || '0', 10),
    embeddings: parseInt(embeddings.rows[0]?.count || '0', 10),
    watchHistory: parseInt(watchHistory.rows[0]?.count || '0', 10),
    recommendations: parseInt(recommendations.rows[0]?.count || '0', 10),
    userPreferences: parseInt(userPreferences.rows[0]?.count || '0', 10),
  }
}

