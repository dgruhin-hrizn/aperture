/**
 * Top Picks STRM Writer
 * 
 * Generates STRM files for Top Picks libraries (global, not per-user).
 * Uses the same patterns as the recommendation STRM writer but with
 * Top Picks-specific poster overlays and a single shared library.
 */

import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { getConfig } from '../strm/config.js'
import { downloadImage } from '../strm/images.js'
import { sanitizeFilename } from '../strm/filenames.js'
import { getMediaServerProvider } from '../media/index.js'
import { getTopPicksConfig } from './config.js'
import type { PopularMovie, PopularSeries } from './popularity.js'
import type { ImageDownloadTask } from '../strm/types.js'

const logger = createChildLogger('top-picks-writer')

// Time interval between ranks for dateAdded ordering (1 day per rank)
// Using days instead of minutes for more reliable sorting in Emby
const INTERVAL_MS = 24 * 60 * 60 * 1000

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
 * Generate NFO content for a Top Picks movie
 */
function generateTopPicksMovieNfo(movie: TopPicksMovie, dateAdded: Date): string {
  // Zero-pad rank for proper alphabetical sorting (01, 02, ... 10)
  const rankPrefix = String(movie.rank).padStart(2, '0')
  
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<movie>',
    `  <title>${escapeXml(movie.title)}</title>`,
    `  <sorttitle>${rankPrefix} - ${escapeXml(movie.title)}</sorttitle>`,
  ]

  if (movie.year) {
    lines.push(`  <year>${movie.year}</year>`)
  }

  if (movie.overview) {
    lines.push(`  <plot>${escapeXml(movie.overview)}</plot>`)
  }

  if (movie.genres?.length) {
    for (const genre of movie.genres) {
      lines.push(`  <genre>${escapeXml(genre)}</genre>`)
    }
  }

  if (movie.communityRating) {
    lines.push(`  <rating>${movie.communityRating.toFixed(1)}</rating>`)
  }

  // Date added for sort ordering (backup method)
  lines.push(`  <dateadded>${dateAdded.toISOString().slice(0, 19).replace('T', ' ')}</dateadded>`)

  // Add Top Picks tag
  lines.push(`  <tag>Top Picks</tag>`)
  lines.push(`  <tag>Rank ${movie.rank}</tag>`)

  lines.push('</movie>')
  return lines.join('\n')
}

/**
 * Generate NFO content for a Top Picks series
 */
function generateTopPicksSeriesNfo(series: TopPicksSeries & {
  contentRating?: string | null
  status?: string | null
  totalSeasons?: number | null
  totalEpisodes?: number | null
}, dateAdded: Date): string {
  // Zero-pad rank for proper alphabetical sorting (01, 02, ... 10)
  const rankPrefix = String(series.rank).padStart(2, '0')
  
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<tvshow>',
    `  <title>${escapeXml(series.title)}</title>`,
    `  <sorttitle>${rankPrefix} - ${escapeXml(series.title)}</sorttitle>`,
  ]

  if (series.year) {
    lines.push(`  <year>${series.year}</year>`)
  }

  if (series.overview) {
    lines.push(`  <plot>${escapeXml(series.overview)}</plot>`)
  }

  if (series.genres?.length) {
    for (const genre of series.genres) {
      lines.push(`  <genre>${escapeXml(genre)}</genre>`)
    }
  }

  if (series.communityRating) {
    lines.push(`  <rating>${series.communityRating.toFixed(1)}</rating>`)
  }

  if (series.network) {
    lines.push(`  <studio>${escapeXml(series.network)}</studio>`)
  }

  if (series.contentRating) {
    lines.push(`  <mpaa>${escapeXml(series.contentRating)}</mpaa>`)
  }

  if (series.status) {
    lines.push(`  <status>${escapeXml(series.status)}</status>`)
  }

  // Date added for sort ordering (backup method)
  lines.push(`  <dateadded>${dateAdded.toISOString().slice(0, 19).replace('T', ' ')}</dateadded>`)

  // Add Top Picks tag
  lines.push(`  <tag>Top Picks</tag>`)
  lines.push(`  <tag>Rank ${series.rank}</tag>`)

  lines.push('</tvshow>')
  return lines.join('\n')
}

interface TopPicksMovie {
  id: string
  title: string
  year: number | null
  providerItemId: string
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  path: string | null
  mediaSources?: Array<{ path: string }>
  rank: number
}

interface TopPicksSeries {
  id: string
  title: string
  year: number | null
  providerItemId: string
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  network: string | null
  rank: number
}

/**
 * Build filename for Top Picks movie
 */
function buildTopPicksMovieFilename(movie: TopPicksMovie): string {
  const title = sanitizeFilename(movie.title)
  const year = movie.year ? ` (${movie.year})` : ''
  return `${title}${year} [${movie.providerItemId}]`
}

/**
 * Build filename for Top Picks series
 */
function buildTopPicksSeriesFilename(series: TopPicksSeries): string {
  const title = sanitizeFilename(series.title)
  const year = series.year ? ` (${series.year})` : ''
  return `${title}${year} [${series.providerItemId}]`
}

/**
 * Get STRM content for a movie
 */
function getMovieStrmContent(movie: TopPicksMovie): string {
  const config = getConfig()
  
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
 * Write STRM files for Top Picks Movies
 */
export async function writeTopPicksMovies(
  movies: PopularMovie[]
): Promise<{ written: number; localPath: string; embyPath: string }> {
  const config = getConfig()
  const topPicksConfig = await getTopPicksConfig()
  const startTime = Date.now()

  // Build paths for the global Top Picks Movies library
  const localPath = path.join(config.strmRoot, 'top-picks', 'movies')
  const embyPath = path.join(config.libraryPathPrefix, '..', 'top-picks', 'movies')

  logger.info({ localPath, embyPath, count: movies.length }, '📁 Writing Top Picks Movies STRM files')

  // Ensure directory exists
  await fs.mkdir(localPath, { recursive: true })

  // Clear existing files (fresh library each refresh)
  const existingFiles = await fs.readdir(localPath).catch(() => [])
  for (const file of existingFiles) {
    await fs.unlink(path.join(localPath, file))
  }

  const now = Date.now()
  let written = 0

  for (const popular of movies) {
    const movie: TopPicksMovie = {
      id: popular.movieId,
      title: popular.title,
      year: popular.year,
      providerItemId: popular.movieId, // Use movie ID as provider ID
      posterUrl: popular.posterUrl,
      backdropUrl: popular.backdropUrl,
      overview: popular.overview,
      genres: popular.genres,
      communityRating: popular.communityRating,
      path: popular.path,
      rank: popular.rank,
    }

    // Need to get the provider_item_id from the database
    const { queryOne } = await import('../lib/db.js')
    const dbMovie = await queryOne<{ provider_item_id: string; path: string | null; media_sources: string | null }>(
      'SELECT provider_item_id, path, media_sources FROM movies WHERE id = $1',
      [popular.movieId]
    )
    
    if (!dbMovie) {
      logger.warn({ movieId: popular.movieId, title: popular.title }, 'Movie not found in DB, skipping')
      continue
    }

    movie.providerItemId = dbMovie.provider_item_id
    movie.path = dbMovie.path
    if (dbMovie.media_sources) {
      try {
        movie.mediaSources = JSON.parse(dbMovie.media_sources)
      } catch {
        // Ignore parse errors
      }
    }

    const baseFilename = buildTopPicksMovieFilename(movie)

    // Calculate dateAdded for rank ordering
    const dateAdded = new Date(now - (movie.rank - 1) * INTERVAL_MS)

    // Write STRM file
    const strmPath = path.join(localPath, `${baseFilename}.strm`)
    const strmContent = getMovieStrmContent(movie)
    await fs.writeFile(strmPath, strmContent, 'utf-8')

    // Write NFO file
    const nfoPath = path.join(localPath, `${baseFilename}.nfo`)
    const nfoContent = generateTopPicksMovieNfo(movie, dateAdded)
    await fs.writeFile(nfoPath, nfoContent, 'utf-8')

    // Download poster with Top Picks badge
    if (config.downloadImages && movie.posterUrl) {
      const posterTask: ImageDownloadTask = {
        url: movie.posterUrl,
        path: path.join(localPath, `${baseFilename}-poster.jpg`),
        movieTitle: movie.title,
        isPoster: true,
        rank: movie.rank,
        mode: 'top-picks',
      }
      await downloadImage(posterTask)
    }

    // Download backdrop
    if (config.downloadImages && movie.backdropUrl) {
      const backdropTask: ImageDownloadTask = {
        url: movie.backdropUrl,
        path: path.join(localPath, `${baseFilename}-fanart.jpg`),
        movieTitle: movie.title,
        isPoster: false,
      }
      await downloadImage(backdropTask)
    }

    written++
  }

  const duration = Date.now() - startTime
  logger.info({ written, duration, localPath }, '✅ Top Picks Movies STRM files written')

  return { written, localPath, embyPath }
}

/**
 * Write STRM files for Top Picks Series
 * Note: For series, we create a folder per series with show.nfo and poster.jpg
 */
export async function writeTopPicksSeries(
  seriesList: PopularSeries[]
): Promise<{ written: number; localPath: string; embyPath: string }> {
  const config = getConfig()
  const topPicksConfig = await getTopPicksConfig()
  const startTime = Date.now()

  // Build paths for the global Top Picks Series library
  const localPath = path.join(config.strmRoot, 'top-picks', 'series')
  const embyPath = path.join(config.libraryPathPrefix, '..', 'top-picks', 'series')

  logger.info({ localPath, embyPath, count: seriesList.length }, '📁 Writing Top Picks Series STRM files')

  // Ensure directory exists
  await fs.mkdir(localPath, { recursive: true })

  // Clear existing folders (fresh library each refresh)
  const existingDirs = await fs.readdir(localPath).catch(() => [])
  for (const dir of existingDirs) {
    const dirPath = path.join(localPath, dir)
    await fs.rm(dirPath, { recursive: true, force: true })
  }

  const now = Date.now()
  let written = 0

  for (const popular of seriesList) {
    // Get the provider_item_id and first episode from the database
    const { queryOne } = await import('../lib/db.js')
    const dbSeries = await queryOne<{ 
      provider_item_id: string
      total_seasons: number | null
      total_episodes: number | null
      status: string | null
      content_rating: string | null
    }>(
      'SELECT provider_item_id, total_seasons, total_episodes, status, content_rating FROM series WHERE id = $1',
      [popular.seriesId]
    )
    
    if (!dbSeries) {
      logger.warn({ seriesId: popular.seriesId, title: popular.title }, 'Series not found in DB, skipping')
      continue
    }

    // Get first episode to find the original series folder path
    const firstEpisode = await queryOne<{
      path: string | null
      media_sources: string | null
    }>(
      'SELECT path, media_sources FROM episodes WHERE series_id = $1 ORDER BY season_number, episode_number LIMIT 1',
      [popular.seriesId]
    )

    if (!firstEpisode) {
      logger.warn({ seriesId: popular.seriesId, title: popular.title }, 'No episodes found for series, skipping')
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
      logger.warn({ seriesId: popular.seriesId, title: popular.title }, 'No file path found for episode, skipping')
      continue
    }

    // Derive original series folder (go up from episode: Episode -> Season -> Series)
    // These paths are from Emby's perspective (e.g., /mnt/TV Shows/...)
    // They won't exist locally but will work when Emby on Unraid follows the symlinks
    const originalSeriesFolder = path.dirname(path.dirname(originalEpisodePath))
    
    logger.info({ 
      title: popular.title, 
      originalSeriesFolder,
    }, '📺 Creating symlinks to Emby path (may not resolve locally)')

    const series: TopPicksSeries = {
      id: popular.seriesId,
      title: popular.title,
      year: popular.year,
      providerItemId: dbSeries.provider_item_id,
      posterUrl: popular.posterUrl,
      backdropUrl: popular.backdropUrl,
      overview: popular.overview,
      genres: popular.genres,
      communityRating: popular.communityRating,
      network: popular.network,
      rank: popular.rank,
    }

    // Create our Top Picks series folder
    const seriesFolderName = buildTopPicksSeriesFilename(series)
    const seriesPath = path.join(localPath, seriesFolderName)
    await fs.mkdir(seriesPath, { recursive: true })

    // Calculate dateAdded for rank ordering
    const dateAdded = new Date(now - (series.rank - 1) * INTERVAL_MS)

    // Write our custom tvshow.nfo (with rank sorting)
    const nfoPath = path.join(seriesPath, 'tvshow.nfo')
    const nfoContent = generateTopPicksSeriesNfo(
      {
        ...series,
        contentRating: dbSeries.content_rating,
        status: dbSeries.status,
        totalSeasons: dbSeries.total_seasons,
        totalEpisodes: dbSeries.total_episodes,
      },
      dateAdded
    )
    await fs.writeFile(nfoPath, nfoContent, 'utf-8')

    // Download our custom poster with Top Picks rank badge
    if (config.downloadImages && series.posterUrl) {
      const posterTask: ImageDownloadTask = {
        url: series.posterUrl,
        path: path.join(seriesPath, 'poster.jpg'),
        movieTitle: series.title,
        isPoster: true,
        rank: series.rank,
        mode: 'top-picks',
      }
      await downloadImage(posterTask)
    }

    // Query all seasons for this series from the database
    const { query } = await import('../lib/db.js')
    const seasons = await query<{ season_number: number; season_path: string }>(
      `SELECT DISTINCT season_number, 
              regexp_replace(path, '/[^/]+$', '') as season_path
       FROM episodes 
       WHERE series_id = $1 AND path IS NOT NULL
       ORDER BY season_number`,
      [popular.seriesId]
    )

    // Create symlinks to each season folder
    // Season folders contain their own poster.jpg which Emby should use
    for (const season of seasons.rows) {
      const seasonFolderName = `Season ${String(season.season_number).padStart(2, '0')}`
      const symlinkPath = path.join(seriesPath, seasonFolderName)
      const originalSeasonPath = season.season_path
      
      try {
        await fs.symlink(originalSeasonPath, symlinkPath)
        logger.debug({ seasonFolderName, originalSeasonPath }, 'Created season symlink')
      } catch (err) {
        // Symlink might already exist or other error
        logger.debug({ err, seasonFolderName }, 'Failed to create season symlink')
      }
    }

    // Symlink fanart if we know the path
    const fanartPath = path.join(originalSeriesFolder, 'fanart.jpg')
    try {
      await fs.symlink(fanartPath, path.join(seriesPath, 'fanart.jpg'))
    } catch {
      // Fanart symlink failed, that's okay - we can download it instead
      if (config.downloadImages && series.backdropUrl) {
        const backdropTask: ImageDownloadTask = {
          url: series.backdropUrl,
          path: path.join(seriesPath, 'fanart.jpg'),
          movieTitle: series.title,
          isPoster: false,
        }
        await downloadImage(backdropTask)
      }
    }

    logger.info({ 
      title: series.title, 
      rank: series.rank,
      seasons: seasons.rows.length,
      originalFolder: originalSeriesFolder,
    }, '📺 Created Top Picks series with symlinks')

    written++
  }

  const duration = Date.now() - startTime
  logger.info({ written, duration, localPath }, '✅ Top Picks Series STRM files written')

  return { written, localPath, embyPath }
}

/**
 * Write all Top Picks STRM files
 */
export async function writeAllTopPicks(
  movies: PopularMovie[],
  seriesList: PopularSeries[]
): Promise<{
  movies: { written: number; localPath: string; embyPath: string }
  series: { written: number; localPath: string; embyPath: string }
}> {
  const [moviesResult, seriesResult] = await Promise.all([
    writeTopPicksMovies(movies),
    writeTopPicksSeries(seriesList),
  ])

  return {
    movies: moviesResult,
    series: seriesResult,
  }
}

