/**
 * Upcoming Episode Data Fetcher
 * 
 * Fetches upcoming episode information for series, using:
 * 1. Emby episodes table (premiere_date for future episodes)
 * 2. TMDB API fallback (next_episode_to_air)
 */

import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { tmdbRequest } from '../tmdb/client.js'

const logger = createChildLogger('upcoming-episodes')

export interface UpcomingEpisode {
  seriesId: string
  seasonNumber: number
  episodeNumber: number
  title: string
  overview: string | null
  airDate: string // ISO date string
  source: 'emby' | 'tmdb'
}

interface TMDbNextEpisode {
  id: number
  name: string
  overview: string | null
  air_date: string | null
  season_number: number
  episode_number: number
}

interface TMDbTVDetailsWithNextEpisode {
  id: number
  name: string
  next_episode_to_air: TMDbNextEpisode | null
  last_episode_to_air: TMDbNextEpisode | null
}

/**
 * Get upcoming episode for a single series
 * First checks Emby data, falls back to TMDB
 */
export async function getUpcomingEpisodeForSeries(
  seriesId: string,
  tmdbId: string | null
): Promise<UpcomingEpisode | null> {
  const today = new Date().toISOString().split('T')[0]

  // First, try to get from Emby episodes table
  const embyEpisode = await queryOne<{
    season_number: number
    episode_number: number
    title: string
    overview: string | null
    premiere_date: string
  }>(
    `SELECT season_number, episode_number, title, overview, premiere_date
     FROM episodes
     WHERE series_id = $1 
       AND premiere_date >= $2
     ORDER BY premiere_date ASC, season_number ASC, episode_number ASC
     LIMIT 1`,
    [seriesId, today]
  )

  if (embyEpisode && embyEpisode.premiere_date) {
    return {
      seriesId,
      seasonNumber: embyEpisode.season_number,
      episodeNumber: embyEpisode.episode_number,
      title: embyEpisode.title,
      overview: embyEpisode.overview,
      airDate: embyEpisode.premiere_date,
      source: 'emby',
    }
  }

  // Fallback to TMDB if we have a tmdb_id
  if (tmdbId) {
    try {
      const tmdbData = await tmdbRequest<TMDbTVDetailsWithNextEpisode>(`/tv/${tmdbId}`)
      
      if (tmdbData?.next_episode_to_air && tmdbData.next_episode_to_air.air_date) {
        return {
          seriesId,
          seasonNumber: tmdbData.next_episode_to_air.season_number,
          episodeNumber: tmdbData.next_episode_to_air.episode_number,
          title: tmdbData.next_episode_to_air.name,
          overview: tmdbData.next_episode_to_air.overview,
          airDate: tmdbData.next_episode_to_air.air_date,
          source: 'tmdb',
        }
      }
    } catch (err) {
      logger.debug({ err, tmdbId, seriesId }, 'Failed to fetch TMDB data for upcoming episode')
    }
  }

  return null
}

/**
 * Get upcoming episodes for multiple series
 * Returns a map of seriesId -> UpcomingEpisode
 */
export async function getUpcomingEpisodes(
  seriesIds: string[]
): Promise<Map<string, UpcomingEpisode>> {
  const result = new Map<string, UpcomingEpisode>()
  
  if (seriesIds.length === 0) {
    return result
  }

  const today = new Date().toISOString().split('T')[0]

  // Batch query for Emby episodes
  const embyEpisodes = await query<{
    series_id: string
    season_number: number
    episode_number: number
    title: string
    overview: string | null
    premiere_date: string
  }>(
    `SELECT DISTINCT ON (series_id) 
            series_id, season_number, episode_number, title, overview, premiere_date
     FROM episodes
     WHERE series_id = ANY($1)
       AND premiere_date >= $2
     ORDER BY series_id, premiere_date ASC, season_number ASC, episode_number ASC`,
    [seriesIds, today]
  )

  // Add Emby results to map
  for (const ep of embyEpisodes.rows) {
    result.set(ep.series_id, {
      seriesId: ep.series_id,
      seasonNumber: ep.season_number,
      episodeNumber: ep.episode_number,
      title: ep.title,
      overview: ep.overview,
      airDate: ep.premiere_date,
      source: 'emby',
    })
  }

  // Find series without Emby data that have TMDB IDs
  const seriesNeedingTmdb = seriesIds.filter((id) => !result.has(id))
  
  if (seriesNeedingTmdb.length > 0) {
    // Get TMDB IDs for these series
    const tmdbIds = await query<{ id: string; tmdb_id: string }>(
      `SELECT id, tmdb_id FROM series 
       WHERE id = ANY($1) AND tmdb_id IS NOT NULL`,
      [seriesNeedingTmdb]
    )

    // Fetch from TMDB (with rate limiting consideration)
    for (const row of tmdbIds.rows) {
      try {
        const tmdbData = await tmdbRequest<TMDbTVDetailsWithNextEpisode>(`/tv/${row.tmdb_id}`)
        
        if (tmdbData?.next_episode_to_air && tmdbData.next_episode_to_air.air_date) {
          result.set(row.id, {
            seriesId: row.id,
            seasonNumber: tmdbData.next_episode_to_air.season_number,
            episodeNumber: tmdbData.next_episode_to_air.episode_number,
            title: tmdbData.next_episode_to_air.name,
            overview: tmdbData.next_episode_to_air.overview,
            airDate: tmdbData.next_episode_to_air.air_date,
            source: 'tmdb',
          })
        }
      } catch (err) {
        logger.debug({ err, tmdbId: row.tmdb_id, seriesId: row.id }, 'Failed to fetch TMDB data')
      }
    }
  }

  return result
}

/**
 * Format upcoming episode for display
 */
export function formatUpcomingEpisode(episode: UpcomingEpisode): string {
  const date = new Date(episode.airDate)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
  
  return `S${episode.seasonNumber}E${episode.episodeNumber} - ${episode.title} (${dateStr})`
}

