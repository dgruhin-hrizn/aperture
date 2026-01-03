/**
 * Top Picks Popularity Calculation
 * 
 * Calculates weighted popularity scores for movies and series
 * based on aggregated watch history from all users.
 */

import { query } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { getTopPicksConfig, type TopPicksConfig } from './config.js'

const logger = createChildLogger('top-picks-popularity')

export interface PopularMovie {
  movieId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  path: string | null
  uniqueViewers: number
  playCount: number
  completionRate: number
  popularityScore: number
  rank: number
}

export interface PopularSeries {
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  network: string | null
  uniqueViewers: number
  totalEpisodesWatched: number
  avgCompletionRate: number
  popularityScore: number
  rank: number
}

/**
 * Get top N most popular movies based on weighted scoring
 */
export async function getTopMovies(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularMovie[]> {
  const config = await getTopPicksConfig()
  const timeWindowDays = configOverrides?.timeWindowDays ?? config.timeWindowDays
  const count = configOverrides?.moviesCount ?? config.moviesCount
  const uniqueViewersWeight = configOverrides?.uniqueViewersWeight ?? config.uniqueViewersWeight
  const playCountWeight = configOverrides?.playCountWeight ?? config.playCountWeight
  const completionWeight = configOverrides?.completionWeight ?? config.completionWeight
  const minUniqueViewers = configOverrides?.minUniqueViewers ?? config.minUniqueViewers

  logger.info({
    timeWindowDays,
    count,
    weights: { uniqueViewersWeight, playCountWeight, completionWeight },
    minUniqueViewers,
  }, 'Calculating top movies')

  const result = await query<{
    movie_id: string
    title: string
    year: number | null
    poster_url: string | null
    backdrop_url: string | null
    overview: string | null
    genres: string[]
    community_rating: string | null
    path: string | null
    unique_viewers: string
    play_count: string
    completion_rate: string | null
    popularity_score: string
  }>(`
    WITH movie_stats AS (
      SELECT 
        wh.movie_id,
        COUNT(DISTINCT wh.user_id) as unique_viewers,
        COUNT(*) as play_count,
        -- For movies, consider played = completed (no progress tracking for movies)
        1.0 as completion_rate
      FROM watch_history wh
      WHERE wh.movie_id IS NOT NULL
        AND wh.last_played_at >= NOW() - INTERVAL '${timeWindowDays} days'
      GROUP BY wh.movie_id
      HAVING COUNT(DISTINCT wh.user_id) >= $1
    )
    SELECT 
      m.id as movie_id,
      m.title,
      m.year,
      m.poster_url,
      m.backdrop_url,
      m.overview,
      m.genres,
      m.community_rating,
      m.path,
      ms.unique_viewers,
      ms.play_count,
      ms.completion_rate,
      (
        (ms.unique_viewers::numeric * $2::numeric) + 
        (ms.play_count::numeric * $3::numeric) + 
        (ms.completion_rate * 100.0 * $4::numeric)
      ) as popularity_score
    FROM movie_stats ms
    JOIN movies m ON m.id = ms.movie_id
    ORDER BY popularity_score DESC
    LIMIT $5
  `, [minUniqueViewers, uniqueViewersWeight, playCountWeight, completionWeight, count])

  logger.info({ count: result.rows.length }, 'Top movies calculated')

  return result.rows.map((row, index) => ({
    movieId: row.movie_id,
    title: row.title,
    year: row.year,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    overview: row.overview,
    genres: row.genres || [],
    communityRating: row.community_rating ? parseFloat(row.community_rating) : null,
    path: row.path,
    uniqueViewers: parseInt(row.unique_viewers),
    playCount: parseInt(row.play_count),
    completionRate: row.completion_rate ? parseFloat(row.completion_rate) : 1.0,
    popularityScore: parseFloat(row.popularity_score),
    rank: index + 1,
  }))
}

/**
 * Get top N most popular series based on weighted scoring
 */
export async function getTopSeries(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularSeries[]> {
  const config = await getTopPicksConfig()
  const timeWindowDays = configOverrides?.timeWindowDays ?? config.timeWindowDays
  const count = configOverrides?.seriesCount ?? config.seriesCount
  const uniqueViewersWeight = configOverrides?.uniqueViewersWeight ?? config.uniqueViewersWeight
  const playCountWeight = configOverrides?.playCountWeight ?? config.playCountWeight
  const completionWeight = configOverrides?.completionWeight ?? config.completionWeight
  const minUniqueViewers = configOverrides?.minUniqueViewers ?? config.minUniqueViewers

  logger.info({
    timeWindowDays,
    count,
    weights: { uniqueViewersWeight, playCountWeight, completionWeight },
    minUniqueViewers,
  }, 'Calculating top series')

  const result = await query<{
    series_id: string
    title: string
    year: number | null
    poster_url: string | null
    backdrop_url: string | null
    overview: string | null
    genres: string[]
    community_rating: string | null
    network: string | null
    unique_viewers: string
    total_episodes_watched: string
    avg_completion_rate: string | null
    popularity_score: string
  }>(`
    WITH series_stats AS (
      SELECT 
        e.series_id,
        COUNT(DISTINCT wh.user_id) as unique_viewers,
        COUNT(DISTINCT wh.episode_id) as total_episodes_watched,
        -- Calculate completion rate per user-series pair, then average
        AVG(
          CASE 
            WHEN s.total_episodes > 0 THEN 
              LEAST(1.0, user_watched.episodes_watched::numeric / s.total_episodes)
            ELSE 0.5
          END
        ) as avg_completion_rate
      FROM watch_history wh
      JOIN episodes e ON e.id = wh.episode_id
      JOIN series s ON s.id = e.series_id
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT wh2.episode_id) as episodes_watched
        FROM watch_history wh2
        JOIN episodes e2 ON e2.id = wh2.episode_id
        WHERE wh2.user_id = wh.user_id AND e2.series_id = e.series_id
      ) user_watched ON true
      WHERE wh.episode_id IS NOT NULL
        AND wh.media_type = 'episode'
        AND wh.last_played_at >= NOW() - INTERVAL '${timeWindowDays} days'
      GROUP BY e.series_id
      HAVING COUNT(DISTINCT wh.user_id) >= $1
    )
    SELECT 
      s.id as series_id,
      s.title,
      s.year,
      s.poster_url,
      s.backdrop_url,
      s.overview,
      s.genres,
      s.community_rating,
      s.network,
      ss.unique_viewers,
      ss.total_episodes_watched,
      ss.avg_completion_rate,
      (
        (ss.unique_viewers::numeric * $2::numeric) + 
        (ss.total_episodes_watched::numeric * $3::numeric / 10.0) +  -- Scale down episode count
        (COALESCE(ss.avg_completion_rate, 0.5) * 100.0 * $4::numeric)
      ) as popularity_score
    FROM series_stats ss
    JOIN series s ON s.id = ss.series_id
    ORDER BY popularity_score DESC
    LIMIT $5
  `, [minUniqueViewers, uniqueViewersWeight, playCountWeight, completionWeight, count])

  logger.info({ count: result.rows.length }, 'Top series calculated')

  return result.rows.map((row, index) => ({
    seriesId: row.series_id,
    title: row.title,
    year: row.year,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    overview: row.overview,
    genres: row.genres || [],
    communityRating: row.community_rating ? parseFloat(row.community_rating) : null,
    network: row.network,
    uniqueViewers: parseInt(row.unique_viewers),
    totalEpisodesWatched: parseInt(row.total_episodes_watched),
    avgCompletionRate: row.avg_completion_rate ? parseFloat(row.avg_completion_rate) : 0.5,
    popularityScore: parseFloat(row.popularity_score),
    rank: index + 1,
  }))
}

/**
 * Get both top movies and series for Top Picks refresh
 */
export async function getTopPicks(
  configOverrides?: Partial<TopPicksConfig>
): Promise<{ movies: PopularMovie[]; series: PopularSeries[] }> {
  const [movies, series] = await Promise.all([
    getTopMovies(configOverrides),
    getTopSeries(configOverrides),
  ])

  return { movies, series }
}

