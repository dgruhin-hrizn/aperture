import type { Movie } from '../types.js'

/**
 * Generate a unique fake provider ID that will never collide with real IDs.
 * We use a deterministic hash based on the movie's internal ID so rebuilding
 * the library generates the same fake IDs (prevents Emby from detecting changes).
 */
function generateFakeProviderId(movieId: string, prefix: string): string {
  // Use a deterministic UUID based on the movie ID and prefix
  // This ensures the same movie always gets the same fake IDs
  const seed = `aperture-${prefix}-${movieId}`
  // Simple hash to make it deterministic
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Format as a fake IMDB-style ID: aperture + hash
  return `aperture${Math.abs(hash).toString(36)}`
}

/**
 * Escape XML special characters
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export interface NfoGenerateOptions {
  /** Include remote image URLs in NFO (when images not downloaded locally) */
  includeImageUrls: boolean
  /** Date to set as "date added" (affects sorting by recency) */
  dateAdded?: Date
  /** Include AI explanation of why this was recommended (default: true) */
  includeAiExplanation?: boolean
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
 * 
 * @param movie - Movie data
 * @param includeImageUrls - Whether to include remote image URLs (for backward compatibility)
 * @param dateAdded - Date to use as "date added" (for backward compatibility)
 * @param options - Extended options (overrides includeImageUrls and dateAdded)
 */
export function generateNfoContent(
  movie: Movie,
  includeImageUrls: boolean | NfoGenerateOptions,
  dateAdded?: Date
): string {
  // Handle both old signature (boolean, Date) and new signature (options object)
  let options: NfoGenerateOptions
  if (typeof includeImageUrls === 'boolean') {
    options = {
      includeImageUrls,
      dateAdded,
      includeAiExplanation: true, // Default to true for backward compatibility
    }
  } else {
    options = includeImageUrls
  }
  
  const { includeAiExplanation = true } = options
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<movie>',
    // Lock data prevents Emby from auto-fetching ProviderIds (IMDB/TMDB) from online sources
    // This is critical for preventing duplicate Continue Watching entries
    '  <lockdata>true</lockdata>',
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

  // Build the plot - AI explanation first (if enabled), then original overview
  let plot = ''
  if (includeAiExplanation && movie.aiExplanation) {
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
      // Handle both string[] (legacy) and object[] (new format with id/name/imageTag)
      const studioName = typeof studio === 'string' ? studio : studio.name
      if (studioName) {
        lines.push(`  <studio>${escapeXml(studioName)}</studio>`)
      }
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

  // Generate FAKE unique provider IDs that will never collide with real IDs.
  // 
  // Why: When real IDs (IMDB/TMDB) are present, Emby links items together and syncs playback state.
  // This causes BOTH the original AND Aperture copy to appear in "Continue Watching".
  // 
  // By using fake IDs:
  // 1. Emby won't try to fetch real IDs (provider fields are already populated)
  // 2. The fake IDs will never match the original's real IDs (no linking)
  // 3. <lockdata>true</lockdata> prevents Emby from "correcting" them
  //
  // Why it's safe: When you play a STRM file, Emby tracks playback on the item that owns the
  // actual media file (the ORIGINAL), not the STRM. Our watch history sync only matches items
  // in our `movies` table (which only contains originals), so watch history stays accurate.
  //
  // Result: No duplicates in Continue Watching, and watch history works correctly.
  
  // Use the movie's provider ID as seed if available, otherwise use title+year
  const movieSeed = movie.id || `${movie.title}-${movie.year || 'unknown'}`
  const fakeImdbId = generateFakeProviderId(movieSeed, 'imdb')
  const fakeTmdbId = generateFakeProviderId(movieSeed, 'tmdb')
  
  lines.push(`  <uniqueid type="imdb" default="true">${fakeImdbId}</uniqueid>`)
  lines.push(`  <uniqueid type="tmdb">${fakeTmdbId}</uniqueid>`)

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
  if (options.dateAdded) {
    const formatted = options.dateAdded.toISOString().replace('T', ' ').substring(0, 19)
    lines.push(`  <dateadded>${formatted}</dateadded>`)
  }

  // Include remote image URLs in NFO when not downloading locally
  if (options.includeImageUrls) {
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

