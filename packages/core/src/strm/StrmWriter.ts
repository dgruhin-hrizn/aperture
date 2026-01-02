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

interface Movie {
  id: string
  providerItemId: string
  title: string
  year: number | null
  path: string | null
  mediaSources: Array<{ path: string }> | null
}

interface StrmConfig {
  strmRoot: string
  libraryRoot: string
  libraryNamePrefix: string
  libraryPathPrefix: string
  useStreamingUrl: boolean
}

function getConfig(): StrmConfig {
  return {
    strmRoot: process.env.MEDIA_SERVER_STRM_ROOT || '/strm',
    libraryRoot: process.env.MEDIA_SERVER_LIBRARY_ROOT || '/mnt/media',
    libraryNamePrefix: process.env.AI_LIBRARY_NAME_PREFIX || 'AI Picks - ',
    libraryPathPrefix: process.env.AI_LIBRARY_PATH_PREFIX || '/strm/aperture/',
    useStreamingUrl: process.env.STRM_USE_STREAMING_URL === 'true',
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
 * Build STRM file path for a movie
 */
function buildStrmFilename(movie: Movie): string {
  const title = sanitizeFilename(movie.title)
  const year = movie.year ? ` (${movie.year})` : ''
  return `${title}${year} [${movie.providerItemId}].strm`
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
 * Write STRM files for a user's recommendations
 */
export async function writeStrmFilesForUser(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ written: number; deleted: number; libraryPath: string }> {
  const config = getConfig()

  // Build user's library path
  const libraryPath = path.join(config.libraryPathPrefix, providerUserId)

  logger.info({ userId, libraryPath }, 'Writing STRM files')

  // Ensure directory exists
  await fs.mkdir(libraryPath, { recursive: true })

  // Get user's latest recommendations
  const latestRun = await queryOne<{ id: string }>(
    `SELECT id FROM recommendation_runs
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )

  if (!latestRun) {
    logger.warn({ userId }, 'No recommendations found')
    return { written: 0, deleted: 0, libraryPath }
  }

  // Get selected movies from the run
  const recommendations = await query<{
    movie_id: string
    provider_item_id: string
    title: string
    year: number | null
    path: string | null
    media_sources: string | null
  }>(
    `SELECT rc.movie_id, m.provider_item_id, m.title, m.year, m.path, m.media_sources::text
     FROM recommendation_candidates rc
     JOIN movies m ON m.id = rc.movie_id
     WHERE rc.run_id = $1 AND rc.is_selected = true
     ORDER BY rc.rank`,
    [latestRun.id]
  )

  // Get list of expected STRM files
  const expectedFiles = new Set<string>()

  for (const rec of recommendations.rows) {
    const movie: Movie = {
      id: rec.movie_id,
      providerItemId: rec.provider_item_id,
      title: rec.title,
      year: rec.year,
      path: rec.path,
      mediaSources: rec.media_sources ? JSON.parse(rec.media_sources) : null,
    }

    const filename = buildStrmFilename(movie)
    expectedFiles.add(filename)

    const filePath = path.join(libraryPath, filename)
    const content = getStrmContent(movie, config)

    await fs.writeFile(filePath, content, 'utf-8')
  }

  // Delete old STRM files not in the current recommendations
  let deleted = 0
  try {
    const existingFiles = await fs.readdir(libraryPath)
    for (const file of existingFiles) {
      if (file.endsWith('.strm') && !expectedFiles.has(file)) {
        await fs.unlink(path.join(libraryPath, file))
        deleted++
      }
    }
  } catch {
    // Directory might be empty or not exist yet
  }

  logger.info({ userId, written: recommendations.rows.length, deleted }, 'STRM files written')

  return {
    written: recommendations.rows.length,
    deleted,
    libraryPath,
  }
}

/**
 * Ensure a user's AI library exists in the media server
 */
export async function ensureUserLibrary(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ libraryId: string; created: boolean }> {
  const config = getConfig()
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  const libraryName = `${config.libraryNamePrefix}${displayName}`
  const libraryPath = path.join(config.libraryPathPrefix, providerUserId)

  // Check if we already have a record of this library
  const existing = await queryOne<{ provider_library_id: string }>(
    `SELECT provider_library_id FROM strm_libraries
     WHERE user_id = $1 AND channel_id IS NULL`,
    [userId]
  )

  if (existing?.provider_library_id) {
    return { libraryId: existing.provider_library_id, created: false }
  }

  // Check if library already exists in media server
  const libraries = await provider.getLibraries(apiKey)
  const existingLib = libraries.find((lib) => lib.name === libraryName)

  if (existingLib) {
    // Store the mapping
    await query(
      `INSERT INTO strm_libraries (user_id, name, path, provider_library_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [userId, libraryName, libraryPath, existingLib.id]
    )

    return { libraryId: existingLib.id, created: false }
  }

  // Create the library
  logger.info({ userId, libraryName, libraryPath }, 'Creating virtual library')

  const result = await provider.createVirtualLibrary(apiKey, libraryName, libraryPath, 'movies')

  // Store the mapping
  await query(
    `INSERT INTO strm_libraries (user_id, name, path, provider_library_id)
     VALUES ($1, $2, $3, $4)`,
    [userId, libraryName, libraryPath, result.libraryId]
  )

  return { libraryId: result.libraryId, created: true }
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
 * Ensures only the owner can see their AI Picks library
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

  // Get user's AI library
  const library = await queryOne<{ provider_library_id: string }>(
    `SELECT provider_library_id FROM strm_libraries
     WHERE user_id = $1 AND channel_id IS NULL`,
    [userId]
  )

  if (!library?.provider_library_id) {
    return
  }

  // Get all libraries the user should have access to
  const allLibraries = await provider.getLibraries(apiKey)

  // User should have access to their AI library plus any shared ones
  // For now, just ensure they have access to their own
  const allowedIds = [library.provider_library_id]

  // Note: In a full implementation, you'd also add the user's regular libraries
  // This is simplified for the initial implementation

  await provider.updateUserLibraryAccess(apiKey, providerUserId, allowedIds)
  logger.info({ userId, libraryId: library.provider_library_id }, 'Library permissions updated')
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

        // Ensure library exists
        await ensureUserLibrary(user.id, user.provider_user_id, displayName)
        addLog(actualJobId, 'debug', `  📚 Library ensured for ${displayName}`)

        // Write STRM files
        await writeStrmFilesForUser(user.id, user.provider_user_id, displayName)
        addLog(actualJobId, 'debug', `  📝 STRM files written for ${displayName}`)

        // Refresh library
        await refreshUserLibrary(user.id)
        addLog(actualJobId, 'debug', `  🔄 Library refreshed for ${displayName}`)

        success++
        addLog(actualJobId, 'info', `✅ Completed STRM processing for ${displayName}`)
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

