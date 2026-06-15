import { createChildLogger } from '../../lib/logger.js'
import { query } from '../../lib/db.js'
import { clampRating } from '../shared/syncHelpers.js'
import type { PreparedSeries } from './syncTypes.js'

const logger = createChildLogger('sync-series')

export async function processSeriesBatch(
  seriesList: PreparedSeries[],
  existingProviderIds: Set<string>,
  existingTitleYears: Map<string, string>,
  _jobId: string
): Promise<{ added: number; updated: number }> {
  // Separate into updates and inserts
  const toUpdate: PreparedSeries[] = []
  const toInsert: PreparedSeries[] = []
  // Track series that need metadata update by title+year (different provider_item_id)
  const toUpdateByTitleYear: PreparedSeries[] = []

  for (const ps of seriesList) {
    if (existingProviderIds.has(ps.series.id)) {
      toUpdate.push(ps)
    } else {
      // Check for duplicate by title + year
      const key = `${ps.series.name?.toLowerCase()}|${ps.series.year}`
      if (existingTitleYears.has(key)) {
        // Series exists by title+year but different provider_item_id - update it
        // This ensures metadata (posters, etc.) gets refreshed even if Emby ID changed
        toUpdateByTitleYear.push(ps)
      } else {
        toInsert.push(ps)
        existingTitleYears.set(key, ps.series.id)
      }
    }
  }

  let added = 0
  let updated = 0

  // Bulk UPDATE existing series
  // Note: Array columns (genres, air_days, directors, writers, tags, production_countries) are passed as JSONB
  // and converted back to text[] in SQL to avoid unnest() flattening 2D arrays incorrectly
  if (toUpdate.length > 0) {
    try {
      const result = await query(
        `UPDATE series SET
          title = data.title,
          original_title = data.original_title,
          sort_title = data.sort_title,
          year = data.year,
          end_year = data.end_year,
          genres = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.genres)), '{}'),
          overview = data.overview,
          tagline = data.tagline,
          community_rating = data.community_rating,
          critic_rating = data.critic_rating,
          content_rating = data.content_rating,
          status = data.status,
          total_seasons = data.total_seasons,
          total_episodes = data.total_episodes,
          air_days = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.air_days)), '{}'),
          network = data.network,
          studios = data.studios,
          directors = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.directors)), '{}'),
          writers = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.writers)), '{}'),
          actors = data.actors,
          imdb_id = data.imdb_id,
          tmdb_id = data.tmdb_id,
          tvdb_id = data.tvdb_id,
          tags = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.tags)), '{}'),
          production_countries = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.production_countries)), '{}'),
          awards = data.awards,
          poster_url = data.poster_url,
          backdrop_url = data.backdrop_url,
          provider_library_id = data.provider_library_id,
          updated_at = NOW()
        FROM (
          SELECT * FROM unnest(
            $1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::int[],
            $7::jsonb[], $8::text[], $9::text[], $10::real[], $11::real[],
            $12::text[], $13::text[], $14::int[], $15::int[], $16::jsonb[],
            $17::text[], $18::jsonb[], $19::jsonb[], $20::jsonb[], $21::jsonb[],
            $22::text[], $23::text[], $24::text[], $25::jsonb[], $26::jsonb[],
            $27::text[], $28::text[], $29::text[], $30::text[]
          ) AS t(
            provider_item_id, title, original_title, sort_title, year, end_year,
            genres, overview, tagline, community_rating, critic_rating, content_rating,
            status, total_seasons, total_episodes, air_days, network, studios,
            directors, writers, actors, imdb_id, tmdb_id, tvdb_id, tags,
            production_countries, awards, poster_url, backdrop_url, provider_library_id
          )
        ) AS data
        WHERE series.provider_item_id = data.provider_item_id`,
        [
          toUpdate.map((ps) => ps.series.id),
          toUpdate.map((ps) => ps.series.name),
          toUpdate.map((ps) => ps.series.originalTitle || null),
          toUpdate.map((ps) => ps.series.sortName || null),
          toUpdate.map((ps) => ps.series.year || null),
          toUpdate.map((ps) => ps.series.endYear || null),
          toUpdate.map((ps) => JSON.stringify(ps.series.genres || [])),
          toUpdate.map((ps) => ps.series.overview || null),
          toUpdate.map((ps) => ps.series.tagline || null),
          toUpdate.map((ps) => clampRating(ps.series.communityRating)),
          toUpdate.map((ps) => clampRating(ps.series.criticRating)),
          toUpdate.map((ps) => ps.series.contentRating || null),
          toUpdate.map((ps) => ps.series.status || null),
          toUpdate.map((ps) => ps.series.totalSeasons || null),
          toUpdate.map((ps) => ps.series.totalEpisodes || null),
          toUpdate.map((ps) => JSON.stringify(ps.series.airDays || [])),
          toUpdate.map((ps) => ps.series.network || null),
          toUpdate.map((ps) => JSON.stringify(ps.series.studios || [])),
          toUpdate.map((ps) => JSON.stringify(ps.series.directors || [])),
          toUpdate.map((ps) => JSON.stringify(ps.series.writers || [])),
          toUpdate.map((ps) => JSON.stringify(ps.series.actors || [])),
          toUpdate.map((ps) => ps.series.imdbId || null),
          toUpdate.map((ps) => ps.series.tmdbId || null),
          toUpdate.map((ps) => ps.series.tvdbId || null),
          toUpdate.map((ps) => JSON.stringify(ps.series.tags || [])),
          toUpdate.map((ps) => JSON.stringify(ps.series.productionCountries || [])),
          toUpdate.map((ps) => ps.series.awards || null),
          toUpdate.map((ps) => ps.posterUrl),
          toUpdate.map((ps) => ps.backdropUrl),
          toUpdate.map((ps) => ps.libraryId),
        ]
      )
      updated = result.rowCount || toUpdate.length
    } catch (err) {
      logger.error({ err, count: toUpdate.length }, 'Failed to bulk update series')
    }
  }

  // Bulk UPDATE series matched by title+year (different provider_item_id)
  // This ensures metadata like posters gets refreshed even when Emby/Jellyfin item IDs change
  if (toUpdateByTitleYear.length > 0) {
    try {
      const result = await query(
        `UPDATE series SET
          provider_item_id = data.provider_item_id,
          original_title = data.original_title,
          sort_title = data.sort_title,
          end_year = data.end_year,
          genres = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.genres)), '{}'),
          overview = data.overview,
          tagline = data.tagline,
          community_rating = data.community_rating,
          critic_rating = data.critic_rating,
          content_rating = data.content_rating,
          status = data.status,
          total_seasons = data.total_seasons,
          total_episodes = data.total_episodes,
          air_days = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.air_days)), '{}'),
          network = data.network,
          studios = data.studios,
          directors = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.directors)), '{}'),
          writers = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.writers)), '{}'),
          actors = data.actors,
          imdb_id = data.imdb_id,
          tmdb_id = data.tmdb_id,
          tvdb_id = data.tvdb_id,
          tags = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.tags)), '{}'),
          production_countries = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.production_countries)), '{}'),
          awards = data.awards,
          poster_url = data.poster_url,
          backdrop_url = data.backdrop_url,
          provider_library_id = data.provider_library_id,
          updated_at = NOW()
        FROM (
          SELECT * FROM unnest(
            $1::text[], $2::text[], $3::int[], $4::text[], $5::text[], $6::int[],
            $7::jsonb[], $8::text[], $9::text[], $10::real[], $11::real[],
            $12::text[], $13::text[], $14::int[], $15::int[], $16::jsonb[],
            $17::text[], $18::jsonb[], $19::jsonb[], $20::jsonb[], $21::jsonb[],
            $22::text[], $23::text[], $24::text[], $25::jsonb[], $26::jsonb[],
            $27::text[], $28::text[], $29::text[], $30::text[]
          ) AS t(
            provider_item_id, title_lower, year, original_title, sort_title, end_year,
            genres, overview, tagline, community_rating, critic_rating, content_rating,
            status, total_seasons, total_episodes, air_days, network, studios,
            directors, writers, actors, imdb_id, tmdb_id, tvdb_id, tags,
            production_countries, awards, poster_url, backdrop_url, provider_library_id
          )
        ) AS data
        WHERE LOWER(series.title) = data.title_lower AND series.year = data.year`,
        [
          toUpdateByTitleYear.map((ps) => ps.series.id),
          toUpdateByTitleYear.map((ps) => ps.series.name?.toLowerCase()),
          toUpdateByTitleYear.map((ps) => ps.series.year || null),
          toUpdateByTitleYear.map((ps) => ps.series.originalTitle || null),
          toUpdateByTitleYear.map((ps) => ps.series.sortName || null),
          toUpdateByTitleYear.map((ps) => ps.series.endYear || null),
          toUpdateByTitleYear.map((ps) => JSON.stringify(ps.series.genres || [])),
          toUpdateByTitleYear.map((ps) => ps.series.overview || null),
          toUpdateByTitleYear.map((ps) => ps.series.tagline || null),
          toUpdateByTitleYear.map((ps) => clampRating(ps.series.communityRating)),
          toUpdateByTitleYear.map((ps) => clampRating(ps.series.criticRating)),
          toUpdateByTitleYear.map((ps) => ps.series.contentRating || null),
          toUpdateByTitleYear.map((ps) => ps.series.status || null),
          toUpdateByTitleYear.map((ps) => ps.series.totalSeasons || null),
          toUpdateByTitleYear.map((ps) => ps.series.totalEpisodes || null),
          toUpdateByTitleYear.map((ps) => JSON.stringify(ps.series.airDays || [])),
          toUpdateByTitleYear.map((ps) => ps.series.network || null),
          toUpdateByTitleYear.map((ps) => JSON.stringify(ps.series.studios || [])),
          toUpdateByTitleYear.map((ps) => JSON.stringify(ps.series.directors || [])),
          toUpdateByTitleYear.map((ps) => JSON.stringify(ps.series.writers || [])),
          toUpdateByTitleYear.map((ps) => JSON.stringify(ps.series.actors || [])),
          toUpdateByTitleYear.map((ps) => ps.series.imdbId || null),
          toUpdateByTitleYear.map((ps) => ps.series.tmdbId || null),
          toUpdateByTitleYear.map((ps) => ps.series.tvdbId || null),
          toUpdateByTitleYear.map((ps) => JSON.stringify(ps.series.tags || [])),
          toUpdateByTitleYear.map((ps) => JSON.stringify(ps.series.productionCountries || [])),
          toUpdateByTitleYear.map((ps) => ps.series.awards || null),
          toUpdateByTitleYear.map((ps) => ps.posterUrl),
          toUpdateByTitleYear.map((ps) => ps.backdropUrl),
          toUpdateByTitleYear.map((ps) => ps.libraryId),
        ]
      )
      updated += result.rowCount || 0
      // Also update provider IDs set so we don't process these again
      for (const ps of toUpdateByTitleYear) {
        existingProviderIds.add(ps.series.id)
      }
      if (toUpdateByTitleYear.length > 0) {
        logger.info(
          { count: result.rowCount, total: toUpdateByTitleYear.length },
          'Updated series by title+year match (metadata refresh)'
        )
      }
    } catch (err) {
      logger.error({ err, count: toUpdateByTitleYear.length }, 'Failed to bulk update series by title+year')
    }
  }

  // Bulk INSERT new series
  // Note: Array columns (genres, air_days, directors, writers, tags, production_countries) are passed as JSONB
  // and converted back to text[] in SQL to avoid unnest() flattening 2D arrays incorrectly
  if (toInsert.length > 0) {
    try {
      const result = await query(
        `INSERT INTO series (
          provider_item_id, title, original_title, sort_title, year, end_year,
          genres, overview, tagline, community_rating, critic_rating, content_rating,
          status, total_seasons, total_episodes, air_days, network, studios,
          directors, writers, actors, imdb_id, tmdb_id, tvdb_id, tags,
          production_countries, awards, poster_url, backdrop_url, provider_library_id
        )
        SELECT
          t.provider_item_id, t.title, t.original_title, t.sort_title, t.year, t.end_year,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.genres)), '{}'),
          t.overview, t.tagline, t.community_rating, t.critic_rating, t.content_rating,
          t.status, t.total_seasons, t.total_episodes,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.air_days)), '{}'),
          t.network, t.studios,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.directors)), '{}'),
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.writers)), '{}'),
          t.actors, t.imdb_id, t.tmdb_id, t.tvdb_id,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.tags)), '{}'),
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.production_countries)), '{}'),
          t.awards, t.poster_url, t.backdrop_url, t.provider_library_id
        FROM unnest(
          $1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::int[],
          $7::jsonb[], $8::text[], $9::text[], $10::real[], $11::real[],
          $12::text[], $13::text[], $14::int[], $15::int[], $16::jsonb[],
          $17::text[], $18::jsonb[], $19::jsonb[], $20::jsonb[], $21::jsonb[],
          $22::text[], $23::text[], $24::text[], $25::jsonb[], $26::jsonb[],
          $27::text[], $28::text[], $29::text[], $30::text[]
        ) AS t(
          provider_item_id, title, original_title, sort_title, year, end_year,
          genres, overview, tagline, community_rating, critic_rating, content_rating,
          status, total_seasons, total_episodes, air_days, network, studios,
          directors, writers, actors, imdb_id, tmdb_id, tvdb_id, tags,
          production_countries, awards, poster_url, backdrop_url, provider_library_id
        )
        ON CONFLICT (provider_item_id) DO NOTHING`,
        [
          toInsert.map((ps) => ps.series.id),
          toInsert.map((ps) => ps.series.name),
          toInsert.map((ps) => ps.series.originalTitle || null),
          toInsert.map((ps) => ps.series.sortName || null),
          toInsert.map((ps) => ps.series.year || null),
          toInsert.map((ps) => ps.series.endYear || null),
          toInsert.map((ps) => JSON.stringify(ps.series.genres || [])),
          toInsert.map((ps) => ps.series.overview || null),
          toInsert.map((ps) => ps.series.tagline || null),
          toInsert.map((ps) => clampRating(ps.series.communityRating)),
          toInsert.map((ps) => clampRating(ps.series.criticRating)),
          toInsert.map((ps) => ps.series.contentRating || null),
          toInsert.map((ps) => ps.series.status || null),
          toInsert.map((ps) => ps.series.totalSeasons || null),
          toInsert.map((ps) => ps.series.totalEpisodes || null),
          toInsert.map((ps) => JSON.stringify(ps.series.airDays || [])),
          toInsert.map((ps) => ps.series.network || null),
          toInsert.map((ps) => JSON.stringify(ps.series.studios || [])),
          toInsert.map((ps) => JSON.stringify(ps.series.directors || [])),
          toInsert.map((ps) => JSON.stringify(ps.series.writers || [])),
          toInsert.map((ps) => JSON.stringify(ps.series.actors || [])),
          toInsert.map((ps) => ps.series.imdbId || null),
          toInsert.map((ps) => ps.series.tmdbId || null),
          toInsert.map((ps) => ps.series.tvdbId || null),
          toInsert.map((ps) => JSON.stringify(ps.series.tags || [])),
          toInsert.map((ps) => JSON.stringify(ps.series.productionCountries || [])),
          toInsert.map((ps) => ps.series.awards || null),
          toInsert.map((ps) => ps.posterUrl),
          toInsert.map((ps) => ps.backdropUrl),
          toInsert.map((ps) => ps.libraryId),
        ]
      )
      added = result.rowCount || toInsert.length
      for (const ps of toInsert) {
        existingProviderIds.add(ps.series.id)
      }
    } catch (err) {
      logger.error({ err, count: toInsert.length }, 'Failed to bulk insert series')
    }
  }

  return { added, updated }
}
