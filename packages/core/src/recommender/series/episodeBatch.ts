import { createChildLogger } from '../../lib/logger.js'
import { query } from '../../lib/db.js'
import { clampRating } from '../shared/syncHelpers.js'
import type { PreparedEpisode } from './syncTypes.js'

const logger = createChildLogger('sync-series')

export async function processEpisodeBatch(
  episodes: PreparedEpisode[],
  existingProviderIds: Set<string>,
  existingEpisodeKeys: Set<string>
): Promise<{ added: number; updated: number }> {
  // Separate into updates and inserts
  // An episode is considered "existing" if EITHER:
  // 1. Its provider_item_id is in the database, OR
  // 2. Its series+season+episode combination exists (handles ID regeneration)
  const toUpdate: PreparedEpisode[] = []
  const toInsert: PreparedEpisode[] = []

  for (const pe of episodes) {
    const episodeKey = `${pe.seriesDbId}:${pe.episode.seasonNumber}:${pe.episode.episodeNumber}`
    if (existingProviderIds.has(pe.episode.id) || existingEpisodeKeys.has(episodeKey)) {
      toUpdate.push(pe)
    } else {
      toInsert.push(pe)
    }
  }

  // Deduplicate toInsert by (series_id, season_number, episode_number) to avoid
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" error
  // This can happen when the media server has multiple versions of the same episode
  const insertMap = new Map<string, PreparedEpisode>()
  for (const pe of toInsert) {
    const key = `${pe.seriesDbId}:${pe.episode.seasonNumber}:${pe.episode.episodeNumber}`
    // Keep the last occurrence (or could keep first - doesn't matter much)
    insertMap.set(key, pe)
  }
  const deduplicatedInserts = Array.from(insertMap.values())
  // Count how many were dropped due to deduplication (multiple versions of same episode)
  const deduplicatedCount = toInsert.length - deduplicatedInserts.length

  let added = 0
  // Start with deduplicated count as "updated" since they're alternate versions of existing episodes
  let updated = deduplicatedCount

  // Bulk UPDATE existing episodes
  // Note: Array columns (directors, writers) are passed as JSONB
  // and converted back to text[] in SQL to avoid unnest() flattening 2D arrays incorrectly
  if (toUpdate.length > 0) {
    try {
      const result = await query(
        `UPDATE episodes SET
          series_id = data.series_id,
          season_number = data.season_number,
          episode_number = data.episode_number,
          title = data.title,
          overview = data.overview,
          premiere_date = data.premiere_date,
          year = data.year,
          runtime_minutes = data.runtime_minutes,
          community_rating = data.community_rating,
          directors = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.directors)), '{}'),
          writers = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.writers)), '{}'),
          guest_stars = data.guest_stars,
          path = data.path,
          media_sources = data.media_sources,
          poster_url = data.poster_url,
          updated_at = NOW()
        FROM (
          SELECT * FROM unnest(
            $1::text[], $2::uuid[], $3::int[], $4::int[], $5::text[],
            $6::text[], $7::date[], $8::int[], $9::int[], $10::real[],
            $11::jsonb[], $12::jsonb[], $13::jsonb[], $14::text[], $15::jsonb[], $16::text[]
          ) AS t(
            provider_item_id, series_id, season_number, episode_number, title,
            overview, premiere_date, year, runtime_minutes, community_rating,
            directors, writers, guest_stars, path, media_sources, poster_url
          )
        ) AS data
        WHERE episodes.provider_item_id = data.provider_item_id`,
        [
          toUpdate.map((pe) => pe.episode.id),
          toUpdate.map((pe) => pe.seriesDbId),
          toUpdate.map((pe) => pe.episode.seasonNumber),
          toUpdate.map((pe) => pe.episode.episodeNumber),
          toUpdate.map((pe) => pe.episode.name),
          toUpdate.map((pe) => pe.episode.overview || null),
          toUpdate.map((pe) =>
            pe.episode.premiereDate ? pe.episode.premiereDate.split('T')[0] : null
          ),
          toUpdate.map((pe) => pe.episode.year || null),
          toUpdate.map((pe) => pe.runtimeMinutes),
          toUpdate.map((pe) => clampRating(pe.episode.communityRating)),
          toUpdate.map((pe) => JSON.stringify(pe.episode.directors || [])),
          toUpdate.map((pe) => JSON.stringify(pe.episode.writers || [])),
          toUpdate.map((pe) => JSON.stringify(pe.episode.guestStars || [])),
          toUpdate.map((pe) => pe.episode.path || null),
          toUpdate.map((pe) => JSON.stringify(pe.episode.mediaSources || [])),
          toUpdate.map((pe) => pe.posterUrl),
        ]
      )
      updated = result.rowCount || toUpdate.length
    } catch (err) {
      logger.error({ err, count: toUpdate.length }, 'Failed to bulk update episodes')
    }
  }

  // Bulk INSERT new episodes with UPSERT
  // Note: Array columns (directors, writers) are passed as JSONB
  // and converted back to text[] in SQL to avoid unnest() flattening 2D arrays incorrectly
  // Uses RETURNING with xmax to distinguish true inserts (xmax=0) from updates (xmax>0)
  if (deduplicatedInserts.length > 0) {
    try {
      const result = await query<{ xmax: string }>(
        `INSERT INTO episodes (
          provider_item_id, series_id, season_number, episode_number, title,
          overview, premiere_date, year, runtime_minutes, community_rating,
          directors, writers, guest_stars, path, media_sources, poster_url
        )
        SELECT
          t.provider_item_id, t.series_id, t.season_number, t.episode_number, t.title,
          t.overview, t.premiere_date, t.year, t.runtime_minutes, t.community_rating,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.directors)), '{}'),
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.writers)), '{}'),
          t.guest_stars, t.path, t.media_sources, t.poster_url
        FROM unnest(
          $1::text[], $2::uuid[], $3::int[], $4::int[], $5::text[],
          $6::text[], $7::date[], $8::int[], $9::int[], $10::real[],
          $11::jsonb[], $12::jsonb[], $13::jsonb[], $14::text[], $15::jsonb[], $16::text[]
        ) AS t(
          provider_item_id, series_id, season_number, episode_number, title,
          overview, premiere_date, year, runtime_minutes, community_rating,
          directors, writers, guest_stars, path, media_sources, poster_url
        )
        ON CONFLICT (series_id, season_number, episode_number) DO UPDATE SET
          provider_item_id = EXCLUDED.provider_item_id,
          title = EXCLUDED.title,
          overview = EXCLUDED.overview,
          premiere_date = EXCLUDED.premiere_date,
          year = EXCLUDED.year,
          runtime_minutes = EXCLUDED.runtime_minutes,
          community_rating = EXCLUDED.community_rating,
          directors = EXCLUDED.directors,
          writers = EXCLUDED.writers,
          guest_stars = EXCLUDED.guest_stars,
          path = EXCLUDED.path,
          media_sources = EXCLUDED.media_sources,
          poster_url = EXCLUDED.poster_url,
          updated_at = NOW()
        RETURNING xmax`,
        [
          deduplicatedInserts.map((pe) => pe.episode.id),
          deduplicatedInserts.map((pe) => pe.seriesDbId),
          deduplicatedInserts.map((pe) => pe.episode.seasonNumber),
          deduplicatedInserts.map((pe) => pe.episode.episodeNumber),
          deduplicatedInserts.map((pe) => pe.episode.name),
          deduplicatedInserts.map((pe) => pe.episode.overview || null),
          deduplicatedInserts.map((pe) =>
            pe.episode.premiereDate ? pe.episode.premiereDate.split('T')[0] : null
          ),
          deduplicatedInserts.map((pe) => pe.episode.year || null),
          deduplicatedInserts.map((pe) => pe.runtimeMinutes),
          deduplicatedInserts.map((pe) => clampRating(pe.episode.communityRating)),
          deduplicatedInserts.map((pe) => JSON.stringify(pe.episode.directors || [])),
          deduplicatedInserts.map((pe) => JSON.stringify(pe.episode.writers || [])),
          deduplicatedInserts.map((pe) => JSON.stringify(pe.episode.guestStars || [])),
          deduplicatedInserts.map((pe) => pe.episode.path || null),
          deduplicatedInserts.map((pe) => JSON.stringify(pe.episode.mediaSources || [])),
          deduplicatedInserts.map((pe) => pe.posterUrl),
        ]
      )
      // xmax = 0 means true insert, xmax > 0 means it was an update due to conflict
      // PostgreSQL returns xmax as a string, convert to number for comparison
      const trueInserts = result.rows.filter(r => Number(r.xmax) === 0).length
      const upsertUpdates = result.rows.length - trueInserts
      added = trueInserts
      updated += upsertUpdates  // Add upsert updates to the update count
      // Track all original provider IDs and episode keys as processed
      for (const pe of toInsert) {
        existingProviderIds.add(pe.episode.id)
        existingEpisodeKeys.add(`${pe.seriesDbId}:${pe.episode.seasonNumber}:${pe.episode.episodeNumber}`)
      }
    } catch (err) {
      logger.error({ err, count: deduplicatedInserts.length }, 'Failed to bulk insert episodes')
    }
  }

  return { added, updated }
}
