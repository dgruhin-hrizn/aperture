import { query } from '../lib/db.js'

/**
 * All movie IDs that should be treated as watched for a user, including duplicate
 * library copies that share the same TMDb/IMDb ID as a watched title.
 */
export async function getExpandedWatchedMovieIds(userId: string): Promise<Set<string>> {
  const result = await query<{ id: string }>(
    `SELECT DISTINCT m.id
     FROM movies m
     WHERE m.id IN (
       SELECT wh.movie_id FROM watch_history wh
       WHERE wh.user_id = $1 AND wh.media_type = 'movie'
     )
     OR m.tmdb_id IN (
       SELECT DISTINCT m2.tmdb_id FROM watch_history wh
       JOIN movies m2 ON m2.id = wh.movie_id
       WHERE wh.user_id = $1 AND wh.media_type = 'movie' AND m2.tmdb_id IS NOT NULL
     )
     OR m.imdb_id IN (
       SELECT DISTINCT m2.imdb_id FROM watch_history wh
       JOIN movies m2 ON m2.id = wh.movie_id
       WHERE wh.user_id = $1 AND wh.media_type = 'movie' AND m2.imdb_id IS NOT NULL
     )`,
    [userId]
  )
  return new Set(result.rows.map((r) => r.id))
}

/**
 * All series IDs that should be treated as watched for a user, including duplicate
 * library copies that share the same TMDb/IMDb/TVDB ID as a watched show.
 */
export async function getExpandedWatchedSeriesIds(userId: string): Promise<Set<string>> {
  const result = await query<{ id: string }>(
    `SELECT DISTINCT s.id
     FROM series s
     WHERE s.id IN (
       SELECT DISTINCT e.series_id
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       WHERE wh.user_id = $1 AND wh.media_type = 'episode'
     )
     OR s.tmdb_id IN (
       SELECT DISTINCT s2.tmdb_id
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN series s2 ON s2.id = e.series_id
       WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s2.tmdb_id IS NOT NULL
     )
     OR s.imdb_id IN (
       SELECT DISTINCT s2.imdb_id
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN series s2 ON s2.id = e.series_id
       WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s2.imdb_id IS NOT NULL
     )
     OR s.tvdb_id IN (
       SELECT DISTINCT s2.tvdb_id
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN series s2 ON s2.id = e.series_id
       WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s2.tvdb_id IS NOT NULL
     )`,
    [userId]
  )
  return new Set(result.rows.map((r) => r.id))
}

export async function getUserIncludeWatched(userId: string): Promise<boolean> {
  const result = await query<{ include_watched: boolean }>(
    `SELECT COALESCE(include_watched, false) AS include_watched
     FROM user_preferences
     WHERE user_id = $1`,
    [userId]
  )
  return result.rows[0]?.include_watched ?? false
}

export function filterByWatchedIds<T extends { id: string }>(
  items: T[],
  watchedIds: Set<string>
): T[] {
  return items.filter((item) => !watchedIds.has(item.id))
}
