/**
 * Series STRM Writer
 *
 * Writes STRM files (or symlinks) for TV series recommendations, organizing them
 * with proper season/episode folder structures for Emby/Jellyfin.
 * Includes comprehensive NFO generation and poster images with rank badges.
 */

import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getConfig } from '../config.js'
import { getAiRecsOutputConfig } from '../../settings/systemSettings.js'
import { getMediaServerProvider } from '../../media/index.js'
import { downloadImage } from '../images.js'
import { generateSeriesNfoContent } from './nfo.js'
import { getEffectiveAiExplanationSetting } from '../../lib/userSettings.js'
import { symlinkArtwork, SERIES_SKIP_FILES, getSeriesFolderFromSeasonPath } from '../artwork.js'
import type { Series, Actor, SeriesImageDownloadTask } from './types.js'
import type { ImageDownloadTask } from '../types.js'

const logger = createChildLogger('strm-series-writer')

interface EpisodeInfo {
  episodeId: string
  providerItemId: string
  seasonNumber: number
  episodeNumber: number
  title: string
  overview: string | null
  premiereDate: string | Date | null
  year: number | null
  runtimeMinutes: number | null
  path: string | null
}

/**
 * Sanitize a string for use in file/folder names
 */
function sanitizeForFilename(input: string): string {
  return input
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 200) // Limit length
}

/**
 * Escape XML special characters
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
 * Generate NFO content for an episode
 */
function generateEpisodeNfoContent(episode: EpisodeInfo, seriesTitle: string): string {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<episodedetails>',
    `  <title>${escapeXml(episode.title)}</title>`,
    `  <showtitle>${escapeXml(seriesTitle)}</showtitle>`,
    `  <season>${episode.seasonNumber}</season>`,
    `  <episode>${episode.episodeNumber}</episode>`,
  ]

  if (episode.overview) {
    lines.push(`  <plot>${escapeXml(episode.overview)}</plot>`)
  }

  if (episode.premiereDate) {
    // Handle both Date objects and ISO strings from the database
    const dateStr = episode.premiereDate instanceof Date
      ? episode.premiereDate.toISOString().split('T')[0]
      : String(episode.premiereDate).split('T')[0]
    lines.push(`  <aired>${dateStr}</aired>`)
  }

  if (episode.runtimeMinutes) {
    lines.push(`  <runtime>${episode.runtimeMinutes}</runtime>`)
  }

  lines.push('</episodedetails>')

  return lines.join('\n')
}

/**
 * Generate a placeholder "Specials" episode NFO with dateadded for Emby home row sorting.
 * Emby sorts series by latest episode dateadded, so we create a fake Season 00/Episode 0
 * with dateadded set by rank to control the order in "Latest" rows.
 * 
 * The date is set 100 years in the future to ensure these placeholders always appear
 * as the "newest" episodes, preventing real episode air dates from interfering.
 * Rank 1 = furthest in future, higher ranks = slightly earlier.
 */
function generateSortingPlaceholderNfo(seriesTitle: string, rank: number): string {
  // Use current date but 100 years in the future
  // Rank 1 = newest (furthest future), with 1-minute intervals per rank
  const now = new Date()
  const futureDate = new Date(now)
  futureDate.setFullYear(futureDate.getFullYear() + 100)
  // Subtract minutes based on rank so Rank 1 is newest
  futureDate.setMinutes(futureDate.getMinutes() - (rank - 1))
  
  const dateAddedStr = futureDate.toISOString().replace('T', ' ').substring(0, 19)
  
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<episodedetails>',
    `  <title>Aperture Sorting Placeholder</title>`,
    `  <showtitle>${escapeXml(seriesTitle)}</showtitle>`,
    `  <season>0</season>`,
    `  <episode>0</episode>`,
    `  <plot>This is a hidden placeholder file created by Aperture to control the sort order in your media server's home screen. This series is ranked #${rank} in your personalized recommendations. You can safely ignore this "episode" - it contains no actual video content.</plot>`,
    `  <dateadded>${dateAddedStr}</dateadded>`,
    `  <runtime>0</runtime>`,
    // Mark as already watched so it doesn't appear in "Continue Watching" or unwatched lists
    `  <playcount>1</playcount>`,
    `  <lastplayed>${dateAddedStr}</lastplayed>`,
    `  <watched>true</watched>`,
    '</episodedetails>',
  ]

  return lines.join('\n')
}

/**
 * Write STRM files (or symlinks) for a user's series recommendations
 */
export async function writeSeriesStrmFilesForUser(
  userId: string,
  providerUserId: string,
  displayName: string
): Promise<{ written: number; seriesCount: number; deleted: number; localPath: string; embyPath: string }> {
  const config = await getConfig()
  const outputConfig = await getAiRecsOutputConfig()
  const useSymlinks = outputConfig.seriesUseSymlinks
  const provider = await getMediaServerProvider()
  const startTime = Date.now()

  // Build user folder name (DisplayName_ID format for readability)
  const { getUserFolderName } = await import('../filenames.js')
  const userFolder = getUserFolderName(displayName, providerUserId)

  // Build paths for series library:
  // - localPath: where Aperture writes files (inside Aperture container)
  // - embyPath: where media server sees them (inside Emby/Jellyfin container)
  // Both use 'aperture-tv' subfolder for AI series recommendations
  const localPath = path.join(config.strmRoot, 'aperture-tv', userFolder)
  const embyPath = path.join(config.libraryPathPrefix, 'aperture-tv', userFolder)

  // Check for old-format folder and migrate if needed
  const oldFormatPath = path.join(config.strmRoot, 'aperture-tv', providerUserId)
  if (userFolder !== providerUserId) {
    try {
      const oldFolderStats = await fs.stat(oldFormatPath)
      if (oldFolderStats.isDirectory()) {
        const newFolderExists = await fs.stat(localPath).then(() => true).catch(() => false)
        if (!newFolderExists) {
          logger.info({ oldPath: oldFormatPath, newPath: localPath }, '📦 Migrating old-format series folder to new naming scheme')
          await fs.rename(oldFormatPath, localPath)
        } else {
          logger.info({ oldPath: oldFormatPath }, '⚠️ Both old and new format folders exist, using new format')
        }
      }
    } catch {
      // Old folder doesn't exist, which is fine
    }
  }

  logger.info({ userId, localPath, embyPath, useSymlinks }, `📺 Starting series ${useSymlinks ? 'symlink' : 'STRM'} file generation`)

  // Check if AI explanation should be included for this user
  const includeAiExplanation = await getEffectiveAiExplanationSetting(userId)
  logger.info({ userId, includeAiExplanation }, '🎯 AI explanation setting resolved')

  await fs.mkdir(localPath, { recursive: true })

  // Get user's latest series recommendations
  const latestRun = await queryOne<{ id: string }>(
    `SELECT id FROM recommendation_runs
     WHERE user_id = $1 AND media_type = 'series' AND status = 'completed'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )

  if (!latestRun) {
    logger.warn({ userId }, 'No series recommendations found')
    return { written: 0, seriesCount: 0, deleted: 0, localPath, embyPath }
  }

  // Get selected series from the run with full metadata for NFO generation
  const recommendations = await query<{
    series_id: string
    provider_item_id: string
    title: string
    original_title: string | null
    sort_title: string | null
    year: number | null
    end_year: number | null
    premiere_date: string | Date | null
    overview: string | null
    tagline: string | null
    community_rating: string | null
    critic_rating: string | null
    content_rating: string | null
    runtime_minutes: number | null
    genres: string[] | null
    poster_url: string | null
    backdrop_url: string | null
    studios: string | null
    directors: string[] | null
    writers: string[] | null
    actors: string | null
    network: string | null
    status: string | null
    total_seasons: number | null
    total_episodes: number | null
    air_days: string[] | null
    imdb_id: string | null
    tmdb_id: string | null
    tvdb_id: string | null
    tags: string[] | null
    production_countries: string[] | null
    awards: string | null
    ai_explanation: string | null
    rank: number
    final_score: string | null
  }>(
    `SELECT rc.series_id, s.provider_item_id, s.title, s.original_title, s.sort_title,
            s.year, s.end_year, 
            (SELECT MIN(premiere_date) FROM episodes WHERE series_id = s.id) as premiere_date,
            s.overview, s.tagline, s.community_rating, s.critic_rating, s.content_rating,
            (SELECT AVG(runtime_minutes) FROM episodes WHERE series_id = s.id) as runtime_minutes,
            s.genres, s.poster_url, s.backdrop_url,
            s.studios::text, s.directors, s.writers, s.actors::text,
            s.network, s.status, s.total_seasons, s.total_episodes, s.air_days,
            s.imdb_id, s.tmdb_id, s.tvdb_id, s.tags, s.production_countries, s.awards,
            rc.ai_explanation, rc.selected_rank as rank, rc.final_score
     FROM recommendation_candidates rc
     JOIN series s ON s.id = rc.series_id
     WHERE rc.run_id = $1 AND rc.is_selected = true
     ORDER BY rc.selected_rank ASC`,
    [latestRun.id]
  )

  const totalSeries = recommendations.rows.length
  logger.info({ count: totalSeries }, '📺 Found series recommendations')

  const expectedFolders = new Set<string>()
  const imageDownloads: ImageDownloadTask[] = []
  let filesWritten = 0

  // Calculate dateAdded timestamps based on rank (Rank 1 = newest)
  const now = Date.now()
  const INTERVAL_MS = 60 * 1000 // 1 minute between each rank

  // Process each series
  for (let i = 0; i < recommendations.rows.length; i++) {
    const rec = recommendations.rows[i]
    
    // Parse actors JSON
    let actors: Actor[] | null = null
    if (rec.actors) {
      try {
        actors = JSON.parse(rec.actors)
      } catch {
        actors = null
      }
    }

    // Parse studios JSON
    let studios: Array<string | { id?: string; name: string; imageTag?: string }> | null = null
    if (rec.studios) {
      try {
        studios = JSON.parse(rec.studios)
      } catch {
        studios = null
      }
    }

    const series: Series = {
      id: rec.series_id,
      providerItemId: rec.provider_item_id,
      title: rec.title,
      originalTitle: rec.original_title,
      sortTitle: rec.sort_title,
      year: rec.year,
      endYear: rec.end_year,
      premiereDate: rec.premiere_date,
      overview: rec.overview,
      tagline: rec.tagline,
      communityRating: rec.community_rating ? parseFloat(rec.community_rating) : null,
      criticRating: rec.critic_rating ? parseFloat(rec.critic_rating) : null,
      contentRating: rec.content_rating,
      runtimeMinutes: rec.runtime_minutes ? Math.round(rec.runtime_minutes) : null,
      genres: rec.genres,
      posterUrl: rec.poster_url,
      backdropUrl: rec.backdrop_url,
      studios,
      directors: rec.directors,
      writers: rec.writers,
      actors,
      network: rec.network,
      status: rec.status,
      totalSeasons: rec.total_seasons,
      totalEpisodes: rec.total_episodes,
      airDays: rec.air_days,
      imdbId: rec.imdb_id,
      tmdbId: rec.tmdb_id,
      tvdbId: rec.tvdb_id,
      tvmazeId: null, // Not stored in our DB currently
      tags: rec.tags,
      productionCountries: rec.production_countries,
      awards: rec.awards,
      aiExplanation: rec.ai_explanation,
      rank: rec.rank,
      matchScore: rec.final_score ? Math.round(parseFloat(rec.final_score) * 100) : 0,
    }

    // Calculate dateAdded: Rank 1 = now, Rank 2 = now - 1 min, etc.
    const dateAdded = new Date(now - (rec.rank - 1) * INTERVAL_MS)

    // Create series folder
    const seriesFolderName = series.year
      ? `${sanitizeForFilename(series.title)} (${series.year})`
      : sanitizeForFilename(series.title)
    const seriesFolderPath = path.join(localPath, seriesFolderName)
    expectedFolders.add(seriesFolderName)

    await fs.mkdir(seriesFolderPath, { recursive: true })

    // Write series NFO (tvshow.nfo) with comprehensive metadata
    const seriesNfoPath = path.join(seriesFolderPath, 'tvshow.nfo')
    const nfoContent = generateSeriesNfoContent(series, {
      includeImageUrls: !config.downloadImages,
      dateAdded,
      includeAiExplanation,
    })
    await fs.writeFile(seriesNfoPath, nfoContent, 'utf-8')
    filesWritten++

    // Queue poster and fanart for download with rank badges (both modes need these for overlays)
    if (config.downloadImages) {
      if (series.posterUrl) {
        imageDownloads.push({
          url: series.posterUrl,
          path: path.join(seriesFolderPath, 'poster.jpg'),
          movieTitle: series.title,
          isPoster: true,
          rank: series.rank,
          matchScore: series.matchScore,
        })
      }
      if (series.backdropUrl) {
        imageDownloads.push({
          url: series.backdropUrl,
          path: path.join(seriesFolderPath, 'fanart.jpg'),
          movieTitle: series.title,
          isPoster: false,
        })
      }
    }

    // Create Season 00 (Specials) folder with a sorting placeholder episode
    // This tricks Emby into sorting series by our rank in the home "Latest" row
    // because Emby uses the latest episode's dateadded for series sorting
    const specialsFolderPath = path.join(seriesFolderPath, 'Season 00')
    await fs.mkdir(specialsFolderPath, { recursive: true })
    
    const placeholderBasename = 'S00E00 - Aperture Sorting Placeholder'
    
    // Create NFO with dateadded set 100 years in future (by rank for sort order)
    const placeholderNfoPath = path.join(specialsFolderPath, `${placeholderBasename}.nfo`)
    const placeholderNfoContent = generateSortingPlaceholderNfo(series.title, series.rank)
    await fs.writeFile(placeholderNfoPath, placeholderNfoContent, 'utf-8')
    filesWritten++
    
    // Create a minimal STRM file so Emby recognizes the episode entry
    // The content is a placeholder - the episode won't be playable but that's intentional
    const placeholderStrmPath = path.join(specialsFolderPath, `${placeholderBasename}.strm`)
    const placeholderStrmContent = '# Aperture sorting placeholder - not a real video\nabout:blank'
    await fs.writeFile(placeholderStrmPath, placeholderStrmContent, 'utf-8')
    filesWritten++
    
    logger.debug({ series: series.title, rank: series.rank, dateAdded }, '📅 Created sorting placeholder for home row ordering')

    if (useSymlinks) {
      // SYMLINKS MODE: Symlink entire season folders from original location
      const seasonPaths = await query<{ season_number: number; season_path: string }>(
        `SELECT DISTINCT season_number, 
                regexp_replace(path, '/[^/]+$', '') as season_path
         FROM episodes 
         WHERE series_id = $1 AND path IS NOT NULL
         ORDER BY season_number`,
        [series.id]
      )

      // Create symlinks to each season folder
      for (const season of seasonPaths.rows) {
        const seasonFolderName = `Season ${String(season.season_number).padStart(2, '0')}`
        const symlinkPath = path.join(seriesFolderPath, seasonFolderName)
        const originalSeasonPath = season.season_path

        try {
          // Remove existing symlink if present
          try {
            await fs.lstat(symlinkPath)
            await fs.unlink(symlinkPath)
          } catch {
            // File doesn't exist, that's fine
          }
          await fs.symlink(originalSeasonPath, symlinkPath)
          logger.debug({ seasonFolderName, originalSeasonPath }, 'Created season symlink')
          filesWritten++
        } catch (err) {
          logger.warn({ err, seasonFolderName }, 'Failed to create season symlink')
        }
      }

      // Symlink all other files from original series folder (artwork, etc.)
      if (seasonPaths.rows.length > 0) {
        const mediaServerSeriesPath = getSeriesFolderFromSeasonPath(seasonPaths.rows[0].season_path)
        const artworkCount = await symlinkArtwork({
          mediaServerPath: mediaServerSeriesPath,
          targetPath: seriesFolderPath,
          skipFiles: SERIES_SKIP_FILES,
          skipSeasonFolders: true,
          mediaType: 'series',
          title: series.title,
        })
        filesWritten += artworkCount
      }

      logger.info(
        { series: series.title, seasons: seasonPaths.rows.length },
        '🔗 Series symlinks created'
      )
    } else {
      // STRM MODE: Create STRM files for each episode
      const episodes = await query<{
        id: string
        provider_item_id: string
        season_number: number
        episode_number: number
        title: string
        overview: string | null
        premiere_date: string | null
        year: number | null
        runtime_minutes: number | null
        path: string | null
      }>(
        `SELECT id, provider_item_id, season_number, episode_number, title,
                overview, premiere_date, year, runtime_minutes, path
         FROM episodes
         WHERE series_id = $1
         ORDER BY season_number, episode_number`,
        [series.id]
      )

      // Group episodes by season
      const seasons = new Map<number, typeof episodes.rows>()
      for (const ep of episodes.rows) {
        if (!seasons.has(ep.season_number)) {
          seasons.set(ep.season_number, [])
        }
        seasons.get(ep.season_number)!.push(ep)
      }

      // Process each season
      for (const [seasonNum, seasonEpisodes] of seasons) {
        const seasonFolderName = `Season ${String(seasonNum).padStart(2, '0')}`
        const seasonFolderPath = path.join(seriesFolderPath, seasonFolderName)

        await fs.mkdir(seasonFolderPath, { recursive: true })

        // Process each episode
        for (const ep of seasonEpisodes) {
          const episode: EpisodeInfo = {
            episodeId: ep.id,
            providerItemId: ep.provider_item_id,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            title: ep.title,
            overview: ep.overview,
            premiereDate: ep.premiere_date,
            year: ep.year,
            runtimeMinutes: ep.runtime_minutes,
            path: ep.path,
          }

          // Episode filename: SeriesName S01E01 Episode Title.strm
          const episodeFilename = `${sanitizeForFilename(series.title)} S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')} ${sanitizeForFilename(episode.title)}`

          // Write STRM file with original file path
          if (!episode.path) {
            logger.warn({ series: series.title, episode: episode.title }, 'No file path for episode, skipping')
            continue
          }

          // Clean up old symlinks if switching from symlink mode to STRM mode
          const possibleSymlinks = [
            path.join(seasonFolderPath, `${episodeFilename}.mp4`),
            path.join(seasonFolderPath, `${episodeFilename}.mkv`),
            path.join(seasonFolderPath, `${episodeFilename}.avi`),
          ]
          for (const symlinkPath of possibleSymlinks) {
            try {
              const stat = await fs.lstat(symlinkPath)
              if (stat.isSymbolicLink()) {
                await fs.unlink(symlinkPath)
                logger.info({ path: symlinkPath }, '🗑️ Removed old episode symlink (switched to STRM mode)')
              }
            } catch {
              // File doesn't exist, which is fine
            }
          }

          const strmPath = path.join(seasonFolderPath, `${episodeFilename}.strm`)
          await fs.writeFile(strmPath, episode.path, 'utf-8')
          filesWritten++

          // Write episode NFO
          const nfoPath = path.join(seasonFolderPath, `${episodeFilename}.nfo`)
          await fs.writeFile(nfoPath, generateEpisodeNfoContent(episode, series.title), 'utf-8')
          filesWritten++
        }
      }

      // Download additional images via API (STRM mode only - symlink mode symlinks these)
      if (config.downloadImages) {
        const additionalImages = [
          { url: provider.getBannerUrl(series.providerItemId), filename: 'banner.jpg' },
          { url: provider.getLogoUrl(series.providerItemId), filename: 'clearlogo.png' },
          { url: provider.getArtUrl(series.providerItemId), filename: 'clearart.png' },
          { url: provider.getThumbUrl(series.providerItemId), filename: 'landscape.jpg' },
        ]

        for (const img of additionalImages) {
          imageDownloads.push({
            url: img.url,
            path: path.join(seriesFolderPath, img.filename),
            movieTitle: series.title,
            isPoster: false,
          })
        }
      }

      logger.info(
        { series: series.title, seasons: seasons.size, episodes: episodes.rows.length },
        '✅ Series processed'
      )
    }
  }

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
      '📥 Starting series image downloads...'
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
      '✅ All series images downloaded'
    )
  }

  // Delete old series folders not in current recommendations
  let deleted = 0
  try {
    const existingFolders = await fs.readdir(localPath)
    const foldersToDelete = existingFolders.filter((folder) => !expectedFolders.has(folder))

    for (const folder of foldersToDelete) {
      const folderPath = path.join(localPath, folder)
      try {
        const stats = await fs.stat(folderPath)
        if (stats.isDirectory()) {
          await fs.rm(folderPath, { recursive: true })
          deleted++
        }
      } catch {
        // Ignore errors
      }
    }

    if (deleted > 0) {
      logger.info({ count: deleted }, '🗑️ Cleaned up old series folders')
    }
  } catch {
    // Directory might not exist yet
  }

  const totalDuration = Date.now() - startTime
  logger.info(
    {
      userId,
      series: totalSeries,
      filesWritten,
      imagesDownloaded: imageDownloads.length,
      deleted,
      durationMs: totalDuration,
      localPath,
      embyPath,
      useSymlinks,
    },
    `✅ Series ${useSymlinks ? 'symlink' : 'STRM'} generation complete`
  )

  return {
    written: filesWritten,
    seriesCount: totalSeries,
    deleted,
    localPath,
    embyPath,
  }
}
