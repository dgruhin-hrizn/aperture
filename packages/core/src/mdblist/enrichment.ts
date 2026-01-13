/**
 * MDBList Metadata Enrichment
 *
 * Enriches movies and series with data from MDBList:
 * - Letterboxd ratings
 * - MDBList aggregated scores
 * - Rotten Tomatoes critic/audience scores (supplement to OMDb)
 * - Metacritic scores (supplement to OMDb)
 * - Streaming providers (informational)
 * - Keywords
 *
 * PERFORMANCE:
 * - Uses batch API (up to 200 items per request)
 * - Respects rate limits (free: ~1k/day, supporter: higher)
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
import { getMDBListConfig, getMediaInfoByTmdbBatch, getMediaInfoByImdb, extractEnrichmentData } from './provider.js'
import type { MDBListEnrichmentData } from './types.js'

const logger = createChildLogger('mdblist:enrichment')

// ============================================================================
// Constants
// ============================================================================

/** Batch size for MDBList API (max 200) */
const BATCH_SIZE = 100

/** Number of items to fetch per database query */
const DB_BATCH_SIZE = 500

// ============================================================================
// Types
// ============================================================================

interface MDBListEnrichmentProgress {
  moviesProcessed: number
  moviesEnriched: number
  moviesFailed: number
  seriesProcessed: number
  seriesEnriched: number
  seriesFailed: number
}

interface ItemToEnrich {
  id: string
  title: string
  tmdb_id: string | null
  imdb_id: string | null
}

// ============================================================================
// Movie Enrichment
// ============================================================================

/**
 * Get movies that need MDBList enrichment
 * Prefers items with TMDB IDs, falls back to IMDB
 */
async function getMoviesNeedingMDBListEnrichment(limit: number = 500): Promise<ItemToEnrich[]> {
  const result = await query<ItemToEnrich>(
    `SELECT id, title, tmdb_id, imdb_id
     FROM movies
     WHERE mdblist_enriched_at IS NULL
       AND (tmdb_id IS NOT NULL OR imdb_id IS NOT NULL)
     ORDER BY 
       CASE WHEN tmdb_id IS NOT NULL THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT $1`,
    [limit]
  )
  return result.rows
}

/**
 * Update a movie with MDBList enrichment data
 */
async function updateMovieEnrichment(
  movieId: string,
  data: MDBListEnrichmentData
): Promise<boolean> {
  try {
    await query(
      `UPDATE movies SET
         letterboxd_score = COALESCE($2, letterboxd_score),
         mdblist_score = COALESCE($3, mdblist_score),
         rt_critic_score = COALESCE($4, rt_critic_score),
         rt_audience_score = COALESCE($5, rt_audience_score),
         metacritic_score = COALESCE($6, metacritic_score),
         streaming_providers = COALESCE($7, streaming_providers),
         mdblist_keywords = COALESCE($8, mdblist_keywords),
         mdblist_enriched_at = NOW()
       WHERE id = $1`,
      [
        movieId,
        data.letterboxdScore,
        data.mdblistScore,
        data.rtCriticScore,
        data.rtAudienceScore,
        data.metacriticScore,
        JSON.stringify(data.streamingProviders),
        data.keywords.length > 0 ? data.keywords : null,
      ]
    )
    return true
  } catch (err) {
    logger.error({ err, movieId }, 'Failed to update movie with MDBList data')
    return false
  }
}

// ============================================================================
// Series Enrichment
// ============================================================================

/**
 * Get series that need MDBList enrichment
 * Prefers items with TMDB IDs, falls back to IMDB
 */
async function getSeriesNeedingMDBListEnrichment(limit: number = 500): Promise<ItemToEnrich[]> {
  const result = await query<ItemToEnrich>(
    `SELECT id, title, tmdb_id, imdb_id
     FROM series
     WHERE mdblist_enriched_at IS NULL
       AND (tmdb_id IS NOT NULL OR imdb_id IS NOT NULL)
     ORDER BY 
       CASE WHEN tmdb_id IS NOT NULL THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT $1`,
    [limit]
  )
  return result.rows
}

/**
 * Update a series with MDBList enrichment data
 */
async function updateSeriesEnrichment(
  seriesId: string,
  data: MDBListEnrichmentData
): Promise<boolean> {
  try {
    await query(
      `UPDATE series SET
         letterboxd_score = COALESCE($2, letterboxd_score),
         mdblist_score = COALESCE($3, mdblist_score),
         rt_critic_score = COALESCE($4, rt_critic_score),
         rt_audience_score = COALESCE($5, rt_audience_score),
         metacritic_score = COALESCE($6, metacritic_score),
         streaming_providers = COALESCE($7, streaming_providers),
         mdblist_keywords = COALESCE($8, mdblist_keywords),
         mdblist_enriched_at = NOW()
       WHERE id = $1`,
      [
        seriesId,
        data.letterboxdScore,
        data.mdblistScore,
        data.rtCriticScore,
        data.rtAudienceScore,
        data.metacriticScore,
        JSON.stringify(data.streamingProviders),
        data.keywords.length > 0 ? data.keywords : null,
      ]
    )
    return true
  } catch (err) {
    logger.error({ err, seriesId }, 'Failed to update series with MDBList data')
    return false
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process a batch of items (movies or series) with MDBList data
 * Uses TMDB IDs when available, falls back to IMDB
 */
async function processBatch(
  items: ItemToEnrich[],
  updateFn: (id: string, data: MDBListEnrichmentData) => Promise<boolean>,
  mediaType: 'movie' | 'show',
  jobId: string
): Promise<{ enriched: number; failed: number }> {
  const result = { enriched: 0, failed: 0 }

  // Separate items by ID type
  const tmdbItems = items.filter((item) => item.tmdb_id !== null)
  const imdbOnlyItems = items.filter((item) => item.tmdb_id === null && item.imdb_id !== null)

  // Create maps for quick lookup by item ID
  const infoByItemId = new Map<string, MDBListEnrichmentData>()

  try {
    // Fetch TMDB items (most items should have TMDB IDs)
    if (tmdbItems.length > 0) {
      const tmdbIds = tmdbItems.map((item) => item.tmdb_id!)
      const mediaInfoList = await getMediaInfoByTmdbBatch(tmdbIds, mediaType)

      // Map results back by TMDB ID
      const tmdbIdToInfo = new Map<number, MDBListEnrichmentData>()
      for (const info of mediaInfoList) {
        if (info.tmdbid) {
          tmdbIdToInfo.set(info.tmdbid, extractEnrichmentData(info))
        }
      }

      // Link to item IDs
      for (const item of tmdbItems) {
        const data = tmdbIdToInfo.get(parseInt(item.tmdb_id!, 10))
        if (data) {
          infoByItemId.set(item.id, data)
        }
      }
    }

    // For items without TMDB, try IMDB (less common case)
    // Use individual lookups since we deprecated the old batch
    for (const item of imdbOnlyItems) {
      if (item.imdb_id) {
        try {
          const info = await getMediaInfoByImdb(item.imdb_id)
          if (info) {
            infoByItemId.set(item.id, extractEnrichmentData(info))
          }
        } catch {
          // Skip failed lookups
        }
      }
    }

    // Update each item
    for (const item of items) {
      const data = infoByItemId.get(item.id)
      if (data) {
        const success = await updateFn(item.id, data)
        if (success) {
          result.enriched++
        } else {
          result.failed++
        }
      } else {
        // Mark as enriched even if not found to avoid re-processing
        await query(
          `UPDATE movies SET mdblist_enriched_at = NOW() WHERE id = $1`,
          [item.id]
        ).catch(() => {
          // Try series table if movie update fails
          return query(
            `UPDATE series SET mdblist_enriched_at = NOW() WHERE id = $1`,
            [item.id]
          )
        })
        result.failed++
      }
    }
  } catch (err) {
    logger.error({ err }, 'Batch MDBList fetch failed')
    result.failed = items.length
  }

  return result
}

// ============================================================================
// Main Enrichment Job
// ============================================================================

/**
 * Run MDBList metadata enrichment for movies and series
 */
export async function enrichMDBListMetadata(jobId: string): Promise<MDBListEnrichmentProgress> {
  const progress: MDBListEnrichmentProgress = {
    moviesProcessed: 0,
    moviesEnriched: 0,
    moviesFailed: 0,
    seriesProcessed: 0,
    seriesEnriched: 0,
    seriesFailed: 0,
  }

  // Check if MDBList is configured
  const config = await getMDBListConfig()
  if (!config.enabled || !config.hasApiKey) {
    logger.warn('MDBList not configured - skipping enrichment')
    return progress
  }

  createJobProgress(jobId, 'enrich-mdblist', 2) // 2 steps: movies, series

  try {
    // Get counts (items with TMDB or IMDB IDs)
    const movieCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM movies WHERE mdblist_enriched_at IS NULL AND (tmdb_id IS NOT NULL OR imdb_id IS NOT NULL)`
    )
    const seriesCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM series WHERE mdblist_enriched_at IS NULL AND (tmdb_id IS NOT NULL OR imdb_id IS NOT NULL)`
    )

    const totalMovies = parseInt(movieCount?.count || '0', 10)
    const totalSeries = parseInt(seriesCount?.count || '0', 10)
    const totalItems = totalMovies + totalSeries

    if (totalItems === 0) {
      addLog(jobId, 'info', 'No items need MDBList enrichment')
      completeJob(jobId, { progress })
      return progress
    }

    const startTime = Date.now()
    const tierLabel = config.supporterTier ? 'supporter' : 'free'
    logger.info(
      { totalMovies, totalSeries, tier: tierLabel },
      'Starting MDBList metadata enrichment'
    )

    addLog(jobId, 'info', `MDBList tier: ${tierLabel}`)
    addLog(jobId, 'info', `Found ${totalMovies} movies and ${totalSeries} series to enrich`)

    // Process movies
    if (totalMovies > 0) {
      setJobStep(jobId, 0, 'Enriching movies from MDBList', totalItems)

      while (!isJobCancelled(jobId)) {
        const movies = await getMoviesNeedingMDBListEnrichment(DB_BATCH_SIZE)
        if (movies.length === 0) break

        // Process in batches for the API
        for (let i = 0; i < movies.length && !isJobCancelled(jobId); i += BATCH_SIZE) {
          const batch = movies.slice(i, i + BATCH_SIZE)
          const batchResult = await processBatch(batch, updateMovieEnrichment, 'movie', jobId)

          progress.moviesProcessed += batch.length
          progress.moviesEnriched += batchResult.enriched
          progress.moviesFailed += batchResult.failed

          updateJobProgress(jobId, progress.moviesProcessed, totalItems)

          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          addLog(
            jobId,
            'info',
            `📽 Movies: ${progress.moviesProcessed}/${totalMovies} (${progress.moviesEnriched} enriched, ${elapsed}s elapsed)`
          )
        }
      }
    }

    // Process series
    if (totalSeries > 0 && !isJobCancelled(jobId)) {
      setJobStep(jobId, 1, 'Enriching series from MDBList', totalItems)

      while (!isJobCancelled(jobId)) {
        const seriesList = await getSeriesNeedingMDBListEnrichment(DB_BATCH_SIZE)
        if (seriesList.length === 0) break

        for (let i = 0; i < seriesList.length && !isJobCancelled(jobId); i += BATCH_SIZE) {
          const batch = seriesList.slice(i, i + BATCH_SIZE)
          const batchResult = await processBatch(batch, updateSeriesEnrichment, 'show', jobId)

          progress.seriesProcessed += batch.length
          progress.seriesEnriched += batchResult.enriched
          progress.seriesFailed += batchResult.failed

          updateJobProgress(
            jobId,
            progress.moviesProcessed + progress.seriesProcessed,
            totalItems
          )

          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          addLog(
            jobId,
            'info',
            `📺 Series: ${progress.seriesProcessed}/${totalSeries} (${progress.seriesEnriched} enriched, ${elapsed}s elapsed)`
          )
        }
      }
    }

    // Complete
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
    const summary = `Enriched ${progress.moviesEnriched} movies and ${progress.seriesEnriched} series from MDBList in ${totalDuration}s`
    addLog(jobId, 'info', `🎉 ${summary}`)
    completeJob(jobId, { progress })

    logger.info(progress, 'MDBList metadata enrichment complete')
    return progress
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'MDBList metadata enrichment failed')
    failJob(jobId, error)
    throw err
  }
}

/**
 * Get MDBList enrichment statistics
 */
export async function getMDBListEnrichmentStats(): Promise<{
  movies: { total: number; enriched: number; pending: number }
  series: { total: number; enriched: number; pending: number }
}> {
  const movieStats = await queryOne<{ total: string; enriched: string }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE mdblist_enriched_at IS NOT NULL) as enriched
     FROM movies
     WHERE tmdb_id IS NOT NULL OR imdb_id IS NOT NULL`
  )

  const seriesStats = await queryOne<{ total: string; enriched: string }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE mdblist_enriched_at IS NOT NULL) as enriched
     FROM series
     WHERE tmdb_id IS NOT NULL OR imdb_id IS NOT NULL`
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
  }
}

/**
 * Clear MDBList enrichment data (for re-enriching)
 */
export async function clearMDBListEnrichmentData(): Promise<void> {
  await query(`UPDATE movies SET mdblist_enriched_at = NULL`)
  await query(`UPDATE series SET mdblist_enriched_at = NULL`)
  logger.info('MDBList enrichment data cleared')
}

/**
 * Enrich a single item immediately (for on-demand enrichment)
 */
export async function enrichSingleItem(
  imdbId: string,
  type: 'movie' | 'series'
): Promise<MDBListEnrichmentData | null> {
  const config = await getMDBListConfig()
  if (!config.enabled || !config.hasApiKey) {
    return null
  }

  try {
    const info = await getMediaInfoByImdb(imdbId)
    if (!info) return null

    const data = extractEnrichmentData(info)

    if (type === 'movie') {
      await query(
        `UPDATE movies SET
           letterboxd_score = COALESCE($2, letterboxd_score),
           mdblist_score = COALESCE($3, mdblist_score),
           rt_critic_score = COALESCE($4, rt_critic_score),
           rt_audience_score = COALESCE($5, rt_audience_score),
           metacritic_score = COALESCE($6, metacritic_score),
           streaming_providers = COALESCE($7, streaming_providers),
           mdblist_keywords = COALESCE($8, mdblist_keywords),
           mdblist_enriched_at = NOW()
         WHERE imdb_id = $1`,
        [
          imdbId,
          data.letterboxdScore,
          data.mdblistScore,
          data.rtCriticScore,
          data.rtAudienceScore,
          data.metacriticScore,
          JSON.stringify(data.streamingProviders),
          data.keywords.length > 0 ? data.keywords : null,
        ]
      )
    } else {
      await query(
        `UPDATE series SET
           letterboxd_score = COALESCE($2, letterboxd_score),
           mdblist_score = COALESCE($3, mdblist_score),
           rt_critic_score = COALESCE($4, rt_critic_score),
           rt_audience_score = COALESCE($5, rt_audience_score),
           metacritic_score = COALESCE($6, metacritic_score),
           streaming_providers = COALESCE($7, streaming_providers),
           mdblist_keywords = COALESCE($8, mdblist_keywords),
           mdblist_enriched_at = NOW()
         WHERE imdb_id = $1`,
        [
          imdbId,
          data.letterboxdScore,
          data.mdblistScore,
          data.rtCriticScore,
          data.rtAudienceScore,
          data.metacriticScore,
          JSON.stringify(data.streamingProviders),
          data.keywords.length > 0 ? data.keywords : null,
        ]
      )
    }

    return data
  } catch (err) {
    logger.error({ err, imdbId, type }, 'Failed to enrich single item')
    return null
  }
}

