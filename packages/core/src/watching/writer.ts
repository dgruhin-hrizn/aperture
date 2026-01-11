/**
 * Shows You Watch STRM Writer
 *
 * Generates symlinks/STRM files for a user's "Shows You Watch" library.
 * Simpler than Top Picks - no ranking or special sorting, just symlinks to
 * the user's selected series.
 *
 * INCREMENTAL UPDATE OPTIMIZATION:
 * - Tracks existing series by provider item ID
 * - Only writes NFO files when content actually changes (using content hash)
 * - Preserves file modification times to avoid triggering library scans
 * - Only triggers library refresh when series are added or removed
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getConfig } from '../strm/config.js'
import { sanitizeFilename } from '../strm/filenames.js'
import { downloadImage } from '../strm/images.js'
import { symlinkArtwork, SERIES_SKIP_FILES } from '../strm/artwork.js'
import { getWatchingLibraryConfig } from '../settings/systemSettings.js'
import type { ImageDownloadTask } from '../strm/types.js'
import {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
} from '../jobs/index.js'

const logger = createChildLogger('watching-writer')

/**
 * Write file only if content has changed (preserves modification time if unchanged)
 * Returns true if the file was actually written (new or changed)
 */
async function writeFileIfChanged(filePath: string, content: string): Promise<boolean> {
  try {
    const existingContent = await fs.readFile(filePath, 'utf-8')
    if (existingContent === content) {
      return false // No change, file preserved
    }
  } catch {
    // File doesn't exist, will be created
  }
  await fs.writeFile(filePath, content, 'utf-8')
  return true
}

interface WatchingSeries {
  id: string
  title: string
  originalTitle: string | null
  year: number | null
  providerItemId: string
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  contentRating: string | null
  network: string | null
  status: string | null
  totalSeasons: number | null
  totalEpisodes: number | null
  endYear: number | null
  studios: string[]
  directors: string[]
  writers: string[]
  actors: Array<{ name: string; role?: string; thumb?: string }>
  imdbId: string | null
  tmdbId: string | null
  tvdbId: string | null
  addedAt: Date // When the series was added to the watching list
}

/**
 * Escape special XML characters
 */
function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate NFO content for a watching series
 * Standard tvshow.nfo format without ranking badges
 *
 * Uses the stable `addedAt` timestamp (when user added the series) rather than
 * current time, to prevent unnecessary library metadata refreshes.
 */
function generateWatchingSeriesNfo(series: WatchingSeries): string {
  const lines = ['<?xml version="1.0" encoding="utf-8" standalone="yes"?>', '<tvshow>']

  // Plot with CDATA for special characters
  if (series.overview) {
    lines.push(`  <plot><![CDATA[${series.overview}]]></plot>`)
  }

  lines.push(`  <lockdata>false</lockdata>`)
  // Use stable addedAt date instead of current time to avoid triggering metadata refreshes
  const dateAdded =
    series.addedAt instanceof Date
      ? series.addedAt.toISOString().slice(0, 19).replace('T', ' ')
      : new Date(series.addedAt).toISOString().slice(0, 19).replace('T', ' ')
  lines.push(`  <dateadded>${dateAdded}</dateadded>`)
  lines.push(`  <title>${escapeXml(series.title)}</title>`)

  // Original title
  if (series.originalTitle) {
    lines.push(`  <originaltitle>${escapeXml(series.originalTitle)}</originaltitle>`)
  } else {
    lines.push(`  <originaltitle>${escapeXml(series.title)}</originaltitle>`)
  }

  // Actors with type
  if (series.actors?.length) {
    for (const actor of series.actors) {
      lines.push(`  <actor>`)
      lines.push(`    <name>${escapeXml(actor.name)}</name>`)
      if (actor.role) {
        lines.push(`    <role>${escapeXml(actor.role)}</role>`)
      }
      lines.push(`    <type>Actor</type>`)
      if (actor.thumb) {
        lines.push(`    <thumb>${escapeXml(actor.thumb)}</thumb>`)
      }
      lines.push(`  </actor>`)
    }
  }

  // Rating
  if (series.communityRating != null) {
    const rating =
      typeof series.communityRating === 'number'
        ? series.communityRating
        : parseFloat(String(series.communityRating))
    if (!isNaN(rating)) {
      lines.push(`  <rating>${rating.toFixed(1)}</rating>`)
    }
  }

  // Year
  if (series.year) {
    lines.push(`  <year>${series.year}</year>`)
  }

  // Sort title
  lines.push(`  <sorttitle>${escapeXml(series.title)}</sorttitle>`)

  // Content rating
  if (series.contentRating) {
    lines.push(`  <mpaa>${escapeXml(series.contentRating)}</mpaa>`)
  }

  // External IDs
  if (series.imdbId) {
    lines.push(`  <imdb_id>${escapeXml(series.imdbId)}</imdb_id>`)
  }
  if (series.tmdbId) {
    lines.push(`  <tmdbid>${escapeXml(series.tmdbId)}</tmdbid>`)
  }

  // Premiered year
  if (series.year) {
    lines.push(`  <premiered>${series.year}-01-01</premiered>`)
  }

  // End year (for ended series)
  if (series.endYear) {
    lines.push(`  <enddate>${series.endYear}-12-31</enddate>`)
  }

  // Genres
  if (series.genres?.length) {
    for (const genre of series.genres) {
      lines.push(`  <genre>${escapeXml(genre)}</genre>`)
    }
  }

  // Network/Studio
  if (series.network) {
    lines.push(`  <studio>${escapeXml(series.network)}</studio>`)
  }
  if (series.studios?.length) {
    for (const studio of series.studios) {
      if (studio !== series.network) {
        lines.push(`  <studio>${escapeXml(studio)}</studio>`)
      }
    }
  }

  // Unique IDs
  if (series.tvdbId) {
    lines.push(`  <uniqueid type="tvdb" default="true">${escapeXml(series.tvdbId)}</uniqueid>`)
    lines.push(`  <tvdbid>${escapeXml(series.tvdbId)}</tvdbid>`)
  }
  if (series.imdbId) {
    lines.push(`  <uniqueid type="imdb">${escapeXml(series.imdbId)}</uniqueid>`)
  }
  if (series.tmdbId) {
    lines.push(`  <uniqueid type="tmdb">${escapeXml(series.tmdbId)}</uniqueid>`)
  }

  // Status
  if (series.status) {
    lines.push(`  <status>${escapeXml(series.status)}</status>`)
  }

  // Tag for identification
  lines.push(`  <tag>Currently Watching</tag>`)

  lines.push('</tvshow>')
  return lines.join('\n')
}

/**
 * Build filename for watching series folder
 */
function buildWatchingSeriesFilename(series: WatchingSeries): string {
  const title = sanitizeFilename(series.title)
  const year = series.year ? ` (${series.year})` : ''
  return `${title}${year} [${series.providerItemId}]`
}

/**
 * Write STRM files or symlinks for a user's watching series
 *
 * INCREMENTAL UPDATE: Returns `hasChanges` to indicate if files were actually
 * added or removed, allowing the caller to skip library refresh when unchanged.
 */
export async function writeWatchingSeriesForUser(
  userId: string,
  providerUserId: string
): Promise<{
  written: number
  deleted: number
  added: number
  unchanged: number
  hasChanges: boolean
  localPath: string
  embyPath: string
}> {
  const config = await getConfig()
  const watchingConfig = await getWatchingLibraryConfig()
  const useSymlinks = watchingConfig.useSymlinks
  const startTime = Date.now()

  // Get user's display name for folder naming
  const userRecord = await queryOne<{ display_name: string | null; username: string }>(
    'SELECT display_name, username FROM users WHERE id = $1',
    [userId]
  )
  const displayName = userRecord?.display_name || userRecord?.username || providerUserId

  // Build user folder name (DisplayName_ID format for readability)
  const { getUserFolderName } = await import('../strm/filenames.js')
  const userFolder = getUserFolderName(displayName, providerUserId)

  // Build paths for this user's watching library:
  // - localPath: where Aperture writes files (inside Aperture container)
  // - embyPath: where media server sees them (inside Emby/Jellyfin container)
  // Both use 'aperture-watching' subfolder for "Shows You Watch" library
  const localPath = path.join(config.strmRoot, 'aperture-watching', userFolder)
  const embyPath = path.join(config.libraryPathPrefix, 'aperture-watching', userFolder)

  // Get user's watching series from database (include added_at for stable dateadded)
  const watchingResult = await query<{
    series_id: string
    title: string
    original_title: string | null
    year: number | null
    end_year: number | null
    provider_item_id: string
    poster_url: string | null
    backdrop_url: string | null
    overview: string | null
    genres: string[]
    community_rating: number | null
    content_rating: string | null
    network: string | null
    status: string | null
    total_seasons: number | null
    total_episodes: number | null
    studios: string | null
    directors: string[] | null
    writers: string[] | null
    actors: string | null
    imdb_id: string | null
    tmdb_id: string | null
    tvdb_id: string | null
    added_at: Date
  }>(
    `SELECT s.id as series_id, s.title, s.original_title, s.year, s.end_year,
            s.provider_item_id, s.poster_url, s.backdrop_url, s.overview,
            s.genres, s.community_rating, s.content_rating, s.network, s.status,
            s.total_seasons, s.total_episodes, s.studios, s.directors, s.writers,
            s.actors, s.imdb_id, s.tmdb_id, s.tvdb_id, uws.added_at
     FROM user_watching_series uws
     JOIN series s ON s.id = uws.series_id
     WHERE uws.user_id = $1
     ORDER BY uws.added_at DESC`,
    [userId]
  )

  logger.info(
    { userId, localPath, embyPath, useSymlinks, count: watchingResult.rows.length },
    `📁 Writing watching series ${useSymlinks ? 'symlinks' : 'STRM files'}`
  )

  // Ensure directory exists
  await fs.mkdir(localPath, { recursive: true })

  // Get existing series folders to track deletions and unchanged series
  const existingFolders = new Set(await fs.readdir(localPath).catch(() => []))
  const currentFolders = new Set<string>()

  let written = 0
  let added = 0 // New series added
  let unchanged = 0 // Existing series that weren't modified

  for (const row of watchingResult.rows) {
    // Parse JSONB fields
    let actors: Array<{ name: string; role?: string; thumb?: string }> = []
    let studiosArray: Array<{ id?: string; name: string }> = []

    if (row.actors) {
      try {
        actors = typeof row.actors === 'string' ? JSON.parse(row.actors) : row.actors
      } catch {
        /* ignore */
      }
    }
    if (row.studios) {
      try {
        studiosArray = typeof row.studios === 'string' ? JSON.parse(row.studios) : row.studios
      } catch {
        /* ignore */
      }
    }

    const series: WatchingSeries = {
      id: row.series_id,
      title: row.title,
      originalTitle: row.original_title,
      year: row.year,
      providerItemId: row.provider_item_id,
      posterUrl: row.poster_url,
      backdropUrl: row.backdrop_url,
      overview: row.overview,
      genres: row.genres || [],
      communityRating: row.community_rating,
      contentRating: row.content_rating,
      network: row.network,
      status: row.status,
      totalSeasons: row.total_seasons,
      totalEpisodes: row.total_episodes,
      endYear: row.end_year,
      studios: studiosArray.map((s) => (typeof s === 'string' ? s : s.name)),
      directors: row.directors || [],
      writers: row.writers || [],
      actors,
      imdbId: row.imdb_id,
      tmdbId: row.tmdb_id,
      tvdbId: row.tvdb_id,
      addedAt: row.added_at,
    }

    // Get first episode to find the original series folder path
    const firstEpisode = await queryOne<{
      path: string | null
      media_sources: string | null
    }>(
      'SELECT path, media_sources FROM episodes WHERE series_id = $1 ORDER BY season_number, episode_number LIMIT 1',
      [series.id]
    )

    if (!firstEpisode) {
      logger.warn(
        { seriesId: series.id, title: series.title },
        'No episodes found for series, skipping'
      )
      continue
    }

    // Get original episode file path to derive series folder
    let originalEpisodePath = firstEpisode.path
    if (!originalEpisodePath && firstEpisode.media_sources) {
      try {
        const sources = JSON.parse(firstEpisode.media_sources)
        if (sources[0]?.path) {
          originalEpisodePath = sources[0].path
        }
      } catch {
        // Ignore parse errors
      }
    }

    if (!originalEpisodePath) {
      logger.warn(
        { seriesId: series.id, title: series.title },
        'No file path found for episode, skipping'
      )
      continue
    }

    // Derive original series folder (go up from episode: Episode -> Season -> Series)
    const originalSeriesFolder = path.dirname(path.dirname(originalEpisodePath))

    // Create series folder
    const seriesFolderName = buildWatchingSeriesFilename(series)
    const seriesPath = path.join(localPath, seriesFolderName)
    currentFolders.add(seriesFolderName)

    // Check if folder already exists (for tracking new vs existing series)
    const isNewSeries = !existingFolders.has(seriesFolderName)
    if (isNewSeries) {
      await fs.mkdir(seriesPath, { recursive: true })
      added++
      logger.debug({ title: series.title }, '➕ New series added to watching library')
    }

    // Write tvshow.nfo ONLY if content has changed (preserves file timestamps)
    const nfoPath = path.join(seriesPath, 'tvshow.nfo')
    const nfoContent = generateWatchingSeriesNfo(series)
    const nfoChanged = await writeFileIfChanged(nfoPath, nfoContent)

    if (!isNewSeries && !nfoChanged) {
      unchanged++
    }

    if (useSymlinks) {
      // SYMLINKS MODE: Symlink entire season folders from original location
      const seasons = await query<{ season_number: number; season_path: string }>(
        `SELECT DISTINCT season_number, 
                regexp_replace(path, '/[^/]+$', '') as season_path
         FROM episodes 
         WHERE series_id = $1 AND path IS NOT NULL
         ORDER BY season_number`,
        [series.id]
      )

      for (const season of seasons.rows) {
        const seasonFolderName = `Season ${String(season.season_number).padStart(2, '0')}`
        const symlinkPath = path.join(seriesPath, seasonFolderName)

        try {
          // Check if symlink already exists
          await fs.lstat(symlinkPath)
        } catch {
          // Symlink doesn't exist, create it
          try {
            await fs.symlink(season.season_path, symlinkPath)
            logger.debug(
              { seasonFolderName, originalPath: season.season_path },
              'Created season symlink'
            )
          } catch (err) {
            logger.debug({ err, seasonFolderName }, 'Failed to create season symlink')
          }
        }
      }

      // Symlink artwork from original series folder
      await symlinkArtwork({
        mediaServerPath: originalSeriesFolder,
        targetPath: seriesPath,
        skipFiles: SERIES_SKIP_FILES,
        skipSeasonFolders: true,
        mediaType: 'series',
        title: series.title,
      })
    } else {
      // STRM MODE: Create STRM files for each episode
      const episodes = await query<{
        id: string
        provider_item_id: string
        season_number: number
        episode_number: number
        title: string
        path: string | null
      }>(
        `SELECT id, provider_item_id, season_number, episode_number, title, path
         FROM episodes
         WHERE series_id = $1
         ORDER BY season_number, episode_number`,
        [series.id]
      )

      // Group episodes by season
      const seasonMap = new Map<number, typeof episodes.rows>()
      for (const ep of episodes.rows) {
        if (!seasonMap.has(ep.season_number)) {
          seasonMap.set(ep.season_number, [])
        }
        seasonMap.get(ep.season_number)!.push(ep)
      }

      // Process each season
      for (const [seasonNum, seasonEpisodes] of seasonMap) {
        const seasonFolderName = `Season ${String(seasonNum).padStart(2, '0')}`
        const seasonFolderPath = path.join(seriesPath, seasonFolderName)

        await fs.mkdir(seasonFolderPath, { recursive: true })

        // Process each episode
        for (const ep of seasonEpisodes) {
          // Episode filename: SeriesName S01E01 Episode Title.strm
          const episodeFilename = `${sanitizeFilename(series.title)} S${String(ep.season_number).padStart(2, '0')}E${String(ep.episode_number).padStart(2, '0')} ${sanitizeFilename(ep.title)}`

          // Write STRM file with original file path
          if (!ep.path) {
            logger.warn(
              { series: series.title, episode: ep.title },
              'No file path for episode, skipping'
            )
            continue
          }
          const strmPath = path.join(seasonFolderPath, `${episodeFilename}.strm`)
          await fs.writeFile(strmPath, ep.path, 'utf-8')
        }
      }

      // Symlink artwork files from original series folder (even in STRM mode)
      await symlinkArtwork({
        mediaServerPath: originalSeriesFolder,
        targetPath: seriesPath,
        skipFiles: SERIES_SKIP_FILES,
        skipSeasonFolders: true,
        mediaType: 'series',
        title: series.title,
      })

      logger.debug(
        { series: series.title, seasons: seasonMap.size, episodes: episodes.rows.length },
        '✅ Series STRM files created'
      )
    }

    // Download poster if not symlinked
    if (config.downloadImages && series.posterUrl) {
      const posterPath = path.join(seriesPath, 'poster.jpg')
      try {
        await fs.access(posterPath)
      } catch {
        const posterTask: ImageDownloadTask = {
          url: series.posterUrl,
          path: posterPath,
          movieTitle: series.title,
          isPoster: true,
        }
        await downloadImage(posterTask)
      }
    }

    // Download backdrop if not symlinked
    if (config.downloadImages && series.backdropUrl) {
      const fanartPath = path.join(seriesPath, 'fanart.jpg')
      try {
        await fs.access(fanartPath)
      } catch {
        const backdropTask: ImageDownloadTask = {
          url: series.backdropUrl,
          path: fanartPath,
          movieTitle: series.title,
          isPoster: false,
        }
        await downloadImage(backdropTask)
      }
    }

    written++
    logger.debug({ title: series.title }, '📺 Processed watching series')
  }

  // Remove series that are no longer in the watching list
  let deleted = 0
  for (const folder of existingFolders) {
    if (!currentFolders.has(folder)) {
      const folderPath = path.join(localPath, folder)
      try {
        await fs.rm(folderPath, { recursive: true, force: true })
        deleted++
        logger.debug({ folder }, 'Removed series no longer in watching list')
      } catch (err) {
        logger.warn({ err, folder }, 'Failed to remove old series folder')
      }
    }
  }

  const duration = Date.now() - startTime
  const hasChanges = added > 0 || deleted > 0

  logger.info(
    { written, added, unchanged, deleted, hasChanges, duration, localPath },
    hasChanges
      ? '✅ Watching series updated (library refresh needed)'
      : '✅ Watching series unchanged (no library refresh needed)'
  )

  return { written, deleted, added, unchanged, hasChanges, localPath, embyPath }
}

/**
 * Process watching library for a single user
 * Creates/updates library and permissions
 *
 * OPTIMIZATION: Only triggers library refresh when files are actually added or removed,
 * preventing unnecessary full library scans when nothing has changed.
 */
export async function processWatchingForUser(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{
  written: number
  added: number
  unchanged: number
  deleted: number
  libraryCreated: boolean
  libraryRefreshed: boolean
}> {
  const {
    ensureUserWatchingLibrary,
    updateUserWatchingLibraryPermissions,
    refreshUserWatchingLibrary,
  } = await import('./library.js')

  // Step 1: Write STRM files first (incremental - only writes changed files)
  const strmResult = await writeWatchingSeriesForUser(userId, providerUserId)

  // Skip library creation if no series
  if (strmResult.written === 0) {
    logger.info({ userId, displayName }, '⏭️ No watching series, skipping library creation')
    return {
      written: 0,
      added: 0,
      unchanged: 0,
      deleted: 0,
      libraryCreated: false,
      libraryRefreshed: false,
    }
  }

  // Step 2: Ensure library exists in media server
  const libraryResult = await ensureUserWatchingLibrary(userId, providerUserId, displayName)

  // Step 3: ONLY refresh library if files were added or removed
  // This is the key optimization - skip refresh if nothing changed to avoid full library scans
  let libraryRefreshed = false
  if (strmResult.hasChanges || libraryResult.created) {
    await refreshUserWatchingLibrary(userId)
    libraryRefreshed = true
    logger.info(
      { userId, displayName, added: strmResult.added, deleted: strmResult.deleted },
      '🔄 Library refresh triggered (files changed)'
    )
  } else {
    logger.info(
      { userId, displayName, unchanged: strmResult.unchanged },
      '⏭️ Skipping library refresh (no changes detected)'
    )
  }

  // Step 4: Update user permissions
  await updateUserWatchingLibraryPermissions(userId, providerUserId)

  return {
    written: strmResult.written,
    added: strmResult.added,
    unchanged: strmResult.unchanged,
    deleted: strmResult.deleted,
    libraryCreated: libraryResult.created,
    libraryRefreshed,
  }
}

/**
 * Process watching libraries for ALL users who have items in their watching list
 * This is the main entry point for the scheduled job
 */
export async function processWatchingLibrariesForAllUsers(jobId?: string): Promise<{
  success: number
  failed: number
  jobId: string
  users: Array<{ userId: string; displayName: string; written: number; error?: string }>
}> {
  const actualJobId = jobId || crypto.randomUUID()

  createJobProgress(actualJobId, 'sync-watching-libraries', 2)

  const users: Array<{ userId: string; displayName: string; written: number; error?: string }> = []

  try {
    // Check if the watching library feature is enabled
    const watchingConfig = await getWatchingLibraryConfig()
    if (!watchingConfig.enabled) {
      addLog(actualJobId, 'info', '⏭️ Watching library feature is disabled, skipping job')
      completeJob(actualJobId, { success: 0, failed: 0, skipped: true })
      return { success: 0, failed: 0, jobId: actualJobId, users: [] }
    }

    setJobStep(actualJobId, 0, 'Finding users with watching items')
    addLog(actualJobId, 'info', '🔍 Finding users with watching series...')

    // Only get users who have at least one item in their watching list
    const usersResult = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
      watching_count: number
    }>(`
      SELECT u.id, u.provider_user_id, u.display_name, u.username, COUNT(uws.id) as watching_count
      FROM users u
      INNER JOIN user_watching_series uws ON uws.user_id = u.id
      WHERE u.is_enabled = true
      GROUP BY u.id, u.provider_user_id, u.display_name, u.username
      HAVING COUNT(uws.id) > 0
    `)

    const totalUsers = usersResult.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'info', '📭 No users have items in their watching list')
      completeJob(actualJobId, { success: 0, failed: 0 })
      return { success: 0, failed: 0, jobId: actualJobId, users: [] }
    }

    addLog(actualJobId, 'info', `👥 Found ${totalUsers} user(s) with watching items`)
    setJobStep(actualJobId, 1, 'Processing watching libraries', totalUsers)

    let success = 0
    let failed = 0

    for (let i = 0; i < usersResult.rows.length; i++) {
      const user = usersResult.rows[i]
      const displayName = user.display_name || user.username

      try {
        addLog(
          actualJobId,
          'info',
          `📺 Processing watching library for ${displayName} (${user.watching_count} series)...`
        )

        // Process the user's watching library (incremental update)
        const result = await processWatchingForUser(user.id, user.provider_user_id, displayName)

        users.push({
          userId: user.id,
          displayName,
          written: result.written,
        })

        if (result.libraryCreated) {
          addLog(actualJobId, 'info', `  📚 Created new watching library in media server`)
        }

        // Log incremental update status
        if (result.libraryRefreshed) {
          addLog(
            actualJobId,
            'info',
            `  🔄 Library refreshed: +${result.added} added, -${result.deleted} removed`
          )
        } else if (result.unchanged > 0) {
          addLog(actualJobId, 'debug', `  ⏭️ No changes: ${result.unchanged} series unchanged`)
        }

        success++
        const changeStatus = result.libraryRefreshed
          ? `+${result.added}/-${result.deleted}`
          : 'no changes'
        addLog(
          actualJobId,
          'info',
          `✅ Completed watching library for ${displayName} (${result.written} series, ${changeStatus})`
        )
        updateJobProgress(
          actualJobId,
          success + failed,
          totalUsers,
          `${success + failed}/${totalUsers} users`
        )
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to process watching library')
        addLog(actualJobId, 'error', `❌ Failed for ${displayName}: ${errorMsg}`)

        users.push({
          userId: user.id,
          displayName,
          written: 0,
          error: errorMsg,
        })

        failed++
        updateJobProgress(
          actualJobId,
          success + failed,
          totalUsers,
          `${success + failed}/${totalUsers} users (${failed} failed)`
        )
      }
    }

    const finalResult = { success, failed, jobId: actualJobId, users }

    if (failed > 0) {
      addLog(
        actualJobId,
        'warn',
        `⚠️ Completed with ${failed} failure(s): ${success} succeeded, ${failed} failed`
      )
    } else {
      addLog(
        actualJobId,
        'info',
        `🎉 All ${success} user(s) watching libraries processed successfully!`
      )
    }

    completeJob(actualJobId, finalResult)
    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'Failed to process watching libraries for all users')
    failJob(actualJobId, error)
    throw err
  }
}
