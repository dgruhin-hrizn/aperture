import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import {
  createJobProgress,
  updateJobProgress,
  setJobStep,
  addLog,
  completeJob,
  failJob,
} from '../jobs/progress.js'

const logger = createChildLogger('strm-writer')

/**
 * Download an image from URL and save it locally
 */
async function downloadImage(url: string, destPath: string): Promise<boolean> {
  const filename = destPath.split('/').pop()
  try {
    logger.info({ url: url.substring(0, 80), filename }, '📥 Downloading image...')
    const startTime = Date.now()
    const response = await fetch(url)
    if (!response.ok) {
      logger.warn({ url, status: response.status, filename }, '❌ Failed to download image')
      return false
    }
    const buffer = await response.arrayBuffer()
    const sizeKB = Math.round(buffer.byteLength / 1024)
    await fs.writeFile(destPath, Buffer.from(buffer))
    const duration = Date.now() - startTime
    logger.info({ filename, sizeKB, durationMs: duration }, `✅ Image saved (${sizeKB}KB in ${duration}ms)`)
    return true
  } catch (err) {
    logger.error({ err, url, filename }, '❌ Error downloading image')
    return false
  }
}

interface Movie {
  id: string
  providerItemId: string
  title: string
  year: number | null
  path: string | null
  mediaSources: Array<{ path: string }> | null
  // Metadata for NFO generation
  overview: string | null
  communityRating: number | null
  criticRating: number | null
  runtimeMinutes: number | null
  genres: string[] | null
  posterUrl: string | null
  backdropUrl: string | null
  // AI-generated explanation for why this movie was recommended
  aiExplanation: string | null
}

interface StrmConfig {
  strmRoot: string
  libraryRoot: string
  libraryNamePrefix: string
  libraryPathPrefix: string
  useStreamingUrl: boolean
  downloadImages: boolean
}

function getConfig(): StrmConfig {
  return {
    strmRoot: process.env.MEDIA_SERVER_STRM_ROOT || '/strm',
    libraryRoot: process.env.MEDIA_SERVER_LIBRARY_ROOT || '/mnt/media',
    libraryNamePrefix: process.env.AI_LIBRARY_NAME_PREFIX || 'AI Picks - ',
    libraryPathPrefix: process.env.AI_LIBRARY_PATH_PREFIX || '/strm/aperture/',
    useStreamingUrl: process.env.STRM_USE_STREAMING_URL === 'true',
    downloadImages: process.env.STRM_DOWNLOAD_IMAGES === 'true',
  }
}

/**
 * Sanitize a filename for filesystem use
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build base filename for a movie (without extension)
 */
function buildBaseFilename(movie: Movie): string {
  const title = sanitizeFilename(movie.title)
  const year = movie.year ? ` (${movie.year})` : ''
  return `${title}${year} [${movie.providerItemId}]`
}

/**
 * Build STRM file path for a movie
 */
function buildStrmFilename(movie: Movie): string {
  return `${buildBaseFilename(movie)}.strm`
}

/**
 * Build NFO file path for a movie
 */
function buildNfoFilename(movie: Movie): string {
  return `${buildBaseFilename(movie)}.nfo`
}

/**
 * Build poster image filename for a movie
 * Emby looks for <basename>-poster.jpg
 */
function buildPosterFilename(movie: Movie): string {
  return `${buildBaseFilename(movie)}-poster.jpg`
}

/**
 * Build backdrop/fanart image filename for a movie
 * Emby looks for <basename>-fanart.jpg or backdrop.jpg
 */
function buildBackdropFilename(movie: Movie): string {
  return `${buildBaseFilename(movie)}-fanart.jpg`
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate NFO content for a movie
 * NFO files contain metadata that Emby can read when scanning the library
 * 
 * When downloadImages is true, images are saved locally and Emby auto-detects them.
 * When downloadImages is false, we include remote URLs in the NFO (Emby won't download
 * these automatically, but they serve as hints).
 * 
 * If an AI explanation is provided, it's appended to the plot.
 */
function generateNfoContent(movie: Movie, includeImageUrls: boolean): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<movie>',
    `  <title>${escapeXml(movie.title)}</title>`,
  ]

  if (movie.year) {
    lines.push(`  <year>${movie.year}</year>`)
  }

  // Build the plot - original overview + AI explanation if available
  let plot = movie.overview || ''
  if (movie.aiExplanation) {
    if (plot) {
      plot += '\n\n🎯 Aperture selected this movie because: ' + movie.aiExplanation
    } else {
      plot = '🎯 Aperture selected this movie because: ' + movie.aiExplanation
    }
  }
  if (plot) {
    lines.push(`  <plot>${escapeXml(plot)}</plot>`)
  }

  if (movie.communityRating) {
    lines.push(`  <rating>${movie.communityRating}</rating>`)
  }

  if (movie.criticRating) {
    lines.push(`  <criticrating>${movie.criticRating}</criticrating>`)
  }

  if (movie.runtimeMinutes) {
    lines.push(`  <runtime>${movie.runtimeMinutes}</runtime>`)
  }

  if (movie.genres && movie.genres.length > 0) {
    for (const genre of movie.genres) {
      lines.push(`  <genre>${escapeXml(genre)}</genre>`)
    }
  }

  // Include remote image URLs in NFO when not downloading locally
  // Note: Emby won't auto-download these, but they're useful metadata
  if (includeImageUrls) {
    if (movie.posterUrl) {
      lines.push(`  <thumb aspect="poster">${escapeXml(movie.posterUrl)}</thumb>`)
    }
    if (movie.backdropUrl) {
      lines.push(`  <fanart>`)
      lines.push(`    <thumb>${escapeXml(movie.backdropUrl)}</thumb>`)
      lines.push(`  </fanart>`)
    }
  }

  lines.push('</movie>')
  
  return lines.join('\n')
}

/**
 * Get the content to write inside the STRM file
 */
function getStrmContent(movie: Movie, config: StrmConfig): string {
  // If streaming URL is preferred
  if (config.useStreamingUrl) {
    const provider = getMediaServerProvider()
    const apiKey = process.env.MEDIA_SERVER_API_KEY || ''
    return provider.getStreamUrl(apiKey, movie.providerItemId)
  }

  // Try to get the actual file path
  if (movie.mediaSources && movie.mediaSources.length > 0) {
    const mediaPath = movie.mediaSources[0].path
    if (mediaPath) {
      return mediaPath
    }
  }

  if (movie.path) {
    return movie.path
  }

  // Fallback to streaming URL
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY || ''
  return provider.getStreamUrl(apiKey, movie.providerItemId)
}

/**
 * Write a single file (used for parallel writes)
 */
async function writeFileWithRetry(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * File write task for batched parallel processing
 */
interface FileWriteTask {
  path: string
  content: string
  movie: Movie
  type: 'strm' | 'nfo'
}

/**
 * Write STRM files for a user's recommendations
 */
export async function writeStrmFilesForUser(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ written: number; deleted: number; localPath: string; embyPath: string }> {
  const config = getConfig()
  const startTime = Date.now()

  // Build paths:
  // - localPath: where Aperture writes files (mounted share on this machine)
  // - embyPath: where Emby sees them (path inside Emby container)
  const localPath = path.join(config.strmRoot, 'aperture', providerUserId)
  const embyPath = path.join(config.libraryPathPrefix, providerUserId)

  logger.info({ userId, localPath, embyPath }, '📁 Starting STRM file generation')

  // Ensure directory exists on local mount
  await fs.mkdir(localPath, { recursive: true })
  logger.info({ localPath }, '📂 Directory ready')

  // Get user's latest recommendations
  const latestRun = await queryOne<{ id: string }>(
    `SELECT id FROM recommendation_runs
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )

  if (!latestRun) {
    logger.warn({ userId }, 'No recommendations found')
    return { written: 0, deleted: 0, localPath, embyPath }
  }

  // Get selected movies from the run with full metadata for NFO generation
  const recommendations = await query<{
    movie_id: string
    provider_item_id: string
    title: string
    year: number | null
    path: string | null
    media_sources: string | null
    overview: string | null
    community_rating: string | null
    critic_rating: string | null
    runtime_minutes: number | null
    genres: string[] | null
    poster_url: string | null
    backdrop_url: string | null
    ai_explanation: string | null
  }>(
    `SELECT rc.movie_id, m.provider_item_id, m.title, m.year, m.path, m.media_sources::text,
            m.overview, m.community_rating, m.critic_rating, m.runtime_minutes,
            m.genres, m.poster_url, m.backdrop_url, rc.ai_explanation
     FROM recommendation_candidates rc
     JOIN movies m ON m.id = rc.movie_id
     WHERE rc.run_id = $1 AND rc.is_selected = true
     ORDER BY rc.rank`,
    [latestRun.id]
  )

  const totalMovies = recommendations.rows.length
  logger.info({ count: totalMovies }, '🎬 Found recommendations, preparing files...')

  // Collect all file write tasks and image downloads
  const expectedFiles = new Set<string>()
  const fileWriteTasks: FileWriteTask[] = []
  const imageDownloads: { url: string; path: string; movieTitle: string }[] = []

  // Prepare all file tasks (fast - just builds strings in memory)
  for (let i = 0; i < recommendations.rows.length; i++) {
    const rec = recommendations.rows[i]
    const movie: Movie = {
      id: rec.movie_id,
      providerItemId: rec.provider_item_id,
      title: rec.title,
      year: rec.year,
      path: rec.path,
      mediaSources: rec.media_sources ? JSON.parse(rec.media_sources) : null,
      overview: rec.overview,
      communityRating: rec.community_rating ? parseFloat(rec.community_rating) : null,
      criticRating: rec.critic_rating ? parseFloat(rec.critic_rating) : null,
      runtimeMinutes: rec.runtime_minutes,
      genres: rec.genres,
      posterUrl: rec.poster_url,
      backdropUrl: rec.backdrop_url,
      aiExplanation: rec.ai_explanation,
    }

    // Prepare STRM file task
    const strmFilename = buildStrmFilename(movie)
    expectedFiles.add(strmFilename)
    const strmContent = getStrmContent(movie, config)
    fileWriteTasks.push({
      path: path.join(localPath, strmFilename),
      content: strmContent,
      movie,
      type: 'strm',
    })

    // Prepare NFO file task
    const nfoFilename = buildNfoFilename(movie)
    expectedFiles.add(nfoFilename)
    const nfoContent = generateNfoContent(movie, !config.downloadImages)
    fileWriteTasks.push({
      path: path.join(localPath, nfoFilename),
      content: nfoContent,
      movie,
      type: 'nfo',
    })

    // Queue images for download (if enabled)
    if (config.downloadImages) {
      if (movie.posterUrl) {
        const posterFilename = buildPosterFilename(movie)
        expectedFiles.add(posterFilename)
        imageDownloads.push({ 
          url: movie.posterUrl, 
          path: path.join(localPath, posterFilename),
          movieTitle: movie.title,
        })
      }
      if (movie.backdropUrl) {
        const backdropFilename = buildBackdropFilename(movie)
        expectedFiles.add(backdropFilename)
        imageDownloads.push({ 
          url: movie.backdropUrl, 
          path: path.join(localPath, backdropFilename),
          movieTitle: movie.title,
        })
      }
    }
  }

  // Write STRM/NFO files in parallel batches (much faster over network mounts)
  const FILE_BATCH_SIZE = 20 // Write 20 files concurrently (10 movies worth)
  const totalFileBatches = Math.ceil(fileWriteTasks.length / FILE_BATCH_SIZE)
  
  logger.info({ 
    totalFiles: fileWriteTasks.length, 
    batchSize: FILE_BATCH_SIZE, 
    totalBatches: totalFileBatches 
  }, '📝 Writing STRM/NFO files in parallel batches...')

  let filesWritten = 0
  for (let i = 0; i < fileWriteTasks.length; i += FILE_BATCH_SIZE) {
    const batchNum = Math.floor(i / FILE_BATCH_SIZE) + 1
    const batch = fileWriteTasks.slice(i, i + FILE_BATCH_SIZE)
    
    // Get unique movies in this batch for logging
    const movieTitles = [...new Set(batch.map(t => t.movie.title))].slice(0, 3)
    const moreCount = [...new Set(batch.map(t => t.movie.title))].length - 3
    const movieList = moreCount > 0 
      ? `${movieTitles.join(', ')} +${moreCount} more`
      : movieTitles.join(', ')
    
    logger.info({ 
      batch: batchNum, 
      of: totalFileBatches, 
      files: batch.length,
      movies: movieList,
    }, `📝 Writing batch ${batchNum}/${totalFileBatches}...`)
    
    const batchStart = Date.now()
    await Promise.all(batch.map(task => writeFileWithRetry(task.path, task.content)))
    const batchDuration = Date.now() - batchStart
    
    filesWritten += batch.length
    logger.info({ 
      batch: batchNum, 
      durationMs: batchDuration,
      avgMs: Math.round(batchDuration / batch.length),
    }, `✅ Batch ${batchNum} complete (${batchDuration}ms)`)
  }

  const fileWriteDuration = Date.now() - startTime
  logger.info({ 
    filesWritten, 
    movies: totalMovies,
    durationMs: fileWriteDuration,
    avgPerFileMs: Math.round(fileWriteDuration / filesWritten),
  }, '📝 All STRM/NFO files written')

  // Download images in parallel batches
  if (imageDownloads.length > 0) {
    const IMAGE_BATCH_SIZE = 10
    const totalImageBatches = Math.ceil(imageDownloads.length / IMAGE_BATCH_SIZE)
    
    logger.info({ 
      total: imageDownloads.length, 
      batchSize: IMAGE_BATCH_SIZE, 
      totalBatches: totalImageBatches 
    }, '📥 Starting image downloads...')
    
    const imageStartTime = Date.now()
    for (let i = 0; i < imageDownloads.length; i += IMAGE_BATCH_SIZE) {
      const batchNum = Math.floor(i / IMAGE_BATCH_SIZE) + 1
      const batch = imageDownloads.slice(i, i + IMAGE_BATCH_SIZE)
      
      logger.info({ 
        batch: batchNum, 
        of: totalImageBatches, 
        count: batch.length 
      }, `📥 Downloading image batch ${batchNum}/${totalImageBatches}...`)
      
      await Promise.all(batch.map(img => downloadImage(img.url, img.path)))
      logger.info({ batch: batchNum }, `✅ Image batch ${batchNum} complete`)
    }
    
    const imageDuration = Date.now() - imageStartTime
    logger.info({ 
      downloaded: imageDownloads.length,
      durationMs: imageDuration,
    }, '✅ All images downloaded')
  } else {
    logger.info('📷 Image downloads disabled or no URLs available')
  }

  // Delete old files not in current recommendations
  let deleted = 0
  try {
    const existingFiles = await fs.readdir(localPath)
    const filesToDelete = existingFiles.filter(file => {
      const isRelevantFile = file.endsWith('.strm') || 
                             file.endsWith('.nfo') || 
                             file.endsWith('-poster.jpg') || 
                             file.endsWith('-fanart.jpg')
      return isRelevantFile && !expectedFiles.has(file)
    })
    
    if (filesToDelete.length > 0) {
      logger.info({ count: filesToDelete.length }, '🗑️ Cleaning up old files...')
      await Promise.all(filesToDelete.map(file => fs.unlink(path.join(localPath, file))))
      deleted = filesToDelete.length
    }
  } catch {
    // Directory might be empty or not exist yet
  }

  const totalDuration = Date.now() - startTime
  logger.info({ 
    userId, 
    written: totalMovies, 
    deleted, 
    totalDurationMs: totalDuration,
    localPath, 
    embyPath 
  }, '✅ STRM generation complete')

  return {
    written: totalMovies,
    deleted,
    localPath,
    embyPath,
  }
}

/**
 * Get the custom library name for a user, or fall back to default
 */
async function getUserLibraryName(userId: string, displayName: string, config: StrmConfig): Promise<string> {
  // Check for custom library name in user settings
  const settings = await queryOne<{ library_name: string | null }>(
    `SELECT library_name FROM user_settings WHERE user_id = $1`,
    [userId]
  )

  if (settings?.library_name) {
    return settings.library_name
  }

  // Fall back to default prefix + display name
  return `${config.libraryNamePrefix}${displayName}`
}

/**
 * Ensure a user's AI library exists in the media server
 */
export async function ensureUserLibrary(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ libraryId: string; libraryGuid: string; created: boolean }> {
  const config = getConfig()
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const libraryName = await getUserLibraryName(userId, displayName, config)
  const libraryPath = path.join(config.libraryPathPrefix, providerUserId)

  logger.info({ userId, libraryName, libraryPath }, '📚 Checking library status...')

  // Check if we already have a record of this library in our database
  const dbRecord = await queryOne<{ 
    provider_library_id: string
    provider_library_guid: string
    name: string 
  }>(
    `SELECT provider_library_id, provider_library_guid, name FROM strm_libraries
     WHERE user_id = $1 AND channel_id IS NULL`,
    [userId]
  )

  // If library name changed, delete the old record so we create a new one
  if (dbRecord && dbRecord.name !== libraryName) {
    logger.info({ userId, oldName: dbRecord.name, newName: libraryName }, 'Library name changed, clearing old record')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND channel_id IS NULL`,
      [userId]
    )
  }

  // ALWAYS check if the library actually exists in the media server
  // (User may have deleted it manually from Emby)
  const libraries = await provider.getLibraries(apiKey)
  const existingLib = libraries.find((lib) => lib.name === libraryName)

  if (existingLib) {
    logger.info({ libraryName, libraryId: existingLib.id }, '📚 Library exists in media server')
    
    // Ensure we have an up-to-date database record
    // Delete any existing record first, then insert fresh
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND channel_id IS NULL`,
      [userId]
    )
    await query(
      `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, libraryName, libraryPath, existingLib.id, existingLib.guid]
    )

    return { libraryId: existingLib.id, libraryGuid: existingLib.guid!, created: false }
  }

  // Library doesn't exist in media server - need to create it
  logger.info({ userId, libraryName, libraryPath }, '📚 Creating virtual library in media server...')

  // If we had a stale database record, delete it
  if (dbRecord) {
    logger.info({ userId }, 'Clearing stale database record (library was deleted from media server)')
    await query(
      `DELETE FROM strm_libraries WHERE user_id = $1 AND channel_id IS NULL`,
      [userId]
    )
  }

  const result = await provider.createVirtualLibrary(apiKey, libraryName, libraryPath, 'movies')

  // Fetch the library again to get the GUID
  const newLibraries = await provider.getLibraries(apiKey)
  const newLib = newLibraries.find((lib) => lib.name === libraryName)
  const libraryGuid = newLib?.guid || result.libraryId

  // Store the mapping with both ID and GUID
  await query(
    `INSERT INTO strm_libraries (user_id, name, path, provider_library_id, provider_library_guid)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, libraryName, libraryPath, result.libraryId, libraryGuid]
  )

  logger.info({ userId, libraryName, libraryId: result.libraryId, libraryGuid }, '✅ Virtual library created')

  return { libraryId: result.libraryId, libraryGuid, created: true }
}

/**
 * Refresh a user's AI library in the media server
 */
export async function refreshUserLibrary(userId: string): Promise<void> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const library = await queryOne<{ provider_library_id: string }>(
    `SELECT provider_library_id FROM strm_libraries
     WHERE user_id = $1 AND channel_id IS NULL`,
    [userId]
  )

  if (!library?.provider_library_id) {
    logger.warn({ userId }, 'No library found to refresh')
    return
  }

  await provider.refreshLibrary(apiKey, library.provider_library_id)
  logger.info({ userId, libraryId: library.provider_library_id }, 'Library refreshed')
}

/**
 * Update user's library access permissions
 * Adds the AI Picks library to the user's existing library access
 */
export async function updateUserLibraryPermissions(
  userId: string,
  providerUserId: string
): Promise<void> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Get user's AI library GUID from our database
  const library = await queryOne<{ provider_library_guid: string }>(
    `SELECT provider_library_guid FROM strm_libraries
     WHERE user_id = $1 AND channel_id IS NULL`,
    [userId]
  )

  if (!library?.provider_library_guid) {
    logger.warn({ userId }, 'No AI library found for user')
    return
  }

  // Get the user's current library access from the media server
  const currentAccess = await provider.getUserLibraryAccess(apiKey, providerUserId)
  
  // If user has access to all folders, no need to modify
  if (currentAccess.enableAllFolders) {
    logger.debug({ userId }, 'User has access to all folders, skipping permission update')
    return
  }

  // Check if AI library is already in the user's allowed list
  if (currentAccess.enabledFolders.includes(library.provider_library_guid)) {
    logger.debug({ userId }, 'AI library already in user permissions')
    return
  }

  // Add the AI library GUID to the user's existing permissions
  const updatedFolders = [...currentAccess.enabledFolders, library.provider_library_guid]

  await provider.updateUserLibraryAccess(apiKey, providerUserId, updatedFolders)
  logger.info({ userId, libraryGuid: library.provider_library_guid }, 'Added AI library to user permissions')
}

/**
 * Process STRM output for all enabled users
 */
export async function processStrmForAllUsers(
  jobId?: string
): Promise<{
  success: number
  failed: number
  jobId: string
}> {
  const actualJobId = jobId || crypto.randomUUID()
  
  // Initialize job progress
  createJobProgress(actualJobId, 'update-permissions', 2)
  
  try {
    setJobStep(actualJobId, 0, 'Finding enabled users')
    addLog(actualJobId, 'info', '🔍 Finding enabled users...')

    const users = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
    }>('SELECT id, provider_user_id, display_name, username FROM users WHERE is_enabled = true')

    const totalUsers = users.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'warn', '⚠️ No enabled users found')
      completeJob(actualJobId, { success: 0, failed: 0 })
      return { success: 0, failed: 0, jobId: actualJobId }
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} enabled user(s)`)
    setJobStep(actualJobId, 1, 'Processing STRM files', totalUsers)

    let success = 0
    let failed = 0

    for (let i = 0; i < users.rows.length; i++) {
      const user = users.rows[i]
      
      try {
        const displayName = user.display_name || user.username
        addLog(actualJobId, 'info', `📁 Processing STRM for ${displayName}...`)

        // Step 1: Write STRM files first (this creates the directory that Emby needs)
        const strmResult = await writeStrmFilesForUser(user.id, user.provider_user_id, displayName)
        addLog(actualJobId, 'debug', `  📝 STRM files written: ${strmResult.written} files at ${strmResult.localPath}`)

        // Step 2: Now ensure the library exists in the media server (directory exists now)
        const libraryResult = await ensureUserLibrary(user.id, user.provider_user_id, displayName)
        if (libraryResult.created) {
          addLog(actualJobId, 'info', `  📚 Created new library in media server`)
        } else {
          addLog(actualJobId, 'debug', `  📚 Library already exists in media server`)
        }

        // Step 3: Refresh library to pick up new/changed STRM files
        await refreshUserLibrary(user.id)
        addLog(actualJobId, 'debug', `  🔄 Library refreshed`)

        // Step 4: Update user permissions to grant access to the library
        await updateUserLibraryPermissions(user.id, user.provider_user_id)
        addLog(actualJobId, 'debug', `  🔐 User permissions updated`)

        success++
        addLog(actualJobId, 'info', `✅ Completed STRM processing for ${displayName} (${strmResult.written} recommendations)`)
        updateJobProgress(actualJobId, success + failed, totalUsers, `${success + failed}/${totalUsers} users`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to process STRM')
        addLog(actualJobId, 'error', `❌ Failed for ${user.username}: ${errorMsg}`)
        failed++
        updateJobProgress(actualJobId, success + failed, totalUsers, `${success + failed}/${totalUsers} users (${failed} failed)`)
      }
    }

    const finalResult = { success, failed, jobId: actualJobId }
    
    if (failed > 0) {
      addLog(actualJobId, 'warn', `⚠️ Completed with ${failed} failure(s): ${success} succeeded, ${failed} failed`)
    } else {
      addLog(actualJobId, 'info', `🎉 All ${success} user(s) processed successfully!`)
    }
    
    completeJob(actualJobId, finalResult)
    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    addLog(actualJobId, 'error', `❌ Job failed: ${error}`)
    failJob(actualJobId, error)
    throw err
  }
}

