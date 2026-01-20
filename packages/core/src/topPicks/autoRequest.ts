/**
 * Top Picks Auto-Request Job
 * 
 * Automatically requests missing Top Picks content via Jellyseerr
 */

import { createChildLogger } from '../lib/logger.js'
import { randomUUID } from 'crypto'
import {
  createJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
} from '../jobs/progress.js'
import { getTopPicksConfig } from './config.js'
import { 
  getTopMoviesFromTMDB, 
  getTopSeriesFromTMDB,
  getTopMoviesFromMDBList,
  getTopSeriesFromMDBList,
} from './popularity.js'
import { 
  isJellyseerrConfigured, 
  createRequest, 
  getMediaStatus,
} from '../jellyseerr/index.js'
import { query } from '../lib/db.js'
import type { TMDbMovieResult, TMDbTVResult } from '../tmdb/index.js'

const logger = createChildLogger('top-picks-auto-request')

export interface AutoRequestResult {
  moviesRequested: number
  seriesRequested: number
  moviesSkipped: number
  seriesSkipped: number
  errors: string[]
  jobId: string
}

interface ExternalItem {
  tmdbId: number
  title: string
  year: number | null
  originalLanguage: string | null
}

/**
 * Get missing movies from the configured source
 * Returns items with TMDB IDs that are NOT in the local library
 * Applies language filters from config
 */
async function getMissingMovies(limit: number): Promise<ExternalItem[]> {
  const config = await getTopPicksConfig()
  const source = config.moviesPopularitySource
  
  // For emby_history, there's nothing "missing" - it only shows local content
  if (source === 'emby_history') {
    return []
  }
  
  // Determine which source to use
  let externalSource = source
  if (source === 'hybrid') {
    externalSource = config.moviesHybridExternalSource
  }
  
  // Get language filter settings
  const languages = config.moviesLanguages || []
  const includeUnknownLanguage = config.moviesIncludeUnknownLanguage ?? true
  
  // Fetch from external source
  let externalItems: ExternalItem[] = []
  
  if (externalSource === 'mdblist' && config.mdblistMoviesListId) {
    // For MDBList, we need to fetch the raw list and get TMDB IDs
    // MDBList doesn't provide language, so we'll need to look it up from TMDB if filtering
    const { getListItems } = await import('../mdblist/index.js')
    const items = await getListItems(config.mdblistMoviesListId, { 
      limit: limit * 3, 
      sort: config.mdblistMoviesSort 
    })
    externalItems = items
      .filter(item => item.tmdbid)
      .map(item => ({
        tmdbId: item.tmdbid!,
        title: item.title || 'Unknown',
        year: item.year || null,
        originalLanguage: null, // MDBList doesn't provide language
      }))
  } else if (externalSource?.startsWith('tmdb_')) {
    // For TMDB sources, fetch directly
    const {
      getPopularMoviesBatch,
      getTrendingMoviesBatch,
      getTopRatedMoviesBatch,
    } = await import('../tmdb/index.js')
    
    const maxPages = Math.ceil((limit * 3) / 20)
    let tmdbMovies: TMDbMovieResult[] = []
    
    switch (externalSource) {
      case 'tmdb_popular':
        tmdbMovies = await getPopularMoviesBatch(maxPages)
        break
      case 'tmdb_trending_day':
        tmdbMovies = await getTrendingMoviesBatch('day', maxPages)
        break
      case 'tmdb_trending_week':
        tmdbMovies = await getTrendingMoviesBatch('week', maxPages)
        break
      case 'tmdb_top_rated':
        tmdbMovies = await getTopRatedMoviesBatch(maxPages)
        break
    }
    
    externalItems = tmdbMovies.map(m => ({
      tmdbId: m.id,
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.split('-')[0]) : null,
      originalLanguage: m.original_language || null,
    }))
  }
  
  if (externalItems.length === 0) {
    return []
  }
  
  // Apply language filter if configured
  if (languages.length > 0) {
    externalItems = externalItems.filter(item => {
      if (!item.originalLanguage) {
        return includeUnknownLanguage
      }
      return languages.includes(item.originalLanguage)
    })
    logger.debug({ languages, includeUnknownLanguage, filteredCount: externalItems.length }, 'Applied language filter to movies for auto-request')
  }
  
  // Check which items are NOT in our library
  const tmdbIds = externalItems.map(i => String(i.tmdbId))
  const existingResult = await query<{ tmdb_id: string }>(
    `SELECT tmdb_id FROM movies WHERE tmdb_id = ANY($1)`,
    [tmdbIds]
  )
  const existingTmdbIds = new Set(existingResult.rows.map(r => r.tmdb_id))
  
  // Return items not in library, up to limit
  return externalItems
    .filter(item => !existingTmdbIds.has(String(item.tmdbId)))
    .slice(0, limit)
}

/**
 * Get missing series from the configured source
 * Applies language filters from config
 */
async function getMissingSeries(limit: number): Promise<ExternalItem[]> {
  const config = await getTopPicksConfig()
  const source = config.seriesPopularitySource
  
  if (source === 'emby_history') {
    return []
  }
  
  let externalSource = source
  if (source === 'hybrid') {
    externalSource = config.seriesHybridExternalSource
  }
  
  // Get language filter settings
  const languages = config.seriesLanguages || []
  const includeUnknownLanguage = config.seriesIncludeUnknownLanguage ?? true
  
  let externalItems: ExternalItem[] = []
  
  if (externalSource === 'mdblist' && config.mdblistSeriesListId) {
    const { getListItems } = await import('../mdblist/index.js')
    const items = await getListItems(config.mdblistSeriesListId, { 
      limit: limit * 3, 
      sort: config.mdblistSeriesSort 
    })
    externalItems = items
      .filter(item => item.tmdbid)
      .map(item => ({
        tmdbId: item.tmdbid!,
        title: item.title || 'Unknown',
        year: item.year || null,
        originalLanguage: null, // MDBList doesn't provide language
      }))
  } else if (externalSource?.startsWith('tmdb_')) {
    const {
      getPopularTVBatch,
      getTrendingTVBatch,
      getTopRatedTVBatch,
    } = await import('../tmdb/index.js')
    
    const maxPages = Math.ceil((limit * 3) / 20)
    let tmdbSeries: TMDbTVResult[] = []
    
    switch (externalSource) {
      case 'tmdb_popular':
        tmdbSeries = await getPopularTVBatch(maxPages)
        break
      case 'tmdb_trending_day':
        tmdbSeries = await getTrendingTVBatch('day', maxPages)
        break
      case 'tmdb_trending_week':
        tmdbSeries = await getTrendingTVBatch('week', maxPages)
        break
      case 'tmdb_top_rated':
        tmdbSeries = await getTopRatedTVBatch(maxPages)
        break
    }
    
    externalItems = tmdbSeries.map(s => ({
      tmdbId: s.id,
      title: s.name,
      year: s.first_air_date ? parseInt(s.first_air_date.split('-')[0]) : null,
      originalLanguage: s.original_language || null,
    }))
  }
  
  if (externalItems.length === 0) {
    return []
  }
  
  // Apply language filter if configured
  if (languages.length > 0) {
    externalItems = externalItems.filter(item => {
      if (!item.originalLanguage) {
        return includeUnknownLanguage
      }
      return languages.includes(item.originalLanguage)
    })
    logger.debug({ languages, includeUnknownLanguage, filteredCount: externalItems.length }, 'Applied language filter to series for auto-request')
  }
  
  // Check which items are NOT in our library
  const tmdbIds = externalItems.map(i => String(i.tmdbId))
  const existingResult = await query<{ tmdb_id: string }>(
    `SELECT tmdb_id FROM series WHERE tmdb_id = ANY($1)`,
    [tmdbIds]
  )
  const existingTmdbIds = new Set(existingResult.rows.map(r => r.tmdb_id))
  
  return externalItems
    .filter(item => !existingTmdbIds.has(String(item.tmdbId)))
    .slice(0, limit)
}

/**
 * Run the auto-request job
 */
export async function runAutoRequestJob(
  existingJobId?: string
): Promise<AutoRequestResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'auto-request-top-picks', 5)

  const result: AutoRequestResult = {
    moviesRequested: 0,
    seriesRequested: 0,
    moviesSkipped: 0,
    seriesSkipped: 0,
    errors: [],
    jobId,
  }

  try {
    // Step 1: Check configuration
    setJobStep(jobId, 0, 'Checking configuration')
    
    const config = await getTopPicksConfig()
    
    if (!config.moviesAutoRequestEnabled && !config.seriesAutoRequestEnabled) {
      addLog(jobId, 'info', '⏭️ Auto-request is disabled for both movies and series')
      completeJob(jobId, { ...result })
      return result
    }
    
    // Check Jellyseerr configuration
    const jellyseerrConfigured = await isJellyseerrConfigured()
    if (!jellyseerrConfigured) {
      addLog(jobId, 'warn', '⚠️ Jellyseerr is not configured - cannot auto-request')
      completeJob(jobId, { ...result })
      return result
    }
    
    addLog(jobId, 'info', '✅ Configuration loaded')
    addLog(jobId, 'info', `🎬 Movies auto-request: ${config.moviesAutoRequestEnabled ? `enabled (limit: ${config.moviesAutoRequestLimit})` : 'disabled'}`)
    addLog(jobId, 'info', `📺 Series auto-request: ${config.seriesAutoRequestEnabled ? `enabled (limit: ${config.seriesAutoRequestLimit})` : 'disabled'}`)

    // Step 2: Get missing movies
    setJobStep(jobId, 1, 'Finding missing movies')
    
    if (config.moviesAutoRequestEnabled) {
      addLog(jobId, 'info', '🔍 Finding missing movies from Top Picks source...')
      const missingMovies = await getMissingMovies(config.moviesAutoRequestLimit)
      addLog(jobId, 'info', `📋 Found ${missingMovies.length} missing movies`)
      
      // Step 3: Request missing movies
      setJobStep(jobId, 2, 'Requesting movies')
      
      for (const movie of missingMovies) {
        try {
          // Check if already requested
          const status = await getMediaStatus(movie.tmdbId, 'movie')
          if (status?.requested) {
            addLog(jobId, 'info', `⏭️ "${movie.title}" already requested`)
            result.moviesSkipped++
            continue
          }
          
          // Create request
          const requestResult = await createRequest(movie.tmdbId, 'movie')
          if (requestResult.success) {
            addLog(jobId, 'info', `✅ Requested "${movie.title}" (${movie.year})`)
            result.moviesRequested++
          } else {
            addLog(jobId, 'warn', `⚠️ Failed to request "${movie.title}": ${requestResult.message}`)
            result.moviesSkipped++
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error'
          addLog(jobId, 'error', `❌ Error requesting "${movie.title}": ${error}`)
          result.errors.push(`Movie "${movie.title}": ${error}`)
        }
      }
    }

    // Step 4: Get missing series
    setJobStep(jobId, 3, 'Finding missing series')
    
    if (config.seriesAutoRequestEnabled) {
      addLog(jobId, 'info', '🔍 Finding missing series from Top Picks source...')
      const missingSeries = await getMissingSeries(config.seriesAutoRequestLimit)
      addLog(jobId, 'info', `📋 Found ${missingSeries.length} missing series`)
      
      // Step 5: Request missing series
      setJobStep(jobId, 4, 'Requesting series')
      
      for (const series of missingSeries) {
        try {
          const status = await getMediaStatus(series.tmdbId, 'tv')
          if (status?.requested) {
            addLog(jobId, 'info', `⏭️ "${series.title}" already requested`)
            result.seriesSkipped++
            continue
          }
          
          const requestResult = await createRequest(series.tmdbId, 'tv')
          if (requestResult.success) {
            addLog(jobId, 'info', `✅ Requested "${series.title}" (${series.year})`)
            result.seriesRequested++
          } else {
            addLog(jobId, 'warn', `⚠️ Failed to request "${series.title}": ${requestResult.message}`)
            result.seriesSkipped++
          }
          
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Unknown error'
          addLog(jobId, 'error', `❌ Error requesting "${series.title}": ${error}`)
          result.errors.push(`Series "${series.title}": ${error}`)
        }
      }
    }

    // Complete
    completeJob(jobId, { ...result })
    addLog(jobId, 'info', `🎉 Auto-request complete: ${result.moviesRequested} movies, ${result.seriesRequested} series requested`)
    if (result.moviesSkipped + result.seriesSkipped > 0) {
      addLog(jobId, 'info', `⏭️ Skipped: ${result.moviesSkipped} movies, ${result.seriesSkipped} series (already requested or failed)`)
    }

    return result
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    logger.error({ err }, 'Auto-request job failed')
    throw err
  }
}
