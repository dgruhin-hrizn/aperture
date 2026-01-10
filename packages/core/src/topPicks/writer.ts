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
import {
  symlinkArtwork,
  symlinkSubtitles,
  SERIES_SKIP_FILES,
  MOVIE_SKIP_FILES,
  getMovieFolderFromFilePath,
} from '../strm/artwork.js'
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
    `  <plot>This is a hidden placeholder file created by Aperture to control the sort order in your media server's home screen. This series is ranked #${rank} in Top Picks. You can safely ignore this "episode" - it contains no actual video content.</plot>`,
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
 * Generate NFO content for a Top Picks movie
 * Format matches Emby/Jellyfin movie.nfo specification
 */
function generateTopPicksMovieNfo(movie: TopPicksMovie, dateAdded: Date): string {
  // Zero-pad rank for proper alphabetical sorting (01, 02, ... 10)
  const rankPrefix = String(movie.rank).padStart(2, '0')

  const lines = ['<?xml version="1.0" encoding="utf-8" standalone="yes"?>', '<movie>']

  // Plot with CDATA for special characters
  if (movie.overview) {
    lines.push(`  <plot><![CDATA[${movie.overview}]]></plot>`)
  }

  // Outline is the tagline (short summary), not a copy of plot
  if (movie.tagline) {
    lines.push(`  <outline><![CDATA[${movie.tagline}]]></outline>`)
  }

  lines.push(`  <lockdata>false</lockdata>`)
  lines.push(`  <dateadded>${dateAdded.toISOString().slice(0, 19).replace('T', ' ')}</dateadded>`)
  lines.push(`  <title>${escapeXml(movie.title)}</title>`)

  // Original title
  if (movie.originalTitle) {
    lines.push(`  <originaltitle>${escapeXml(movie.originalTitle)}</originaltitle>`)
  } else {
    lines.push(`  <originaltitle>${escapeXml(movie.title)}</originaltitle>`)
  }

  // Actors with type
  if (movie.actors?.length) {
    for (const actor of movie.actors) {
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

  // Directors
  if (movie.directors?.length) {
    for (const director of movie.directors) {
      lines.push(`  <director>${escapeXml(director)}</director>`)
    }
  }

  // Writers (both <writer> and <credits> elements)
  if (movie.writers?.length) {
    for (const writer of movie.writers) {
      lines.push(`  <writer>${escapeXml(writer)}</writer>`)
    }
    for (const writer of movie.writers) {
      lines.push(`  <credits>${escapeXml(writer)}</credits>`)
    }
  }

  // Rating
  if (movie.communityRating) {
    lines.push(`  <rating>${movie.communityRating.toFixed(3)}</rating>`)
  }
  if (movie.criticRating) {
    lines.push(`  <criticrating>${movie.criticRating}</criticrating>`)
  }

  // Year
  if (movie.year) {
    lines.push(`  <year>${movie.year}</year>`)
  }

  // Sort title with rank prefix
  lines.push(`  <sorttitle>${rankPrefix} - ${escapeXml(movie.title)}</sorttitle>`)

  // Content rating (MPAA)
  if (movie.contentRating) {
    lines.push(`  <mpaa>${escapeXml(movie.contentRating)}</mpaa>`)
  }

  // External IDs as separate elements
  if (movie.imdbId) {
    lines.push(`  <imdbid>${escapeXml(movie.imdbId)}</imdbid>`)
  }
  if (movie.tmdbId) {
    lines.push(`  <tmdbid>${escapeXml(movie.tmdbId)}</tmdbid>`)
  }

  // Premiere/release date
  if (movie.premiereDate) {
    // Handle both Date objects and ISO strings
    const dateStr =
      movie.premiereDate instanceof Date
        ? movie.premiereDate.toISOString().split('T')[0]
        : String(movie.premiereDate).split('T')[0]
    lines.push(`  <premiered>${dateStr}</premiered>`)
    lines.push(`  <releasedate>${dateStr}</releasedate>`)
  }

  // Runtime
  if (movie.runtimeMinutes) {
    lines.push(`  <runtime>${movie.runtimeMinutes}</runtime>`)
  }

  // Tagline
  if (movie.tagline) {
    lines.push(`  <tagline>${escapeXml(movie.tagline)}</tagline>`)
  }

  // Production countries
  if (movie.productionCountries?.length) {
    for (const country of movie.productionCountries) {
      lines.push(`  <country>${escapeXml(country)}</country>`)
    }
  }

  // Genres
  if (movie.genres?.length) {
    for (const genre of movie.genres) {
      lines.push(`  <genre>${escapeXml(genre)}</genre>`)
    }
  }

  // Studios
  if (movie.studios?.length) {
    for (const studio of movie.studios) {
      lines.push(`  <studio>${escapeXml(studio)}</studio>`)
    }
  }

  // Add to Top Picks set/collection
  lines.push(`  <set>`)
  lines.push(`    <name>Top Picks - Movies</name>`)
  lines.push(`  </set>`)

  // Unique IDs
  if (movie.imdbId) {
    lines.push(`  <uniqueid type="imdb">${escapeXml(movie.imdbId)}</uniqueid>`)
  }
  if (movie.tmdbId) {
    lines.push(`  <uniqueid type="tmdb">${escapeXml(movie.tmdbId)}</uniqueid>`)
  }

  // Primary ID
  if (movie.imdbId) {
    lines.push(`  <id>${escapeXml(movie.imdbId)}</id>`)
  } else if (movie.tmdbId) {
    lines.push(`  <id>${escapeXml(movie.tmdbId)}</id>`)
  }

  // Tags
  lines.push(`  <tag>Top Picks</tag>`)
  lines.push(`  <tag>Rank ${movie.rank}</tag>`)

  lines.push('</movie>')
  return lines.join('\n')
}

/**
 * Generate NFO content for a Top Picks series
 * Format matches Emby/Jellyfin tvshow.nfo specification
 */
function generateTopPicksSeriesNfo(
  series: TopPicksSeries & {
    totalSeasons?: number | null
    totalEpisodes?: number | null
    endYear?: number | null
  },
  dateAdded: Date
): string {
  // Zero-pad rank for proper alphabetical sorting (01, 02, ... 10)
  const rankPrefix = String(series.rank).padStart(2, '0')

  const lines = ['<?xml version="1.0" encoding="utf-8" standalone="yes"?>', '<tvshow>']

  // Plot with CDATA for special characters
  if (series.overview) {
    lines.push(`  <plot><![CDATA[${series.overview}]]></plot>`)
  }

  lines.push(`  <lockdata>false</lockdata>`)
  lines.push(`  <dateadded>${dateAdded.toISOString().slice(0, 19).replace('T', ' ')}</dateadded>`)
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
  if (series.communityRating) {
    lines.push(`  <rating>${series.communityRating.toFixed(1)}</rating>`)
  }

  // Year
  if (series.year) {
    lines.push(`  <year>${series.year}</year>`)
  }

  // Sort title with rank prefix
  lines.push(`  <sorttitle>${rankPrefix} - ${escapeXml(series.title)}</sorttitle>`)

  // Content rating (MPAA/TV rating)
  if (series.contentRating) {
    lines.push(`  <mpaa>${escapeXml(series.contentRating)}</mpaa>`)
  }

  // External IDs as both uniqueid and legacy elements
  if (series.imdbId) {
    lines.push(`  <imdb_id>${escapeXml(series.imdbId)}</imdb_id>`)
  }
  if (series.tmdbId) {
    lines.push(`  <tmdbid>${escapeXml(series.tmdbId)}</tmdbid>`)
  }

  // Year range (premiered year is from series.year, end year from endYear)
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

  // Add to Top Picks set/collection
  lines.push(`  <set>`)
  lines.push(`    <name>Top Picks - Series</name>`)
  lines.push(`  </set>`)

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

  // Tags
  lines.push(`  <tag>Top Picks</tag>`)
  lines.push(`  <tag>Rank ${series.rank}</tag>`)

  lines.push('</tvshow>')
  return lines.join('\n')
}

interface TopPicksMovie {
  id: string
  title: string
  originalTitle: string | null
  year: number | null
  providerItemId: string
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  tagline: string | null
  genres: string[]
  communityRating: number | null
  criticRating: number | null
  contentRating: string | null
  runtimeMinutes: number | null
  premiereDate: Date | string | null
  path: string | null
  mediaSources?: Array<{ path: string }>
  // Cast & Crew
  studios: string[]
  directors: string[]
  writers: string[]
  actors: Array<{ name: string; role?: string; thumb?: string }>
  // Production info
  productionCountries: string[]
  // External IDs
  imdbId: string | null
  tmdbId: string | null
  // Ranking
  rank: number
}

interface TopPicksSeries {
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
  criticRating: number | null
  contentRating: string | null
  network: string | null
  status: string | null
  // Cast & Crew
  studios: string[]
  directors: string[]
  writers: string[]
  actors: Array<{ name: string; role?: string; thumb?: string }>
  // External IDs
  imdbId: string | null
  tmdbId: string | null
  tvdbId: string | null
  // Ranking
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
async function getMovieStrmContent(movie: TopPicksMovie): Promise<string> {
  const config = getConfig()

  // If streaming URL is preferred
  if (config.useStreamingUrl) {
    const provider = await getMediaServerProvider()
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
  const provider = await getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY || ''
  return provider.getStreamUrl(apiKey, movie.providerItemId)
}

/**
 * Write STRM files (or symlinks) for Top Picks Movies
 */
export async function writeTopPicksMovies(
  movies: PopularMovie[]
): Promise<{ written: number; localPath: string; embyPath: string }> {
  const config = getConfig()
  const topPicksConfig = await getTopPicksConfig()
  const startTime = Date.now()
  const useSymlinks = topPicksConfig.moviesUseSymlinks

  // Build paths for the global Top Picks Movies library
  const localPath = path.join(config.strmRoot, 'top-picks', 'movies')
  const embyPath = path.join(config.libraryPathPrefix, '..', 'top-picks', 'movies')

  logger.info(
    { localPath, embyPath, count: movies.length, useSymlinks },
    `📁 Writing Top Picks Movies ${useSymlinks ? 'symlinks' : 'STRM files'}`
  )

  // Ensure directory exists
  await fs.mkdir(localPath, { recursive: true })

  // Clear existing files/folders (fresh library each refresh)
  const existingEntries = await fs.readdir(localPath).catch(() => [])
  for (const entry of existingEntries) {
    const entryPath = path.join(localPath, entry)
    await fs.rm(entryPath, { recursive: true, force: true })
  }

  const now = Date.now()
  let written = 0

  for (const popular of movies) {
    // Get full movie metadata from the database
    const { queryOne } = await import('../lib/db.js')
    const dbMovie = await queryOne<{
      provider_item_id: string
      original_title: string | null
      path: string | null
      media_sources: string | null
      tagline: string | null
      content_rating: string | null
      critic_rating: number | null
      runtime_minutes: number | null
      premiere_date: Date | string | null
      studios: string | Array<{ id?: string; name: string }> | null
      directors: string[] | null
      writers: string[] | null
      actors: string | null
      production_countries: string[] | null
      imdb_id: string | null
      tmdb_id: string | null
    }>(
      `SELECT provider_item_id, original_title, path, media_sources,
              tagline, content_rating, critic_rating, runtime_minutes, premiere_date,
              studios, directors, writers, actors, production_countries, imdb_id, tmdb_id
       FROM movies WHERE id = $1`,
      [popular.movieId]
    )

    if (!dbMovie) {
      logger.warn(
        { movieId: popular.movieId, title: popular.title },
        'Movie not found in DB, skipping'
      )
      continue
    }

    // Parse fields - JSONB fields come as objects or strings depending on driver
    let mediaSources: Array<{ path: string }> | undefined
    let actors: Array<{ name: string; role?: string; thumb?: string }> = []
    let studiosArray: Array<{ id?: string; name: string }> = []

    if (dbMovie.media_sources) {
      try {
        mediaSources =
          typeof dbMovie.media_sources === 'string'
            ? JSON.parse(dbMovie.media_sources)
            : dbMovie.media_sources
      } catch {
        /* ignore */
      }
    }
    if (dbMovie.actors) {
      try {
        actors = typeof dbMovie.actors === 'string' ? JSON.parse(dbMovie.actors) : dbMovie.actors
      } catch {
        /* ignore */
      }
    }
    if (dbMovie.studios) {
      try {
        studiosArray =
          typeof dbMovie.studios === 'string' ? JSON.parse(dbMovie.studios) : dbMovie.studios
      } catch {
        /* ignore */
      }
    }

    // Extract just the studio names for NFO compatibility
    const studios = studiosArray.map((s) => s.name)
    const directors = dbMovie.directors || []
    const writers = dbMovie.writers || []
    const productionCountries = dbMovie.production_countries || []

    // Runtime is already in minutes
    const runtimeMinutes = dbMovie.runtime_minutes

    const movie: TopPicksMovie = {
      id: popular.movieId,
      title: popular.title,
      originalTitle: dbMovie.original_title,
      year: popular.year,
      providerItemId: dbMovie.provider_item_id,
      posterUrl: popular.posterUrl,
      backdropUrl: popular.backdropUrl,
      overview: popular.overview,
      tagline: dbMovie.tagline,
      genres: popular.genres,
      communityRating: popular.communityRating,
      criticRating: dbMovie.critic_rating,
      contentRating: dbMovie.content_rating,
      runtimeMinutes,
      premiereDate: dbMovie.premiere_date,
      path: dbMovie.path,
      mediaSources,
      studios,
      directors,
      writers,
      actors,
      productionCountries,
      imdbId: dbMovie.imdb_id,
      tmdbId: dbMovie.tmdb_id,
      rank: popular.rank,
    }

    const baseFilename = buildTopPicksMovieFilename(movie)

    // Calculate dateAdded for rank ordering
    const dateAdded = new Date(now - (movie.rank - 1) * INTERVAL_MS)

    if (useSymlinks) {
      // SYMLINKS MODE: Create a folder per movie (like series)
      // Structure: Movie Name (Year) [id]/Movie Name (Year) [id].mkv + movie.nfo + poster.jpg
      const movieFolderPath = path.join(localPath, baseFilename)
      await fs.mkdir(movieFolderPath, { recursive: true })

      // Get original file path
      let originalPath = movie.path
      if (!originalPath && movie.mediaSources && movie.mediaSources.length > 0) {
        originalPath = movie.mediaSources[0].path
      }

      if (originalPath) {
        // Get the file extension from the original path
        const ext = path.extname(originalPath)
        const symlinkPath = path.join(movieFolderPath, `${baseFilename}${ext}`)
        try {
          await fs.symlink(originalPath, symlinkPath)
          logger.debug({ movie: movie.title, originalPath }, 'Created movie symlink')
        } catch (err) {
          logger.debug(
            { err, movie: movie.title },
            'Failed to create movie symlink, falling back to STRM'
          )
          // Fallback to STRM if symlink fails
          const strmPath = path.join(movieFolderPath, `${baseFilename}.strm`)
          const strmContent = await getMovieStrmContent(movie)
          await fs.writeFile(strmPath, strmContent, 'utf-8')
        }
      } else {
        logger.warn({ movie: movie.title }, 'No file path found for movie, using STRM')
        const strmPath = path.join(movieFolderPath, `${baseFilename}.strm`)
        const strmContent = await getMovieStrmContent(movie)
        await fs.writeFile(strmPath, strmContent, 'utf-8')
      }

      // Write NFO file inside the movie folder (named after the movie)
      const nfoPath = path.join(movieFolderPath, `${baseFilename}.nfo`)
      const nfoContent = generateTopPicksMovieNfo(movie, dateAdded)
      await fs.writeFile(nfoPath, nfoContent, 'utf-8')

      // Download poster with Top Picks badge (poster.jpg in folder)
      if (config.downloadImages && movie.posterUrl) {
        const posterTask: ImageDownloadTask = {
          url: movie.posterUrl,
          path: path.join(movieFolderPath, 'poster.jpg'),
          movieTitle: movie.title,
          isPoster: true,
          rank: movie.rank,
          mode: 'top-picks',
        }
        await downloadImage(posterTask)
      }

      // Download backdrop (fanart.jpg in folder)
      if (config.downloadImages && movie.backdropUrl) {
        const backdropTask: ImageDownloadTask = {
          url: movie.backdropUrl,
          path: path.join(movieFolderPath, 'fanart.jpg'),
          movieTitle: movie.title,
          isPoster: false,
        }
        await downloadImage(backdropTask)
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
      // STRM MODE: Flat file structure (original behavior)
      const strmPath = path.join(localPath, `${baseFilename}.strm`)
      const strmContent = await getMovieStrmContent(movie)
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
    }

    written++
  }

  const duration = Date.now() - startTime
  logger.info({ written, duration, localPath }, '✅ Top Picks Movies STRM files written')

  return { written, localPath, embyPath }
}

/**
 * Write STRM files (or symlinks) for Top Picks Series
 * Note: For series, we create a folder per series with show.nfo and poster.jpg
 */
export async function writeTopPicksSeries(
  seriesList: PopularSeries[]
): Promise<{ written: number; localPath: string; embyPath: string }> {
  const config = getConfig()
  const topPicksConfig = await getTopPicksConfig()
  const startTime = Date.now()
  const useSymlinks = topPicksConfig.seriesUseSymlinks

  // Build paths for the global Top Picks Series library
  const localPath = path.join(config.strmRoot, 'top-picks', 'series')
  const embyPath = path.join(config.libraryPathPrefix, '..', 'top-picks', 'series')

  logger.info(
    { localPath, embyPath, count: seriesList.length, useSymlinks },
    `📁 Writing Top Picks Series ${useSymlinks ? 'symlinks' : 'STRM files'}`
  )

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
    // Get full series metadata from the database
    const { queryOne } = await import('../lib/db.js')
    const dbSeries = await queryOne<{
      provider_item_id: string
      original_title: string | null
      total_seasons: number | null
      total_episodes: number | null
      status: string | null
      content_rating: string | null
      critic_rating: number | null
      end_year: number | null
      studios: string | Array<{ id?: string; name: string }> | null
      directors: string[] | null
      writers: string[] | null
      actors: string | null
      imdb_id: string | null
      tmdb_id: string | null
      tvdb_id: string | null
    }>(
      `SELECT provider_item_id, original_title, total_seasons, total_episodes, 
              status, content_rating, critic_rating, end_year,
              studios, directors, writers, actors,
              imdb_id, tmdb_id, tvdb_id
       FROM series WHERE id = $1`,
      [popular.seriesId]
    )

    if (!dbSeries) {
      logger.warn(
        { seriesId: popular.seriesId, title: popular.title },
        'Series not found in DB, skipping'
      )
      continue
    }

    // Parse fields - JSONB fields come as objects or strings depending on driver
    let actors: Array<{ name: string; role?: string; thumb?: string }> = []
    let studiosArray: Array<{ id?: string; name: string }> = []

    if (dbSeries.actors) {
      try {
        actors = typeof dbSeries.actors === 'string' ? JSON.parse(dbSeries.actors) : dbSeries.actors
      } catch {
        /* ignore */
      }
    }
    if (dbSeries.studios) {
      try {
        studiosArray =
          typeof dbSeries.studios === 'string' ? JSON.parse(dbSeries.studios) : dbSeries.studios
      } catch {
        /* ignore */
      }
    }

    // Extract just the studio names for NFO compatibility
    const studios = studiosArray.map((s) => s.name)
    const directors = dbSeries.directors || []
    const writers = dbSeries.writers || []

    // Get first episode to find the original series folder path
    const firstEpisode = await queryOne<{
      path: string | null
      media_sources: string | null
    }>(
      'SELECT path, media_sources FROM episodes WHERE series_id = $1 ORDER BY season_number, episode_number LIMIT 1',
      [popular.seriesId]
    )

    if (!firstEpisode) {
      logger.warn(
        { seriesId: popular.seriesId, title: popular.title },
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
        { seriesId: popular.seriesId, title: popular.title },
        'No file path found for episode, skipping'
      )
      continue
    }

    // Derive original series folder (go up from episode: Episode -> Season -> Series)
    // These paths are from Emby's perspective (e.g., /mnt/TV Shows/...)
    // They won't exist locally but will work when Emby on Unraid follows the symlinks
    const originalSeriesFolder = path.dirname(path.dirname(originalEpisodePath))

    logger.info(
      {
        title: popular.title,
        originalSeriesFolder,
      },
      '📺 Creating symlinks to Emby path (may not resolve locally)'
    )

    const series: TopPicksSeries = {
      id: popular.seriesId,
      title: popular.title,
      originalTitle: dbSeries.original_title,
      year: popular.year,
      providerItemId: dbSeries.provider_item_id,
      posterUrl: popular.posterUrl,
      backdropUrl: popular.backdropUrl,
      overview: popular.overview,
      genres: popular.genres,
      communityRating: popular.communityRating,
      criticRating: dbSeries.critic_rating,
      contentRating: dbSeries.content_rating,
      network: popular.network,
      status: dbSeries.status,
      studios,
      directors,
      writers,
      actors,
      imdbId: dbSeries.imdb_id,
      tmdbId: dbSeries.tmdb_id,
      tvdbId: dbSeries.tvdb_id,
      rank: popular.rank,
    }

    // Create our Top Picks series folder
    const seriesFolderName = buildTopPicksSeriesFilename(series)
    const seriesPath = path.join(localPath, seriesFolderName)
    await fs.mkdir(seriesPath, { recursive: true })

    // Calculate dateAdded for rank ordering
    const dateAdded = new Date(now - (series.rank - 1) * INTERVAL_MS)

    // Write our custom tvshow.nfo (with rank sorting and full cast/crew)
    const nfoPath = path.join(seriesPath, 'tvshow.nfo')
    const nfoContent = generateTopPicksSeriesNfo(
      {
        ...series,
        totalSeasons: dbSeries.total_seasons,
        totalEpisodes: dbSeries.total_episodes,
        endYear: dbSeries.end_year,
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

    // Create Season 00 (Specials) folder with a sorting placeholder episode
    // This tricks Emby into sorting series by our rank in the home "Latest" row
    // because Emby uses the latest episode's dateadded for series sorting
    const specialsFolderPath = path.join(seriesPath, 'Season 00')
    await fs.mkdir(specialsFolderPath, { recursive: true })

    const placeholderBasename = 'S00E00 - Aperture Sorting Placeholder'

    // Create NFO with dateadded set 100 years in future (by rank for sort order)
    const placeholderNfoPath = path.join(specialsFolderPath, `${placeholderBasename}.nfo`)
    const placeholderNfoContent = generateSortingPlaceholderNfo(series.title, series.rank)
    await fs.writeFile(placeholderNfoPath, placeholderNfoContent, 'utf-8')

    // Create a minimal STRM file so Emby recognizes the episode entry
    const placeholderStrmPath = path.join(specialsFolderPath, `${placeholderBasename}.strm`)
    const placeholderStrmContent = '# Aperture sorting placeholder - not a real video\nabout:blank'
    await fs.writeFile(placeholderStrmPath, placeholderStrmContent, 'utf-8')

    logger.debug(
      { series: series.title, rank: series.rank },
      '📅 Created sorting placeholder for home row ordering'
    )

    // Query all episodes for this series from the database
    const { query } = await import('../lib/db.js')

    if (useSymlinks) {
      // SYMLINKS MODE: Create symlinks to season folders
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

      // Symlink all other artwork files from original series folder
      const artworkCount = await symlinkArtwork({
        mediaServerPath: originalSeriesFolder,
        targetPath: seriesPath,
        skipFiles: SERIES_SKIP_FILES,
        skipSeasonFolders: true,
        mediaType: 'series',
        title: series.title,
      })

      // If no artwork was symlinked, try to download fanart
      if (artworkCount === 0 && config.downloadImages && series.backdropUrl) {
        const backdropTask: ImageDownloadTask = {
          url: series.backdropUrl,
          path: path.join(seriesPath, 'fanart.jpg'),
          movieTitle: series.title,
          isPoster: false,
        }
        await downloadImage(backdropTask)
      }

      logger.info(
        {
          title: series.title,
          rank: series.rank,
          seasons: seasons.rows.length,
          originalFolder: originalSeriesFolder,
        },
        '📺 Created Top Picks series with symlinks'
      )
    } else {
      // STRM MODE: Create STRM files for each episode
      const episodes = await query<{
        season_number: number
        episode_number: number
        title: string
        path: string | null
        media_sources: string | null
        provider_item_id: string
      }>(
        `SELECT season_number, episode_number, title, path, media_sources, provider_item_id
         FROM episodes 
         WHERE series_id = $1
         ORDER BY season_number, episode_number`,
        [popular.seriesId]
      )

      for (const episode of episodes.rows) {
        const seasonFolder = `Season ${String(episode.season_number).padStart(2, '0')}`
        const seasonPath = path.join(seriesPath, seasonFolder)
        await fs.mkdir(seasonPath, { recursive: true })

        // Build episode filename
        const episodeNum = `S${String(episode.season_number).padStart(2, '0')}E${String(episode.episode_number).padStart(2, '0')}`
        const episodeTitle = episode.title ? ` - ${sanitizeFilename(episode.title)}` : ''
        const episodeFilename = `${sanitizeFilename(series.title)} ${episodeNum}${episodeTitle}`

        // Get STRM content (streaming URL or file path)
        let strmContent: string
        if (config.useStreamingUrl) {
          const provider = await getMediaServerProvider()
          const apiKey = process.env.MEDIA_SERVER_API_KEY || ''
          strmContent = provider.getStreamUrl(apiKey, episode.provider_item_id)
        } else {
          // Try to get the actual file path
          let episodePath = episode.path
          if (!episodePath && episode.media_sources) {
            try {
              const sources = JSON.parse(episode.media_sources)
              if (sources[0]?.path) {
                episodePath = sources[0].path
              }
            } catch {
              // Ignore parse errors
            }
          }
          if (episodePath) {
            strmContent = episodePath
          } else {
            // Fallback to streaming URL
            const provider = await getMediaServerProvider()
            const apiKey = process.env.MEDIA_SERVER_API_KEY || ''
            strmContent = provider.getStreamUrl(apiKey, episode.provider_item_id)
          }
        }

        const strmPath = path.join(seasonPath, `${episodeFilename}.strm`)
        await fs.writeFile(strmPath, strmContent, 'utf-8')
      }

      // Symlink artwork files from original series folder (even in STRM mode)
      const artworkCount = await symlinkArtwork({
        mediaServerPath: originalSeriesFolder,
        targetPath: seriesPath,
        skipFiles: SERIES_SKIP_FILES,
        skipSeasonFolders: true,
        mediaType: 'series',
        title: series.title,
      })

      // If no artwork was symlinked, try to download fanart
      if (artworkCount === 0 && config.downloadImages && series.backdropUrl) {
        const backdropTask: ImageDownloadTask = {
          url: series.backdropUrl,
          path: path.join(seriesPath, 'fanart.jpg'),
          movieTitle: series.title,
          isPoster: false,
        }
        await downloadImage(backdropTask)
      }

      logger.info(
        {
          title: series.title,
          rank: series.rank,
          episodes: episodes.rows.length,
        },
        '📺 Created Top Picks series with STRM files'
      )
    }

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
