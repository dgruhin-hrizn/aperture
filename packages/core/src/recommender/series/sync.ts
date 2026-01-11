import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getEnabledTvLibraryIds } from '../../lib/libraryConfig.js'
import { getMediaServerProvider } from '../../media/index.js'
import { getMediaServerApiKey, getMediaServerConfig } from '../../settings/systemSettings.js'
import {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
} from '../../jobs/progress.js'
import { randomUUID } from 'crypto'
import type { Series, Episode } from '../../media/types.js'
import type { MediaServerProvider } from '../../media/MediaServerProvider.js'

const logger = createChildLogger('sync-series')

// ============================================================================
// PERFORMANCE TUNING CONSTANTS
// ============================================================================
// These values are optimized for local Emby/Jellyfin servers which have no rate limits.

/** Number of series to fetch per API request */
const SERIES_PAGE_SIZE = 500

/** Number of episodes to fetch per API request */
const EPISODE_PAGE_SIZE = 1000

/** Number of concurrent API requests for fetching pages */
const PARALLEL_FETCHES = 4

/** Number of items to batch insert/update in a single DB operation */
const DB_BATCH_SIZE = 100

export interface SyncSeriesResult {
  seriesAdded: number
  seriesUpdated: number
  episodesAdded: number
  episodesUpdated: number
  totalSeries: number
  totalEpisodes: number
  jobId: string
}

/**
 * Prepared series data ready for database insertion
 */
interface PreparedSeries {
  series: Series
  posterUrl: string | null
  backdropUrl: string | null
  libraryId: string | null
}

/**
 * Prepared episode data ready for database insertion
 */
interface PreparedEpisode {
  episode: Episode
  seriesDbId: string
  posterUrl: string | null
  runtimeMinutes: number | null
}

/**
 * Fetch multiple pages in parallel
 */
async function fetchParallel<T>(
  fetchFn: (startIndex: number, limit: number) => Promise<{ items: T[]; totalRecordCount: number }>,
  totalCount: number,
  pageSize: number,
  parallelFetches: number,
  onProgress?: (fetched: number) => void
): Promise<T[]> {
  const allItems: T[] = []
  const totalPages = Math.ceil(totalCount / pageSize)
  let currentPage = 0

  while (currentPage < totalPages) {
    const pagesToFetch = Math.min(parallelFetches, totalPages - currentPage)
    const fetchPromises: Promise<T[]>[] = []

    for (let i = 0; i < pagesToFetch; i++) {
      const startIndex = (currentPage + i) * pageSize
      fetchPromises.push(fetchFn(startIndex, pageSize).then((result) => result.items))
    }

    const results = await Promise.all(fetchPromises)
    for (const items of results) {
      allItems.push(...items)
    }

    currentPage += pagesToFetch
    onProgress?.(allItems.length)
  }

  return allItems
}

/**
 * Process series batch for database insertion
 */
/**
 * Process series batch using bulk SQL operations
 * 
 * OPTIMIZED: Uses PostgreSQL unnest() for bulk INSERT/UPDATE
 */
async function processSeriesBatch(
  seriesList: PreparedSeries[],
  existingProviderIds: Set<string>,
  _jobId: string
): Promise<{ added: number; updated: number }> {
  // Separate into updates and inserts
  const toUpdate: PreparedSeries[] = []
  const toInsert: PreparedSeries[] = []

  for (const ps of seriesList) {
    if (existingProviderIds.has(ps.series.id)) {
      toUpdate.push(ps)
    } else {
      toInsert.push(ps)
    }
  }

  let added = 0
  let updated = 0

  // Bulk UPDATE existing series
  if (toUpdate.length > 0) {
    try {
      const result = await query(
        `UPDATE series SET
          title = data.title,
          original_title = data.original_title,
          sort_title = data.sort_title,
          year = data.year,
          end_year = data.end_year,
          genres = data.genres,
          overview = data.overview,
          tagline = data.tagline,
          community_rating = data.community_rating,
          critic_rating = data.critic_rating,
          content_rating = data.content_rating,
          status = data.status,
          total_seasons = data.total_seasons,
          total_episodes = data.total_episodes,
          air_days = data.air_days,
          network = data.network,
          studios = data.studios,
          directors = data.directors,
          writers = data.writers,
          actors = data.actors,
          imdb_id = data.imdb_id,
          tmdb_id = data.tmdb_id,
          tvdb_id = data.tvdb_id,
          tags = data.tags,
          production_countries = data.production_countries,
          awards = data.awards,
          poster_url = data.poster_url,
          backdrop_url = data.backdrop_url,
          provider_library_id = data.provider_library_id,
          updated_at = NOW()
        FROM (
          SELECT * FROM unnest(
            $1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::int[],
            $7::text[][], $8::text[], $9::text[], $10::real[], $11::real[],
            $12::text[], $13::text[], $14::int[], $15::int[], $16::text[][],
            $17::text[], $18::jsonb[], $19::text[][], $20::text[][], $21::jsonb[],
            $22::text[], $23::text[], $24::text[], $25::text[][], $26::text[][],
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
          toUpdate.map((ps) => ps.series.genres || []),
          toUpdate.map((ps) => ps.series.overview || null),
          toUpdate.map((ps) => ps.series.tagline || null),
          toUpdate.map((ps) => ps.series.communityRating || null),
          toUpdate.map((ps) => ps.series.criticRating || null),
          toUpdate.map((ps) => ps.series.contentRating || null),
          toUpdate.map((ps) => ps.series.status || null),
          toUpdate.map((ps) => ps.series.totalSeasons || null),
          toUpdate.map((ps) => ps.series.totalEpisodes || null),
          toUpdate.map((ps) => ps.series.airDays || []),
          toUpdate.map((ps) => ps.series.network || null),
          toUpdate.map((ps) => JSON.stringify(ps.series.studios || [])),
          toUpdate.map((ps) => ps.series.directors || []),
          toUpdate.map((ps) => ps.series.writers || []),
          toUpdate.map((ps) => JSON.stringify(ps.series.actors || [])),
          toUpdate.map((ps) => ps.series.imdbId || null),
          toUpdate.map((ps) => ps.series.tmdbId || null),
          toUpdate.map((ps) => ps.series.tvdbId || null),
          toUpdate.map((ps) => ps.series.tags || []),
          toUpdate.map((ps) => ps.series.productionCountries || []),
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

  // Bulk INSERT new series
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
        SELECT * FROM unnest(
          $1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::int[],
          $7::text[][], $8::text[], $9::text[], $10::real[], $11::real[],
          $12::text[], $13::text[], $14::int[], $15::int[], $16::text[][],
          $17::text[], $18::jsonb[], $19::text[][], $20::text[][], $21::jsonb[],
          $22::text[], $23::text[], $24::text[], $25::text[][], $26::text[][],
          $27::text[], $28::text[], $29::text[], $30::text[]
        )
        ON CONFLICT (provider_item_id) DO NOTHING`,
        [
          toInsert.map((ps) => ps.series.id),
          toInsert.map((ps) => ps.series.name),
          toInsert.map((ps) => ps.series.originalTitle || null),
          toInsert.map((ps) => ps.series.sortName || null),
          toInsert.map((ps) => ps.series.year || null),
          toInsert.map((ps) => ps.series.endYear || null),
          toInsert.map((ps) => ps.series.genres || []),
          toInsert.map((ps) => ps.series.overview || null),
          toInsert.map((ps) => ps.series.tagline || null),
          toInsert.map((ps) => ps.series.communityRating || null),
          toInsert.map((ps) => ps.series.criticRating || null),
          toInsert.map((ps) => ps.series.contentRating || null),
          toInsert.map((ps) => ps.series.status || null),
          toInsert.map((ps) => ps.series.totalSeasons || null),
          toInsert.map((ps) => ps.series.totalEpisodes || null),
          toInsert.map((ps) => ps.series.airDays || []),
          toInsert.map((ps) => ps.series.network || null),
          toInsert.map((ps) => JSON.stringify(ps.series.studios || [])),
          toInsert.map((ps) => ps.series.directors || []),
          toInsert.map((ps) => ps.series.writers || []),
          toInsert.map((ps) => JSON.stringify(ps.series.actors || [])),
          toInsert.map((ps) => ps.series.imdbId || null),
          toInsert.map((ps) => ps.series.tmdbId || null),
          toInsert.map((ps) => ps.series.tvdbId || null),
          toInsert.map((ps) => ps.series.tags || []),
          toInsert.map((ps) => ps.series.productionCountries || []),
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

/**
 * Process episode batch using bulk SQL operations
 * 
 * OPTIMIZED: Uses PostgreSQL unnest() for bulk INSERT/UPDATE
 */
async function processEpisodeBatch(
  episodes: PreparedEpisode[],
  existingProviderIds: Set<string>
): Promise<{ added: number; updated: number }> {
  // Separate into updates and inserts
  const toUpdate: PreparedEpisode[] = []
  const toInsert: PreparedEpisode[] = []

  for (const pe of episodes) {
    if (existingProviderIds.has(pe.episode.id)) {
      toUpdate.push(pe)
    } else {
      toInsert.push(pe)
    }
  }

  let added = 0
  let updated = 0

  // Bulk UPDATE existing episodes
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
          directors = data.directors,
          writers = data.writers,
          guest_stars = data.guest_stars,
          path = data.path,
          media_sources = data.media_sources,
          poster_url = data.poster_url,
          updated_at = NOW()
        FROM (
          SELECT * FROM unnest(
            $1::text[], $2::uuid[], $3::int[], $4::int[], $5::text[],
            $6::text[], $7::date[], $8::int[], $9::int[], $10::real[],
            $11::text[][], $12::text[][], $13::jsonb[], $14::text[], $15::jsonb[], $16::text[]
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
          toUpdate.map((pe) => pe.episode.communityRating || null),
          toUpdate.map((pe) => pe.episode.directors || []),
          toUpdate.map((pe) => pe.episode.writers || []),
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
  if (toInsert.length > 0) {
    try {
      const result = await query(
        `INSERT INTO episodes (
          provider_item_id, series_id, season_number, episode_number, title,
          overview, premiere_date, year, runtime_minutes, community_rating,
          directors, writers, guest_stars, path, media_sources, poster_url
        )
        SELECT * FROM unnest(
          $1::text[], $2::uuid[], $3::int[], $4::int[], $5::text[],
          $6::text[], $7::date[], $8::int[], $9::int[], $10::real[],
          $11::text[][], $12::text[][], $13::jsonb[], $14::text[], $15::jsonb[], $16::text[]
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
          updated_at = NOW()`,
        [
          toInsert.map((pe) => pe.episode.id),
          toInsert.map((pe) => pe.seriesDbId),
          toInsert.map((pe) => pe.episode.seasonNumber),
          toInsert.map((pe) => pe.episode.episodeNumber),
          toInsert.map((pe) => pe.episode.name),
          toInsert.map((pe) => pe.episode.overview || null),
          toInsert.map((pe) =>
            pe.episode.premiereDate ? pe.episode.premiereDate.split('T')[0] : null
          ),
          toInsert.map((pe) => pe.episode.year || null),
          toInsert.map((pe) => pe.runtimeMinutes),
          toInsert.map((pe) => pe.episode.communityRating || null),
          toInsert.map((pe) => pe.episode.directors || []),
          toInsert.map((pe) => pe.episode.writers || []),
          toInsert.map((pe) => JSON.stringify(pe.episode.guestStars || [])),
          toInsert.map((pe) => pe.episode.path || null),
          toInsert.map((pe) => JSON.stringify(pe.episode.mediaSources || [])),
          toInsert.map((pe) => pe.posterUrl),
        ]
      )
      added = result.rowCount || toInsert.length
      for (const pe of toInsert) {
        existingProviderIds.add(pe.episode.id)
      }
    } catch (err) {
      logger.error({ err, count: toInsert.length }, 'Failed to bulk insert episodes')
    }
  }

  return { added, updated }
}

/**
 * Sync all series and episodes from the media server to the database
 *
 * OPTIMIZED: Uses parallel API fetching and batch database operations
 * for significantly faster sync times on large libraries.
 */
export async function syncSeries(existingJobId?: string): Promise<SyncSeriesResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'sync-series', 4)

  try {
    const provider = await getMediaServerProvider()
    const apiKey = await getMediaServerApiKey()

    if (!apiKey) {
      throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
    }

    // Step 1: Connect to media server and check library config
    setJobStep(jobId, 0, 'Connecting to media server')
    const config = await getMediaServerConfig()
    const serverType = config.type || 'emby'
    const serverUrl = config.baseUrl || 'Not configured'

    addLog(jobId, 'info', `🔌 Connecting to ${serverType.toUpperCase()} server...`)
    addLog(jobId, 'info', `📡 Server URL: ${serverUrl}`)
    addLog(
      jobId,
      'info',
      `⚡ Performance: ${SERIES_PAGE_SIZE} series/page, ${EPISODE_PAGE_SIZE} episodes/page, ${PARALLEL_FETCHES} parallel`
    )

    // Get enabled TV library IDs from config
    const enabledLibraryIds = await getEnabledTvLibraryIds()

    if (enabledLibraryIds !== null && enabledLibraryIds.length === 0) {
      addLog(jobId, 'warn', '⚠️ No TV libraries enabled for sync!')
      addLog(jobId, 'info', '💡 Enable TV libraries in Settings → Library Configuration')
      completeJob(jobId, {
        seriesAdded: 0,
        seriesUpdated: 0,
        episodesAdded: 0,
        episodesUpdated: 0,
        totalSeries: 0,
        totalEpisodes: 0,
      })
      return {
        seriesAdded: 0,
        seriesUpdated: 0,
        episodesAdded: 0,
        episodesUpdated: 0,
        totalSeries: 0,
        totalEpisodes: 0,
        jobId,
      }
    }

    const librariesToSync = enabledLibraryIds ?? []

    if (librariesToSync.length > 0) {
      addLog(jobId, 'info', `📚 Syncing from ${librariesToSync.length} selected TV library/libraries`)
    } else {
      addLog(jobId, 'info', '📚 Syncing from ALL TV libraries (no filter configured)')
    }

    // Step 2: Fetch series and episode counts
    setJobStep(jobId, 1, 'Fetching counts')
    addLog(jobId, 'info', '📋 Querying media server for TV libraries...')

    const libraryCounts: Array<{ libraryId: string | null; seriesCount: number; episodeCount: number }> =
      []
    let totalSeries = 0
    let totalEpisodes = 0

    if (librariesToSync.length > 0) {
      for (const libId of librariesToSync) {
        const [seriesResult, episodeResult] = await Promise.all([
          provider.getSeries(apiKey, { startIndex: 0, limit: 1, parentIds: [libId] }),
          provider.getEpisodes(apiKey, { startIndex: 0, limit: 1, parentIds: [libId] }),
        ])
        libraryCounts.push({
          libraryId: libId,
          seriesCount: seriesResult.totalRecordCount,
          episodeCount: episodeResult.totalRecordCount,
        })
        totalSeries += seriesResult.totalRecordCount
        totalEpisodes += episodeResult.totalRecordCount
        addLog(
          jobId,
          'debug',
          `Library ${libId}: ${seriesResult.totalRecordCount} series, ${episodeResult.totalRecordCount} episodes`
        )
      }
    } else {
      const [seriesResult, episodeResult] = await Promise.all([
        provider.getSeries(apiKey, { startIndex: 0, limit: 1 }),
        provider.getEpisodes(apiKey, { startIndex: 0, limit: 1 }),
      ])
      libraryCounts.push({
        libraryId: null,
        seriesCount: seriesResult.totalRecordCount,
        episodeCount: episodeResult.totalRecordCount,
      })
      totalSeries = seriesResult.totalRecordCount
      totalEpisodes = episodeResult.totalRecordCount
    }

    addLog(jobId, 'info', `📺 Found ${totalSeries} series and ${totalEpisodes} episodes`)

    if (totalSeries === 0) {
      addLog(jobId, 'warn', '⚠️ No series found in media server library!')
      completeJob(jobId, {
        seriesAdded: 0,
        seriesUpdated: 0,
        episodesAdded: 0,
        episodesUpdated: 0,
        totalSeries: 0,
        totalEpisodes: 0,
      })
      return {
        seriesAdded: 0,
        seriesUpdated: 0,
        episodesAdded: 0,
        episodesUpdated: 0,
        totalSeries: 0,
        totalEpisodes: 0,
        jobId,
      }
    }

    // Pre-fetch existing data from database
    addLog(jobId, 'info', '🔍 Loading existing series and episodes from database...')
    const [existingSeriesResult, existingEpisodesResult] = await Promise.all([
      query<{ provider_item_id: string }>('SELECT provider_item_id FROM series'),
      query<{ provider_item_id: string }>('SELECT provider_item_id FROM episodes'),
    ])
    const existingSeriesIds = new Set(existingSeriesResult.rows.map((r) => r.provider_item_id))
    const existingEpisodeIds = new Set(existingEpisodesResult.rows.map((r) => r.provider_item_id))
    addLog(
      jobId,
      'info',
      `📊 Found ${existingSeriesIds.size} existing series, ${existingEpisodeIds.size} existing episodes in database`
    )

    const startTime = Date.now()
    let seriesAdded = 0
    let seriesUpdated = 0
    let episodesAdded = 0
    let episodesUpdated = 0
    let processedSeries = 0
    let processedEpisodes = 0

    // Step 3: Process series
    setJobStep(jobId, 2, 'Processing series', totalSeries)

    for (const { libraryId, seriesCount } of libraryCounts) {
      if (seriesCount === 0) continue

      addLog(jobId, 'info', `📂 Fetching ${seriesCount} series from library${libraryId ? ` ${libraryId}` : ''}...`)

      // Fetch all series in parallel
      // Note: We don't update job progress during fetch since it's fast
      // Progress updates happen during the processing phase below
      const seriesList = await fetchParallel(
        (startIndex, limit) =>
          provider.getSeries(apiKey, {
            startIndex,
            limit,
            parentIds: libraryId ? [libraryId] : undefined,
          }),
        seriesCount,
        SERIES_PAGE_SIZE,
        PARALLEL_FETCHES
      )

      addLog(jobId, 'info', `✅ Fetched ${seriesList.length} series, now processing...`)

      // Prepare series data
      const preparedSeries: PreparedSeries[] = seriesList.map((series) => ({
        series,
        posterUrl: series.posterImageTag ? provider.getPosterUrl(series.id, series.posterImageTag) : null,
        backdropUrl: series.backdropImageTag
          ? provider.getBackdropUrl(series.id, series.backdropImageTag)
          : null,
        libraryId,
      }))

      // Process in batches
      for (let i = 0; i < preparedSeries.length; i += DB_BATCH_SIZE) {
        const batch = preparedSeries.slice(i, i + DB_BATCH_SIZE)
        const result = await processSeriesBatch(batch, existingSeriesIds, jobId)
        seriesAdded += result.added
        seriesUpdated += result.updated
        processedSeries += batch.length
        updateJobProgress(jobId, processedSeries, totalSeries, `${processedSeries}/${totalSeries} series`)
      }
    }

    addLog(
      jobId,
      'info',
      `📊 Series sync: ${seriesAdded} new, ${seriesUpdated} updated (${processedSeries} total)`
    )

    // Refresh series ID mapping after inserts
    const allSeriesResult = await query<{ id: string; provider_item_id: string }>(
      'SELECT id, provider_item_id FROM series'
    )
    const providerToDbSeriesId = new Map<string, string>()
    for (const s of allSeriesResult.rows) {
      providerToDbSeriesId.set(s.provider_item_id, s.id)
    }

    // Step 4: Process episodes
    setJobStep(jobId, 3, 'Processing episodes', totalEpisodes)
    addLog(jobId, 'info', '📺 Syncing episodes...')

    for (const { libraryId, episodeCount } of libraryCounts) {
      if (episodeCount === 0) continue

      addLog(
        jobId,
        'info',
        `📂 Fetching ${episodeCount} episodes from library${libraryId ? ` ${libraryId}` : ''}...`
      )

      // Fetch all episodes in parallel
      // Note: We don't update job progress during fetch since it's fast
      const episodeList = await fetchParallel(
        (startIndex, limit) =>
          provider.getEpisodes(apiKey, {
            startIndex,
            limit,
            parentIds: libraryId ? [libraryId] : undefined,
          }),
        episodeCount,
        EPISODE_PAGE_SIZE,
        PARALLEL_FETCHES
      )

      addLog(jobId, 'info', `✅ Fetched ${episodeList.length} episodes, now processing...`)

      // Prepare episode data, filtering out placeholders and episodes without series
      const preparedEpisodes: PreparedEpisode[] = []
      for (const episode of episodeList) {
        // Skip Aperture sorting placeholder episodes
        if (
          episode.name === 'Aperture Sorting Placeholder' ||
          (episode.seasonNumber === 0 && episode.episodeNumber === 0 && episode.name?.includes('Aperture'))
        ) {
          continue
        }

        const seriesDbId = providerToDbSeriesId.get(episode.seriesId)
        if (!seriesDbId) continue // Series not in DB

        preparedEpisodes.push({
          episode,
          seriesDbId,
          posterUrl: episode.posterImageTag ? provider.getPosterUrl(episode.id, episode.posterImageTag) : null,
          runtimeMinutes: episode.runtimeTicks ? Math.round(episode.runtimeTicks / 600000000) : null,
        })
      }

      // Process in batches
      for (let i = 0; i < preparedEpisodes.length; i += DB_BATCH_SIZE) {
        const batch = preparedEpisodes.slice(i, i + DB_BATCH_SIZE)
        const result = await processEpisodeBatch(batch, existingEpisodeIds)
        episodesAdded += result.added
        episodesUpdated += result.updated
        processedEpisodes += batch.length
        updateJobProgress(
          jobId,
          processedEpisodes,
          totalEpisodes,
          `${processedEpisodes}/${totalEpisodes} episodes`
        )

        // Log progress periodically
        if (i % (DB_BATCH_SIZE * 10) === 0 && i > 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = Math.round(processedEpisodes / elapsed)
          addLog(
            jobId,
            'info',
            `📊 Episodes: ${processedEpisodes}/${totalEpisodes} (${rate}/sec, ${episodesAdded} new)`
          )
        }
      }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
    const finalResult = {
      seriesAdded,
      seriesUpdated,
      episodesAdded,
      episodesUpdated,
      totalSeries: processedSeries,
      totalEpisodes: processedEpisodes,
      jobId,
    }
    completeJob(jobId, finalResult)

    addLog(
      jobId,
      'info',
      `🎉 Sync complete in ${totalDuration}s: ${seriesAdded} new series, ${seriesUpdated} updated | ${episodesAdded} new episodes, ${episodesUpdated} updated`
    )

    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    throw err
  }
}

/**
 * Sync episode watch history for a specific user
 * @param fullSync - If true, performs a full sync regardless of last sync time
 */
export async function syncSeriesWatchHistoryForUser(
  userId: string,
  providerUserId: string,
  fullSync: boolean = false
): Promise<{ synced: number; removed: number }> {
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
  }

  // Get user's last sync time for delta sync
  const userRecord = await queryOne<{ series_watch_history_synced_at: Date | null }>(
    'SELECT series_watch_history_synced_at FROM users WHERE id = $1',
    [userId]
  )

  const sinceDate = fullSync ? undefined : userRecord?.series_watch_history_synced_at || undefined

  logger.info(
    { userId, providerUserId, deltaSync: !!sinceDate, fullSync },
    'Syncing series watch history'
  )

  const watchedEpisodes = await provider.getSeriesWatchHistory(apiKey, providerUserId, sinceDate)

  // Get all episodes we have in our database with their provider IDs
  const allEpisodes = await query<{ id: string; provider_item_id: string }>(
    'SELECT id, provider_item_id FROM episodes WHERE provider_item_id IS NOT NULL'
  )

  const providerIdToEpisodeId = new Map<string, string>()
  for (const episode of allEpisodes.rows) {
    providerIdToEpisodeId.set(episode.provider_item_id, episode.id)
  }

  // Get current episode watch history for this user
  const existingHistory = await query<{ episode_id: string }>(
    "SELECT episode_id FROM watch_history WHERE user_id = $1 AND media_type = 'episode'",
    [userId]
  )
  const existingEpisodeIds = new Set(existingHistory.rows.map((r) => r.episode_id))

  let synced = 0
  const syncedEpisodeIds = new Set<string>()

  for (const item of watchedEpisodes) {
    const episodeId = providerIdToEpisodeId.get(item.episodeId)

    if (!episodeId) {
      logger.debug({ providerItemId: item.episodeId }, 'Episode not found in database, skipping')
      continue
    }

    // Upsert watch history (uses partial unique index idx_watch_history_user_episode_unique)
    await query(
      `INSERT INTO watch_history (user_id, episode_id, media_type, play_count, last_played_at, is_favorite)
       VALUES ($1, $2, 'episode', $3, $4, $5)
       ON CONFLICT (user_id, episode_id) WHERE episode_id IS NOT NULL DO UPDATE SET
         play_count = EXCLUDED.play_count,
         last_played_at = EXCLUDED.last_played_at,
         is_favorite = EXCLUDED.is_favorite,
         updated_at = NOW()`,
      [userId, episodeId, item.playCount, item.lastPlayedDate || null, item.isFavorite]
    )

    syncedEpisodeIds.add(episodeId)
    synced++
  }

  // Remove watch history entries for episodes no longer marked as watched
  // Only do this on full sync (delta sync only adds/updates)
  let removed = 0
  if (fullSync) {
    for (const existingEpisodeId of existingEpisodeIds) {
      if (!syncedEpisodeIds.has(existingEpisodeId)) {
        await query(
          "DELETE FROM watch_history WHERE user_id = $1 AND episode_id = $2 AND media_type = 'episode'",
          [userId, existingEpisodeId]
        )
        removed++
        logger.debug(
          { userId, episodeId: existingEpisodeId },
          'Removed stale episode watch history entry'
        )
      }
    }
  }

  // Update user's last sync timestamp
  await query('UPDATE users SET series_watch_history_synced_at = NOW() WHERE id = $1', [userId])

  logger.info(
    { userId, synced, removed, deltaSync: !fullSync },
    'Series watch history sync completed'
  )
  return { synced, removed }
}

/**
 * Sync series watch history for all users (not just enabled)
 * This is needed for Top Picks which aggregates watch data from all users
 * Auto-imports any Emby/Jellyfin users not yet in our database
 * @param fullSync - If true, performs a full sync regardless of last sync time
 */
export async function syncSeriesWatchHistoryForAllUsers(
  existingJobId?: string,
  fullSync: boolean = false
): Promise<{ success: number; failed: number; totalItems: number; jobId: string }> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'sync-series-watch-history', 3)

  try {
    const provider = await getMediaServerProvider()
    const apiKey = await getMediaServerApiKey()

    if (!apiKey) {
      throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
    }

    // Step 1: Fetch all users from media server and auto-import missing ones
    setJobStep(jobId, 0, 'Fetching users from media server')
    addLog(jobId, 'info', '📡 Fetching user list from media server...')

    const providerUsers = await provider.getUsers(apiKey)
    addLog(jobId, 'info', `👥 Found ${providerUsers.length} user(s) on media server`)

    // Get existing users from our database
    const existingUsers = await query<{ provider_user_id: string }>(
      'SELECT provider_user_id FROM users WHERE provider_user_id IS NOT NULL'
    )
    const existingProviderIds = new Set(existingUsers.rows.map((u) => u.provider_user_id))

    // Import any missing users
    const msConfig = await getMediaServerConfig()
    const providerType = msConfig.type || 'emby'
    let imported = 0
    for (const pu of providerUsers) {
      if (!existingProviderIds.has(pu.id)) {
        await query(
          `INSERT INTO users (username, provider_user_id, provider, is_admin, is_enabled, movies_enabled, series_enabled)
           VALUES ($1, $2, $3, $4, false, false, false)`,
          [pu.name, pu.id, providerType, pu.isAdmin || false]
        )
        imported++
        addLog(jobId, 'info', `➕ Imported user: ${pu.name}`)
      }
    }

    if (imported > 0) {
      addLog(jobId, 'info', `✅ Imported ${imported} new user(s) from media server`)
    }

    // Step 2: Get ALL users from our database
    setJobStep(jobId, 1, 'Finding users')
    const result = await query<{ id: string; provider_user_id: string; username: string }>(
      'SELECT id, provider_user_id, username FROM users WHERE provider_user_id IS NOT NULL'
    )

    const users = result.rows
    addLog(jobId, 'info', `👥 Syncing series watch history for ${users.length} user(s)`)

    if (users.length === 0) {
      addLog(jobId, 'warn', '⚠️ No users found with media server accounts')
      completeJob(jobId, { success: 0, failed: 0, totalItems: 0 })
      return { success: 0, failed: 0, totalItems: 0, jobId }
    }

    const syncMode = fullSync ? 'full' : 'delta'
    addLog(jobId, 'info', `🔄 Sync mode: ${syncMode}`)

    // Step 3: Sync each user
    setJobStep(jobId, 2, 'Syncing series watch history', users.length)

    let success = 0
    let failed = 0
    let totalItems = 0

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      updateJobProgress(jobId, i, users.length, user.username)

      try {
        addLog(jobId, 'info', `🔄 Syncing series watch history for ${user.username}...`)
        const syncResult = await syncSeriesWatchHistoryForUser(
          user.id,
          user.provider_user_id,
          fullSync
        )
        totalItems += syncResult.synced
        success++
        const removedMsg = syncResult.removed > 0 ? `, ${syncResult.removed} removed` : ''
        addLog(
          jobId,
          'info',
          `✅ ${user.username}: ${syncResult.synced} watched episodes synced${removedMsg}`
        )
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to sync series watch history')
        addLog(jobId, 'error', `❌ ${user.username}: ${error}`)
        failed++
      }
    }

    updateJobProgress(jobId, users.length, users.length)
    const finalResult = { success, failed, totalItems, jobId }
    completeJob(jobId, finalResult)

    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    throw err
  }
}
