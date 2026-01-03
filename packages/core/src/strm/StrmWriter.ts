import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
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

// Emby green color
const EMBY_GREEN = '#52B54B'
// Aperture purple accent
const APERTURE_PURPLE = '#8B5CF6'

/**
 * Create a ranked poster with badge overlays:
 * - Top left: Emby green circle with white rank number
 * - Top right: Black circle with purple progress ring and white percentage
 * - Original poster dimensions preserved
 */
async function createRankedPoster(
  posterBuffer: Buffer,
  rank: number,
  matchPercent: number
): Promise<Buffer> {
  // Get original poster dimensions
  const metadata = await sharp(posterBuffer).metadata()
  const width = metadata.width || 1000
  const height = metadata.height || 1500

  // Badge sizing - proportional to image size
  const badgeRadius = Math.round(Math.min(width, height) * 0.08)
  const padding = Math.round(badgeRadius * 0.5)
  const fontSize = Math.round(badgeRadius * 0.9)
  const percentFontSize = Math.round(badgeRadius * 0.7)
  const ringStroke = Math.round(badgeRadius * 0.15)
  
  // Progress ring calculations
  const ringRadius = badgeRadius - ringStroke / 2 - 2
  const ringCircumference = 2 * Math.PI * ringRadius
  const progressOffset = ringCircumference * (1 - matchPercent / 100)

  // Create SVG overlay with both badges
  const overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Shadow filter for badges -->
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
        
        <!-- Glow for purple ring -->
        <filter id="purpleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- TOP LEFT: Rank badge (Emby green with white number) -->
      <g transform="translate(${padding + badgeRadius}, ${padding + badgeRadius})" filter="url(#shadow)">
        <!-- Green circle background -->
        <circle 
          cx="0" 
          cy="0" 
          r="${badgeRadius}" 
          fill="${EMBY_GREEN}"
        />
        <!-- Rank number -->
        <text 
          x="0" 
          y="${fontSize * 0.35}" 
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="${fontSize}" 
          font-weight="800" 
          fill="white" 
          text-anchor="middle"
        >${rank}</text>
      </g>
      
      <!-- TOP RIGHT: Match percentage badge (black with purple ring) -->
      <g transform="translate(${width - padding - badgeRadius}, ${padding + badgeRadius})" filter="url(#shadow)">
        <!-- Black circle background -->
        <circle 
          cx="0" 
          cy="0" 
          r="${badgeRadius}" 
          fill="rgba(0,0,0,0.85)"
        />
        
        <!-- Background ring (subtle) -->
        <circle 
          cx="0" 
          cy="0" 
          r="${ringRadius}" 
          fill="none" 
          stroke="rgba(255,255,255,0.15)" 
          stroke-width="${ringStroke}"
        />
        
        <!-- Progress ring (purple) -->
        <circle 
          cx="0" 
          cy="0" 
          r="${ringRadius}" 
          fill="none" 
          stroke="${APERTURE_PURPLE}" 
          stroke-width="${ringStroke}"
          stroke-linecap="round"
          stroke-dasharray="${ringCircumference}"
          stroke-dashoffset="${progressOffset}"
          transform="rotate(-90)"
          filter="url(#purpleGlow)"
        />
        
        <!-- Percentage text -->
        <text 
          x="0" 
          y="${percentFontSize * 0.35}" 
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="${percentFontSize}" 
          font-weight="700" 
          fill="white" 
          text-anchor="middle"
        >${matchPercent}%</text>
      </g>
    </svg>
  `

  // Composite the overlay onto the original poster
  const result = await sharp(posterBuffer)
    .composite([
      {
        input: Buffer.from(overlaySvg),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()

  return result
}

/**
 * Image download task with optional ranking data for poster overlay
 */
interface ImageDownloadTask {
  url: string
  path: string
  movieTitle: string
  isPoster: boolean
  rank?: number
  matchScore?: number
}

/**
 * Download an image from URL and save it locally
 * For posters, applies the ranked overlay with rank and match percentage
 */
async function downloadImage(task: ImageDownloadTask): Promise<boolean> {
  const filename = task.path.split('/').pop()
  try {
    logger.info({ url: task.url.substring(0, 80), filename, isPoster: task.isPoster }, '📥 Downloading image...')
    const startTime = Date.now()
    const response = await fetch(task.url)
    if (!response.ok) {
      logger.warn({ url: task.url, status: response.status, filename }, '❌ Failed to download image')
      return false
    }
    let buffer: Buffer = Buffer.from(await response.arrayBuffer())
    
    // Apply ranked overlay for poster images
    if (task.isPoster && task.rank !== undefined && task.matchScore !== undefined) {
      try {
        logger.info({ filename, rank: task.rank, matchScore: task.matchScore }, '🎨 Applying ranked overlay...')
        const overlayBuffer = await createRankedPoster(buffer, task.rank, task.matchScore)
        buffer = Buffer.from(overlayBuffer)
        logger.info({ filename, newSizeKB: Math.round(buffer.byteLength / 1024) }, '🎨 Overlay applied successfully')
      } catch (overlayErr) {
        logger.warn({ err: overlayErr, filename }, '⚠️ Failed to apply overlay, saving original')
      }
    }
    
    const sizeKB = Math.round(buffer.byteLength / 1024)
    await fs.writeFile(task.path, buffer)
    const duration = Date.now() - startTime
    logger.info({ filename, sizeKB, durationMs: duration }, `✅ Image saved (${sizeKB}KB in ${duration}ms)`)
    return true
  } catch (err) {
    logger.error({ err, url: task.url, filename }, '❌ Error downloading image')
    return false
  }
}

interface Movie {
  id: string
  providerItemId: string
  title: string
  originalTitle: string | null
  sortTitle: string | null
  year: number | null
  premiereDate: string | Date | null
  path: string | null
  mediaSources: Array<{ path: string }> | null
  // Metadata for NFO generation
  overview: string | null
  tagline: string | null
  communityRating: number | null
  criticRating: number | null
  contentRating: string | null // MPAA rating
  runtimeMinutes: number | null
  genres: string[] | null
  posterUrl: string | null
  backdropUrl: string | null
  // Extended metadata
  studios: string[] | null
  directors: string[] | null
  writers: string[] | null
  actors: Array<{ name: string; role?: string; thumb?: string }> | null
  imdbId: string | null
  tmdbId: string | null
  tags: string[] | null
  productionCountries: string[] | null
  awards: string | null
  videoResolution: string | null
  videoCodec: string | null
  audioCodec: string | null
  container: string | null
  // AI-generated explanation for why this movie was recommended
  aiExplanation: string | null
  // Recommendation ranking data
  rank: number
  matchScore: number // 0-100 percentage
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
 * NFO files contain comprehensive metadata that Emby can read when scanning the library
 * 
 * When downloadImages is true, images are saved locally and Emby auto-detects them.
 * When downloadImages is false, we include remote URLs in the NFO.
 * 
 * The plot contains AI explanation first (why Aperture picked it), then original overview.
 * dateAdded is used to set the "Date Added" in Emby based on rank (Rank 1 = newest)
 */
function generateNfoContent(movie: Movie, includeImageUrls: boolean, dateAdded?: Date): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<movie>',
    `  <title>${escapeXml(movie.title)}</title>`,
  ]

  // Original title (if different from main title)
  if (movie.originalTitle && movie.originalTitle !== movie.title) {
    lines.push(`  <originaltitle>${escapeXml(movie.originalTitle)}</originaltitle>`)
  }

  // Sort title
  if (movie.sortTitle) {
    lines.push(`  <sorttitle>${escapeXml(movie.sortTitle)}</sorttitle>`)
  }

  // Year
  if (movie.year) {
    lines.push(`  <year>${movie.year}</year>`)
  }

  // Build the plot - AI explanation first, then original overview
  let plot = ''
  if (movie.aiExplanation) {
    plot = '🎯 Why Aperture picked this for you:\n' + movie.aiExplanation
    if (movie.overview) {
      plot += '\n\n📖 About this movie:\n' + movie.overview
    }
  } else if (movie.overview) {
    plot = movie.overview
  }
  if (plot) {
    lines.push(`  <plot>${escapeXml(plot)}</plot>`)
  }

  // Tagline
  if (movie.tagline) {
    lines.push(`  <tagline>${escapeXml(movie.tagline)}</tagline>`)
  }

  // Runtime
  if (movie.runtimeMinutes) {
    lines.push(`  <runtime>${movie.runtimeMinutes}</runtime>`)
  }

  // MPAA/Content Rating
  if (movie.contentRating) {
    lines.push(`  <mpaa>${escapeXml(movie.contentRating)}</mpaa>`)
  }

  // Ratings
  if (movie.communityRating) {
    lines.push(`  <rating>${movie.communityRating}</rating>`)
  }
  if (movie.criticRating) {
    lines.push(`  <criticrating>${movie.criticRating}</criticrating>`)
  }

  // Genres
  if (movie.genres && movie.genres.length > 0) {
    for (const genre of movie.genres) {
      lines.push(`  <genre>${escapeXml(genre)}</genre>`)
    }
  }

  // Studios
  if (movie.studios && movie.studios.length > 0) {
    for (const studio of movie.studios) {
      lines.push(`  <studio>${escapeXml(studio)}</studio>`)
    }
  }

  // Directors
  if (movie.directors && movie.directors.length > 0) {
    for (const director of movie.directors) {
      lines.push(`  <director>${escapeXml(director)}</director>`)
    }
  }

  // Writers (credits)
  if (movie.writers && movie.writers.length > 0) {
    for (const writer of movie.writers) {
      lines.push(`  <credits>${escapeXml(writer)}</credits>`)
    }
  }

  // Actors
  if (movie.actors && movie.actors.length > 0) {
    for (const actor of movie.actors) {
      lines.push(`  <actor>`)
      lines.push(`    <name>${escapeXml(actor.name)}</name>`)
      if (actor.role) {
        lines.push(`    <role>${escapeXml(actor.role)}</role>`)
      }
      if (actor.thumb) {
        lines.push(`    <thumb>${escapeXml(actor.thumb)}</thumb>`)
      }
      lines.push(`  </actor>`)
    }
  }

  // Premiere date
  if (movie.premiereDate) {
    // Handle both Date objects and ISO strings from the database
    const dateStr = movie.premiereDate instanceof Date 
      ? movie.premiereDate.toISOString().split('T')[0]
      : String(movie.premiereDate).split('T')[0]
    lines.push(`  <premiered>${dateStr}</premiered>`)
  }

  // Production countries
  if (movie.productionCountries && movie.productionCountries.length > 0) {
    for (const country of movie.productionCountries) {
      lines.push(`  <country>${escapeXml(country)}</country>`)
    }
  }

  // Tags
  if (movie.tags && movie.tags.length > 0) {
    for (const tag of movie.tags) {
      lines.push(`  <tag>${escapeXml(tag)}</tag>`)
    }
  }

  // External IDs
  if (movie.imdbId) {
    lines.push(`  <uniqueid type="imdb">${escapeXml(movie.imdbId)}</uniqueid>`)
  }
  if (movie.tmdbId) {
    lines.push(`  <uniqueid type="tmdb">${movie.tmdbId}</uniqueid>`)
  }

  // File info (for display purposes)
  if (movie.videoResolution || movie.videoCodec || movie.audioCodec) {
    lines.push(`  <fileinfo>`)
    lines.push(`    <streamdetails>`)
    if (movie.videoResolution || movie.videoCodec) {
      lines.push(`      <video>`)
      if (movie.videoCodec) {
        lines.push(`        <codec>${escapeXml(movie.videoCodec)}</codec>`)
      }
      if (movie.videoResolution) {
        const [width, height] = movie.videoResolution.split('x')
        if (width) lines.push(`        <width>${width}</width>`)
        if (height) lines.push(`        <height>${height}</height>`)
      }
      lines.push(`      </video>`)
    }
    if (movie.audioCodec) {
      lines.push(`      <audio>`)
      lines.push(`        <codec>${escapeXml(movie.audioCodec)}</codec>`)
      lines.push(`      </audio>`)
    }
    lines.push(`    </streamdetails>`)
    lines.push(`  </fileinfo>`)
  }

  // Set dateadded for Emby sorting by "Date Added" (Rank 1 = newest)
  if (dateAdded) {
    const formatted = dateAdded.toISOString().replace('T', ' ').substring(0, 19)
    lines.push(`  <dateadded>${formatted}</dateadded>`)
  }

  // Include remote image URLs in NFO when not downloading locally
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
      
      await Promise.all(batch.map(task => downloadImage(task)))
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
): Promise<{ libraryId: string; libraryGuid: string; created: boolean; name: string }> {
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

    return { libraryId: existingLib.id, libraryGuid: existingLib.guid!, created: false, name: libraryName }
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

  return { libraryId: result.libraryId, libraryGuid, created: true, name: libraryName }
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

