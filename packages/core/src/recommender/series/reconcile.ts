import { query } from '../../lib/db.js'
import { addLog } from '../../jobs/progress.js'
import type { LibrarySeriesSyncResult } from './syncTypes.js'

export async function reconcileRemovedSeries(
  jobId: string,
  libraryResults: LibrarySeriesSyncResult[]
): Promise<{ seriesRemoved: number; episodesRemoved: number }> {
  let seriesRemoved = 0
  let episodesRemoved = 0

  for (const lib of libraryResults) {
    if (lib.expectedSeriesCount > 0) {
      if (lib.fetchedSeriesCount !== lib.expectedSeriesCount) {
        addLog(
          jobId,
          'warn',
          `⚠️ Skipping stale series cleanup for library ${lib.libraryId ?? 'all'}: fetched ${lib.fetchedSeriesCount} but expected ${lib.expectedSeriesCount}`
        )
      } else {
        const seenSeries = [...lib.seenSeriesProviderIds]
        const deleteSeriesResult = lib.libraryId
          ? await query<{ id: string }>(
              `DELETE FROM series
               WHERE provider_library_id = $1
                 AND provider_item_id IS NOT NULL
                 AND NOT (provider_item_id = ANY($2::text[]))
               RETURNING id`,
              [lib.libraryId, seenSeries]
            )
          : await query<{ id: string }>(
              `DELETE FROM series
               WHERE provider_item_id IS NOT NULL
                 AND NOT (provider_item_id = ANY($1::text[]))
               RETURNING id`,
              [seenSeries]
            )
        const removed = deleteSeriesResult.rowCount || 0
        if (removed > 0) {
          addLog(
            jobId,
            'info',
            `🗑️ Removed ${removed} stale series no longer in Emby (library ${lib.libraryId ?? 'all'})`
          )
          seriesRemoved += removed
        }
      }
    }

    if (lib.expectedEpisodeCount > 0) {
      if (lib.fetchedEpisodeCount !== lib.expectedEpisodeCount) {
        addLog(
          jobId,
          'warn',
          `⚠️ Skipping stale episode cleanup for library ${lib.libraryId ?? 'all'}: fetched ${lib.fetchedEpisodeCount} but expected ${lib.expectedEpisodeCount}`
        )
      } else {
        const seenEpisodes = [...lib.seenEpisodeProviderIds]
        const deleteEpisodesResult = lib.libraryId
          ? await query<{ id: string }>(
              `DELETE FROM episodes e
               USING series s
               WHERE e.series_id = s.id
                 AND s.provider_library_id = $1
                 AND e.provider_item_id IS NOT NULL
                 AND NOT (e.provider_item_id = ANY($2::text[]))
               RETURNING e.id`,
              [lib.libraryId, seenEpisodes]
            )
          : await query<{ id: string }>(
              `DELETE FROM episodes
               WHERE provider_item_id IS NOT NULL
                 AND NOT (provider_item_id = ANY($1::text[]))
               RETURNING id`,
              [seenEpisodes]
            )
        const removed = deleteEpisodesResult.rowCount || 0
        if (removed > 0) {
          addLog(
            jobId,
            'info',
            `🗑️ Removed ${removed} stale episodes no longer in Emby (library ${lib.libraryId ?? 'all'})`
          )
          episodesRemoved += removed
        }
      }
    }
  }

  return { seriesRemoved, episodesRemoved }
}
