/**
 * Top Picks Popularity Calculation
 *
 * Calculates weighted popularity scores for movies and series
 * based on aggregated watch history from all users, or from
 * external sources (TMDB, MDBList), or a hybrid of local + external.
 */

import { query } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { getTopPicksConfig, type TopPicksConfig, type PopularitySource, type HybridExternalSource } from './config.js'
import { getListItems, isMDBListConfigured, type MDBListItem } from '../mdblist/index.js'
import {
  getPopularMoviesBatch,
  getTrendingMoviesBatch,
  getTopRatedMoviesBatch,
  getPopularTVBatch,
  getTrendingTVBatch,
  getTopRatedTVBatch,
  type TMDbMovieResult,
  type TMDbTVResult,
} from '../tmdb/index.js'

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
 * Routes to appropriate fetcher based on source config
 */
export async function getTopMovies(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularMovie[]> {
  const config = await getTopPicksConfig()
  const source = configOverrides?.moviesPopularitySource ?? config.moviesPopularitySource
  const useAllMatches = configOverrides?.moviesUseAllMatches ?? config.moviesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.moviesCount ?? config.moviesCount)
  
  // Get language filter settings
  const languages = configOverrides?.moviesLanguages ?? config.moviesLanguages ?? []
  const includeUnknown = configOverrides?.moviesIncludeUnknownLanguage ?? config.moviesIncludeUnknownLanguage ?? true
  const languageFilter = languages.length > 0 ? { languages, includeUnknown } : undefined

  logger.info({ source, count, useAllMatches, languageFilter }, 'Getting top movies')

  switch (source) {
    case 'tmdb_popular':
      return getTopMoviesFromTMDB('popular', count, languageFilter)
    case 'tmdb_trending_day':
      return getTopMoviesFromTMDB('trending_day', count, languageFilter)
    case 'tmdb_trending_week':
      return getTopMoviesFromTMDB('trending_week', count, languageFilter)
    case 'tmdb_top_rated':
      return getTopMoviesFromTMDB('top_rated', count, languageFilter)
    case 'mdblist': {
      const listId = configOverrides?.mdblistMoviesListId ?? config.mdblistMoviesListId
      if (!listId) {
        logger.warn('MDBList source selected but no movie list configured, falling back to emby_history')
        return getTopMoviesLocalPublic(configOverrides)
      }
      return getTopMoviesFromMDBList(listId, count, languageFilter)
    }
    case 'hybrid':
      return getTopMoviesHybrid(configOverrides)
    case 'emby_history':
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
 * Routes to appropriate fetcher based on source config
 */
export async function getTopSeries(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularSeries[]> {
  const config = await getTopPicksConfig()
  const source = configOverrides?.seriesPopularitySource ?? config.seriesPopularitySource
  const useAllMatches = configOverrides?.seriesUseAllMatches ?? config.seriesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.seriesCount ?? config.seriesCount)
  
  // Get language filter settings
  const languages = configOverrides?.seriesLanguages ?? config.seriesLanguages ?? []
  const includeUnknown = configOverrides?.seriesIncludeUnknownLanguage ?? config.seriesIncludeUnknownLanguage ?? true
  const languageFilter = languages.length > 0 ? { languages, includeUnknown } : undefined

  logger.info({ source, count, useAllMatches, languageFilter }, 'Getting top series')

  switch (source) {
    case 'tmdb_popular':
      return getTopSeriesFromTMDB('popular', count, languageFilter)
    case 'tmdb_trending_day':
      return getTopSeriesFromTMDB('trending_day', count, languageFilter)
    case 'tmdb_trending_week':
      return getTopSeriesFromTMDB('trending_week', count, languageFilter)
    case 'tmdb_top_rated':
      return getTopSeriesFromTMDB('top_rated', count, languageFilter)
    case 'mdblist': {
      const listId = configOverrides?.mdblistSeriesListId ?? config.mdblistSeriesListId
      if (!listId) {
        logger.warn('MDBList source selected but no series list configured, falling back to emby_history')
        return getTopSeriesLocalPublic(configOverrides)
      }
      return getTopSeriesFromMDBList(listId, count, languageFilter)
    }
    case 'hybrid':
      return getTopSeriesHybrid(configOverrides)
    case 'emby_history':
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
  count: number,
  languageFilter?: { languages: string[]; includeUnknown: boolean },
  sort?: string
): Promise<PopularMovie[]> {
  // Get sort from config if not passed
  const config = await getTopPicksConfig()
  const sortOption = sort ?? config.mdblistMoviesSort

  // For popularity metrics (lower = better), use ascending order
  // For ratings (higher = better), use descending order
  const isPopularitySort = sortOption === 'imdbpopular' || sortOption === 'tmdbpopular'
  const order = isPopularitySort ? 'asc' : 'desc'

  logger.info({ listId, count, sort: sortOption, order, languageFilter }, 'Fetching top movies from MDBList')

  // Check if MDBList is configured
  const configured = await isMDBListConfigured()
  if (!configured) {
    logger.warn('MDBList not configured, returning empty list')
    return []
  }

  // Fetch list items (get more than needed since some won't match)
  let listItems = await getListItems(listId, { limit: count * 3, sort: sortOption, order })

  if (listItems.length === 0) {
    logger.warn({ listId }, 'MDBList returned empty list')
    return []
  }

  // MDBList doesn't provide language info, so we need to fetch from TMDB if filtering
  // For now, we'll apply the filter at the library matching stage where we have language info
  // This is a limitation - MDBList items without TMDB matches can't be language-filtered
  
  // Log the top items from MDBList for debugging (before library matching)
  // Note: Array position is the sorted rank, item.rank is just the original list position
  logger.info(
    {
      listId,
      sort: sortOption,
      topFromMDBList: listItems.slice(0, 5).map((item, idx) => ({
        sortedRank: idx + 1,
        title: item.title,
        year: item.year,
        imdbid: item.imdbid,
        originalListPosition: item.rank, // NOT the sorted rank!
      })),
    },
    'Top items from MDBList (sorted by ' + sortOption + ', before library matching)'
  )

  // Match list items to local library by TMDB/IMDB ID
  const movies = await matchMDBListMoviesToLibrary(listItems, count, languageFilter)

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
  count: number,
  languageFilter?: { languages: string[]; includeUnknown: boolean },
  sort?: string
): Promise<PopularSeries[]> {
  // Get sort from config if not passed
  const config = await getTopPicksConfig()
  const sortOption = sort ?? config.mdblistSeriesSort

  // For popularity metrics (lower = better), use ascending order
  // For ratings (higher = better), use descending order
  const isPopularitySort = sortOption === 'imdbpopular' || sortOption === 'tmdbpopular'
  const order = isPopularitySort ? 'asc' : 'desc'

  logger.info({ listId, count, sort: sortOption, order, languageFilter }, 'Fetching top series from MDBList')

  const configured = await isMDBListConfigured()
  if (!configured) {
    logger.warn('MDBList not configured, returning empty list')
    return []
  }

  const listItems = await getListItems(listId, { limit: count * 3, sort: sortOption, order })

  if (listItems.length === 0) {
    logger.warn({ listId }, 'MDBList returned empty list')
    return []
  }

  const series = await matchMDBListSeriesToLibrary(listItems, count, languageFilter)

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
  limit: number,
  languageFilter?: { languages: string[]; includeUnknown: boolean }
): Promise<PopularMovie[]> {
  // Extract IMDB and TMDB IDs from list items
  const imdbIds = items.filter((i) => i.imdbid).map((i) => i.imdbid!)
  const tmdbIds = items.filter((i) => i.tmdbid).map((i) => String(i.tmdbid!))

  if (imdbIds.length === 0 && tmdbIds.length === 0) {
    return []
  }

  // Query local movies that match these IDs (include languages for filtering)
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
    languages: string[] | null
  }>(
    `
    SELECT 
      id, title, year, poster_url, backdrop_url, overview, genres,
      community_rating, path, imdb_id, tmdb_id, languages
    FROM movies
    WHERE imdb_id = ANY($1) OR tmdb_id = ANY($2)
  `,
    [imdbIds, tmdbIds]
  )

  // Get local watch stats for these movies (supplementary data)
  const movieIds = result.rows.map(r => r.id)
  const statsResult = await query<{
    movie_id: string
    unique_viewers: string
    play_count: string
  }>(
    `
    SELECT 
      movie_id,
      COUNT(DISTINCT user_id) as unique_viewers,
      COUNT(*) as play_count
    FROM watch_history
    WHERE movie_id = ANY($1)
    GROUP BY movie_id
  `,
    [movieIds]
  )

  // Build stats lookup
  const statsMap = new Map<string, { uniqueViewers: number; playCount: number }>()
  for (const row of statsResult.rows) {
    statsMap.set(row.movie_id, {
      uniqueViewers: parseInt(row.unique_viewers),
      playCount: parseInt(row.play_count),
    })
  }

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
      // Apply language filter if configured
      if (languageFilter && languageFilter.languages.length > 0) {
        const movieLanguage = movie.languages?.[0] || null
        if (!movieLanguage) {
          if (!languageFilter.includeUnknown) continue
        } else if (!languageFilter.languages.includes(movieLanguage)) {
          continue
        }
      }
      
      const stats = statsMap.get(movie.id) || { uniqueViewers: 0, playCount: 0 }
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
        uniqueViewers: stats.uniqueViewers,
        playCount: stats.playCount,
        completionRate: stats.playCount > 0 ? 1.0 : 0,
        popularityScore: 1000 - rank, // Higher score for items earlier in sorted list
        rank: rank++, // Array position = sorted rank (NOT item.rank which is original list position)
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
  limit: number,
  languageFilter?: { languages: string[]; includeUnknown: boolean }
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
    languages: string[] | null
  }>(
    `
    SELECT 
      id, title, year, poster_url, backdrop_url, overview, genres,
      community_rating, network, imdb_id, tmdb_id, tvdb_id, languages
    FROM series
    WHERE imdb_id = ANY($1) OR tmdb_id = ANY($2) OR tvdb_id = ANY($3)
  `,
    [imdbIds, tmdbIds, tvdbIds]
  )

  // Get local watch stats for these series (supplementary data)
  const seriesIds = result.rows.map(r => r.id)
  const statsResult = await query<{
    series_id: string
    unique_viewers: string
    total_episodes_watched: string
  }>(
    `
    SELECT 
      e.series_id,
      COUNT(DISTINCT wh.user_id) as unique_viewers,
      COUNT(DISTINCT wh.episode_id) as total_episodes_watched
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    WHERE e.series_id = ANY($1)
    GROUP BY e.series_id
  `,
    [seriesIds]
  )

  // Build stats lookup
  const statsMap = new Map<string, { uniqueViewers: number; totalEpisodesWatched: number }>()
  for (const row of statsResult.rows) {
    statsMap.set(row.series_id, {
      uniqueViewers: parseInt(row.unique_viewers),
      totalEpisodesWatched: parseInt(row.total_episodes_watched),
    })
  }

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
      // Apply language filter if configured
      if (languageFilter && languageFilter.languages.length > 0) {
        const seriesLanguage = s.languages?.[0] || null
        if (!seriesLanguage) {
          if (!languageFilter.includeUnknown) continue
        } else if (!languageFilter.languages.includes(seriesLanguage)) {
          continue
        }
      }
      
      const stats = statsMap.get(s.id) || { uniqueViewers: 0, totalEpisodesWatched: 0 }
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
        uniqueViewers: stats.uniqueViewers,
        totalEpisodesWatched: stats.totalEpisodesWatched,
        avgCompletionRate: stats.totalEpisodesWatched > 0 ? 0.5 : 0, // Approximate since we don't have per-user data here
        popularityScore: 1000 - rank, // Higher score for items earlier in sorted list
        rank: rank++, // Array position = sorted rank (NOT item.rank which is original list position)
      })
    }
  }

  return series
}

// ============================================================================
// TMDB-based Popularity
// ============================================================================

type TMDBSourceType = 'popular' | 'trending_day' | 'trending_week' | 'top_rated'

/**
 * Get top movies from TMDB, matched to local library
 */
export async function getTopMoviesFromTMDB(
  sourceType: TMDBSourceType,
  count: number,
  languageFilter?: { languages: string[]; includeUnknown: boolean }
): Promise<PopularMovie[]> {
  logger.info({ sourceType, count, languageFilter }, 'Fetching top movies from TMDB')

  // Fetch from TMDB (get more than needed since some won't match)
  const maxPages = Math.ceil((count * 3) / 20) // TMDB returns 20 per page
  let tmdbMovies: TMDbMovieResult[] = []

  switch (sourceType) {
    case 'popular':
      tmdbMovies = await getPopularMoviesBatch(maxPages)
      break
    case 'trending_day':
      tmdbMovies = await getTrendingMoviesBatch('day', maxPages)
      break
    case 'trending_week':
      tmdbMovies = await getTrendingMoviesBatch('week', maxPages)
      break
    case 'top_rated':
      tmdbMovies = await getTopRatedMoviesBatch(maxPages)
      break
  }

  if (tmdbMovies.length === 0) {
    logger.warn({ sourceType }, 'TMDB returned empty list')
    return []
  }

  // Apply language filter if configured
  if (languageFilter && languageFilter.languages.length > 0) {
    const beforeCount = tmdbMovies.length
    tmdbMovies = tmdbMovies.filter(movie => {
      if (!movie.original_language) {
        return languageFilter.includeUnknown
      }
      return languageFilter.languages.includes(movie.original_language)
    })
    logger.debug({ 
      languages: languageFilter.languages, 
      includeUnknown: languageFilter.includeUnknown,
      beforeCount,
      afterCount: tmdbMovies.length 
    }, 'Applied language filter to TMDB movies')
  }

  logger.info(
    {
      sourceType,
      topFromTMDB: tmdbMovies.slice(0, 5).map((m, idx) => ({
        rank: idx + 1,
        title: m.title,
        year: m.release_date?.split('-')[0],
        tmdbId: m.id,
      })),
    },
    `Top items from TMDB ${sourceType} (before library matching)`
  )

  // Match to local library
  const movies = await matchTMDBMoviesToLibrary(tmdbMovies, count)

  logger.info(
    { sourceType, fetched: tmdbMovies.length, matched: movies.length },
    'TMDB movies matched to library'
  )
  return movies
}

/**
 * Get top series from TMDB, matched to local library
 */
export async function getTopSeriesFromTMDB(
  sourceType: TMDBSourceType,
  count: number,
  languageFilter?: { languages: string[]; includeUnknown: boolean }
): Promise<PopularSeries[]> {
  logger.info({ sourceType, count, languageFilter }, 'Fetching top series from TMDB')

  const maxPages = Math.ceil((count * 3) / 20)
  let tmdbSeries: TMDbTVResult[] = []

  switch (sourceType) {
    case 'popular':
      tmdbSeries = await getPopularTVBatch(maxPages)
      break
    case 'trending_day':
      tmdbSeries = await getTrendingTVBatch('day', maxPages)
      break
    case 'trending_week':
      tmdbSeries = await getTrendingTVBatch('week', maxPages)
      break
    case 'top_rated':
      tmdbSeries = await getTopRatedTVBatch(maxPages)
      break
  }

  if (tmdbSeries.length === 0) {
    logger.warn({ sourceType }, 'TMDB returned empty list')
    return []
  }

  // Apply language filter if configured
  if (languageFilter && languageFilter.languages.length > 0) {
    const beforeCount = tmdbSeries.length
    tmdbSeries = tmdbSeries.filter(series => {
      if (!series.original_language) {
        return languageFilter.includeUnknown
      }
      return languageFilter.languages.includes(series.original_language)
    })
    logger.debug({ 
      languages: languageFilter.languages, 
      includeUnknown: languageFilter.includeUnknown,
      beforeCount,
      afterCount: tmdbSeries.length 
    }, 'Applied language filter to TMDB series')
  }

  logger.info(
    {
      sourceType,
      topFromTMDB: tmdbSeries.slice(0, 5).map((s, idx) => ({
        rank: idx + 1,
        title: s.name,
        year: s.first_air_date?.split('-')[0],
        tmdbId: s.id,
      })),
    },
    `Top items from TMDB ${sourceType} (before library matching)`
  )

  const series = await matchTMDBSeriesToLibrary(tmdbSeries, count)

  logger.info(
    { sourceType, fetched: tmdbSeries.length, matched: series.length },
    'TMDB series matched to library'
  )
  return series
}

/**
 * Match TMDB movies to local library
 */
async function matchTMDBMoviesToLibrary(
  tmdbMovies: TMDbMovieResult[],
  limit: number
): Promise<PopularMovie[]> {
  const tmdbIds = tmdbMovies.map((m) => String(m.id))

  if (tmdbIds.length === 0) {
    return []
  }

  // Query local movies that match these TMDB IDs
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
    tmdb_id: string | null
  }>(
    `
    SELECT 
      id, title, year, poster_url, backdrop_url, overview, genres,
      community_rating, path, tmdb_id
    FROM movies
    WHERE tmdb_id = ANY($1)
  `,
    [tmdbIds]
  )

  // Get local watch stats for these movies
  const movieIds = result.rows.map((r) => r.id)
  const statsResult = await query<{
    movie_id: string
    unique_viewers: string
    play_count: string
  }>(
    `
    SELECT 
      movie_id,
      COUNT(DISTINCT user_id) as unique_viewers,
      COUNT(*) as play_count
    FROM watch_history
    WHERE movie_id = ANY($1)
    GROUP BY movie_id
  `,
    [movieIds]
  )

  const statsMap = new Map<string, { uniqueViewers: number; playCount: number }>()
  for (const row of statsResult.rows) {
    statsMap.set(row.movie_id, {
      uniqueViewers: parseInt(row.unique_viewers),
      playCount: parseInt(row.play_count),
    })
  }

  // Build lookup by TMDB ID
  const movieByTmdb = new Map<string, (typeof result.rows)[0]>()
  for (const movie of result.rows) {
    if (movie.tmdb_id) movieByTmdb.set(movie.tmdb_id, movie)
  }

  // Maintain order from TMDB (ranking order)
  const movies: PopularMovie[] = []
  let rank = 1

  for (const tmdbMovie of tmdbMovies) {
    if (movies.length >= limit) break

    const movie = movieByTmdb.get(String(tmdbMovie.id))
    if (movie) {
      const stats = statsMap.get(movie.id) || { uniqueViewers: 0, playCount: 0 }
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
        uniqueViewers: stats.uniqueViewers,
        playCount: stats.playCount,
        completionRate: stats.playCount > 0 ? 1.0 : 0,
        popularityScore: 1000 - rank,
        rank: rank++,
      })
    }
  }

  return movies
}

/**
 * Match TMDB series to local library
 */
async function matchTMDBSeriesToLibrary(
  tmdbSeries: TMDbTVResult[],
  limit: number
): Promise<PopularSeries[]> {
  const tmdbIds = tmdbSeries.map((s) => String(s.id))

  if (tmdbIds.length === 0) {
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
    tmdb_id: string | null
  }>(
    `
    SELECT 
      id, title, year, poster_url, backdrop_url, overview, genres,
      community_rating, network, tmdb_id
    FROM series
    WHERE tmdb_id = ANY($1)
  `,
    [tmdbIds]
  )

  // Get local watch stats
  const seriesIds = result.rows.map((r) => r.id)
  const statsResult = await query<{
    series_id: string
    unique_viewers: string
    total_episodes_watched: string
  }>(
    `
    SELECT 
      e.series_id,
      COUNT(DISTINCT wh.user_id) as unique_viewers,
      COUNT(DISTINCT wh.episode_id) as total_episodes_watched
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    WHERE e.series_id = ANY($1)
    GROUP BY e.series_id
  `,
    [seriesIds]
  )

  const statsMap = new Map<string, { uniqueViewers: number; totalEpisodesWatched: number }>()
  for (const row of statsResult.rows) {
    statsMap.set(row.series_id, {
      uniqueViewers: parseInt(row.unique_viewers),
      totalEpisodesWatched: parseInt(row.total_episodes_watched),
    })
  }

  const seriesByTmdb = new Map<string, (typeof result.rows)[0]>()
  for (const s of result.rows) {
    if (s.tmdb_id) seriesByTmdb.set(s.tmdb_id, s)
  }

  const series: PopularSeries[] = []
  let rank = 1

  for (const tmdbShow of tmdbSeries) {
    if (series.length >= limit) break

    const s = seriesByTmdb.get(String(tmdbShow.id))
    if (s) {
      const stats = statsMap.get(s.id) || { uniqueViewers: 0, totalEpisodesWatched: 0 }
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
        uniqueViewers: stats.uniqueViewers,
        totalEpisodesWatched: stats.totalEpisodesWatched,
        avgCompletionRate: stats.totalEpisodesWatched > 0 ? 0.5 : 0,
        popularityScore: 1000 - rank,
        rank: rank++,
      })
    }
  }

  return series
}

// ============================================================================
// Hybrid Popularity (Local + External source combined)
// ============================================================================

/**
 * Get top movies using hybrid scoring (local + one external source)
 */
export async function getTopMoviesHybrid(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularMovie[]> {
  const config = await getTopPicksConfig()
  const useAllMatches = configOverrides?.moviesUseAllMatches ?? config.moviesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.moviesCount ?? config.moviesCount)
  const localWeight = configOverrides?.hybridLocalWeight ?? config.hybridLocalWeight
  const externalWeight = configOverrides?.hybridExternalWeight ?? config.hybridExternalWeight
  const externalSource = configOverrides?.moviesHybridExternalSource ?? config.moviesHybridExternalSource

  logger.info(
    { count, useAllMatches, localWeight, externalWeight, externalSource },
    'Calculating hybrid top movies'
  )

  // Get local top movies (get more for blending)
  const localMovies = await getTopMoviesLocal(configOverrides)

  // Get external source movies
  const externalMovies = await getExternalMovies(externalSource, count * 2, configOverrides)

  // Blend scores
  return blendPopularityScores(localMovies, externalMovies, localWeight, externalWeight, count)
}

/**
 * Get movies from an external source (TMDB or MDBList)
 */
async function getExternalMovies(
  source: HybridExternalSource,
  count: number,
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularMovie[]> {
  const config = await getTopPicksConfig()
  
  // Get language filter settings
  const languages = configOverrides?.moviesLanguages ?? config.moviesLanguages ?? []
  const includeUnknown = configOverrides?.moviesIncludeUnknownLanguage ?? config.moviesIncludeUnknownLanguage ?? true
  const languageFilter = languages.length > 0 ? { languages, includeUnknown } : undefined
  
  switch (source) {
    case 'tmdb_popular':
      return getTopMoviesFromTMDB('popular', count, languageFilter)
    case 'tmdb_trending_day':
      return getTopMoviesFromTMDB('trending_day', count, languageFilter)
    case 'tmdb_trending_week':
      return getTopMoviesFromTMDB('trending_week', count, languageFilter)
    case 'tmdb_top_rated':
      return getTopMoviesFromTMDB('top_rated', count, languageFilter)
    case 'mdblist': {
      const listId = configOverrides?.mdblistMoviesListId ?? config.mdblistMoviesListId
      if (!listId) {
        logger.warn('MDBList selected as hybrid external source but no list configured')
        return []
      }
      const sortOption = configOverrides?.mdblistMoviesSort ?? config.mdblistMoviesSort
      return getTopMoviesFromMDBList(listId, count, languageFilter, sortOption)
    }
    default:
      logger.warn({ source }, 'Unknown external source for hybrid mode')
      return []
  }
}

/**
 * Get top series using hybrid scoring (local + one external source)
 */
export async function getTopSeriesHybrid(
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularSeries[]> {
  const config = await getTopPicksConfig()
  const useAllMatches = configOverrides?.seriesUseAllMatches ?? config.seriesUseAllMatches
  const count = useAllMatches ? 10000 : (configOverrides?.seriesCount ?? config.seriesCount)
  const localWeight = configOverrides?.hybridLocalWeight ?? config.hybridLocalWeight
  const externalWeight = configOverrides?.hybridExternalWeight ?? config.hybridExternalWeight
  const externalSource = configOverrides?.seriesHybridExternalSource ?? config.seriesHybridExternalSource

  logger.info(
    { count, useAllMatches, localWeight, externalWeight, externalSource },
    'Calculating hybrid top series'
  )

  const localSeries = await getTopSeriesLocal(configOverrides)

  // Get external source series
  const externalSeries = await getExternalSeries(externalSource, count * 2, configOverrides)

  return blendSeriesPopularityScores(localSeries, externalSeries, localWeight, externalWeight, count)
}

/**
 * Get series from an external source (TMDB or MDBList)
 */
async function getExternalSeries(
  source: HybridExternalSource,
  count: number,
  configOverrides?: Partial<TopPicksConfig>
): Promise<PopularSeries[]> {
  const config = await getTopPicksConfig()
  
  // Get language filter settings
  const languages = configOverrides?.seriesLanguages ?? config.seriesLanguages ?? []
  const includeUnknown = configOverrides?.seriesIncludeUnknownLanguage ?? config.seriesIncludeUnknownLanguage ?? true
  const languageFilter = languages.length > 0 ? { languages, includeUnknown } : undefined
  
  switch (source) {
    case 'tmdb_popular':
      return getTopSeriesFromTMDB('popular', count, languageFilter)
    case 'tmdb_trending_day':
      return getTopSeriesFromTMDB('trending_day', count, languageFilter)
    case 'tmdb_trending_week':
      return getTopSeriesFromTMDB('trending_week', count, languageFilter)
    case 'tmdb_top_rated':
      return getTopSeriesFromTMDB('top_rated', count, languageFilter)
    case 'mdblist': {
      const listId = configOverrides?.mdblistSeriesListId ?? config.mdblistSeriesListId
      if (!listId) {
        logger.warn('MDBList selected as hybrid external source but no list configured')
        return []
      }
      const sortOption = configOverrides?.mdblistSeriesSort ?? config.mdblistSeriesSort
      return getTopSeriesFromMDBList(listId, count, languageFilter, sortOption)
    }
    default:
      logger.warn({ source }, 'Unknown external source for hybrid mode')
      return []
  }
}

/**
 * Blend popularity scores from two sources (local + external)
 */
function blendPopularityScores(
  local: PopularMovie[],
  external: PopularMovie[],
  localWeight: number,
  externalWeight: number,
  limit: number
): PopularMovie[] {
  // Normalize scores to 0-100 scale
  const maxLocalScore = Math.max(...local.map((m) => m.popularityScore), 1)
  const maxExternalScore = Math.max(...external.map((m) => m.popularityScore), 1)

  // Build lookup by movieId
  const scoreMap = new Map<
    string,
    { movie: PopularMovie; localScore: number; externalScore: number }
  >()

  for (const movie of local) {
    const normalizedScore = (movie.popularityScore / maxLocalScore) * 100
    scoreMap.set(movie.movieId, {
      movie,
      localScore: normalizedScore,
      externalScore: 0,
    })
  }

  for (const movie of external) {
    const normalizedScore = (movie.popularityScore / maxExternalScore) * 100
    const existing = scoreMap.get(movie.movieId)
    if (existing) {
      existing.externalScore = normalizedScore
    } else {
      scoreMap.set(movie.movieId, {
        movie,
        localScore: 0,
        externalScore: normalizedScore,
      })
    }
  }

  // Calculate blended scores and sort
  const blended = Array.from(scoreMap.values())
    .map(({ movie, localScore, externalScore }) => ({
      ...movie,
      popularityScore: localScore * localWeight + externalScore * externalWeight,
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
 * Blend series popularity scores (local + external)
 */
function blendSeriesPopularityScores(
  local: PopularSeries[],
  external: PopularSeries[],
  localWeight: number,
  externalWeight: number,
  limit: number
): PopularSeries[] {
  const maxLocalScore = Math.max(...local.map((s) => s.popularityScore), 1)
  const maxExternalScore = Math.max(...external.map((s) => s.popularityScore), 1)

  const scoreMap = new Map<
    string,
    { series: PopularSeries; localScore: number; externalScore: number }
  >()

  for (const series of local) {
    const normalizedScore = (series.popularityScore / maxLocalScore) * 100
    scoreMap.set(series.seriesId, {
      series,
      localScore: normalizedScore,
      externalScore: 0,
    })
  }

  for (const series of external) {
    const normalizedScore = (series.popularityScore / maxExternalScore) * 100
    const existing = scoreMap.get(series.seriesId)
    if (existing) {
      existing.externalScore = normalizedScore
    } else {
      scoreMap.set(series.seriesId, {
        series,
        localScore: 0,
        externalScore: normalizedScore,
      })
    }
  }

  const blended = Array.from(scoreMap.values())
    .map(({ series, localScore, externalScore }) => ({
      ...series,
      popularityScore: localScore * localWeight + externalScore * externalWeight,
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

// ============================================================================
// Preview Functions (for Admin UI)
// ============================================================================

export interface PreviewItem {
  id: string | null  // null for missing items
  tmdbId: number
  title: string
  year: number | null
  posterUrl: string | null
  rank: number
  inLibrary: boolean
  // Extended metadata for rich display
  overview: string | null
  voteAverage: number | null
  genreIds: number[]
  originalLanguage: string | null  // ISO 639-1 code for language filtering
}

export interface PreviewResult {
  matched: PreviewItem[]
  missing: PreviewItem[]
  source: string
  mediaType: 'movies' | 'series'
}

// Re-use the TMDBSourceType from above (already defined at line ~718)

/**
 * Get preview of top movies from an external source (TMDB or MDBList)
 * Returns both matched (in library) and missing items
 */
export async function getTopMoviesPreview(
  source: PopularitySource,
  options: {
    limit?: number
    hybridExternalSource?: HybridExternalSource
    mdblistListId?: number
    mdblistSort?: string
    languages?: string[]
    includeUnknownLanguage?: boolean
  } = {}
): Promise<PreviewResult> {
  const { limit = 100, hybridExternalSource, mdblistListId, mdblistSort = 'score', languages = [], includeUnknownLanguage = true } = options

  logger.info({ source, limit }, 'Getting top movies preview')

  // For emby_history, we only have library items (no "missing" concept)
  if (source === 'emby_history') {
    const movies = await getTopMovies({ 
      moviesPopularitySource: source, 
      moviesCount: limit,
      moviesUseAllMatches: false,
    })
    return {
      matched: movies.map(m => ({
        id: m.movieId,
        tmdbId: 0, // Not available for local-only
        title: m.title,
        year: m.year,
        posterUrl: m.posterUrl,
        rank: m.rank,
        inLibrary: true,
        overview: m.overview,
        voteAverage: m.communityRating,
        genreIds: [], // Genre IDs not available for local source
        originalLanguage: null, // Not available for local source
      })),
      missing: [],
      source,
      mediaType: 'movies',
    }
  }

  // For hybrid, use the external source component
  const effectiveSource = source === 'hybrid' 
    ? (hybridExternalSource || 'tmdb_popular') 
    : source

  // Fetch raw items from external source
  interface RawItem {
    tmdbId: number
    imdbId: string | null
    title: string
    year: number | null
    posterUrl: string | null
    overview: string | null
    voteAverage: number | null
    genreIds: number[]
    originalLanguage: string | null
  }
  let rawItems: RawItem[] = []

  if (effectiveSource === 'mdblist' && mdblistListId) {
    const mdblistItems = await getListItems(mdblistListId, { limit, sort: mdblistSort })
    rawItems = mdblistItems
      .filter(item => item.tmdbid)
      .map(item => ({
        tmdbId: item.tmdbid!,
        imdbId: item.imdbid || null,
        title: item.title || 'Unknown',
        year: item.year || null,
        posterUrl: null, // MDBList items don't have poster URLs in list response
        overview: item.description || null,
        voteAverage: item.score || null,
        genreIds: [], // MDBList doesn't provide genre IDs in list response
        originalLanguage: null, // MDBList doesn't provide language in list response
      }))
  } else if (effectiveSource.startsWith('tmdb_')) {
    const tmdbSource = effectiveSource.replace('tmdb_', '') as TMDBSourceType
    const maxPages = Math.ceil((limit * 2) / 20)
    
    let tmdbMovies: TMDbMovieResult[] = []
    switch (tmdbSource) {
      case 'popular':
        tmdbMovies = await getPopularMoviesBatch(maxPages)
        break
      case 'trending_day':
        tmdbMovies = await getTrendingMoviesBatch('day', maxPages)
        break
      case 'trending_week':
        tmdbMovies = await getTrendingMoviesBatch('week', maxPages)
        break
      case 'top_rated':
        tmdbMovies = await getTopRatedMoviesBatch(maxPages)
        break
    }
    
    rawItems = tmdbMovies.slice(0, limit).map(m => ({
      tmdbId: m.id,
      imdbId: null, // TMDB list results don't include IMDB ID
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.split('-')[0]) : null,
      posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      overview: m.overview,
      voteAverage: m.vote_average,
      genreIds: m.genre_ids || [],
      originalLanguage: m.original_language || null,
    }))
  }

  // Apply language filter if specified
  if (languages.length > 0) {
    rawItems = rawItems.filter(item => {
      if (!item.originalLanguage) {
        // Include items with unknown language if configured to do so
        return includeUnknownLanguage
      }
      return languages.includes(item.originalLanguage)
    })
    logger.debug({ languages, includeUnknownLanguage, filteredCount: rawItems.length }, 'Applied language filter to movies')
  }

  if (rawItems.length === 0) {
    return { matched: [], missing: [], source, mediaType: 'movies' }
  }

  // Check which items are in the library by TMDB ID (primary lookup)
  const tmdbIds = rawItems.map(item => String(item.tmdbId))
  const libraryResult = await query<{ id: string; tmdb_id: string | null; imdb_id: string | null; poster_url: string | null }>(
    `SELECT id, tmdb_id, imdb_id, poster_url FROM movies WHERE tmdb_id = ANY($1)`,
    [tmdbIds]
  )
  
  const libraryMap = new Map<string, { id: string; posterUrl: string | null }>()
  for (const row of libraryResult.rows) {
    if (row.tmdb_id) libraryMap.set(row.tmdb_id, { id: row.id, posterUrl: row.poster_url })
  }

  // For items not matched by TMDB ID, try matching by IMDB ID
  const unmatchedWithImdb = rawItems.filter(item => !libraryMap.has(String(item.tmdbId)) && item.imdbId)
  if (unmatchedWithImdb.length > 0) {
    const imdbIds = unmatchedWithImdb.map(item => item.imdbId!)
    const imdbResult = await query<{ id: string; tmdb_id: string | null; imdb_id: string | null; poster_url: string | null }>(
      `SELECT id, tmdb_id, imdb_id, poster_url FROM movies WHERE imdb_id = ANY($1)`,
      [imdbIds]
    )
    
    // Create a map of IMDB ID to library data
    const imdbLibraryMap = new Map<string, { id: string; posterUrl: string | null }>()
    for (const row of imdbResult.rows) {
      if (row.imdb_id) imdbLibraryMap.set(row.imdb_id, { id: row.id, posterUrl: row.poster_url })
    }
    
    // Add matches found by IMDB ID to the main library map (keyed by TMDB ID)
    for (const item of unmatchedWithImdb) {
      const libraryData = imdbLibraryMap.get(item.imdbId!)
      if (libraryData) {
        libraryMap.set(String(item.tmdbId), libraryData)
        logger.debug({ tmdbId: item.tmdbId, imdbId: item.imdbId, title: item.title }, 'Matched movie by IMDB ID fallback')
      }
    }
  }

  // For MDBList items without poster URLs, use MDBList batch API to get posters
  const posterUrlMap = new Map<number, string>()
  if (effectiveSource === 'mdblist') {
    const itemsNeedingPosters = rawItems.filter(item => !item.posterUrl)
    if (itemsNeedingPosters.length > 0) {
      const { getMediaInfoByTmdbBatch } = await import('../mdblist/provider.js')
      const tmdbIdsForPosters = itemsNeedingPosters.map(item => String(item.tmdbId))
      const mediaInfoList = await getMediaInfoByTmdbBatch(tmdbIdsForPosters, 'movie')
      for (const info of mediaInfoList) {
        if (info.tmdbid && info.poster) {
          posterUrlMap.set(info.tmdbid, info.poster)
        }
      }
    }
  }

  // Split into matched and missing
  const matched: PreviewItem[] = []
  const missing: PreviewItem[] = []
  
  rawItems.forEach((item, index) => {
    const libraryData = libraryMap.get(String(item.tmdbId))
    const previewItem: PreviewItem = {
      id: libraryData?.id || null,
      tmdbId: item.tmdbId,
      title: item.title,
      year: item.year,
      // Use library poster for matched, external poster for TMDB sources, or fetched poster for MDBList
      posterUrl: libraryData?.posterUrl || item.posterUrl || posterUrlMap.get(item.tmdbId) || null,
      rank: index + 1,
      inLibrary: !!libraryData,
      overview: item.overview,
      voteAverage: item.voteAverage,
      genreIds: item.genreIds,
      originalLanguage: item.originalLanguage,
    }
    
    if (libraryData) {
      matched.push(previewItem)
    } else {
      missing.push(previewItem)
    }
  })

  logger.info({ source, total: rawItems.length, matched: matched.length, missing: missing.length }, 'Movies preview complete')

  return { matched, missing, source, mediaType: 'movies' }
}

/**
 * Get preview of top series from an external source (TMDB or MDBList)
 * Returns both matched (in library) and missing items
 */
export async function getTopSeriesPreview(
  source: PopularitySource,
  options: {
    limit?: number
    hybridExternalSource?: HybridExternalSource
    mdblistListId?: number
    mdblistSort?: string
    languages?: string[]
    includeUnknownLanguage?: boolean
  } = {}
): Promise<PreviewResult> {
  const { limit = 100, hybridExternalSource, mdblistListId, mdblistSort = 'score', languages = [], includeUnknownLanguage = true } = options

  logger.info({ source, limit, languages }, 'Getting top series preview')

  // For emby_history, we only have library items (no "missing" concept)
  if (source === 'emby_history') {
    const series = await getTopSeries({ 
      seriesPopularitySource: source, 
      seriesCount: limit,
      seriesUseAllMatches: false,
    })
    return {
      matched: series.map(s => ({
        id: s.seriesId,
        tmdbId: 0,
        title: s.title,
        year: s.year,
        posterUrl: s.posterUrl,
        rank: s.rank,
        inLibrary: true,
        overview: s.overview,
        voteAverage: s.communityRating,
        genreIds: [], // Genre IDs not available for local source
        originalLanguage: null, // Not available for local source
      })),
      missing: [],
      source,
      mediaType: 'series',
    }
  }

  // For hybrid, use the external source component
  const effectiveSource = source === 'hybrid' 
    ? (hybridExternalSource || 'tmdb_popular') 
    : source

  // Fetch raw items from external source
  interface RawItem {
    tmdbId: number
    imdbId: string | null
    tvdbId: number | null
    title: string
    year: number | null
    posterUrl: string | null
    overview: string | null
    voteAverage: number | null
    genreIds: number[]
    originalLanguage: string | null
  }
  let rawItems: RawItem[] = []

  if (effectiveSource === 'mdblist' && mdblistListId) {
    const mdblistItems = await getListItems(mdblistListId, { limit, sort: mdblistSort })
    rawItems = mdblistItems
      .filter(item => item.tmdbid)
      .map(item => ({
        tmdbId: item.tmdbid!,
        imdbId: item.imdbid || null,
        tvdbId: item.tvdbid || null,
        title: item.title || 'Unknown',
        year: item.year || null,
        posterUrl: null, // MDBList items don't have poster URLs in list response
        overview: item.description || null,
        voteAverage: item.score || null,
        genreIds: [], // MDBList doesn't provide genre IDs in list response
        originalLanguage: null, // MDBList doesn't provide language in list response
      }))
  } else if (effectiveSource.startsWith('tmdb_')) {
    const tmdbSource = effectiveSource.replace('tmdb_', '') as TMDBSourceType
    const maxPages = Math.ceil((limit * 2) / 20)
    
    let tmdbSeries: TMDbTVResult[] = []
    switch (tmdbSource) {
      case 'popular':
        tmdbSeries = await getPopularTVBatch(maxPages)
        break
      case 'trending_day':
        tmdbSeries = await getTrendingTVBatch('day', maxPages)
        break
      case 'trending_week':
        tmdbSeries = await getTrendingTVBatch('week', maxPages)
        break
      case 'top_rated':
        tmdbSeries = await getTopRatedTVBatch(maxPages)
        break
    }
    
    rawItems = tmdbSeries.slice(0, limit).map(s => ({
      tmdbId: s.id,
      imdbId: null, // TMDB list results don't include IMDB ID
      tvdbId: null, // TMDB list results don't include TVDB ID
      title: s.name,
      year: s.first_air_date ? parseInt(s.first_air_date.split('-')[0]) : null,
      posterUrl: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null,
      overview: s.overview,
      voteAverage: s.vote_average,
      genreIds: s.genre_ids || [],
      originalLanguage: s.original_language || null,
    }))
  }

  // Apply language filter if specified
  if (languages.length > 0) {
    rawItems = rawItems.filter(item => {
      if (!item.originalLanguage) {
        // Include items with unknown language if configured to do so
        return includeUnknownLanguage
      }
      return languages.includes(item.originalLanguage)
    })
    logger.debug({ languages, includeUnknownLanguage, filteredCount: rawItems.length }, 'Applied language filter to series')
  }

  if (rawItems.length === 0) {
    return { matched: [], missing: [], source, mediaType: 'series' }
  }

  // Check which items are in the library by TMDB ID (primary lookup)
  const tmdbIds = rawItems.map(item => String(item.tmdbId))
  const libraryResult = await query<{ id: string; tmdb_id: string | null; imdb_id: string | null; tvdb_id: string | null; poster_url: string | null }>(
    `SELECT id, tmdb_id, imdb_id, tvdb_id, poster_url FROM series WHERE tmdb_id = ANY($1)`,
    [tmdbIds]
  )
  
  const libraryMap = new Map<string, { id: string; posterUrl: string | null }>()
  for (const row of libraryResult.rows) {
    if (row.tmdb_id) libraryMap.set(row.tmdb_id, { id: row.id, posterUrl: row.poster_url })
  }

  // For items not matched by TMDB ID, try matching by IMDB ID
  const unmatchedWithImdb = rawItems.filter(item => !libraryMap.has(String(item.tmdbId)) && item.imdbId)
  if (unmatchedWithImdb.length > 0) {
    const imdbIds = unmatchedWithImdb.map(item => item.imdbId!)
    const imdbResult = await query<{ id: string; tmdb_id: string | null; imdb_id: string | null; poster_url: string | null }>(
      `SELECT id, tmdb_id, imdb_id, poster_url FROM series WHERE imdb_id = ANY($1)`,
      [imdbIds]
    )
    
    // Create a map of IMDB ID to library data
    const imdbLibraryMap = new Map<string, { id: string; posterUrl: string | null }>()
    for (const row of imdbResult.rows) {
      if (row.imdb_id) imdbLibraryMap.set(row.imdb_id, { id: row.id, posterUrl: row.poster_url })
    }
    
    // Add matches found by IMDB ID to the main library map (keyed by TMDB ID)
    for (const item of unmatchedWithImdb) {
      const libraryData = imdbLibraryMap.get(item.imdbId!)
      if (libraryData) {
        libraryMap.set(String(item.tmdbId), libraryData)
        logger.debug({ tmdbId: item.tmdbId, imdbId: item.imdbId, title: item.title }, 'Matched series by IMDB ID fallback')
      }
    }
  }

  // For items still not matched, try matching by TVDB ID
  const unmatchedWithTvdb = rawItems.filter(item => !libraryMap.has(String(item.tmdbId)) && item.tvdbId)
  if (unmatchedWithTvdb.length > 0) {
    const tvdbIds = unmatchedWithTvdb.map(item => String(item.tvdbId!))
    const tvdbResult = await query<{ id: string; tmdb_id: string | null; tvdb_id: string | null; poster_url: string | null }>(
      `SELECT id, tmdb_id, tvdb_id, poster_url FROM series WHERE tvdb_id = ANY($1)`,
      [tvdbIds]
    )
    
    // Create a map of TVDB ID to library data
    const tvdbLibraryMap = new Map<string, { id: string; posterUrl: string | null }>()
    for (const row of tvdbResult.rows) {
      if (row.tvdb_id) tvdbLibraryMap.set(row.tvdb_id, { id: row.id, posterUrl: row.poster_url })
    }
    
    // Add matches found by TVDB ID to the main library map (keyed by TMDB ID)
    for (const item of unmatchedWithTvdb) {
      const libraryData = tvdbLibraryMap.get(String(item.tvdbId!))
      if (libraryData) {
        libraryMap.set(String(item.tmdbId), libraryData)
        logger.debug({ tmdbId: item.tmdbId, tvdbId: item.tvdbId, title: item.title }, 'Matched series by TVDB ID fallback')
      }
    }
  }

  // For MDBList items without poster URLs, use MDBList batch API to get posters
  const posterUrlMap = new Map<number, string>()
  if (effectiveSource === 'mdblist') {
    const itemsNeedingPosters = rawItems.filter(item => !item.posterUrl)
    if (itemsNeedingPosters.length > 0) {
      const { getMediaInfoByTmdbBatch } = await import('../mdblist/provider.js')
      const tmdbIdsForPosters = itemsNeedingPosters.map(item => String(item.tmdbId))
      const mediaInfoList = await getMediaInfoByTmdbBatch(tmdbIdsForPosters, 'show')
      for (const info of mediaInfoList) {
        if (info.tmdbid && info.poster) {
          posterUrlMap.set(info.tmdbid, info.poster)
        }
      }
    }
  }

  // Split into matched and missing
  const matched: PreviewItem[] = []
  const missing: PreviewItem[] = []
  
  rawItems.forEach((item, index) => {
    const libraryData = libraryMap.get(String(item.tmdbId))
      || (item.imdbId ? libraryMap.get(item.imdbId) : undefined)
      || (item.tvdbId ? libraryMap.get(String(item.tvdbId)) : undefined)
    const previewItem: PreviewItem = {
      id: libraryData?.id || null,
      tmdbId: item.tmdbId,
      title: item.title,
      year: item.year,
      // Use library poster for matched, external poster for TMDB sources, or fetched poster for MDBList
      posterUrl: libraryData?.posterUrl || item.posterUrl || posterUrlMap.get(item.tmdbId) || null,
      rank: index + 1,
      inLibrary: !!libraryData,
      overview: item.overview,
      voteAverage: item.voteAverage,
      genreIds: item.genreIds,
      originalLanguage: item.originalLanguage,
    }
    
    if (libraryData) {
      matched.push(previewItem)
    } else {
      missing.push(previewItem)
    }
  })

  logger.info({ source, total: rawItems.length, matched: matched.length, missing: missing.length }, 'Series preview complete')

  return { matched, missing, source, mediaType: 'series' }
}
