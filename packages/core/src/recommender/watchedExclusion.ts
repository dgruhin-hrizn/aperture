import { query } from '../lib/db.js'

export const IN_PROGRESS_EXCLUSION_THRESHOLD = 0.05

export function isExcludableWatchHistoryRow(
  played: boolean,
  playbackPositionTicks: number | null | undefined,
  runtimeTicks: number | null | undefined
): boolean {
  if (played) return true
  if (!playbackPositionTicks || !runtimeTicks || runtimeTicks <= 0) return false
  return playbackPositionTicks / runtimeTicks >= IN_PROGRESS_EXCLUSION_THRESHOLD
}

/** SQL fragment referencing watch_history columns as `wh` */
export const WATCH_HISTORY_EXCLUDABLE_SQL = `(
  wh.played = true
  OR (
    wh.playback_position_ticks IS NOT NULL
    AND wh.playback_position_ticks > 0
    AND wh.runtime_ticks IS NOT NULL
    AND wh.runtime_ticks > 0
    AND (wh.playback_position_ticks::numeric / wh.runtime_ticks::numeric) >= ${IN_PROGRESS_EXCLUSION_THRESHOLD}
  )
)`

/** SQL fragment for taste-profile input: fully played or favorited only */
export const WATCH_HISTORY_TASTE_SQL = `(wh.played = true OR wh.is_favorite = true)`

/**
 * All movie IDs that should be treated as watched for a user, including duplicate
 * library copies that share the same TMDb/IMDb ID as a watched title.
 */
export async function getExpandedWatchedMovieIds(userId: string): Promise<Set<string>> {
  const result = await query<{ id: string }>(
    `WITH watched AS MATERIALIZED (
       SELECT DISTINCT m.id, m.tmdb_id, m.imdb_id
       FROM watch_history wh
       JOIN movies m ON m.id = wh.movie_id
       WHERE wh.user_id = $1 AND wh.media_type = 'movie'
         AND ${WATCH_HISTORY_EXCLUDABLE_SQL}
     )
     SELECT id FROM watched
     UNION
     SELECT m.id FROM movies m
     JOIN (SELECT DISTINCT tmdb_id FROM watched WHERE tmdb_id IS NOT NULL) w
       ON w.tmdb_id = m.tmdb_id
     UNION
     SELECT m.id FROM movies m
     JOIN (SELECT DISTINCT imdb_id FROM watched WHERE imdb_id IS NOT NULL) w
       ON w.imdb_id = m.imdb_id`,
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
    `WITH watched AS MATERIALIZED (
       SELECT DISTINCT m.id, m.tmdb_id, m.imdb_id, m.tvdb_id
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN series m ON m.id = e.series_id
       WHERE wh.user_id = $1 AND wh.media_type = 'episode'
         AND ${WATCH_HISTORY_EXCLUDABLE_SQL}
     )
     SELECT id FROM watched
     UNION
     SELECT m.id FROM series m
     JOIN (SELECT DISTINCT tmdb_id FROM watched WHERE tmdb_id IS NOT NULL) w
       ON w.tmdb_id = m.tmdb_id
     UNION
     SELECT m.id FROM series m
     JOIN (SELECT DISTINCT imdb_id FROM watched WHERE imdb_id IS NOT NULL) w
       ON w.imdb_id = m.imdb_id
     UNION
     SELECT m.id FROM series m
     JOIN (SELECT DISTINCT tvdb_id FROM watched WHERE tvdb_id IS NOT NULL) w
       ON w.tvdb_id = m.tvdb_id`,
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
