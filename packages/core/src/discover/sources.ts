/**
 * Discovery Sources
 * 
 * Fetches candidate content from external integrations (TMDb, Trakt, MDBList)
 */

import { createChildLogger } from '../lib/logger.js'
import { query } from '../lib/db.js'
import {
  getMovieRecommendationsBatch,
  getSimilarMoviesBatch,
  getTVRecommendationsBatch,
  getSimilarTVBatch,
  discoverMovies,
  discoverTV,
  normalizeMovieResult,
  normalizeTVResult,
  extractYear,
  getMovieDetails,
  getMovieCredits,
  getTVDetails,
  getTVExternalIds,
  getTVCredits,
} from '../tmdb/index.js'
import {
  getTrendingMovies,
  getPopularMovies,
  getRecommendedMovies,
  getTrendingShows,
  getPopularShows,
  getRecommendedShows,
  isTraktConfigured,
  getUserTraktTokens,
} from '../trakt/index.js'
import type { MediaType, RawCandidate, DiscoverySource, DiscoveryConfig, CastMember } from './types.js'

const logger = createChildLogger('discover:sources')

/**
 * Fetch candidates from TMDb recommendations (based on user's watched content)
 */
async function fetchTmdbRecommendations(
  userId: string,
  mediaType: MediaType,
  config: DiscoveryConfig
): Promise<RawCandidate[]> {
  const candidates: RawCandidate[] = []
  
  // Get user's top-rated or most recently watched content
  // Movies are joined directly, series need to go through episodes
  let watchedResult: { rows: { tmdb_id: string | null }[] }
  
  if (mediaType === 'movie') {
    watchedResult = await query<{ tmdb_id: string | null }>(
      `SELECT m.tmdb_id 
       FROM watch_history wh
       JOIN movies m ON m.id = wh.movie_id
       WHERE wh.user_id = $1 
         AND wh.media_type = 'movie'
         AND m.tmdb_id IS NOT NULL
       GROUP BY m.tmdb_id
       ORDER BY MAX(wh.last_played_at) DESC
       LIMIT 10`,
      [userId]
    )
  } else {
    // For series, we need to join through episodes to get the series
    watchedResult = await query<{ tmdb_id: string | null }>(
      `SELECT s.tmdb_id 
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN series s ON s.id = e.series_id
       WHERE wh.user_id = $1 
         AND wh.media_type = 'episode'
         AND s.tmdb_id IS NOT NULL
       GROUP BY s.tmdb_id
       ORDER BY MAX(wh.last_played_at) DESC
       LIMIT 10`,
      [userId]
    )
  }

  const tmdbIds = watchedResult.rows
    .map(r => r.tmdb_id ? parseInt(r.tmdb_id, 10) : null)
    .filter((id): id is number => id !== null)

  if (tmdbIds.length === 0) {
    logger.debug({ userId, mediaType }, 'No watched content with TMDb IDs for recommendations')
    return []
  }

  // Fetch recommendations for each watched item
  for (const tmdbId of tmdbIds.slice(0, 5)) {
    try {
      if (mediaType === 'movie') {
        const results = await getMovieRecommendationsBatch(tmdbId, 2)
        for (const movie of results.slice(0, config.maxCandidatesPerSource / 5)) {
          const normalized = normalizeMovieResult(movie)
          candidates.push({
            tmdbId: normalized.tmdbId,
            imdbId: null,
            title: normalized.title,
            originalTitle: normalized.originalTitle,
            overview: movie.overview,
            releaseYear: normalized.releaseYear,
            posterPath: normalized.posterPath,
            backdropPath: normalized.backdropPath,
            genres: normalized.genres,
            voteAverage: normalized.voteAverage,
            voteCount: normalized.voteCount,
            popularity: normalized.popularity,
            source: 'tmdb_recommendations',
            sourceMediaId: tmdbId,
          })
        }
      } else {
        const results = await getTVRecommendationsBatch(tmdbId, 2)
        for (const tv of results.slice(0, config.maxCandidatesPerSource / 5)) {
          const normalized = normalizeTVResult(tv)
          candidates.push({
            tmdbId: normalized.tmdbId,
            imdbId: null,
            title: normalized.title,
            originalTitle: normalized.originalTitle,
            overview: tv.overview,
            releaseYear: normalized.releaseYear,
            posterPath: normalized.posterPath,
            backdropPath: normalized.backdropPath,
            genres: normalized.genres,
            voteAverage: normalized.voteAverage,
            voteCount: normalized.voteCount,
            popularity: normalized.popularity,
            source: 'tmdb_recommendations',
            sourceMediaId: tmdbId,
          })
        }
      }
    } catch (err) {
      logger.warn({ err, tmdbId, mediaType }, 'Failed to fetch TMDb recommendations')
    }
  }

  return candidates
}

/**
 * Fetch candidates from TMDb similar titles
 */
async function fetchTmdbSimilar(
  userId: string,
  mediaType: MediaType,
  config: DiscoveryConfig
): Promise<RawCandidate[]> {
  const candidates: RawCandidate[] = []
  
  const tableName = mediaType === 'movie' ? 'movies' : 'series'
  const idColumn = mediaType === 'movie' ? 'movie_id' : 'series_id'
  
  // Get highly rated items
  const ratedResult = await query<{ tmdb_id: string | null }>(
    `SELECT m.tmdb_id 
     FROM user_ratings ur
     JOIN ${tableName} m ON m.id = ur.${idColumn}
     WHERE ur.user_id = $1 
       AND ur.${idColumn} IS NOT NULL
       AND m.tmdb_id IS NOT NULL
       AND ur.rating >= 8
     GROUP BY m.tmdb_id
     ORDER BY MAX(ur.rating) DESC
     LIMIT 10`,
    [userId]
  )

  const tmdbIds = ratedResult.rows
    .map(r => r.tmdb_id ? parseInt(r.tmdb_id, 10) : null)
    .filter((id): id is number => id !== null)

  if (tmdbIds.length === 0) {
    logger.debug({ userId, mediaType }, 'No highly rated content for similar titles')
    return []
  }

  for (const tmdbId of tmdbIds.slice(0, 5)) {
    try {
      if (mediaType === 'movie') {
        const results = await getSimilarMoviesBatch(tmdbId, 2)
        for (const movie of results.slice(0, config.maxCandidatesPerSource / 5)) {
          const normalized = normalizeMovieResult(movie)
          candidates.push({
            tmdbId: normalized.tmdbId,
            imdbId: null,
            title: normalized.title,
            originalTitle: normalized.originalTitle,
            overview: movie.overview,
            releaseYear: normalized.releaseYear,
            posterPath: normalized.posterPath,
            backdropPath: normalized.backdropPath,
            genres: normalized.genres,
            voteAverage: normalized.voteAverage,
            voteCount: normalized.voteCount,
            popularity: normalized.popularity,
            source: 'tmdb_similar',
            sourceMediaId: tmdbId,
          })
        }
      } else {
        const results = await getSimilarTVBatch(tmdbId, 2)
        for (const tv of results.slice(0, config.maxCandidatesPerSource / 5)) {
          const normalized = normalizeTVResult(tv)
          candidates.push({
            tmdbId: normalized.tmdbId,
            imdbId: null,
            title: normalized.title,
            originalTitle: normalized.originalTitle,
            overview: tv.overview,
            releaseYear: normalized.releaseYear,
            posterPath: normalized.posterPath,
            backdropPath: normalized.backdropPath,
            genres: normalized.genres,
            voteAverage: normalized.voteAverage,
            voteCount: normalized.voteCount,
            popularity: normalized.popularity,
            source: 'tmdb_similar',
            sourceMediaId: tmdbId,
          })
        }
      }
    } catch (err) {
      logger.warn({ err, tmdbId, mediaType }, 'Failed to fetch TMDb similar')
    }
  }

  return candidates
}

/**
 * Fetch candidates from TMDb Discover (general popular content)
 */
async function fetchTmdbDiscover(
  mediaType: MediaType,
  config: DiscoveryConfig
): Promise<RawCandidate[]> {
  const candidates: RawCandidate[] = []

  try {
    if (mediaType === 'movie') {
      const result = await discoverMovies({
        sortBy: 'popularity.desc',
        minVoteCount: config.minVoteCount,
        minVoteAverage: config.minVoteAverage,
        page: 1,
      })
      
      if (result?.results) {
        for (const movie of result.results.slice(0, config.maxCandidatesPerSource)) {
          const normalized = normalizeMovieResult(movie)
          candidates.push({
            tmdbId: normalized.tmdbId,
            imdbId: null,
            title: normalized.title,
            originalTitle: normalized.originalTitle,
            overview: movie.overview,
            releaseYear: normalized.releaseYear,
            posterPath: normalized.posterPath,
            backdropPath: normalized.backdropPath,
            genres: normalized.genres,
            voteAverage: normalized.voteAverage,
            voteCount: normalized.voteCount,
            popularity: normalized.popularity,
            source: 'tmdb_discover',
          })
        }
      }
    } else {
      const result = await discoverTV({
        sortBy: 'popularity.desc',
        minVoteCount: config.minVoteCount,
        minVoteAverage: config.minVoteAverage,
        page: 1,
      })
      
      if (result?.results) {
        for (const tv of result.results.slice(0, config.maxCandidatesPerSource)) {
          const normalized = normalizeTVResult(tv)
          candidates.push({
            tmdbId: normalized.tmdbId,
            imdbId: null,
            title: normalized.title,
            originalTitle: normalized.originalTitle,
            overview: tv.overview,
            releaseYear: normalized.releaseYear,
            posterPath: normalized.posterPath,
            backdropPath: normalized.backdropPath,
            genres: normalized.genres,
            voteAverage: normalized.voteAverage,
            voteCount: normalized.voteCount,
            popularity: normalized.popularity,
            source: 'tmdb_discover',
          })
        }
      }
    }
  } catch (err) {
    logger.warn({ err, mediaType }, 'Failed to fetch TMDb discover')
  }

  return candidates
}

/**
 * Fetch candidates from Trakt trending
 */
async function fetchTraktTrending(
  mediaType: MediaType,
  config: DiscoveryConfig
): Promise<RawCandidate[]> {
  const candidates: RawCandidate[] = []

  if (!await isTraktConfigured()) {
    return []
  }

  try {
    if (mediaType === 'movie') {
      const results = await getTrendingMovies({ limit: config.maxCandidatesPerSource })
      for (const item of results) {
        if (!item.movie.ids.tmdb) continue
        candidates.push({
          tmdbId: item.movie.ids.tmdb,
          imdbId: item.movie.ids.imdb || null,
          title: item.movie.title,
          originalTitle: null,
          overview: null,
          releaseYear: item.movie.year,
          posterPath: null,
          backdropPath: null,
          genres: [],
          voteAverage: 0,
          voteCount: 0,
          popularity: item.watchers ?? 0,
          source: 'trakt_trending',
        })
      }
    } else {
      const results = await getTrendingShows({ limit: config.maxCandidatesPerSource })
      for (const item of results) {
        if (!item.show.ids.tmdb) continue
        candidates.push({
          tmdbId: item.show.ids.tmdb,
          imdbId: item.show.ids.imdb || null,
          title: item.show.title,
          originalTitle: null,
          overview: null,
          releaseYear: item.show.year,
          posterPath: null,
          backdropPath: null,
          genres: [],
          voteAverage: 0,
          voteCount: 0,
          popularity: item.watchers ?? 0,
          source: 'trakt_trending',
        })
      }
    }
  } catch (err) {
    logger.warn({ err, mediaType }, 'Failed to fetch Trakt trending')
  }

  return candidates
}

/**
 * Fetch candidates from Trakt popular
 */
async function fetchTraktPopular(
  mediaType: MediaType,
  config: DiscoveryConfig
): Promise<RawCandidate[]> {
  const candidates: RawCandidate[] = []

  if (!await isTraktConfigured()) {
    return []
  }

  try {
    if (mediaType === 'movie') {
      const results = await getPopularMovies({ limit: config.maxCandidatesPerSource })
      for (const movie of results) {
        if (!movie.ids.tmdb) continue
        candidates.push({
          tmdbId: movie.ids.tmdb,
          imdbId: movie.ids.imdb || null,
          title: movie.title,
          originalTitle: null,
          overview: null,
          releaseYear: movie.year,
          posterPath: null,
          backdropPath: null,
          genres: [],
          voteAverage: 0,
          voteCount: 0,
          popularity: 0,
          source: 'trakt_popular',
        })
      }
    } else {
      const results = await getPopularShows({ limit: config.maxCandidatesPerSource })
      for (const show of results) {
        if (!show.ids.tmdb) continue
        candidates.push({
          tmdbId: show.ids.tmdb,
          imdbId: show.ids.imdb || null,
          title: show.title,
          originalTitle: null,
          overview: null,
          releaseYear: show.year,
          posterPath: null,
          backdropPath: null,
          genres: [],
          voteAverage: 0,
          voteCount: 0,
          popularity: 0,
          source: 'trakt_popular',
        })
      }
    }
  } catch (err) {
    logger.warn({ err, mediaType }, 'Failed to fetch Trakt popular')
  }

  return candidates
}

/**
 * Fetch candidates from Trakt recommendations (personalized, requires user auth)
 * Note: Trakt /recommendations endpoint returns movies/shows directly, not wrapped
 */
async function fetchTraktRecommendations(
  userId: string,
  mediaType: MediaType,
  config: DiscoveryConfig
): Promise<RawCandidate[]> {
  const candidates: RawCandidate[] = []

  // Check if user has Trakt connected
  const tokens = await getUserTraktTokens(userId)
  if (!tokens) {
    return []
  }

  try {
    if (mediaType === 'movie') {
      const results = await getRecommendedMovies(userId, { limit: config.maxCandidatesPerSource })
      for (const item of results) {
        // Trakt recommendations return movies directly (not wrapped)
        const movie = 'movie' in item ? item.movie : item
        if (!movie?.ids?.tmdb) continue
        candidates.push({
          tmdbId: movie.ids.tmdb,
          imdbId: movie.ids?.imdb || null,
          title: movie.title,
          originalTitle: null,
          overview: null,
          releaseYear: movie.year,
          posterPath: null,
          backdropPath: null,
          genres: [],
          voteAverage: 0,
          voteCount: 0,
          popularity: 0,
          source: 'trakt_recommendations',
        })
      }
    } else {
      const results = await getRecommendedShows(userId, { limit: config.maxCandidatesPerSource })
      for (const item of results) {
        // Trakt recommendations return shows directly (not wrapped)
        const show = 'show' in item ? item.show : item
        if (!show?.ids?.tmdb) continue
        candidates.push({
          tmdbId: show.ids.tmdb,
          imdbId: show.ids?.imdb || null,
          title: show.title,
          originalTitle: null,
          overview: null,
          releaseYear: show.year,
          posterPath: null,
          backdropPath: null,
          genres: [],
          voteAverage: 0,
          voteCount: 0,
          popularity: 0,
          source: 'trakt_recommendations',
        })
      }
    }
  } catch (err) {
    logger.warn({ err, userId, mediaType }, 'Failed to fetch Trakt recommendations')
  }

  return candidates
}

interface EnrichedData {
  imdbId: string | null
  posterPath: string | null
  backdropPath: string | null
  overview: string | null
  voteAverage: number
  voteCount: number
  genres: number[]
  castMembers: CastMember[]
  directors: string[]
  runtimeMinutes: number | null
  tagline: string | null
}

/**
 * Enrich candidates with missing data and cast/crew info from TMDb
 * This handles candidates from Trakt which don't include poster paths,
 * and fetches credits for all candidates for the detail popper
 */
async function enrichMissingData(
  candidates: RawCandidate[],
  mediaType: MediaType
): Promise<RawCandidate[]> {
  // Find candidates missing poster paths, IMDb IDs, or cast/crew info
  // For simplicity, we'll enrich all candidates that don't have cast info yet
  const needsEnrichment = candidates.filter(c => !c.posterPath || !c.imdbId || !c.castMembers?.length)
  
  if (needsEnrichment.length === 0) {
    return candidates
  }

  logger.info({ mediaType, count: needsEnrichment.length }, 'Enriching candidates with metadata and credits')

  // Create a map for quick lookup
  const enrichmentMap = new Map<number, EnrichedData>()

  // Batch fetch with concurrency limit (5 at a time to avoid rate limits)
  const batchSize = 5
  for (let i = 0; i < needsEnrichment.length; i += batchSize) {
    const batch = needsEnrichment.slice(i, i + batchSize)
    
    const results = await Promise.all(
      batch.map(async (candidate) => {
        try {
          if (mediaType === 'movie') {
            // Fetch both details and credits in parallel
            const [details, credits] = await Promise.all([
              getMovieDetails(candidate.tmdbId),
              getMovieCredits(candidate.tmdbId),
            ])
            if (details) {
              // Extract top cast members (up to 10)
              const castMembers: CastMember[] = (credits?.cast || [])
                .slice(0, 10)
                .map(c => ({
                  id: c.id,
                  name: c.name,
                  character: c.character,
                  profilePath: c.profile_path,
                }))
              
              // Extract directors from crew
              const directors = (credits?.crew || [])
                .filter(c => c.job === 'Director')
                .map(c => c.name)
                .filter((name, idx, arr) => arr.indexOf(name) === idx) // Dedupe

              return {
                tmdbId: candidate.tmdbId,
                imdbId: details.imdb_id,
                posterPath: details.poster_path,
                backdropPath: details.backdrop_path,
                overview: details.overview,
                voteAverage: details.vote_average,
                voteCount: details.vote_count,
                genres: details.genres?.map(g => g.id) || [],
                castMembers,
                directors,
                runtimeMinutes: details.runtime || null,
                tagline: details.tagline || null,
              }
            }
          } else {
            // For TV shows, fetch details, external IDs, and credits in parallel
            const [details, externalIds, credits] = await Promise.all([
              getTVDetails(candidate.tmdbId),
              getTVExternalIds(candidate.tmdbId),
              getTVCredits(candidate.tmdbId),
            ])
            if (details) {
              // Extract top cast members (up to 10)
              const castMembers: CastMember[] = (credits?.cast || [])
                .slice(0, 10)
                .map(c => ({
                  id: c.id,
                  name: c.name,
                  character: c.character,
                  profilePath: c.profile_path,
                }))
              
              // For TV, creators are like directors
              const directors = details.created_by?.map(c => c.name) || []

              return {
                tmdbId: candidate.tmdbId,
                imdbId: externalIds?.imdb_id || null,
                posterPath: details.poster_path,
                backdropPath: details.backdrop_path,
                overview: details.overview,
                voteAverage: details.vote_average,
                voteCount: details.vote_count,
                genres: details.genres?.map(g => g.id) || [],
                castMembers,
                directors,
                runtimeMinutes: details.episode_run_time?.[0] || null,
                tagline: details.tagline || null,
              }
            }
          }
        } catch (err) {
          logger.debug({ tmdbId: candidate.tmdbId, err }, 'Failed to fetch details for candidate')
        }
        return null
      })
    )

    for (const result of results) {
      if (result) {
        enrichmentMap.set(result.tmdbId, {
          imdbId: result.imdbId,
          posterPath: result.posterPath,
          backdropPath: result.backdropPath,
          overview: result.overview,
          voteAverage: result.voteAverage,
          voteCount: result.voteCount,
          genres: result.genres,
          castMembers: result.castMembers,
          directors: result.directors,
          runtimeMinutes: result.runtimeMinutes,
          tagline: result.tagline,
        })
      }
    }
  }

  logger.info({ mediaType, enriched: enrichmentMap.size }, 'Finished enriching candidate data with credits')

  // Update candidates with enriched data
  return candidates.map(candidate => {
    const enriched = enrichmentMap.get(candidate.tmdbId)
    if (enriched) {
      return {
        ...candidate,
        imdbId: enriched.imdbId ?? candidate.imdbId,
        posterPath: enriched.posterPath ?? candidate.posterPath,
        backdropPath: enriched.backdropPath ?? candidate.backdropPath,
        overview: enriched.overview ?? candidate.overview,
        voteAverage: enriched.voteAverage || candidate.voteAverage,
        voteCount: enriched.voteCount || candidate.voteCount,
        genres: enriched.genres.length > 0 ? enriched.genres : candidate.genres,
        castMembers: enriched.castMembers,
        directors: enriched.directors,
        runtimeMinutes: enriched.runtimeMinutes,
        tagline: enriched.tagline,
      } as RawCandidate
    }
    return candidate
  })
}

/**
 * Fetch all candidates from enabled sources
 */
export async function fetchAllCandidates(
  userId: string,
  mediaType: MediaType,
  config: DiscoveryConfig
): Promise<RawCandidate[]> {
  logger.info({ userId, mediaType }, 'Fetching candidates from all sources')

  // Fetch from all sources in parallel
  const [
    tmdbRecommendations,
    tmdbSimilar,
    tmdbDiscover,
    traktTrending,
    traktPopular,
    traktRecommendations,
  ] = await Promise.all([
    fetchTmdbRecommendations(userId, mediaType, config),
    fetchTmdbSimilar(userId, mediaType, config),
    fetchTmdbDiscover(mediaType, config),
    fetchTraktTrending(mediaType, config),
    fetchTraktPopular(mediaType, config),
    fetchTraktRecommendations(userId, mediaType, config),
  ])

  const allCandidates = [
    ...tmdbRecommendations,
    ...tmdbSimilar,
    ...tmdbDiscover,
    ...traktTrending,
    ...traktPopular,
    ...traktRecommendations,
  ]

  logger.info({
    userId,
    mediaType,
    sources: {
      tmdbRecommendations: tmdbRecommendations.length,
      tmdbSimilar: tmdbSimilar.length,
      tmdbDiscover: tmdbDiscover.length,
      traktTrending: traktTrending.length,
      traktPopular: traktPopular.length,
      traktRecommendations: traktRecommendations.length,
    },
    total: allCandidates.length,
  }, 'Fetched candidates from all sources')

  // Enrich candidates missing poster paths or IMDb IDs (e.g., from Trakt)
  const enrichedCandidates = await enrichMissingData(allCandidates, mediaType)

  return enrichedCandidates
}

/**
 * Check if any discovery sources are available
 */
export async function hasDiscoverySources(): Promise<boolean> {
  // TMDb is always available if configured
  // For now, we'll assume TMDb is the primary requirement
  // We could also check Trakt, MDBList, etc.
  return true
}

