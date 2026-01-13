/**
 * Studio Logo Enrichment Module
 *
 * Enriches studios and networks with TMDB logo data:
 * - Fetches production company/network logos from TMDB
 * - Downloads and stores logos locally
 * - Optionally pushes logos to Emby/Jellyfin
 *
 * PERFORMANCE OPTIMIZED:
 * - Multiple studios processed concurrently (within API rate limits)
 * - TMDb: ~40 req/sec (limit is ~50)
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
import { getTMDbConfig, getSystemSetting } from '../settings/systemSettings.js'
import {
  searchCompanyByName,
  getCompanyDetails,
  getNetworkDetails,
  getImageUrl,
} from '../tmdb/client.js'
import { pushImageToMediaServer } from '../uploads/mediaServerSync.js'
import * as fs from 'fs/promises'
import * as path from 'path'

const logger = createChildLogger('enrichment:studio-logos')

// ============================================================================
// PERFORMANCE TUNING CONSTANTS
// ============================================================================

/** Number of studios to process concurrently */
const CONCURRENCY = 5

/** Number of studios to fetch per database query */
const BATCH_SIZE = 50

// ============================================================================
// Types
// ============================================================================

interface StudioLogoProgress {
  studiosProcessed: number
  studiosEnriched: number
  studiosFailed: number
  networksProcessed: number
  networksEnriched: number
  networksFailed: number
  logosPushedToEmby: number
}

interface StudioToEnrich {
  id: string
  name: string
  type: 'studio' | 'network'
  emby_id: string | null
  tmdb_id: number | null
}

// ============================================================================
// Studio Population
// ============================================================================

/**
 * Populate the studios_networks table from movies and series
 * This extracts unique studios from the movies.studios and series.studios JSONB columns
 */
export async function populateStudiosFromMedia(): Promise<{ studios: number; networks: number }> {
  logger.info('Populating studios_networks table from media...')

  // Insert unique studios from movies (type = 'studio')
  const studioResult = await query(
    `INSERT INTO studios_networks (name, type, emby_id)
     SELECT DISTINCT
       studio_obj->>'name' as name,
       'studio' as type,
       studio_obj->>'id' as emby_id
     FROM movies, jsonb_array_elements(studios) as studio_obj
     WHERE studio_obj->>'name' IS NOT NULL
       AND studio_obj->>'name' != ''
     ON CONFLICT (name, type) DO UPDATE SET
       emby_id = COALESCE(EXCLUDED.emby_id, studios_networks.emby_id),
       updated_at = NOW()`
  )

  // Insert unique studios/networks from series
  // For series, we treat them as 'network' type since that's more commonly what they represent
  const networkResult = await query(
    `INSERT INTO studios_networks (name, type, emby_id)
     SELECT DISTINCT
       studio_obj->>'name' as name,
       'network' as type,
       studio_obj->>'id' as emby_id
     FROM series, jsonb_array_elements(studios) as studio_obj
     WHERE studio_obj->>'name' IS NOT NULL
       AND studio_obj->>'name' != ''
     ON CONFLICT (name, type) DO UPDATE SET
       emby_id = COALESCE(EXCLUDED.emby_id, studios_networks.emby_id),
       updated_at = NOW()`
  )

  const studiosCount = studioResult.rowCount || 0
  const networksCount = networkResult.rowCount || 0

  logger.info({ studios: studiosCount, networks: networksCount }, 'Studios/networks populated')
  return { studios: studiosCount, networks: networksCount }
}

// ============================================================================
// Studio Logo Enrichment
// ============================================================================

/**
 * Get studios that need logo enrichment
 */
async function getStudiosNeedingLogos(
  type: 'studio' | 'network',
  limit: number = 50,
  offset: number = 0
): Promise<StudioToEnrich[]> {
  const result = await query<StudioToEnrich>(
    `SELECT id, name, type, emby_id, tmdb_id
     FROM studios_networks
     WHERE type = $1
       AND logo_path IS NULL
     ORDER BY name
     LIMIT $2
     OFFSET $3`,
    [type, limit, offset]
  )
  return result.rows
}

/**
 * Download logo from TMDB and save locally
 */
async function downloadLogo(
  logoPath: string,
  studioId: string
): Promise<string | null> {
  try {
    const imageUrl = getImageUrl(logoPath, 'w185')
    if (!imageUrl) return null

    const response = await fetch(imageUrl)
    if (!response.ok) {
      logger.warn({ logoPath, status: response.status }, 'Failed to download logo')
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Save to uploads/studios directory
    const uploadsDir = process.env.UPLOADS_DIR || './uploads'
    const studiosDir = path.join(uploadsDir, 'studios')
    await fs.mkdir(studiosDir, { recursive: true })

    const ext = path.extname(logoPath) || '.png'
    const filename = `${studioId}${ext}`
    const filePath = path.join(studiosDir, filename)

    await fs.writeFile(filePath, buffer)
    
    // Return relative path for database storage
    return `studios/${filename}`
  } catch (err) {
    logger.error({ err, logoPath }, 'Failed to download logo')
    return null
  }
}

/**
 * Enrich a single studio with TMDB logo data
 */
async function enrichStudio(
  studio: StudioToEnrich,
  pushToEmby: boolean,
  jobId: string
): Promise<{ enriched: boolean; pushedToEmby: boolean }> {
  let result = { enriched: false, pushedToEmby: false }

  try {
    let tmdbId = studio.tmdb_id
    let logoPath: string | null = null
    let originCountry: string | null = null

    // If we have a TMDB ID, fetch company details directly
    if (tmdbId) {
      const details =
        studio.type === 'network'
          ? await getNetworkDetails(tmdbId)
          : await getCompanyDetails(tmdbId)

      if (details) {
        logoPath = details.logo_path
        originCountry = details.origin_country
      }
    } else {
      // Search for company by name
      const searchResult = await searchCompanyByName(studio.name)
      if (searchResult) {
        tmdbId = searchResult.id
        logoPath = searchResult.logo_path
        originCountry = searchResult.origin_country
      }
    }

    // If we found a logo, download it
    let localPath: string | null = null
    if (logoPath) {
      localPath = await downloadLogo(logoPath, studio.id)
    }

    // Update database
    await query(
      `UPDATE studios_networks SET
         tmdb_id = $2,
         logo_path = $3,
         origin_country = $4,
         logo_local_path = $5,
         updated_at = NOW()
       WHERE id = $1`,
      [studio.id, tmdbId, logoPath, originCountry, localPath]
    )

    result.enriched = logoPath !== null

    // Push to Emby if enabled and we have both a logo and an Emby ID
    if (pushToEmby && localPath && studio.emby_id) {
      try {
        const uploadsDir = process.env.UPLOADS_DIR || './uploads'
        const fullPath = path.join(uploadsDir, localPath)
        const buffer = await fs.readFile(fullPath)
        
        // Determine MIME type
        const ext = path.extname(localPath).toLowerCase()
        const mimeType = ext === '.svg' ? 'image/svg+xml' : 'image/png'

        const pushResult = await pushImageToMediaServer(
          studio.emby_id,
          'Thumb', // Studio images use 'Thumb' type in Emby
          buffer,
          mimeType
        )

        if (pushResult.success) {
          await query(
            `UPDATE studios_networks SET emby_synced_at = NOW() WHERE id = $1`,
            [studio.id]
          )
          result.pushedToEmby = true
          addLog(jobId, 'debug', `🖼 Pushed logo to Emby: ${studio.name}`)
        }
      } catch (err) {
        logger.warn({ err, studioId: studio.id, name: studio.name }, 'Failed to push logo to Emby')
      }
    }

    if (logoPath) {
      addLog(jobId, 'debug', `✓ ${studio.name}: found logo`)
    } else {
      addLog(jobId, 'debug', `○ ${studio.name}: no logo found`)
    }
  } catch (err) {
    logger.error({ err, studioId: studio.id }, 'Failed to enrich studio')
    addLog(jobId, 'warn', `✗ ${studio.name}: error`)
  }

  return result
}

// ============================================================================
// Concurrent Processing Helper
// ============================================================================

/**
 * Process items with limited concurrency
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
 * Run the studio logo enrichment job
 */
export async function enrichStudioLogos(jobId: string): Promise<StudioLogoProgress> {
  const progress: StudioLogoProgress = {
    studiosProcessed: 0,
    studiosEnriched: 0,
    studiosFailed: 0,
    networksProcessed: 0,
    networksEnriched: 0,
    networksFailed: 0,
    logosPushedToEmby: 0,
  }

  // Check if TMDb is configured
  const tmdbConfig = await getTMDbConfig()
  if (!tmdbConfig.enabled || !tmdbConfig.hasApiKey) {
    logger.warn('TMDb is not configured - skipping studio logo enrichment')
    return progress
  }

  // Check push to Emby setting
  const pushToEmby = (await getSystemSetting('studio_logos_push_to_emby')) === 'true'

  createJobProgress(jobId, 'enrich-studio-logos', 3)

  try {
    // Step 1: Populate studios from media
    setJobStep(jobId, 0, 'Extracting studios from media')
    addLog(jobId, 'info', '📋 Extracting studios and networks from movies/series...')
    
    const populated = await populateStudiosFromMedia()
    addLog(jobId, 'info', `✓ Found ${populated.studios} studios, ${populated.networks} networks`)

    // Get counts for progress tracking
    const studioCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM studios_networks WHERE type = 'studio' AND logo_path IS NULL`
    )
    const networkCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM studios_networks WHERE type = 'network' AND logo_path IS NULL`
    )

    const totalStudios = parseInt(studioCount?.count || '0', 10)
    const totalNetworks = parseInt(networkCount?.count || '0', 10)
    const totalItems = totalStudios + totalNetworks

    if (totalItems === 0) {
      addLog(jobId, 'info', '✓ All studios/networks already have logos')
      completeJob(jobId, { progress })
      return progress
    }

    addLog(jobId, 'info', `🔍 Need logos for ${totalStudios} studios, ${totalNetworks} networks`)
    addLog(jobId, 'info', `⚡ Performance: ${CONCURRENCY} concurrent lookups`)
    addLog(jobId, 'info', `📤 Push to Emby: ${pushToEmby ? 'enabled' : 'disabled'}`)

    const startTime = Date.now()

    // Step 2: Process studios
    if (totalStudios > 0) {
      setJobStep(jobId, 1, 'Enriching studios', totalItems)
      addLog(jobId, 'info', `🏢 Processing ${totalStudios} studios...`)

      while (true) {
        if (isJobCancelled(jobId)) {
          addLog(jobId, 'warn', 'Job cancelled by user')
          break
        }

        const studios = await getStudiosNeedingLogos('studio', BATCH_SIZE, progress.studiosFailed)
        if (studios.length === 0) break

        const results = await processWithConcurrency(
          studios,
          CONCURRENCY,
          async (studio) => enrichStudio(studio, pushToEmby, jobId),
          () => isJobCancelled(jobId)
        )

        for (const result of results) {
          progress.studiosProcessed++
          if (result.enriched) {
            progress.studiosEnriched++
          } else {
            progress.studiosFailed++
          }
          if (result.pushedToEmby) {
            progress.logosPushedToEmby++
          }
        }

        updateJobProgress(jobId, progress.studiosProcessed, totalItems)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const rate = (progress.studiosProcessed / parseFloat(elapsed)).toFixed(1)
        addLog(
          jobId,
          'info',
          `🏢 Studios: ${progress.studiosProcessed}/${totalStudios} (${rate}/sec, ${progress.studiosEnriched} with logos)`
        )
      }
    }

    // Step 3: Process networks
    if (totalNetworks > 0 && !isJobCancelled(jobId)) {
      setJobStep(jobId, 2, 'Enriching networks', totalItems)
      addLog(jobId, 'info', `📺 Processing ${totalNetworks} networks...`)

      while (true) {
        if (isJobCancelled(jobId)) {
          addLog(jobId, 'warn', 'Job cancelled by user')
          break
        }

        const networks = await getStudiosNeedingLogos('network', BATCH_SIZE, progress.networksFailed)
        if (networks.length === 0) break

        const results = await processWithConcurrency(
          networks,
          CONCURRENCY,
          async (network) => enrichStudio(network, pushToEmby, jobId),
          () => isJobCancelled(jobId)
        )

        for (const result of results) {
          progress.networksProcessed++
          if (result.enriched) {
            progress.networksEnriched++
          } else {
            progress.networksFailed++
          }
          if (result.pushedToEmby) {
            progress.logosPushedToEmby++
          }
        }

        const totalProcessed = progress.studiosProcessed + progress.networksProcessed
        updateJobProgress(jobId, totalProcessed, totalItems)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const rate = (totalProcessed / parseFloat(elapsed)).toFixed(1)
        addLog(
          jobId,
          'info',
          `📺 Networks: ${progress.networksProcessed}/${totalNetworks} (${rate}/sec overall, ${progress.networksEnriched} with logos)`
        )
      }
    }

    // Complete job
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
    const totalProcessed = progress.studiosProcessed + progress.networksProcessed
    const totalEnriched = progress.studiosEnriched + progress.networksEnriched
    const avgRate = (totalProcessed / parseFloat(totalDuration)).toFixed(1)

    const summary = `Processed ${progress.studiosProcessed} studios (${progress.studiosEnriched} with logos), ${progress.networksProcessed} networks (${progress.networksEnriched} with logos) in ${totalDuration}s (${avgRate}/sec). ${progress.logosPushedToEmby} pushed to Emby.`
    addLog(jobId, 'info', `🎉 ${summary}`)
    completeJob(jobId, { progress })

    logger.info(progress, 'Studio logo enrichment complete')
    return progress
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'Studio logo enrichment failed')
    failJob(jobId, error)
    throw err
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get studio logo enrichment statistics
 */
export async function getStudioLogoStats(): Promise<{
  studios: { total: number; withLogos: number; pending: number }
  networks: { total: number; withLogos: number; pending: number }
  pushedToEmby: number
}> {
  const studioStats = await queryOne<{ total: string; with_logos: string }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE logo_path IS NOT NULL) as with_logos
     FROM studios_networks
     WHERE type = 'studio'`
  )

  const networkStats = await queryOne<{ total: string; with_logos: string }>(
    `SELECT 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE logo_path IS NOT NULL) as with_logos
     FROM studios_networks
     WHERE type = 'network'`
  )

  const embyStats = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM studios_networks WHERE emby_synced_at IS NOT NULL`
  )

  const totalStudios = parseInt(studioStats?.total || '0', 10)
  const studiosWithLogos = parseInt(studioStats?.with_logos || '0', 10)
  const totalNetworks = parseInt(networkStats?.total || '0', 10)
  const networksWithLogos = parseInt(networkStats?.with_logos || '0', 10)

  return {
    studios: {
      total: totalStudios,
      withLogos: studiosWithLogos,
      pending: totalStudios - studiosWithLogos,
    },
    networks: {
      total: totalNetworks,
      withLogos: networksWithLogos,
      pending: totalNetworks - networksWithLogos,
    },
    pushedToEmby: parseInt(embyStats?.count || '0', 10),
  }
}

/**
 * Get studio/network by name for display
 */
export async function getStudioByName(
  name: string,
  type: 'studio' | 'network'
): Promise<{
  id: string
  name: string
  tmdbId: number | null
  logoPath: string | null
  logoLocalPath: string | null
  embyId: string | null
} | null> {
  const result = await queryOne<{
    id: string
    name: string
    tmdb_id: number | null
    logo_path: string | null
    logo_local_path: string | null
    emby_id: string | null
  }>(
    `SELECT id, name, tmdb_id, logo_path, logo_local_path, emby_id
     FROM studios_networks
     WHERE name = $1 AND type = $2`,
    [name, type]
  )

  if (!result) return null

  return {
    id: result.id,
    name: result.name,
    tmdbId: result.tmdb_id,
    logoPath: result.logo_path,
    logoLocalPath: result.logo_local_path,
    embyId: result.emby_id,
  }
}

/**
 * Get logo URL for a studio/network
 * Returns local path if available, otherwise TMDB URL
 */
export function getStudioLogoUrl(
  logoLocalPath: string | null,
  logoPath: string | null
): string | null {
  if (logoLocalPath) {
    // Return API endpoint for local image
    return `/api/images/studios/${logoLocalPath.replace('studios/', '')}`
  }
  if (logoPath) {
    // Return TMDB URL
    return getImageUrl(logoPath, 'w185')
  }
  return null
}

