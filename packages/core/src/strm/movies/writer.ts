import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getConfig } from '../config.js'
import { downloadImage } from '../images.js'
import { generateNfoContent } from './nfo.js'
import {
  buildStrmFilename,
  buildNfoFilename,
  buildPosterFilename,
  buildBackdropFilename,
  getStrmContent,
} from '../filenames.js'
import type { Movie, FileWriteTask, ImageDownloadTask } from '../types.js'

const logger = createChildLogger('strm-writer')

/**
 * Write a single file (used for parallel writes)
 */
async function writeFileWithRetry(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Write STRM files for a user's recommendations
 */
export async function writeStrmFilesForUser(
  userId: string,
  providerUserId: string,
  _displayName: string
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
            rc.ai_explanation, rc.rank, rc.final_score
     FROM recommendation_candidates rc
     JOIN movies m ON m.id = rc.movie_id
     WHERE rc.run_id = $1 AND rc.is_selected = true
     ORDER BY rc.rank DESC`,
    [latestRun.id]
  )

  const totalMovies = recommendations.rows.length
  logger.info({ count: totalMovies }, '🎬 Found recommendations, preparing files...')

  // Collect all file write tasks and image downloads
  const expectedFiles = new Set<string>()
  const fileWriteTasks: FileWriteTask[] = []
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

    // Prepare NFO file task (with dateAdded for Emby sorting)
    const nfoFilename = buildNfoFilename(movie)
    expectedFiles.add(nfoFilename)
    const nfoContent = generateNfoContent(movie, !config.downloadImages, dateAdded)
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
          isPoster: true,
          rank: movie.rank,
          matchScore: movie.matchScore,
        })
      }
      if (movie.backdropUrl) {
        const backdropFilename = buildBackdropFilename(movie)
        expectedFiles.add(backdropFilename)
        imageDownloads.push({
          url: movie.backdropUrl,
          path: path.join(localPath, backdropFilename),
          movieTitle: movie.title,
          isPoster: false,
        })
      }
    }
  }

  // Write STRM/NFO files in parallel batches (much faster over network mounts)
  const FILE_BATCH_SIZE = 20 // Write 20 files concurrently (10 movies worth)
  const totalFileBatches = Math.ceil(fileWriteTasks.length / FILE_BATCH_SIZE)

  logger.info(
    {
      totalFiles: fileWriteTasks.length,
      batchSize: FILE_BATCH_SIZE,
      totalBatches: totalFileBatches,
    },
    '📝 Writing STRM/NFO files in parallel batches...'
  )

  let filesWritten = 0
  for (let i = 0; i < fileWriteTasks.length; i += FILE_BATCH_SIZE) {
    const batchNum = Math.floor(i / FILE_BATCH_SIZE) + 1
    const batch = fileWriteTasks.slice(i, i + FILE_BATCH_SIZE)

    // Get unique movies in this batch for logging
    const movieTitles = [...new Set(batch.map((t) => t.movie.title))].slice(0, 3)
    const moreCount = [...new Set(batch.map((t) => t.movie.title))].length - 3
    const movieList =
      moreCount > 0 ? `${movieTitles.join(', ')} +${moreCount} more` : movieTitles.join(', ')

    logger.info(
      {
        batch: batchNum,
        of: totalFileBatches,
        files: batch.length,
        movies: movieList,
      },
      `📝 Writing batch ${batchNum}/${totalFileBatches}...`
    )

    const batchStart = Date.now()
    await Promise.all(batch.map((task) => writeFileWithRetry(task.path, task.content)))
    const batchDuration = Date.now() - batchStart

    filesWritten += batch.length
    logger.info(
      {
        batch: batchNum,
        durationMs: batchDuration,
        avgMs: Math.round(batchDuration / batch.length),
      },
      `✅ Batch ${batchNum} complete (${batchDuration}ms)`
    )
  }

  const fileWriteDuration = Date.now() - startTime
  logger.info(
    {
      filesWritten,
      movies: totalMovies,
      durationMs: fileWriteDuration,
      avgPerFileMs: Math.round(fileWriteDuration / filesWritten),
    },
    '📝 All STRM/NFO files written'
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

  // Delete old files not in current recommendations
  let deleted = 0
  try {
    const existingFiles = await fs.readdir(localPath)
    const filesToDelete = existingFiles.filter((file) => {
      const isRelevantFile =
        file.endsWith('.strm') ||
        file.endsWith('.nfo') ||
        file.endsWith('-poster.jpg') ||
        file.endsWith('-fanart.jpg')
      return isRelevantFile && !expectedFiles.has(file)
    })

    if (filesToDelete.length > 0) {
      logger.info({ count: filesToDelete.length }, '🗑️ Cleaning up old files...')
      await Promise.all(filesToDelete.map((file) => fs.unlink(path.join(localPath, file))))
      deleted = filesToDelete.length
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
