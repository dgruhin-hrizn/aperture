/**
 * Top Picks Popularity Calculation
 *
 * Calculates weighted popularity scores for movies and series
 * based on aggregated watch history from all users, or from
 * MDBList curated lists, or a hybrid of both sources.
 */

import { query } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { getTopPicksConfig, type TopPicksConfig } from './config.js'
import { getListItems, isMDBListConfigured, type MDBListItem } from '../mdblist/index.js'

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
 * Get top N most popular movies based on configured popularity source
 *
 * Routes to local, MDBList, or hybrid calculation based on config
 */
export async function getTopMovies(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularMovie[]> {
  const config = await getTopPicksConfig()
  const source = configOverrides?.moviesPopularitySource ?? config.moviesPopularitySource
  const useAllMatches = configOverrides?.moviesUseAllMatches ?? config.moviesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.moviesCount ?? config.moviesCount)

  logger.info({ source, count, useAllMatches }, 'Getting top movies')

  switch (source) {
    case 'mdblist': {
      const listId = configOverrides?.mdblistMoviesListId ?? config.mdblistMoviesListId
      if (!listId) {
        logger.warn('MDBList source selected but no movie list configured, falling back to local')
        return getTopMoviesLocalPublic(configOverrides)
      }
      return getTopMoviesFromMDBList(listId, count)
    }
    case 'hybrid':
      return getTopMoviesHybrid(configOverrides)
    case 'local':
    default:
      return getTopMoviesLocalPublic(configOverrides)
  }
}

/**
 * Get top N most popular movies from local watch history (public API)
 */
async function getTopMoviesLocalPublic(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularMovie[]> {
  const config = await getTopPicksConfig()
  const timeWindowDays = configOverrides?.moviesTimeWindowDays ?? config.moviesTimeWindowDays
  const useAllMatches = configOverrides?.moviesUseAllMatches ?? config.moviesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.moviesCount ?? config.moviesCount)
  const minUniqueViewers = configOverrides?.moviesMinUniqueViewers ?? config.moviesMinUniqueViewers

  // Normalize weights so they sum to 1.0 (allows any slider values to work)
  const rawViewers = configOverrides?.uniqueViewersWeight ?? config.uniqueViewersWeight
  const rawPlayCount = configOverrides?.playCountWeight ?? config.playCountWeight
  const rawCompletion = configOverrides?.completionWeight ?? config.completionWeight
  const totalWeight = rawViewers + rawPlayCount + rawCompletion
  const uniqueViewersWeight = totalWeight > 0 ? rawViewers / totalWeight : 0.33
  const playCountWeight = totalWeight > 0 ? rawPlayCount / totalWeight : 0.33
  const completionWeight = totalWeight > 0 ? rawCompletion / totalWeight : 0.34

  logger.info(
    {
      timeWindowDays,
      count,
      useAllMatches,
      weights: { uniqueViewersWeight, playCountWeight, completionWeight },
      minUniqueViewers,
    },
    'Calculating top movies from local watch history'
  )

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
  }>(
    `
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
  `,
    [minUniqueViewers, uniqueViewersWeight, playCountWeight, completionWeight, count]
  )

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
 * Get top N most popular series based on configured popularity source
 *
 * Routes to local, MDBList, or hybrid calculation based on config
 */
export async function getTopSeries(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularSeries[]> {
  const config = await getTopPicksConfig()
  const source = configOverrides?.seriesPopularitySource ?? config.seriesPopularitySource
  const useAllMatches = configOverrides?.seriesUseAllMatches ?? config.seriesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.seriesCount ?? config.seriesCount)

  logger.info({ source, count, useAllMatches }, 'Getting top series')

  switch (source) {
    case 'mdblist': {
      const listId = configOverrides?.mdblistSeriesListId ?? config.mdblistSeriesListId
      if (!listId) {
        logger.warn('MDBList source selected but no series list configured, falling back to local')
        return getTopSeriesLocalPublic(configOverrides)
      }
      return getTopSeriesFromMDBList(listId, count)
    }
    case 'hybrid':
      return getTopSeriesHybrid(configOverrides)
    case 'local':
    default:
      return getTopSeriesLocalPublic(configOverrides)
  }
}

/**
 * Get top N most popular series from local watch history (public API)
 */
async function getTopSeriesLocalPublic(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularSeries[]> {
  const config = await getTopPicksConfig()
  const timeWindowDays = configOverrides?.seriesTimeWindowDays ?? config.seriesTimeWindowDays
  const useAllMatches = configOverrides?.seriesUseAllMatches ?? config.seriesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.seriesCount ?? config.seriesCount)
  const minUniqueViewers = configOverrides?.seriesMinUniqueViewers ?? config.seriesMinUniqueViewers

  // Normalize weights so they sum to 1.0 (allows any slider values to work)
  const rawViewers = configOverrides?.uniqueViewersWeight ?? config.uniqueViewersWeight
  const rawPlayCount = configOverrides?.playCountWeight ?? config.playCountWeight
  const rawCompletion = configOverrides?.completionWeight ?? config.completionWeight
  const totalWeight = rawViewers + rawPlayCount + rawCompletion
  const uniqueViewersWeight = totalWeight > 0 ? rawViewers / totalWeight : 0.33
  const playCountWeight = totalWeight > 0 ? rawPlayCount / totalWeight : 0.33
  const completionWeight = totalWeight > 0 ? rawCompletion / totalWeight : 0.34

  logger.info(
    {
      timeWindowDays,
      count,
      useAllMatches,
      weights: { uniqueViewersWeight, playCountWeight, completionWeight },
      minUniqueViewers,
    },
    'Calculating top series from local watch history'
  )

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
  }>(
    `
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
  `,
    [minUniqueViewers, uniqueViewersWeight, playCountWeight, completionWeight, count]
  )

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

// ============================================================================
// MDBList-based Popularity
// ============================================================================

/**
 * Get top movies from an MDBList list, matched to local library
 */
export async function getTopMoviesFromMDBList(
  listId: number,
  count: number
): Promise<PopularMovie[]> {
  logger.info({ listId, count }, 'Fetching top movies from MDBList')

  // Check if MDBList is configured
  const configured = await isMDBListConfigured()
  if (!configured) {
    logger.warn('MDBList not configured, returning empty list')
    return []
  }

  // Fetch list items (get more than needed since some won't match)
  const listItems = await getListItems(listId, { limit: count * 3 })

  if (listItems.length === 0) {
    logger.warn({ listId }, 'MDBList returned empty list')
    return []
  }

  // Match list items to local library by TMDB/IMDB ID
  const movies = await matchMDBListMoviesToLibrary(listItems, count)

  logger.info(
    { listId, fetched: listItems.length, matched: movies.length },
    'MDBList movies matched to library'
  )
  return movies
}

/**
 * Get top series from an MDBList list, matched to local library
 */
export async function getTopSeriesFromMDBList(
  listId: number,
  count: number
): Promise<PopularSeries[]> {
  logger.info({ listId, count }, 'Fetching top series from MDBList')

  const configured = await isMDBListConfigured()
  if (!configured) {
    logger.warn('MDBList not configured, returning empty list')
    return []
  }

  const listItems = await getListItems(listId, { limit: count * 3 })

  if (listItems.length === 0) {
    logger.warn({ listId }, 'MDBList returned empty list')
    return []
  }

  const series = await matchMDBListSeriesToLibrary(listItems, count)

  logger.info(
    { listId, fetched: listItems.length, matched: series.length },
    'MDBList series matched to library'
  )
  return series
}

/**
 * Match MDBList items to movies in the local library
 */
async function matchMDBListMoviesToLibrary(
  items: MDBListItem[],
  limit: number
): Promise<PopularMovie[]> {
  // Extract IMDB and TMDB IDs from list items
  const imdbIds = items.filter((i) => i.imdbid).map((i) => i.imdbid!)
  const tmdbIds = items.filter((i) => i.tmdbid).map((i) => String(i.tmdbid!))

  if (imdbIds.length === 0 && tmdbIds.length === 0) {
    return []
  }

  // Query local movies that match these IDs
  const result = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    backdrop_url: string | null
    overview: string | null
    genres: string[]
    community_rating: string | null
    path: string | null
    imdb_id: string | null
    tmdb_id: string | null
  }>(
    `
    SELECT 
      id, title, year, poster_url, backdrop_url, overview, genres,
      community_rating, path, imdb_id, tmdb_id
    FROM movies
    WHERE imdb_id = ANY($1) OR tmdb_id = ANY($2)
  `,
    [imdbIds, tmdbIds]
  )

  // Build lookup maps
  const movieByImdb = new Map<string, (typeof result.rows)[0]>()
  const movieByTmdb = new Map<string, (typeof result.rows)[0]>()
  for (const movie of result.rows) {
    if (movie.imdb_id) movieByImdb.set(movie.imdb_id, movie)
    if (movie.tmdb_id) movieByTmdb.set(movie.tmdb_id, movie)
  }

  // Maintain the order from MDBList (which is the ranking order)
  const movies: PopularMovie[] = []
  let rank = 1

  for (const item of items) {
    if (movies.length >= limit) break

    // Try to find matching local movie
    let movie = item.imdbid ? movieByImdb.get(item.imdbid) : undefined
    if (!movie && item.tmdbid) {
      movie = movieByTmdb.get(String(item.tmdbid))
    }

    if (movie) {
      movies.push({
        movieId: movie.id,
        title: movie.title,
        year: movie.year,
        posterUrl: movie.poster_url,
        backdropUrl: movie.backdrop_url,
        overview: movie.overview,
        genres: movie.genres || [],
        communityRating: movie.community_rating ? parseFloat(movie.community_rating) : null,
        path: movie.path,
        uniqueViewers: 0, // Not applicable for MDBList source
        playCount: 0,
        completionRate: 0,
        popularityScore: item.rank || 1000 - rank, // Use MDBList rank as score
        rank: rank++,
      })
    }
  }

  return movies
}

/**
 * Match MDBList items to series in the local library
 */
async function matchMDBListSeriesToLibrary(
  items: MDBListItem[],
  limit: number
): Promise<PopularSeries[]> {
  const imdbIds = items.filter((i) => i.imdbid).map((i) => i.imdbid!)
  const tmdbIds = items.filter((i) => i.tmdbid).map((i) => String(i.tmdbid!))
  const tvdbIds = items.filter((i) => i.tvdbid).map((i) => String(i.tvdbid!))

  if (imdbIds.length === 0 && tmdbIds.length === 0 && tvdbIds.length === 0) {
    return []
  }

  const result = await query<{
    id: string
    title: string
    year: number | null
    poster_url: string | null
    backdrop_url: string | null
    overview: string | null
    genres: string[]
    community_rating: string | null
    network: string | null
    imdb_id: string | null
    tmdb_id: string | null
    tvdb_id: string | null
  }>(
    `
    SELECT 
      id, title, year, poster_url, backdrop_url, overview, genres,
      community_rating, network, imdb_id, tmdb_id, tvdb_id
    FROM series
    WHERE imdb_id = ANY($1) OR tmdb_id = ANY($2) OR tvdb_id = ANY($3)
  `,
    [imdbIds, tmdbIds, tvdbIds]
  )

  const seriesByImdb = new Map<string, (typeof result.rows)[0]>()
  const seriesByTmdb = new Map<string, (typeof result.rows)[0]>()
  const seriesByTvdb = new Map<string, (typeof result.rows)[0]>()
  for (const s of result.rows) {
    if (s.imdb_id) seriesByImdb.set(s.imdb_id, s)
    if (s.tmdb_id) seriesByTmdb.set(s.tmdb_id, s)
    if (s.tvdb_id) seriesByTvdb.set(s.tvdb_id, s)
  }

  const series: PopularSeries[] = []
  let rank = 1

  for (const item of items) {
    if (series.length >= limit) break

    let s = item.imdbid ? seriesByImdb.get(item.imdbid) : undefined
    if (!s && item.tmdbid) s = seriesByTmdb.get(String(item.tmdbid))
    if (!s && item.tvdbid) s = seriesByTvdb.get(String(item.tvdbid))

    if (s) {
      series.push({
        seriesId: s.id,
        title: s.title,
        year: s.year,
        posterUrl: s.poster_url,
        backdropUrl: s.backdrop_url,
        overview: s.overview,
        genres: s.genres || [],
        communityRating: s.community_rating ? parseFloat(s.community_rating) : null,
        network: s.network,
        uniqueViewers: 0,
        totalEpisodesWatched: 0,
        avgCompletionRate: 0,
        popularityScore: item.rank || 1000 - rank,
        rank: rank++,
      })
    }
  }

  return series
}

// ============================================================================
// Hybrid Popularity (Local + MDBList combined)
// ============================================================================

/**
 * Get top movies using hybrid scoring (local + MDBList)
 */
export async function getTopMoviesHybrid(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularMovie[]> {
  const config = await getTopPicksConfig()
  const useAllMatches = configOverrides?.moviesUseAllMatches ?? config.moviesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.moviesCount ?? config.moviesCount)
  const localWeight = configOverrides?.hybridLocalWeight ?? config.hybridLocalWeight
  const mdblistWeight = configOverrides?.hybridMdblistWeight ?? config.hybridMdblistWeight
  const listId = configOverrides?.mdblistMoviesListId ?? config.mdblistMoviesListId

  logger.info(
    { count, useAllMatches, localWeight, mdblistWeight, listId },
    'Calculating hybrid top movies'
  )

  // Get local top movies (get more for blending)
  const localMovies = await getTopMoviesLocal(configOverrides)

  // Get MDBList movies if configured
  let mdblistMovies: PopularMovie[] = []
  if (listId) {
    mdblistMovies = await getTopMoviesFromMDBList(listId, count * 2)
  }

  // Blend scores
  return blendPopularityScores(localMovies, mdblistMovies, localWeight, mdblistWeight, count)
}

/**
 * Get top series using hybrid scoring
 */
export async function getTopSeriesHybrid(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularSeries[]> {
  const config = await getTopPicksConfig()
  const useAllMatches = configOverrides?.seriesUseAllMatches ?? config.seriesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.seriesCount ?? config.seriesCount)
  const localWeight = configOverrides?.hybridLocalWeight ?? config.hybridLocalWeight
  const mdblistWeight = configOverrides?.hybridMdblistWeight ?? config.hybridMdblistWeight
  const listId = configOverrides?.mdblistSeriesListId ?? config.mdblistSeriesListId

  logger.info(
    { count, useAllMatches, localWeight, mdblistWeight, listId },
    'Calculating hybrid top series'
  )

  const localSeries = await getTopSeriesLocal(configOverrides)

  let mdblistSeries: PopularSeries[] = []
  if (listId) {
    mdblistSeries = await getTopSeriesFromMDBList(listId, count * 2)
  }

  return blendSeriesPopularityScores(localSeries, mdblistSeries, localWeight, mdblistWeight, count)
}

/**
 * Blend popularity scores from two sources
 */
function blendPopularityScores(
  local: PopularMovie[],
  mdblist: PopularMovie[],
  localWeight: number,
  mdblistWeight: number,
  limit: number
): PopularMovie[] {
  // Normalize scores to 0-100 scale
  const maxLocalScore = Math.max(...local.map((m) => m.popularityScore), 1)
  const maxMdblistScore = Math.max(...mdblist.map((m) => m.popularityScore), 1)

  // Build lookup by movieId
  const scoreMap = new Map<
    string,
    { movie: PopularMovie; localScore: number; mdblistScore: number }
  >()

  for (const movie of local) {
    const normalizedScore = (movie.popularityScore / maxLocalScore) * 100
    scoreMap.set(movie.movieId, {
      movie,
      localScore: normalizedScore,
      mdblistScore: 0,
    })
  }

  for (const movie of mdblist) {
    const normalizedScore = (movie.popularityScore / maxMdblistScore) * 100
    const existing = scoreMap.get(movie.movieId)
    if (existing) {
      existing.mdblistScore = normalizedScore
    } else {
      scoreMap.set(movie.movieId, {
        movie,
        localScore: 0,
        mdblistScore: normalizedScore,
      })
    }
  }

  // Calculate blended scores and sort
  const blended = Array.from(scoreMap.values())
    .map(({ movie, localScore, mdblistScore }) => ({
      ...movie,
      popularityScore: localScore * localWeight + mdblistScore * mdblistWeight,
    }))
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, limit)

  // Re-assign ranks
  return blended.map((movie, index) => ({
    ...movie,
    rank: index + 1,
  }))
}

/**
 * Blend series popularity scores
 */
function blendSeriesPopularityScores(
  local: PopularSeries[],
  mdblist: PopularSeries[],
  localWeight: number,
  mdblistWeight: number,
  limit: number
): PopularSeries[] {
  const maxLocalScore = Math.max(...local.map((s) => s.popularityScore), 1)
  const maxMdblistScore = Math.max(...mdblist.map((s) => s.popularityScore), 1)

  const scoreMap = new Map<
    string,
    { series: PopularSeries; localScore: number; mdblistScore: number }
  >()

  for (const series of local) {
    const normalizedScore = (series.popularityScore / maxLocalScore) * 100
    scoreMap.set(series.seriesId, {
      series,
      localScore: normalizedScore,
      mdblistScore: 0,
    })
  }

  for (const series of mdblist) {
    const normalizedScore = (series.popularityScore / maxMdblistScore) * 100
    const existing = scoreMap.get(series.seriesId)
    if (existing) {
      existing.mdblistScore = normalizedScore
    } else {
      scoreMap.set(series.seriesId, {
        series,
        localScore: 0,
        mdblistScore: normalizedScore,
      })
    }
  }

  const blended = Array.from(scoreMap.values())
    .map(({ series, localScore, mdblistScore }) => ({
      ...series,
      popularityScore: localScore * localWeight + mdblistScore * mdblistWeight,
    }))
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, limit)

  return blended.map((series, index) => ({
    ...series,
    rank: index + 1,
  }))
}

// ============================================================================
// Internal helpers for local-only calculation (used by hybrid)
// ============================================================================

/**
 * Get top movies from local watch history only (internal use)
 */
async function getTopMoviesLocal(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularMovie[]> {
  const config = await getTopPicksConfig()
  const timeWindowDays = configOverrides?.moviesTimeWindowDays ?? config.moviesTimeWindowDays
  // Get more for hybrid blending
  const count = (configOverrides?.moviesCount ?? config.moviesCount) * 2
  const minUniqueViewers = configOverrides?.moviesMinUniqueViewers ?? config.moviesMinUniqueViewers

  // Normalize weights so they sum to 1.0
  const rawViewers = configOverrides?.uniqueViewersWeight ?? config.uniqueViewersWeight
  const rawPlayCount = configOverrides?.playCountWeight ?? config.playCountWeight
  const rawCompletion = configOverrides?.completionWeight ?? config.completionWeight
  const totalWeight = rawViewers + rawPlayCount + rawCompletion
  const uniqueViewersWeight = totalWeight > 0 ? rawViewers / totalWeight : 0.33
  const playCountWeight = totalWeight > 0 ? rawPlayCount / totalWeight : 0.33
  const completionWeight = totalWeight > 0 ? rawCompletion / totalWeight : 0.34

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
  }>(
    `
    WITH movie_stats AS (
      SELECT 
        wh.movie_id,
        COUNT(DISTINCT wh.user_id) as unique_viewers,
        COUNT(*) as play_count,
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
  `,
    [minUniqueViewers, uniqueViewersWeight, playCountWeight, completionWeight, count]
  )

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
 * Get top series from local watch history only (internal use)
 */
async function getTopSeriesLocal(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularSeries[]> {
  const config = await getTopPicksConfig()
  const timeWindowDays = configOverrides?.seriesTimeWindowDays ?? config.seriesTimeWindowDays
  const count = (configOverrides?.seriesCount ?? config.seriesCount) * 2
  const minUniqueViewers = configOverrides?.seriesMinUniqueViewers ?? config.seriesMinUniqueViewers

  // Normalize weights so they sum to 1.0
  const rawViewers = configOverrides?.uniqueViewersWeight ?? config.uniqueViewersWeight
  const rawPlayCount = configOverrides?.playCountWeight ?? config.playCountWeight
  const rawCompletion = configOverrides?.completionWeight ?? config.completionWeight
  const totalWeight = rawViewers + rawPlayCount + rawCompletion
  const uniqueViewersWeight = totalWeight > 0 ? rawViewers / totalWeight : 0.33
  const playCountWeight = totalWeight > 0 ? rawPlayCount / totalWeight : 0.33
  const completionWeight = totalWeight > 0 ? rawCompletion / totalWeight : 0.34

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
  }>(
    `
    WITH series_stats AS (
      SELECT 
        e.series_id,
        COUNT(DISTINCT wh.user_id) as unique_viewers,
        COUNT(DISTINCT wh.episode_id) as total_episodes_watched,
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
        (ss.total_episodes_watched::numeric * $3::numeric / 10.0) +
        (COALESCE(ss.avg_completion_rate, 0.5) * 100.0 * $4::numeric)
      ) as popularity_score
    FROM series_stats ss
    JOIN series s ON s.id = ss.series_id
    ORDER BY popularity_score DESC
    LIMIT $5
  `,
    [minUniqueViewers, uniqueViewersWeight, playCountWeight, completionWeight, count]
  )

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

// ============================================================================
// Preview Counts for Settings UI
// ============================================================================

export interface TopPicksPreviewParams {
  moviesMinViewers: number
  moviesTimeWindowDays: number
  seriesMinViewers: number
  seriesTimeWindowDays: number
}

export interface TopPicksPreviewResult {
  movies: number
  series: number
  recommendedMoviesMinViewers: number
  recommendedSeriesMinViewers: number
}

/**
 * Get preview counts for Top Picks settings UI
 *
 * Returns the number of movies/series that would qualify with the given settings,
 * plus recommended minViewers values to target ~25 items.
 */
export async function getTopPicksPreviewCounts(
  params: TopPicksPreviewParams
): Promise<TopPicksPreviewResult> {
  const { moviesMinViewers, moviesTimeWindowDays, seriesMinViewers, seriesTimeWindowDays } = params

  // Count movies with given settings
  const moviesResult = await query<{ count: string }>(
    `
    SELECT COUNT(*) as count FROM (
      SELECT movie_id
      FROM watch_history
      WHERE movie_id IS NOT NULL
        AND media_type = 'movie'
        AND last_played_at >= NOW() - INTERVAL '${moviesTimeWindowDays} days'
      GROUP BY movie_id
      HAVING COUNT(DISTINCT user_id) >= $1
    ) sub
  `,
    [moviesMinViewers]
  )

  // Count series with given settings
  const seriesResult = await query<{ count: string }>(
    `
    SELECT COUNT(*) as count FROM (
      SELECT e.series_id
      FROM watch_history wh
      JOIN episodes e ON e.id = wh.episode_id
      WHERE wh.episode_id IS NOT NULL
        AND wh.media_type = 'episode'
        AND wh.last_played_at >= NOW() - INTERVAL '${seriesTimeWindowDays} days'
      GROUP BY e.series_id
      HAVING COUNT(DISTINCT wh.user_id) >= $1
    ) sub
  `,
    [seriesMinViewers]
  )

  const moviesCount = parseInt(moviesResult.rows[0]?.count || '0')
  const seriesCount = parseInt(seriesResult.rows[0]?.count || '0')

  // Calculate recommended minViewers to target ~25 items
  const recommendedMoviesMinViewers = await findRecommendedMinViewers(
    'movies',
    moviesTimeWindowDays,
    25
  )
  const recommendedSeriesMinViewers = await findRecommendedMinViewers(
    'series',
    seriesTimeWindowDays,
    25
  )

  return {
    movies: moviesCount,
    series: seriesCount,
    recommendedMoviesMinViewers,
    recommendedSeriesMinViewers,
  }
}

/**
 * Find the minimum viewers threshold that would result in approximately targetCount items
 */
async function findRecommendedMinViewers(
  type: 'movies' | 'series',
  timeWindowDays: number,
  targetCount: number
): Promise<number> {
  // Get counts for various minViewers thresholds
  const thresholds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20]

  for (const threshold of thresholds) {
    let count: number

    if (type === 'movies') {
      const result = await query<{ count: string }>(
        `
        SELECT COUNT(*) as count FROM (
          SELECT movie_id
          FROM watch_history
          WHERE movie_id IS NOT NULL
            AND media_type = 'movie'
            AND last_played_at >= NOW() - INTERVAL '${timeWindowDays} days'
          GROUP BY movie_id
          HAVING COUNT(DISTINCT user_id) >= $1
        ) sub
      `,
        [threshold]
      )
      count = parseInt(result.rows[0]?.count || '0')
    } else {
      const result = await query<{ count: string }>(
        `
        SELECT COUNT(*) as count FROM (
          SELECT e.series_id
          FROM watch_history wh
          JOIN episodes e ON e.id = wh.episode_id
          WHERE wh.episode_id IS NOT NULL
            AND wh.media_type = 'episode'
            AND wh.last_played_at >= NOW() - INTERVAL '${timeWindowDays} days'
          GROUP BY e.series_id
          HAVING COUNT(DISTINCT wh.user_id) >= $1
        ) sub
      `,
        [threshold]
      )
      count = parseInt(result.rows[0]?.count || '0')
    }

    // Return the first threshold that gives us <= targetCount items
    if (count <= targetCount) {
      return threshold
    }
  }

  // If even 20+ viewers gives too many, return 20
  return 20
}
