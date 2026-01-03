/**
 * Series STRM Writer
 *
 * Writes STRM files for TV series recommendations, organizing them
 * with proper season/episode folder structures for Emby/Jellyfin.
 */

import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getConfig } from '../config.js'
import { getMediaServerProvider } from '../../media/index.js'

const logger = createChildLogger('strm-series-writer')

interface RecommendedSeries {
  seriesId: string
  providerItemId: string
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  genres: string[] | null
  contentRating: string | null
  network: string | null
  status: string | null
  posterUrl: string | null
  backdropUrl: string | null
  imdbId: string | null
  tmdbId: string | null
  tvdbId: string | null
  rank: number
  finalScore: number | null
}

interface EpisodeInfo {
  episodeId: string
  providerItemId: string
  seasonNumber: number
  episodeNumber: number
  title: string
  overview: string | null
  premiereDate: string | null
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
 * Generate NFO content for a TV series
 */
function generateSeriesNfoContent(series: RecommendedSeries): string {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<tvshow>',
    `  <title>${escapeXml(series.title)}</title>`,
  ]

  if (series.originalTitle) {
    lines.push(`  <originaltitle>${escapeXml(series.originalTitle)}</originaltitle>`)
  }

  lines.push(`  <sorttitle>${escapeXml(series.title)}</sorttitle>`)

  if (series.year) {
    lines.push(`  <year>${series.year}</year>`)
  }

  if (series.overview) {
    lines.push(`  <plot>${escapeXml(series.overview)}</plot>`)
  }

  if (series.genres) {
    for (const genre of series.genres) {
      lines.push(`  <genre>${escapeXml(genre)}</genre>`)
    }
  }

  if (series.contentRating) {
    lines.push(`  <mpaa>${escapeXml(series.contentRating)}</mpaa>`)
  }

  if (series.network) {
    lines.push(`  <studio>${escapeXml(series.network)}</studio>`)
  }

  if (series.status) {
    lines.push(`  <status>${escapeXml(series.status)}</status>`)
  }

  // External IDs
  if (series.imdbId) {
    lines.push(`  <uniqueid type="imdb">${escapeXml(series.imdbId)}</uniqueid>`)
  }
  if (series.tmdbId) {
    lines.push(`  <uniqueid type="tmdb">${escapeXml(series.tmdbId)}</uniqueid>`)
  }
  if (series.tvdbId) {
    lines.push(`  <uniqueid type="tvdb" default="true">${escapeXml(series.tvdbId)}</uniqueid>`)
  }

  lines.push('</tvshow>')

  return lines.join('\n')
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
    const dateStr = episode.premiereDate.split('T')[0]
    lines.push(`  <aired>${dateStr}</aired>`)
  }

  if (episode.runtimeMinutes) {
    lines.push(`  <runtime>${episode.runtimeMinutes}</runtime>`)
  }

  lines.push('</episodedetails>')

  return lines.join('\n')
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Write STRM files for a user's series recommendations
 */
export async function writeSeriesStrmFilesForUser(
  userId: string,
  providerUserId: string,
  _displayName: string
): Promise<{ written: number; deleted: number; localPath: string; embyPath: string }> {
  const config = getConfig()
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY || ''
  const startTime = Date.now()

  // Build paths for series library
  const localPath = path.join(config.strmRoot, 'aperture-tv', providerUserId)
  const embyPath = path.join(
    config.libraryPathPrefix.replace('/aperture', '/aperture-tv'),
    providerUserId
  )

  logger.info({ userId, localPath, embyPath }, '📺 Starting series STRM file generation')

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
    return { written: 0, deleted: 0, localPath, embyPath }
  }

  // Get selected series from the run
  const recommendations = await query<{
    series_id: string
    provider_item_id: string
    title: string
    original_title: string | null
    year: number | null
    overview: string | null
    genres: string[] | null
    content_rating: string | null
    network: string | null
    status: string | null
    poster_url: string | null
    backdrop_url: string | null
    imdb_id: string | null
    tmdb_id: string | null
    tvdb_id: string | null
    rank: number
    final_score: string | null
  }>(
    `SELECT rc.series_id, s.provider_item_id, s.title, s.original_title,
            s.year, s.overview, s.genres, s.content_rating, s.network, s.status,
            s.poster_url, s.backdrop_url, s.imdb_id, s.tmdb_id, s.tvdb_id,
            rc.selected_rank as rank, rc.final_score
     FROM recommendation_candidates rc
     JOIN series s ON s.id = rc.series_id
     WHERE rc.run_id = $1 AND rc.is_selected = true
     ORDER BY rc.selected_rank ASC`,
    [latestRun.id]
  )

  const totalSeries = recommendations.rows.length
  logger.info({ count: totalSeries }, '📺 Found series recommendations')

  const expectedFolders = new Set<string>()
  let filesWritten = 0

  // Process each series
  for (const rec of recommendations.rows) {
    const series: RecommendedSeries = {
      seriesId: rec.series_id,
      providerItemId: rec.provider_item_id,
      title: rec.title,
      originalTitle: rec.original_title,
      year: rec.year,
      overview: rec.overview,
      genres: rec.genres,
      contentRating: rec.content_rating,
      network: rec.network,
      status: rec.status,
      posterUrl: rec.poster_url,
      backdropUrl: rec.backdrop_url,
      imdbId: rec.imdb_id,
      tmdbId: rec.tmdb_id,
      tvdbId: rec.tvdb_id,
      rank: rec.rank,
      finalScore: rec.final_score ? parseFloat(rec.final_score) : null,
    }

    // Create series folder
    const seriesFolderName = series.year
      ? `${sanitizeForFilename(series.title)} (${series.year})`
      : sanitizeForFilename(series.title)
    const seriesFolderPath = path.join(localPath, seriesFolderName)
    expectedFolders.add(seriesFolderName)

    await fs.mkdir(seriesFolderPath, { recursive: true })

    // Write series NFO (tvshow.nfo)
    const seriesNfoPath = path.join(seriesFolderPath, 'tvshow.nfo')
    await fs.writeFile(seriesNfoPath, generateSeriesNfoContent(series), 'utf-8')
    filesWritten++

    // Get episodes for this series
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
      [series.seriesId]
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

        // Write STRM file
        const strmPath = path.join(seasonFolderPath, `${episodeFilename}.strm`)
        // Try to use direct path first, fall back to streaming URL
        let strmContent: string
        if (episode.path && !config.useStreamingUrl) {
          strmContent = episode.path
        } else {
          strmContent = provider.getStreamUrl(apiKey, episode.providerItemId)
        }
        await fs.writeFile(strmPath, strmContent, 'utf-8')
        filesWritten++

        // Write episode NFO
        const nfoPath = path.join(seasonFolderPath, `${episodeFilename}.nfo`)
        await fs.writeFile(nfoPath, generateEpisodeNfoContent(episode, series.title), 'utf-8')
        filesWritten++
      }
    }

    logger.info(
      { series: series.title, seasons: seasons.size, episodes: episodes.rows.length },
      '✅ Series processed'
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
      deleted,
      durationMs: totalDuration,
      localPath,
      embyPath,
    },
    '✅ Series STRM generation complete'
  )

  return {
    written: filesWritten,
    deleted,
    localPath,
    embyPath,
  }
}
