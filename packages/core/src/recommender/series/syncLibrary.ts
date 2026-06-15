import { query } from '../../lib/db.js'
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
import type { Episode } from '../../media/types.js'
import { fetchParallel, streamingBatchProcess } from '../shared/syncHelpers.js'
import {
  SERIES_PAGE_SIZE,
  EPISODE_PAGE_SIZE,
  PARALLEL_FETCHES,
  DB_BATCH_SIZE,
} from './syncConstants.js'
import type { SyncSeriesResult, LibrarySeriesSyncResult, PreparedSeries, PreparedEpisode } from './syncTypes.js'
import { reconcileRemovedSeries } from './reconcile.js'
import { processSeriesBatch } from './seriesBatch.js'
import { processEpisodeBatch } from './episodeBatch.js'

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
        seriesRemoved: 0,
        episodesRemoved: 0,
        totalSeries: 0,
        totalEpisodes: 0,
      })
      return {
        seriesAdded: 0,
        seriesUpdated: 0,
        episodesAdded: 0,
        episodesUpdated: 0,
        seriesRemoved: 0,
        episodesRemoved: 0,
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
        seriesRemoved: 0,
        episodesRemoved: 0,
        totalSeries: 0,
        totalEpisodes: 0,
      })
      return {
        seriesAdded: 0,
        seriesUpdated: 0,
        episodesAdded: 0,
        episodesUpdated: 0,
        seriesRemoved: 0,
        episodesRemoved: 0,
        totalSeries: 0,
        totalEpisodes: 0,
        jobId,
      }
    }

    // Pre-fetch existing data from database
    addLog(jobId, 'info', '🔍 Loading existing series and episodes from database...')
    const [existingSeriesResult, existingEpisodesResult] = await Promise.all([
      query<{ provider_item_id: string; title: string; year: number | null }>('SELECT provider_item_id, title, year FROM series'),
      query<{ provider_item_id: string; series_id: string; season_number: number; episode_number: number }>(
        'SELECT provider_item_id, series_id, season_number, episode_number FROM episodes'
      ),
    ])
    const existingSeriesIds = new Set<string>()
    const existingSeriesTitleYears = new Map<string, string>()
    for (const s of existingSeriesResult.rows) {
      existingSeriesIds.add(s.provider_item_id)
      if (s.title && s.year) {
        existingSeriesTitleYears.set(`${s.title.toLowerCase()}|${s.year}`, s.provider_item_id)
      }
    }
    // Track existing episodes by BOTH provider_item_id AND by series+season+episode composite key
    // This handles cases where Emby/Jellyfin regenerates item IDs
    const existingEpisodeIds = new Set(existingEpisodesResult.rows.map((r) => r.provider_item_id))
    const existingEpisodeKeys = new Set(
      existingEpisodesResult.rows.map((r) => `${r.series_id}:${r.season_number}:${r.episode_number}`)
    )
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
    const librarySyncResults: LibrarySeriesSyncResult[] = []

    // Step 3: Process series
    setJobStep(jobId, 2, 'Processing series', totalSeries)

    for (const { libraryId, seriesCount, episodeCount } of libraryCounts) {
      const libraryResult: LibrarySeriesSyncResult = {
        libraryId,
        expectedSeriesCount: seriesCount,
        fetchedSeriesCount: 0,
        seenSeriesProviderIds: new Set<string>(),
        expectedEpisodeCount: episodeCount,
        fetchedEpisodeCount: 0,
        seenEpisodeProviderIds: new Set<string>(),
      }
      librarySyncResults.push(libraryResult)

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

      libraryResult.fetchedSeriesCount = seriesList.length
      for (const series of seriesList) {
        libraryResult.seenSeriesProviderIds.add(series.id)
      }

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
        const result = await processSeriesBatch(batch, existingSeriesIds, existingSeriesTitleYears, jobId)
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

    // Step 4: Process episodes using streaming batch processing
    // This processes episodes in chunks to avoid loading all 200K+ episodes into memory
    setJobStep(jobId, 3, 'Processing episodes', totalEpisodes)
    addLog(jobId, 'info', '📺 Syncing episodes (streaming mode for large libraries)...')

    for (const { libraryId, episodeCount } of libraryCounts) {
      if (episodeCount === 0) continue

      const libraryResult = librarySyncResults.find((lib) => lib.libraryId === libraryId) ?? {
        libraryId,
        expectedSeriesCount: 0,
        fetchedSeriesCount: 0,
        seenSeriesProviderIds: new Set<string>(),
        expectedEpisodeCount: episodeCount,
        fetchedEpisodeCount: 0,
        seenEpisodeProviderIds: new Set<string>(),
      }
      if (!librarySyncResults.includes(libraryResult)) {
        librarySyncResults.push(libraryResult)
      }

      addLog(
        jobId,
        'info',
        `📂 Processing ${episodeCount} episodes from library${libraryId ? ` ${libraryId}` : ''} (streaming)...`
      )

      let lastLogTime = Date.now()
      // Track base counts for this library (to accumulate across multiple libraries)
      const baseProcessed = processedEpisodes
      const baseAdded = episodesAdded
      const baseUpdated = episodesUpdated

      // Use streaming batch processing to avoid memory issues with large libraries
      const streamResult = await streamingBatchProcess<Episode>(
        // Fetch function
        (startIndex, limit) =>
          provider.getEpisodes(apiKey, {
            startIndex,
            limit,
            parentIds: libraryId ? [libraryId] : undefined,
          }),
        episodeCount,
        EPISODE_PAGE_SIZE,
        // Process batch function - prepares and inserts episodes
        async (episodes) => {
          for (const episode of episodes) {
            libraryResult.seenEpisodeProviderIds.add(episode.id)
          }
          libraryResult.fetchedEpisodeCount += episodes.length

          // Prepare episode data, filtering out placeholders and episodes without series
          const preparedEpisodes: PreparedEpisode[] = []
          for (const episode of episodes) {
            // Skip Aperture sorting placeholder episodes
            if (
              episode.name === 'Aperture Sorting Placeholder' ||
              (episode.seasonNumber === 0 && episode.episodeNumber === 0 && episode.name?.includes('Aperture'))
            ) {
              continue
            }

            // Skip episodes with null season or episode numbers (extras, bonus content, etc.)
            // These can't be inserted into the DB due to NOT NULL constraints
            if (episode.seasonNumber == null || episode.episodeNumber == null) {
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

          // Process in smaller DB batches
          let batchAdded = 0
          let batchUpdated = 0
          for (let i = 0; i < preparedEpisodes.length; i += DB_BATCH_SIZE) {
            const batch = preparedEpisodes.slice(i, i + DB_BATCH_SIZE)
            const result = await processEpisodeBatch(batch, existingEpisodeIds, existingEpisodeKeys)
            batchAdded += result.added
            batchUpdated += result.updated
          }

          return { added: batchAdded, updated: batchUpdated }
        },
        // Progress callback - accumulate with base counts from previous libraries
        (processed, added, updated) => {
          processedEpisodes = baseProcessed + processed
          episodesAdded = baseAdded + added
          episodesUpdated = baseUpdated + updated
          updateJobProgress(
            jobId,
            processedEpisodes,
            totalEpisodes,
            `${processedEpisodes}/${totalEpisodes} episodes`
          )

          // Log progress every 5 seconds or every 10K episodes
          const now = Date.now()
          if (now - lastLogTime > 5000 || processed % 10000 === 0) {
            const elapsed = (now - startTime) / 1000
            const rate = Math.round(processedEpisodes / elapsed)
            addLog(
              jobId,
              'info',
              `📊 Episodes: ${processedEpisodes}/${totalEpisodes} (${rate}/sec, ${episodesAdded} new, ${episodesUpdated} updated)`
            )
            lastLogTime = now
          }
        }
      )

      addLog(
        jobId,
        'info',
        `✅ Library complete: ${streamResult.totalProcessed} episodes (${streamResult.totalAdded} new, ${streamResult.totalUpdated} updated)`
      )
    }

    const { seriesRemoved, episodesRemoved } = await reconcileRemovedSeries(jobId, librarySyncResults)

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
    const finalResult = {
      seriesAdded,
      seriesUpdated,
      episodesAdded,
      episodesUpdated,
      seriesRemoved,
      episodesRemoved,
      totalSeries: processedSeries,
      totalEpisodes: processedEpisodes,
      jobId,
    }
    completeJob(jobId, finalResult)

    addLog(
      jobId,
      'info',
      `🎉 Sync complete in ${totalDuration}s: ${seriesAdded} new series, ${seriesUpdated} updated, ${seriesRemoved} removed | ${episodesAdded} new episodes, ${episodesUpdated} updated, ${episodesRemoved} removed`
    )

    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    throw err
  }
}
