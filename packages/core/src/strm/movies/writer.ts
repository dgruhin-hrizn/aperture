import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getConfig } from '../config.js'
import { getAiRecsOutputConfig, getPreventDuplicateContinueWatchingConfig } from '../../settings/systemSettings.js'
import { downloadImage } from '../images.js'
import { generateNfoContent } from './nfo.js'
import {
  getStrmContent,
} from '../filenames.js'
import { getEffectiveAiExplanationSetting } from '../../lib/userSettings.js'
import {
  symlinkArtwork,
  symlinkSubtitles,
  MOVIE_SKIP_FILES,
  getMovieFolderFromFilePath,
} from '../artwork.js'
import { getMediaServerProvider } from '../../media/index.js'
import type { Movie, ImageDownloadTask } from '../types.js'

const logger = createChildLogger('strm-writer')

/**
 * Ensure user's STRM directory exists (without writing any files)
 * This is used to create the folder BEFORE the library, so Emby sees an empty folder
 * and uses our CollectionType instead of auto-detecting based on content
 */
export async function ensureUserDirectory(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ localPath: string; embyPath: string }> {
  const config = await getConfig()
  
  const { getUserFolderName } = await import('../filenames.js')
  const userFolder = getUserFolderName(displayName, providerUserId)
  
  const localPath = path.join(config.strmRoot, 'aperture', userFolder)
  const embyPath = path.join(config.libraryPathPrefix, 'aperture', userFolder)
  
  // Create directory if it doesn't exist
  await fs.mkdir(localPath, { recursive: true })
  
  logger.info({ userId, localPath, embyPath }, '📂 Ensured directory exists')
  
  return { localPath, embyPath }
}

/**
 * Write STRM files (or symlinks) for a user's movie recommendations
 */
export async function writeStrmFilesForUser(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ written: number; deleted: number; localPath: string; embyPath: string }> {
  const config = await getConfig()
  const outputConfig = await getAiRecsOutputConfig()
  const useSymlinks = outputConfig.moviesUseSymlinks
  const startTime = Date.now()

  // Build user folder name (DisplayName_ID format for readability)
  const { getUserFolderName } = await import('../filenames.js')
  const userFolder = getUserFolderName(displayName, providerUserId)

  // Build paths:
  // - localPath: where Aperture writes files (inside Aperture container)
  // - embyPath: where media server sees them (inside Emby/Jellyfin container)
  // Both use 'aperture' subfolder for AI movie recommendations
  const localPath = path.join(config.strmRoot, 'aperture', userFolder)
  const embyPath = path.join(config.libraryPathPrefix, 'aperture', userFolder)

  // Check for old-format folder and migrate if needed
  const oldFormatPath = path.join(config.strmRoot, 'aperture', providerUserId)
  if (userFolder !== providerUserId) {
    try {
      const oldFolderStats = await fs.stat(oldFormatPath)
      if (oldFolderStats.isDirectory()) {
        const newFolderExists = await fs
          .stat(localPath)
          .then(() => true)
          .catch(() => false)
        if (!newFolderExists) {
          logger.info(
            { oldPath: oldFormatPath, newPath: localPath },
            '📦 Migrating old-format folder to new naming scheme'
          )
          await fs.rename(oldFormatPath, localPath)
        } else {
          logger.info(
            { oldPath: oldFormatPath },
            '⚠️ Both old and new format folders exist, using new format'
          )
        }
      }
    } catch {
      // Old folder doesn't exist, which is fine
    }
  }

  logger.info(
    { userId, localPath, embyPath, useSymlinks },
    `📁 Starting ${useSymlinks ? 'symlink' : 'STRM'} file generation`
  )

  // Check if AI explanation should be included for this user
  const includeAiExplanation = await getEffectiveAiExplanationSetting(userId)
  logger.info({ userId, includeAiExplanation }, '🎯 AI explanation setting resolved')

  // Check if duplicate Continue Watching prevention is enabled
  const preventDuplicatesConfig = await getPreventDuplicateContinueWatchingConfig()
  const prefixProviderIds = preventDuplicatesConfig.enabled
  if (prefixProviderIds) {
    logger.info('🔒 Duplicate Continue Watching prevention enabled - prefixing provider IDs')
  }

  // Ensure directory exists on local mount
  await fs.mkdir(localPath, { recursive: true })
  logger.info({ localPath }, '📂 Directory ready')

  // Get user's latest movie recommendations
  const latestRun = await queryOne<{ id: string }>(
    `SELECT id FROM recommendation_runs
     WHERE user_id = $1 AND status = 'completed' AND media_type = 'movie'
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
    original_title: string | null
    sort_title: string | null
    year: number | null
    premiere_date: string | Date | null
    path: string | null
    media_sources: string | null
    overview: string | null
    tagline: string | null
    community_rating: string | null
    critic_rating: string | null
    content_rating: string | null
    runtime_minutes: number | null
    genres: string[] | null
    poster_url: string | null
    backdrop_url: string | null
    studios: string[] | null
    directors: string[] | null
    writers: string[] | null
    actors: string | null
    imdb_id: string | null
    tmdb_id: string | null
    tags: string[] | null
    production_countries: string[] | null
    awards: string | null
    video_resolution: string | null
    video_codec: string | null
    audio_codec: string | null
    container: string | null
    ai_explanation: string | null
    rank: number
    final_score: string | null
  }>(
    `SELECT rc.movie_id, m.provider_item_id, m.title, m.original_title, m.sort_title,
            m.year, m.premiere_date, m.path, m.media_sources::text,
            m.overview, m.tagline, m.community_rating, m.critic_rating, m.content_rating,
            m.runtime_minutes, m.genres, m.poster_url, m.backdrop_url,
            m.studios, m.directors, m.writers, m.actors::text,
            m.imdb_id, m.tmdb_id, m.tags, m.production_countries, m.awards,
            m.video_resolution, m.video_codec, m.audio_codec, m.container,
            rc.ai_explanation, rc.selected_rank as rank, rc.final_score
     FROM recommendation_candidates rc
     JOIN movies m ON m.id = rc.movie_id
     WHERE rc.run_id = $1 AND rc.is_selected = true
     ORDER BY rc.selected_rank ASC`,
    [latestRun.id]
  )

  const totalMovies = recommendations.rows.length
  logger.info({ count: totalMovies }, '🎬 Found recommendations, preparing files...')

  // Collect expected folders and image downloads
  const expectedFolders = new Set<string>()
  const imageDownloads: ImageDownloadTask[] = []

  // Calculate dateAdded timestamps based on rank (Rank 1 = newest)
  // Use 1-minute intervals between ranks for clear separation in Emby
  const now = Date.now()
  const INTERVAL_MS = 60 * 1000 // 1 minute between each rank

  // Prepare all file tasks (fast - just builds strings in memory)
  for (let i = 0; i < recommendations.rows.length; i++) {
    const rec = recommendations.rows[i]
    const movie: Movie = {
      id: rec.movie_id,
      providerItemId: rec.provider_item_id,
      title: rec.title,
      originalTitle: rec.original_title,
      sortTitle: rec.sort_title,
      year: rec.year,
      premiereDate: rec.premiere_date,
      path: rec.path,
      mediaSources: rec.media_sources ? JSON.parse(rec.media_sources) : null,
      overview: rec.overview,
      tagline: rec.tagline,
      communityRating: rec.community_rating ? parseFloat(rec.community_rating) : null,
      criticRating: rec.critic_rating ? parseFloat(rec.critic_rating) : null,
      contentRating: rec.content_rating,
      runtimeMinutes: rec.runtime_minutes,
      genres: rec.genres,
      posterUrl: rec.poster_url,
      backdropUrl: rec.backdrop_url,
      studios: rec.studios,
      directors: rec.directors,
      writers: rec.writers,
      actors: rec.actors ? JSON.parse(rec.actors) : null,
      imdbId: rec.imdb_id,
      tmdbId: rec.tmdb_id,
      tags: rec.tags,
      productionCountries: rec.production_countries,
      awards: rec.awards,
      videoResolution: rec.video_resolution,
      videoCodec: rec.video_codec,
      audioCodec: rec.audio_codec,
      container: rec.container,
      aiExplanation: rec.ai_explanation,
      rank: rec.rank,
      matchScore: rec.final_score ? Math.round(parseFloat(rec.final_score) * 100) : 0,
    }

    // Calculate dateAdded: Rank 1 = now, Rank 2 = now - 1 min, etc.
    const dateAdded = new Date(now - (rec.rank - 1) * INTERVAL_MS)

    if (useSymlinks) {
      // SYMLINKS MODE: Create folder per movie with symlink to original file
      const safeTitle = movie.title.replace(/[<>:"/\\|?*]/g, '')
      const folderName = movie.year ? `${safeTitle} (${movie.year})` : safeTitle
      const movieFolderPath = path.join(localPath, folderName)
      expectedFolders.add(folderName)

      // Create movie folder
      await fs.mkdir(movieFolderPath, { recursive: true })

      // Try to find original movie file path
      let originalPath: string | null = null
      if (movie.path) {
        originalPath = movie.path
      } else if (movie.mediaSources && movie.mediaSources.length > 0) {
        // mediaSources is Array<{ path: string }> - use first source's path
        const source = movie.mediaSources[0]
        if (source.path) {
          originalPath = source.path
        }
      }

      // Create symlink to original file or fallback to STRM
      const baseFilename = folderName
      if (originalPath) {
        const ext = path.extname(originalPath)
        const symlinkPath = path.join(movieFolderPath, `${baseFilename}${ext}`)
        try {
          // Check if symlink already exists
          try {
            await fs.lstat(symlinkPath)
            await fs.unlink(symlinkPath)
          } catch {
            // File doesn't exist, that's fine
          }
          await fs.symlink(originalPath, symlinkPath)
          logger.debug({ movie: movie.title, originalPath }, 'Created movie symlink')
        } catch (err) {
          logger.debug(
            { err, movie: movie.title },
            'Failed to create movie symlink, falling back to STRM'
          )
          // Fallback to STRM if symlink fails - use original file path
          const strmPath = path.join(movieFolderPath, `${baseFilename}.strm`)
          await fs.writeFile(strmPath, originalPath, 'utf-8')
        }
      } else {
        // No original path - skip this movie
        logger.warn({ movie: movie.title }, 'No file path found for movie, skipping')
        continue
      }

      // Create NFO file in folder
      const nfoContent = generateNfoContent(movie, {
        includeImageUrls: !config.downloadImages,
        dateAdded,
        includeAiExplanation,
        prefixProviderIds,
      })
      await fs.writeFile(path.join(movieFolderPath, 'movie.nfo'), nfoContent, 'utf-8')

      // Handle images
      if (config.downloadImages) {
        if (movie.posterUrl) {
          imageDownloads.push({
            url: movie.posterUrl,
            path: path.join(movieFolderPath, 'poster.jpg'),
            movieTitle: movie.title,
            isPoster: true,
            rank: movie.rank,
            matchScore: movie.matchScore,
          })
        }
        if (movie.backdropUrl) {
          imageDownloads.push({
            url: movie.backdropUrl,
            path: path.join(movieFolderPath, 'fanart.jpg'),
            movieTitle: movie.title,
            isPoster: false,
          })
        }
      }

      // Symlink other artwork files from original movie folder
      if (originalPath) {
        const movieFolder = getMovieFolderFromFilePath(originalPath)
        await symlinkArtwork({
          mediaServerPath: movieFolder,
          targetPath: movieFolderPath,
          skipFiles: MOVIE_SKIP_FILES,
          skipSeasonFolders: false,
          mediaType: 'movie',
          title: movie.title,
        })

        // Symlink subtitle files with proper naming to match our video file
        const originalBasename = path.basename(originalPath, path.extname(originalPath))
        await symlinkSubtitles({
          mediaServerPath: movieFolder,
          targetPath: movieFolderPath,
          targetBasename: baseFilename,
          originalBasename,
          title: movie.title,
        })
      }
    } else {
      // STRM MODE: Folder per movie with all images downloaded via API
      // Get original file path for STRM content
      let originalPath: string | null = null
      if (movie.path) {
        originalPath = movie.path
      } else if (movie.mediaSources) {
        for (const source of movie.mediaSources) {
          if (source.path) {
            originalPath = source.path
            break
          }
        }
      }

      if (!originalPath) {
        logger.warn({ movie: movie.title }, 'No file path found for movie, skipping STRM')
        continue
      }

      const safeTitle = movie.title.replace(/[<>:"/\\|?*]/g, '')
      const folderName = movie.year ? `${safeTitle} (${movie.year})` : safeTitle
      const movieFolderPath = path.join(localPath, folderName)
      expectedFolders.add(folderName)

      // Create movie folder
      await fs.mkdir(movieFolderPath, { recursive: true })

      // Clean up old symlinks if switching from symlink mode to STRM mode
      // This prevents duplicate items in Emby (both .mp4 symlink and .strm file)
      const baseFilename = folderName
      const possibleSymlinks = [
        path.join(movieFolderPath, `${baseFilename}.mp4`),
        path.join(movieFolderPath, `${baseFilename}.mkv`),
        path.join(movieFolderPath, `${baseFilename}.avi`),
      ]
      for (const symlinkPath of possibleSymlinks) {
        try {
          const stat = await fs.lstat(symlinkPath)
          if (stat.isSymbolicLink()) {
            await fs.unlink(symlinkPath)
            logger.info({ path: symlinkPath }, '🗑️ Removed old symlink (switched to STRM mode)')
          }
        } catch {
          // File doesn't exist, which is fine
        }
      }

      // Create STRM file with original file path
      const strmPath = path.join(movieFolderPath, `${baseFilename}.strm`)
      const strmContent = getStrmContent(originalPath)
      await fs.writeFile(strmPath, strmContent, 'utf-8')

      // Create NFO file in folder
      const nfoContent = generateNfoContent(movie, {
        includeImageUrls: !config.downloadImages,
        dateAdded,
        includeAiExplanation,
        prefixProviderIds,
      })
      await fs.writeFile(path.join(movieFolderPath, 'movie.nfo'), nfoContent, 'utf-8')

      // Download all available images via API
      if (config.downloadImages) {
        const provider = await getMediaServerProvider()

        // Primary poster (with rank overlay)
        if (movie.posterUrl) {
          imageDownloads.push({
            url: movie.posterUrl,
            path: path.join(movieFolderPath, 'poster.jpg'),
            movieTitle: movie.title,
            isPoster: true,
            rank: movie.rank,
            matchScore: movie.matchScore,
          })
        }

        // Backdrop/fanart
        if (movie.backdropUrl) {
          imageDownloads.push({
            url: movie.backdropUrl,
            path: path.join(movieFolderPath, 'fanart.jpg'),
            movieTitle: movie.title,
            isPoster: false,
          })
        }

        // Additional images via API (gracefully handles 404 if not available)
        const additionalImages = [
          { url: provider.getBannerUrl(movie.providerItemId), filename: 'banner.jpg' },
          { url: provider.getLogoUrl(movie.providerItemId), filename: 'clearlogo.png' },
          { url: provider.getArtUrl(movie.providerItemId), filename: 'clearart.png' },
          { url: provider.getThumbUrl(movie.providerItemId), filename: 'landscape.jpg' },
        ]

        for (const img of additionalImages) {
          imageDownloads.push({
            url: img.url,
            path: path.join(movieFolderPath, img.filename),
            movieTitle: movie.title,
            isPoster: false,
          })
        }
      }
    }
  }

  // Both modes now write inline (folder per movie)
  logger.info(
    { movies: totalMovies, mode: useSymlinks ? 'symlinks' : 'STRM' },
    `📁 All movie ${useSymlinks ? 'symlinks' : 'STRM files'} created`
  )

  // Download images in parallel batches
  if (imageDownloads.length > 0) {
    const IMAGE_BATCH_SIZE = 10
    const totalImageBatches = Math.ceil(imageDownloads.length / IMAGE_BATCH_SIZE)

    logger.info(
      {
        total: imageDownloads.length,
        batchSize: IMAGE_BATCH_SIZE,
        totalBatches: totalImageBatches,
      },
      '📥 Starting image downloads...'
    )

    const imageStartTime = Date.now()
    for (let i = 0; i < imageDownloads.length; i += IMAGE_BATCH_SIZE) {
      const batchNum = Math.floor(i / IMAGE_BATCH_SIZE) + 1
      const batch = imageDownloads.slice(i, i + IMAGE_BATCH_SIZE)

      logger.info(
        {
          batch: batchNum,
          of: totalImageBatches,
          count: batch.length,
        },
        `📥 Downloading image batch ${batchNum}/${totalImageBatches}...`
      )

      await Promise.all(batch.map((task) => downloadImage(task)))
      logger.info({ batch: batchNum }, `✅ Image batch ${batchNum} complete`)
    }

    const imageDuration = Date.now() - imageStartTime
    logger.info(
      {
        downloaded: imageDownloads.length,
        durationMs: imageDuration,
      },
      '✅ All images downloaded'
    )
  } else {
    logger.info('📷 Image downloads disabled or no URLs available')
  }

  // Delete old folders not in current recommendations (both modes now use folders)
  let deleted = 0
  try {
    const existingEntries = await fs.readdir(localPath, { withFileTypes: true })

    for (const entry of existingEntries) {
      if (entry.isDirectory() && !expectedFolders.has(entry.name)) {
        const folderPath = path.join(localPath, entry.name)
        await fs.rm(folderPath, { recursive: true, force: true })
        deleted++
      }
    }
    if (deleted > 0) {
      logger.info({ count: deleted }, '🗑️ Cleaned up old movie folders')
    }
  } catch {
    // Directory might be empty or not exist yet
  }

  const totalDuration = Date.now() - startTime
  logger.info(
    {
      userId,
      written: totalMovies,
      deleted,
      totalDurationMs: totalDuration,
      localPath,
      embyPath,
    },
    '✅ STRM generation complete'
  )

  return {
    written: totalMovies,
    deleted,
    localPath,
    embyPath,
  }
}
