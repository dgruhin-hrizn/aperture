/**
 * Metadata Enrichment Module
 *
 * Enriches movies and series with data from TMDb and OMDb:
 * - TMDb: Keywords, collections/franchises, expanded crew
 * - OMDb: Rotten Tomatoes scores, Metacritic, awards
 *
 * PERFORMANCE OPTIMIZED:
 * - TMDb and OMDb calls made in parallel per item
 * - Multiple items processed concurrently (within API rate limits)
 * - TMDb: ~40 req/sec (limit is ~50)
 * - OMDb: ~10 req/sec (conservative for free tier)
 */

import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import {
  createJobProgress,
  updateJobProgress,
  setJobStep,
  completeJob,
  failJob,
  isJobCancelled,
  addLog,
} from '../jobs/progress.js'
import { getTMDbConfig, getOMDbConfig } from '../settings/systemSettings.js'
import {
  getMovieEnrichmentData,
  getCollectionData,
  type CollectionData,
  type ApiLogCallback,
} from '../tmdb/index.js'
import { getSeriesEnrichmentData } from '../tmdb/series.js'
import { getRatingsData } from '../omdb/ratings.js'

const logger = createChildLogger('enrichment')

// ============================================================================
// PERFORMANCE TUNING CONSTANTS
// ============================================================================
// These control how aggressively we call external APIs.
// Increase CONCURRENCY for faster processing, decrease if hitting rate limits.

/** Number of items to process concurrently */
const CONCURRENCY = 5

/** Number of items to fetch per database query */
const BATCH_SIZE = 100

/**
 * Create a logging callback for API calls during enrichment
 */
function createApiLogger(jobId: string, itemTitle: string): ApiLogCallback {
  return (service, endpoint, status, details) => {
    const serviceLabel = service.toUpperCase()
    const statusIcon = status === 'success' ? '✓' : status === 'not_found' ? '○' : '✗'
    const detailsSuffix = details ? ` (${details})` : ''
    
    // Only log API calls for verbose debugging - we log per-item summaries instead
    // But we do log errors and not_found for visibility
    if (status === 'error') {
      addLog(jobId, 'warn', `${serviceLabel} ${statusIcon} ${endpoint}${detailsSuffix}`)
    }
  }
}

// ============================================================================
// Types
// ============================================================================

interface EnrichmentProgress {
  moviesProcessed: number
  moviesEnriched: number
  moviesFailed: number
  seriesProcessed: number
  seriesEnriched: number
  seriesFailed: number
  collectionsCreated: number
}

interface MovieToEnrich {
  id: string
  title: string
  tmdb_id: string | null
  imdb_id: string | null
}

interface SeriesToEnrich {
  id: string
  title: string
  tmdb_id: string | null
  imdb_id: string | null
  tvdb_id: string | null
}

// ============================================================================
// Movie Enrichment
// ============================================================================

/**
 * Get movies that need enrichment (missing keywords or RT scores)
 */
async function getMoviesNeedingEnrichment(limit: number = 100): Promise<MovieToEnrich[]> {
  const result = await query<MovieToEnrich>(
    `SELECT id, title, tmdb_id, imdb_id
     FROM movies
     WHERE enriched_at IS NULL
       AND (imdb_id IS NOT NULL OR tmdb_id IS NOT NULL)
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  )
  return result.rows
}

/**
 * Enrich a single movie with TMDb and OMDb data
 * OPTIMIZED: TMDb and OMDb calls are made in parallel
 */
async function enrichMovie(
  movie: MovieToEnrich,
  tmdbEnabled: boolean,
  omdbEnabled: boolean,
  collectionsToCreate: Map<number, CollectionData>,
  jobId: string
): Promise<boolean> {
  const onLog = createApiLogger(jobId, movie.title)
  const apiResults: string[] = []

  // Prepare parallel API calls
  const tmdbPromise =
    tmdbEnabled && (movie.tmdb_id || movie.imdb_id)
      ? (async () => {
          try {
            const tmdbId = movie.tmdb_id ? parseInt(movie.tmdb_id, 10) : null
            const data = await getMovieEnrichmentData(tmdbId, movie.imdb_id, { onLog })
            if (data) {
              const info: string[] = []
              if (data.keywords?.length) info.push(`${data.keywords.length} keywords`)
              if (data.collectionName) info.push(`collection: ${data.collectionName}`)
              apiResults.push(`TMDb: ${info.length > 0 ? info.join(', ') : 'no data'}`)
            } else {
              apiResults.push('TMDb: not found')
            }
            return data
          } catch (err) {
            logger.warn({ err, movieId: movie.id, title: movie.title }, 'Failed to fetch TMDb data')
            apiResults.push('TMDb: error')
            return null
          }
        })()
      : Promise.resolve(null)

  const omdbPromise =
    omdbEnabled && movie.imdb_id
      ? (async () => {
          try {
            const data = await getRatingsData(movie.imdb_id!, { onLog })
            if (data) {
              const info: string[] = []
              if (data.rtCriticScore != null) info.push(`RT: ${data.rtCriticScore}%`)
              if (data.metacriticScore != null) info.push(`MC: ${data.metacriticScore}`)
              apiResults.push(`OMDb: ${info.length > 0 ? info.join(', ') : 'no scores'}`)
            } else {
              apiResults.push('OMDb: not found')
            }
            return data
          } catch (err) {
            logger.warn({ err, movieId: movie.id, title: movie.title }, 'Failed to fetch OMDb data')
            apiResults.push('OMDb: error')
            return null
          }
        })()
      : Promise.resolve(null)

  // Execute both API calls in parallel
  const [tmdbData, omdbData] = await Promise.all([tmdbPromise, omdbPromise])

  // Log API results summary for this movie
  if (apiResults.length > 0) {
    addLog(jobId, 'debug', `📽 ${movie.title}: ${apiResults.join(' | ')}`)
  }

  // If we got collection data, queue it for creation
  if (tmdbData?.collectionId && tmdbData?.collectionName) {
    if (!collectionsToCreate.has(tmdbData.collectionId)) {
      const collectionData = await getCollectionData(tmdbData.collectionId, { onLog })
      if (collectionData) {
        collectionsToCreate.set(tmdbData.collectionId, collectionData)
      }
    }
  }

  // Update movie in database
  try {
    await query(
      `UPDATE movies SET
         keywords = COALESCE($2, keywords),
         collection_id = COALESCE($3, collection_id),
         collection_name = COALESCE($4, collection_name),
         cinematographers = COALESCE($5, cinematographers),
         composers = COALESCE($6, composers),
         editors = COALESCE($7, editors),
         rt_critic_score = COALESCE($8, rt_critic_score),
         rt_audience_score = COALESCE($9, rt_audience_score),
         metacritic_score = COALESCE($10, metacritic_score),
         awards_summary = COALESCE($11, awards_summary),
         enriched_at = NOW()
       WHERE id = $1`,
      [
        movie.id,
        tmdbData?.keywords ?? null,
        tmdbData?.collectionId?.toString() ?? null,
        tmdbData?.collectionName ?? null,
        tmdbData?.cinematographers ?? null,
        tmdbData?.composers ?? null,
        tmdbData?.editors ?? null,
        omdbData?.rtCriticScore ?? null,
        omdbData?.rtAudienceScore ?? null,
        omdbData?.metacriticScore ?? null,
        omdbData?.awardsSummary ?? null,
      ]
    )
    return true
  } catch (err) {
    logger.error({ err, movieId: movie.id }, 'Failed to update movie with enrichment data')
    return false
  }
}

// ============================================================================
// Series Enrichment
// ============================================================================

/**
 * Get series that need enrichment
 */
async function getSeriesNeedingEnrichment(limit: number = 100): Promise<SeriesToEnrich[]> {
  const result = await query<SeriesToEnrich>(
    `SELECT id, title, tmdb_id, imdb_id, tvdb_id
     FROM series
     WHERE enriched_at IS NULL
       AND (imdb_id IS NOT NULL OR tmdb_id IS NOT NULL OR tvdb_id IS NOT NULL)
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  )
  return result.rows
}

/**
 * Enrich a single series with TMDb and OMDb data
 * OPTIMIZED: TMDb and OMDb calls are made in parallel
 */
async function enrichSeries(
  series: SeriesToEnrich,
  tmdbEnabled: boolean,
  omdbEnabled: boolean,
  jobId: string
): Promise<boolean> {
  const onLog = createApiLogger(jobId, series.title)
  const apiResults: string[] = []

  // Prepare parallel API calls
  const tmdbPromise =
    tmdbEnabled && (series.tmdb_id || series.imdb_id || series.tvdb_id)
      ? (async () => {
          try {
            const tmdbId = series.tmdb_id ? parseInt(series.tmdb_id, 10) : null
            const data = await getSeriesEnrichmentData(tmdbId, series.imdb_id, series.tvdb_id, {
              onLog,
            })
            if (data) {
              const info: string[] = []
              if (data.keywords?.length) info.push(`${data.keywords.length} keywords`)
              apiResults.push(`TMDb: ${info.length > 0 ? info.join(', ') : 'no data'}`)
            } else {
              apiResults.push('TMDb: not found')
            }
            return data
          } catch (err) {
            logger.warn(
              { err, seriesId: series.id, title: series.title },
              'Failed to fetch TMDb data'
            )
            apiResults.push('TMDb: error')
            return null
          }
        })()
      : Promise.resolve(null)

  const omdbPromise =
    omdbEnabled && series.imdb_id
      ? (async () => {
          try {
            const data = await getRatingsData(series.imdb_id!, { onLog })
            if (data) {
              const info: string[] = []
              if (data.rtCriticScore != null) info.push(`RT: ${data.rtCriticScore}%`)
              if (data.metacriticScore != null) info.push(`MC: ${data.metacriticScore}`)
              apiResults.push(`OMDb: ${info.length > 0 ? info.join(', ') : 'no scores'}`)
            } else {
              apiResults.push('OMDb: not found')
            }
            return data
          } catch (err) {
            logger.warn(
              { err, seriesId: series.id, title: series.title },
              'Failed to fetch OMDb data'
            )
            apiResults.push('OMDb: error')
            return null
          }
        })()
      : Promise.resolve(null)

  // Execute both API calls in parallel
  const [tmdbData, omdbData] = await Promise.all([tmdbPromise, omdbPromise])

  // Log API results summary for this series
  if (apiResults.length > 0) {
    addLog(jobId, 'debug', `📺 ${series.title}: ${apiResults.join(' | ')}`)
  }

  // Update series in database
  try {
    await query(
      `UPDATE series SET
         keywords = COALESCE($2, keywords),
         rt_critic_score = COALESCE($3, rt_critic_score),
         rt_audience_score = COALESCE($4, rt_audience_score),
         metacritic_score = COALESCE($5, metacritic_score),
         awards_summary = COALESCE($6, awards_summary),
         enriched_at = NOW()
       WHERE id = $1`,
      [
        series.id,
        tmdbData?.keywords ?? null,
        omdbData?.rtCriticScore ?? null,
        omdbData?.rtAudienceScore ?? null,
        omdbData?.metacriticScore ?? null,
        omdbData?.awardsSummary ?? null,
      ]
    )
    return true
  } catch (err) {
    logger.error({ err, seriesId: series.id }, 'Failed to update series with enrichment data')
    return false
  }
}

// ============================================================================
// Collection Management
// ============================================================================

/**
 * Create or update a collection in the database
 */
async function upsertCollection(data: CollectionData): Promise<void> {
  await query(
    `INSERT INTO collections (tmdb_id, name, overview, poster_url, backdrop_url, enriched_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (tmdb_id) DO UPDATE SET
       name = EXCLUDED.name,
       overview = EXCLUDED.overview,
       poster_url = EXCLUDED.poster_url,
       backdrop_url = EXCLUDED.backdrop_url,
       enriched_at = NOW()`,
    [
      data.tmdbId.toString(),
      data.name,
      data.overview,
      data.posterUrl,
      data.backdropUrl,
    ]
  )
}

/**
 * Update movie count for all collections
 */
async function updateCollectionCounts(): Promise<void> {
  await query(
    `UPDATE collections c SET
       movie_count = (
         SELECT COUNT(*) FROM movies m
         WHERE m.collection_id = c.tmdb_id
       )`
  )
}

// ============================================================================
// Concurrent Processing Helper
// ============================================================================

/**
 * Process items with limited concurrency
 * Respects API rate limits by processing only N items at a time
 */
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>,
  shouldCancel?: () => boolean
): Promise<R[]> {
  const results: R[] = []
  let index = 0

  async function processNext(): Promise<void> {
    while (index < items.length) {
      if (shouldCancel?.()) break
      const currentIndex = index++
      const result = await processor(items[currentIndex])
      results[currentIndex] = result
    }
  }

  // Start N concurrent workers
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => processNext())

  await Promise.all(workers)
  return results
}

// ============================================================================
// Main Enrichment Job
// ============================================================================

/**
 * Run the full enrichment process for movies and series
 *
 * OPTIMIZED:
 * - TMDb and OMDb calls made in parallel per item
 * - Multiple items processed concurrently (CONCURRENCY setting)
 * - Larger batch sizes for fewer DB queries
 */
export async function enrichMetadata(jobId: string): Promise<EnrichmentProgress> {
  const progress: EnrichmentProgress = {
    moviesProcessed: 0,
    moviesEnriched: 0,
    moviesFailed: 0,
    seriesProcessed: 0,
    seriesEnriched: 0,
    seriesFailed: 0,
    collectionsCreated: 0,
  }

  // Check if TMDb and OMDb are configured
  const tmdbConfig = await getTMDbConfig()
  const omdbConfig = await getOMDbConfig()
  const tmdbEnabled = tmdbConfig.enabled && tmdbConfig.hasApiKey
  const omdbEnabled = omdbConfig.enabled && omdbConfig.hasApiKey

  if (!tmdbEnabled && !omdbEnabled) {
    logger.warn('Neither TMDb nor OMDb is configured - skipping enrichment')
    return progress
  }

  createJobProgress(jobId, 'enrich-metadata', 3) // 3 steps: movies, series, collections

  try {
    // Get counts for progress tracking
    const movieCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM movies WHERE enriched_at IS NULL AND (imdb_id IS NOT NULL OR tmdb_id IS NOT NULL)`
    )
    const seriesCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM series WHERE enriched_at IS NULL AND (imdb_id IS NOT NULL OR tmdb_id IS NOT NULL OR tvdb_id IS NOT NULL)`
    )

    const totalMovies = parseInt(movieCount?.count || '0', 10)
    const totalSeries = parseInt(seriesCount?.count || '0', 10)
    const totalItems = totalMovies + totalSeries

    if (totalItems === 0) {
      addLog(jobId, 'info', 'No items need enrichment')
      completeJob(jobId, { progress })
      return progress
    }

    const startTime = Date.now()
    logger.info(
      { totalMovies, totalSeries, tmdbEnabled, omdbEnabled, concurrency: CONCURRENCY },
      'Starting metadata enrichment'
    )

    // Log which metadata services are enabled
    const enabledServices: string[] = []
    if (tmdbEnabled) enabledServices.push('TMDb')
    if (omdbEnabled) enabledServices.push('OMDb')
    addLog(jobId, 'info', `Metadata services enabled: ${enabledServices.join(', ')}`)
    addLog(jobId, 'info', `Found ${totalMovies} movies and ${totalSeries} series to enrich`)
    addLog(jobId, 'info', `⚡ Performance: ${CONCURRENCY} concurrent items, parallel API calls`)

    const collectionsToCreate = new Map<number, CollectionData>()

    // Process movies with concurrency
    if (totalMovies > 0) {
      setJobStep(jobId, 0, 'Enriching movies', totalItems)

      while (true) {
        if (isJobCancelled(jobId)) {
          addLog(jobId, 'warn', 'Job cancelled by user')
          break
        }

        const movies = await getMoviesNeedingEnrichment(BATCH_SIZE)
        if (movies.length === 0) break

        // Process batch concurrently
        const results = await processWithConcurrency(
          movies,
          CONCURRENCY,
          async (movie) => {
            const success = await enrichMovie(
              movie,
              tmdbEnabled,
              omdbEnabled,
              collectionsToCreate,
              jobId
            )
            return success
          },
          () => isJobCancelled(jobId)
        )

        // Update progress
        for (const success of results) {
          progress.moviesProcessed++
          if (success) {
            progress.moviesEnriched++
          } else {
            progress.moviesFailed++
          }
        }

        updateJobProgress(jobId, progress.moviesProcessed, totalItems)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const rate = (progress.moviesProcessed / parseFloat(elapsed)).toFixed(1)
        addLog(
          jobId,
          'info',
          `📽 Movies: ${progress.moviesProcessed}/${totalMovies} (${rate}/sec, ${progress.moviesEnriched} enriched)`
        )
      }
    }

    // Process series with concurrency
    if (totalSeries > 0 && !isJobCancelled(jobId)) {
      setJobStep(jobId, 1, 'Enriching series', totalItems)

      while (true) {
        if (isJobCancelled(jobId)) {
          addLog(jobId, 'warn', 'Job cancelled by user')
          break
        }

        const seriesList = await getSeriesNeedingEnrichment(BATCH_SIZE)
        if (seriesList.length === 0) break

        // Process batch concurrently
        const results = await processWithConcurrency(
          seriesList,
          CONCURRENCY,
          async (series) => {
            const success = await enrichSeries(series, tmdbEnabled, omdbEnabled, jobId)
            return success
          },
          () => isJobCancelled(jobId)
        )

        // Update progress
        for (const success of results) {
          progress.seriesProcessed++
          if (success) {
            progress.seriesEnriched++
          } else {
            progress.seriesFailed++
          }
        }

        updateJobProgress(jobId, progress.moviesProcessed + progress.seriesProcessed, totalItems)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const totalProcessed = progress.moviesProcessed + progress.seriesProcessed
        const rate = (totalProcessed / parseFloat(elapsed)).toFixed(1)
        addLog(
          jobId,
          'info',
          `📺 Series: ${progress.seriesProcessed}/${totalSeries} (${rate}/sec overall, ${progress.seriesEnriched} enriched)`
        )
      }
    }

    // Create collections
    if (collectionsToCreate.size > 0 && !isJobCancelled(jobId)) {
      setJobStep(jobId, 2, 'Creating collections', collectionsToCreate.size)
      addLog(jobId, 'info', `Creating ${collectionsToCreate.size} collections...`)

      for (const [tmdbId, data] of collectionsToCreate) {
        try {
          await upsertCollection(data)
          progress.collectionsCreated++
        } catch (err) {
          logger.error({ err, tmdbId }, 'Failed to create collection')
        }
      }

      // Update movie counts
      await updateCollectionCounts()
    }

    // Complete job
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
    const totalProcessed = progress.moviesProcessed + progress.seriesProcessed
    const avgRate = (totalProcessed / parseFloat(totalDuration)).toFixed(1)

    const summary = `Enriched ${progress.moviesEnriched} movies (${progress.moviesFailed} failed), ${progress.seriesEnriched} series (${progress.seriesFailed} failed), created ${progress.collectionsCreated} collections in ${totalDuration}s (${avgRate}/sec)`
    addLog(jobId, 'info', `🎉 ${summary}`)
    completeJob(jobId, { progress })

    logger.info(progress, 'Metadata enrichment complete')
    return progress
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'Metadata enrichment failed')
    failJob(jobId, error)
    throw err
  }
}

/**
 * Get enrichment statistics
 */
export async function getEnrichmentStats(): Promise<{
  movies: { total: number; enriched: number; pending: number }
  series: { total: number; enriched: number; pending: number }
  collections: { total: number }
}> {
  const movieStats = await queryOne<{ total: string; enriched: string }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE enriched_at IS NOT NULL) as enriched
     FROM movies`
  )

  const seriesStats = await queryOne<{ total: string; enriched: string }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE enriched_at IS NOT NULL) as enriched
     FROM series`
  )

  const collectionStats = await queryOne<{ total: string }>(
    `SELECT COUNT(*) as total FROM collections`
  )

  const totalMovies = parseInt(movieStats?.total || '0', 10)
  const enrichedMovies = parseInt(movieStats?.enriched || '0', 10)
  const totalSeries = parseInt(seriesStats?.total || '0', 10)
  const enrichedSeries = parseInt(seriesStats?.enriched || '0', 10)

  return {
    movies: {
      total: totalMovies,
      enriched: enrichedMovies,
      pending: totalMovies - enrichedMovies,
    },
    series: {
      total: totalSeries,
      enriched: enrichedSeries,
      pending: totalSeries - enrichedSeries,
    },
    collections: {
      total: parseInt(collectionStats?.total || '0', 10),
    },
  }
}

/**
 * Clear enrichment data (for re-enriching)
 */
export async function clearEnrichmentData(): Promise<void> {
  await query(`UPDATE movies SET enriched_at = NULL`)
  await query(`UPDATE series SET enriched_at = NULL`)
  logger.info('Enrichment data cleared')
}

