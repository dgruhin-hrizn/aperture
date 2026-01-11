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
async function processSeriesBatch(
  seriesList: PreparedSeries[],
  existingProviderIds: Set<string>,
  jobId: string
): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0

  for (const ps of seriesList) {
    try {
      if (existingProviderIds.has(ps.series.id)) {
        // Update existing
        await query(
          `UPDATE series SET
            title = $2, original_title = $3, sort_title = $4, year = $5, end_year = $6,
            genres = $7, overview = $8, tagline = $9, community_rating = $10, critic_rating = $11,
            content_rating = $12, status = $13, total_seasons = $14, total_episodes = $15,
            air_days = $16, network = $17, studios = $18, directors = $19, writers = $20,
            actors = $21, imdb_id = $22, tmdb_id = $23, tvdb_id = $24, tags = $25,
            production_countries = $26, awards = $27, poster_url = $28, backdrop_url = $29,
            provider_library_id = $30, updated_at = NOW()
          WHERE provider_item_id = $1`,
          [
            ps.series.id,
            ps.series.name,
            ps.series.originalTitle,
            ps.series.sortName,
            ps.series.year,
            ps.series.endYear,
            ps.series.genres,
            ps.series.overview,
            ps.series.tagline,
            ps.series.communityRating,
            ps.series.criticRating,
            ps.series.contentRating,
            ps.series.status,
            ps.series.totalSeasons,
            ps.series.totalEpisodes,
            ps.series.airDays || [],
            ps.series.network,
            JSON.stringify(ps.series.studios || []),
            ps.series.directors || [],
            ps.series.writers || [],
            JSON.stringify(ps.series.actors || []),
            ps.series.imdbId,
            ps.series.tmdbId,
            ps.series.tvdbId,
            ps.series.tags || [],
            ps.series.productionCountries || [],
            ps.series.awards,
            ps.posterUrl,
            ps.backdropUrl,
            ps.libraryId,
          ]
        )
        updated++
      } else {
        // Insert new
        await query(
          `INSERT INTO series (
            provider_item_id, title, original_title, sort_title, year, end_year,
            genres, overview, tagline, community_rating, critic_rating, content_rating,
            status, total_seasons, total_episodes, air_days, network,
            studios, directors, writers, actors,
            imdb_id, tmdb_id, tvdb_id, tags, production_countries, awards,
            poster_url, backdrop_url, provider_library_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
          )`,
          [
            ps.series.id,
            ps.series.name,
            ps.series.originalTitle,
            ps.series.sortName,
            ps.series.year,
            ps.series.endYear,
            ps.series.genres,
            ps.series.overview,
            ps.series.tagline,
            ps.series.communityRating,
            ps.series.criticRating,
            ps.series.contentRating,
            ps.series.status,
            ps.series.totalSeasons,
            ps.series.totalEpisodes,
            ps.series.airDays || [],
            ps.series.network,
            JSON.stringify(ps.series.studios || []),
            ps.series.directors || [],
            ps.series.writers || [],
            JSON.stringify(ps.series.actors || []),
            ps.series.imdbId,
            ps.series.tmdbId,
            ps.series.tvdbId,
            ps.series.tags || [],
            ps.series.productionCountries || [],
            ps.series.awards,
            ps.posterUrl,
            ps.backdropUrl,
            ps.libraryId,
          ]
        )
        added++
        existingProviderIds.add(ps.series.id)
      }
    } catch (err) {
      logger.error({ err, series: ps.series.name }, 'Failed to sync series')
    }
  }

  return { added, updated }
}

/**
 * Process episode batch for database insertion
 */
async function processEpisodeBatch(
  episodes: PreparedEpisode[],
  existingProviderIds: Set<string>
): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0

  for (const pe of episodes) {
    try {
      if (existingProviderIds.has(pe.episode.id)) {
        // Update existing
        await query(
          `UPDATE episodes SET
            series_id = $2, season_number = $3, episode_number = $4, title = $5,
            overview = $6, premiere_date = $7, year = $8, runtime_minutes = $9,
            community_rating = $10, directors = $11, writers = $12, guest_stars = $13,
            path = $14, media_sources = $15, poster_url = $16, updated_at = NOW()
          WHERE provider_item_id = $1`,
          [
            pe.episode.id,
            pe.seriesDbId,
            pe.episode.seasonNumber,
            pe.episode.episodeNumber,
            pe.episode.name,
            pe.episode.overview,
            pe.episode.premiereDate ? pe.episode.premiereDate.split('T')[0] : null,
            pe.episode.year,
            pe.runtimeMinutes,
            pe.episode.communityRating,
            pe.episode.directors || [],
            pe.episode.writers || [],
            JSON.stringify(pe.episode.guestStars || []),
            pe.episode.path,
            JSON.stringify(pe.episode.mediaSources || []),
            pe.posterUrl,
          ]
        )
        updated++
      } else {
        // Insert new (with upsert on series_id + season + episode conflict)
        await query(
          `INSERT INTO episodes (
            provider_item_id, series_id, season_number, episode_number, title,
            overview, premiere_date, year, runtime_minutes, community_rating,
            directors, writers, guest_stars, path, media_sources, poster_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (series_id, season_number, episode_number) DO UPDATE SET
            provider_item_id = EXCLUDED.provider_item_id,
            title = EXCLUDED.title, overview = EXCLUDED.overview,
            premiere_date = EXCLUDED.premiere_date, year = EXCLUDED.year,
            runtime_minutes = EXCLUDED.runtime_minutes, community_rating = EXCLUDED.community_rating,
            directors = EXCLUDED.directors, writers = EXCLUDED.writers,
            guest_stars = EXCLUDED.guest_stars, path = EXCLUDED.path,
            media_sources = EXCLUDED.media_sources, poster_url = EXCLUDED.poster_url,
            updated_at = NOW()`,
          [
            pe.episode.id,
            pe.seriesDbId,
            pe.episode.seasonNumber,
            pe.episode.episodeNumber,
            pe.episode.name,
            pe.episode.overview,
            pe.episode.premiereDate ? pe.episode.premiereDate.split('T')[0] : null,
            pe.episode.year,
            pe.runtimeMinutes,
            pe.episode.communityRating,
            pe.episode.directors || [],
            pe.episode.writers || [],
            JSON.stringify(pe.episode.guestStars || []),
            pe.episode.path,
            JSON.stringify(pe.episode.mediaSources || []),
            pe.posterUrl,
          ]
        )
        added++
        existingProviderIds.add(pe.episode.id)
      }
    } catch (err) {
      logger.error({ err, episode: pe.episode.name }, 'Failed to sync episode')
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
      const seriesList = await fetchParallel(
        (startIndex, limit) =>
          provider.getSeries(apiKey, {
            startIndex,
            limit,
            parentIds: libraryId ? [libraryId] : undefined,
          }),
        seriesCount,
        SERIES_PAGE_SIZE,
        PARALLEL_FETCHES,
        (fetched) => updateJobProgress(jobId, processedSeries + fetched, totalSeries, `Fetching series...`)
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
      const episodeList = await fetchParallel(
        (startIndex, limit) =>
          provider.getEpisodes(apiKey, {
            startIndex,
            limit,
            parentIds: libraryId ? [libraryId] : undefined,
          }),
        episodeCount,
        EPISODE_PAGE_SIZE,
        PARALLEL_FETCHES,
        (fetched) =>
          updateJobProgress(jobId, processedEpisodes + fetched, totalEpisodes, `Fetching episodes...`)
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
