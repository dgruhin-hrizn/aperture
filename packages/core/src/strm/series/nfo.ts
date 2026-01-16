/**
 * Series NFO Generator
 *
 * Generates comprehensive NFO files for TV series that Emby/Jellyfin can read.
 * This matches the quality and completeness of the movie NFO generator.
 */

import type { Series, NfoGenerateOptions } from './types.js'

/**
 * Generate a unique fake provider ID that will never collide with real IDs.
 * We use a deterministic hash based on the series' internal ID so rebuilding
 * the library generates the same fake IDs (prevents Emby from detecting changes).
 */
function generateFakeProviderId(seriesId: string, prefix: string): string {
  // Use a deterministic UUID based on the series ID and prefix
  // This ensures the same series always gets the same fake IDs
  const seed = `aperture-${prefix}-${seriesId}`
  // Simple hash to make it deterministic
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Format as a fake ID: aperture + hash
  return `aperture${Math.abs(hash).toString(36)}`
}

/**
 * Escape XML special characters
 */
export function escapeXml(text: string): string {
  if (typeof text !== 'string') {
    return String(text || '')
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Generate NFO content for a TV series
 *
 * NFO files contain comprehensive metadata that Emby can read when scanning the library.
 * The plot contains AI explanation first (why Aperture picked it), then original overview.
 * dateAdded is used to set the "Date Added" in Emby based on rank (Rank 1 = newest)
 */
export function generateSeriesNfoContent(
  series: Series,
  optionsOrIncludeImageUrls: boolean | NfoGenerateOptions,
  dateAdded?: Date
): string {
  // Handle both old signature (boolean, Date) and new signature (options object)
  let options: NfoGenerateOptions
  if (typeof optionsOrIncludeImageUrls === 'boolean') {
    options = {
      includeImageUrls: optionsOrIncludeImageUrls,
      dateAdded,
      includeAiExplanation: true,
    }
  } else {
    options = optionsOrIncludeImageUrls
  }

  const { includeAiExplanation = true } = options
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8" standalone="yes"?>',
    '<tvshow>',
  ]

  // === Plot and Outline ===
  // Build the plot - AI explanation first (if enabled), then original overview
  let plot = ''
  if (includeAiExplanation && series.aiExplanation) {
    plot = '🎯 Why Aperture picked this for you:\n' + series.aiExplanation
    if (series.overview) {
      plot += '\n\n📖 About this series:\n' + series.overview
    }
  } else if (series.overview) {
    plot = series.overview
  }

  if (plot) {
    lines.push(`  <plot><![CDATA[${plot}]]></plot>`)
    lines.push(`  <outline><![CDATA[${series.overview || plot}]]></outline>`)
  }

  // Lock data - prevents Emby from auto-fetching ProviderIds (IMDB/TMDB/TVDB) from online sources
  // This is critical for preventing duplicate Continue Watching entries
  lines.push(`  <lockdata>true</lockdata>`)

  // Date added (for Emby sorting by "Date Added" - Rank 1 = newest)
  if (options.dateAdded) {
    const formatted = options.dateAdded.toISOString().replace('T', ' ').substring(0, 19)
    lines.push(`  <dateadded>${formatted}</dateadded>`)
  }

  // === Title Information ===
  lines.push(`  <title>${escapeXml(series.title)}</title>`)

  if (series.originalTitle && series.originalTitle !== series.title) {
    lines.push(`  <originaltitle>${escapeXml(series.originalTitle)}</originaltitle>`)
  }

  if (series.sortTitle) {
    lines.push(`  <sorttitle>${escapeXml(series.sortTitle)}</sorttitle>`)
  } else {
    lines.push(`  <sorttitle>${escapeXml(series.title)}</sorttitle>`)
  }

  // === Actors ===
  if (series.actors && series.actors.length > 0) {
    for (const actor of series.actors) {
      lines.push(`  <actor>`)
      lines.push(`    <name>${escapeXml(actor.name)}</name>`)
      if (actor.role) {
        lines.push(`    <role>${escapeXml(actor.role)}</role>`)
      }
      if (actor.type) {
        lines.push(`    <type>${escapeXml(actor.type)}</type>`)
      }
      if (actor.thumb) {
        lines.push(`    <thumb>${escapeXml(actor.thumb)}</thumb>`)
      }
      if (actor.tmdbId) {
        lines.push(`    <tmdbid>${escapeXml(actor.tmdbId)}</tmdbid>`)
      }
      if (actor.imdbId) {
        lines.push(`    <imdbid>${escapeXml(actor.imdbId)}</imdbid>`)
      }
      if (actor.tvdbId) {
        lines.push(`    <tvdbid>${escapeXml(actor.tvdbId)}</tvdbid>`)
      }
      if (actor.tvmazeId) {
        lines.push(`    <tvmazeid>${escapeXml(actor.tvmazeId)}</tvmazeid>`)
      }
      lines.push(`  </actor>`)
    }
  }

  // === Year and Dates ===
  if (series.year) {
    lines.push(`  <year>${series.year}</year>`)
  }

  if (series.premiereDate) {
    const dateStr = series.premiereDate instanceof Date
      ? series.premiereDate.toISOString().split('T')[0]
      : String(series.premiereDate).split('T')[0]
    lines.push(`  <premiered>${dateStr}</premiered>`)
    lines.push(`  <releasedate>${dateStr}</releasedate>`)
  }

  // === Runtime ===
  if (series.runtimeMinutes) {
    lines.push(`  <runtime>${series.runtimeMinutes}</runtime>`)
  }

  // === Ratings ===
  if (series.communityRating) {
    lines.push(`  <rating>${series.communityRating}</rating>`)
  }
  if (series.criticRating) {
    lines.push(`  <criticrating>${series.criticRating}</criticrating>`)
  }

  // === Content Rating ===
  if (series.contentRating) {
    lines.push(`  <mpaa>${escapeXml(series.contentRating)}</mpaa>`)
  }

  // === Tagline ===
  if (series.tagline) {
    lines.push(`  <tagline>${escapeXml(series.tagline)}</tagline>`)
  }

  // === Country ===
  if (series.productionCountries && series.productionCountries.length > 0) {
    for (const country of series.productionCountries) {
      lines.push(`  <country>${escapeXml(country)}</country>`)
    }
  }

  // === Genres ===
  if (series.genres && series.genres.length > 0) {
    for (const genre of series.genres) {
      lines.push(`  <genre>${escapeXml(genre)}</genre>`)
    }
  }

  // === Tags ===
  if (series.tags && series.tags.length > 0) {
    for (const tag of series.tags) {
      lines.push(`  <tag>${escapeXml(tag)}</tag>`)
    }
  }

  // === Studio/Network ===
  if (series.network) {
    lines.push(`  <studio>${escapeXml(series.network)}</studio>`)
  }
  if (series.studios && series.studios.length > 0) {
    for (const studio of series.studios) {
      const studioName = typeof studio === 'string' ? studio : studio.name
      if (studioName && studioName !== series.network) {
        lines.push(`  <studio>${escapeXml(studioName)}</studio>`)
      }
    }
  }

  // === Directors (Creators/Showrunners) ===
  if (series.directors && series.directors.length > 0) {
    for (const director of series.directors) {
      lines.push(`  <director>${escapeXml(director)}</director>`)
    }
  }

  // === Writers ===
  if (series.writers && series.writers.length > 0) {
    for (const writer of series.writers) {
      lines.push(`  <credits>${escapeXml(writer)}</credits>`)
    }
  }

  // Generate FAKE unique provider IDs that will never collide with real IDs.
  // 
  // Why: When real IDs (IMDB/TMDB/TVDB) are present, Emby links items together and syncs playback state.
  // This causes BOTH the original AND Aperture copy to appear in "Continue Watching".
  // 
  // By using fake IDs:
  // 1. Emby won't try to fetch real IDs (provider fields are already populated)
  // 2. The fake IDs will never match the original's real IDs (no linking)
  // 3. <lockdata>true</lockdata> prevents Emby from "correcting" them
  //
  // Why it's safe: When you play a STRM file, Emby tracks playback on the item that owns the
  // actual media file (the ORIGINAL), not the STRM. Our watch history sync only matches items
  // in our database tables (which only contain originals), so watch history stays accurate.
  //
  // Result: No duplicates in Continue Watching, and watch history works correctly.
  
  // Use the series' provider ID as seed if available, otherwise use title+year
  const seriesSeed = series.id || `${series.title}-${series.year || 'unknown'}`
  const fakeImdbId = generateFakeProviderId(seriesSeed, 'imdb')
  const fakeTmdbId = generateFakeProviderId(seriesSeed, 'tmdb')
  const fakeTvdbId = generateFakeProviderId(seriesSeed, 'tvdb')
  
  lines.push(`  <uniqueid type="imdb">${fakeImdbId}</uniqueid>`)
  lines.push(`  <uniqueid type="tvdb" default="true">${fakeTvdbId}</uniqueid>`)
  lines.push(`  <uniqueid type="tmdb">${fakeTmdbId}</uniqueid>`)

  // === Series Metadata ===

  // Season/episode counts
  if (series.totalSeasons) {
    lines.push(`  <season>${series.totalSeasons}</season>`)
  }
  if (series.totalEpisodes) {
    lines.push(`  <episode>${series.totalEpisodes}</episode>`)
  }

  // Display order
  lines.push(`  <displayorder>aired</displayorder>`)

  // Status
  if (series.status) {
    lines.push(`  <status>${escapeXml(series.status)}</status>`)
  }

  // End year (for ended series)
  if (series.endYear && series.endYear !== series.year) {
    lines.push(`  <enddate>${series.endYear}</enddate>`)
  }

  // === Awards ===
  if (series.awards) {
    lines.push(`  <awards>${escapeXml(series.awards)}</awards>`)
  }

  // === Image URLs (when not downloading locally) ===
  if (options.includeImageUrls) {
    if (series.posterUrl) {
      lines.push(`  <thumb aspect="poster">${escapeXml(series.posterUrl)}</thumb>`)
    }
    if (series.backdropUrl) {
      lines.push(`  <fanart>`)
      lines.push(`    <thumb>${escapeXml(series.backdropUrl)}</thumb>`)
      lines.push(`  </fanart>`)
    }
  }

  lines.push('</tvshow>')

  return lines.join('\n')
}



