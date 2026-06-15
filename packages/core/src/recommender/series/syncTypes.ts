import type { Series, Episode } from '../../media/types.js'

export interface SyncSeriesResult {
  seriesAdded: number
  seriesUpdated: number
  episodesAdded: number
  episodesUpdated: number
  seriesRemoved: number
  episodesRemoved: number
  totalSeries: number
  totalEpisodes: number
  jobId: string
}
export interface LibrarySeriesSyncResult {
  libraryId: string | null
  expectedSeriesCount: number
  fetchedSeriesCount: number
  seenSeriesProviderIds: Set<string>
  expectedEpisodeCount: number
  fetchedEpisodeCount: number
  seenEpisodeProviderIds: Set<string>
}
/**
 * Prepared series data ready for database insertion
 */
export interface PreparedSeries {
  series: Series
  posterUrl: string | null
  backdropUrl: string | null
  libraryId: string | null
}

/**
 * Prepared episode data ready for database insertion
 */
export interface PreparedEpisode {
  episode: Episode
  seriesDbId: string
  posterUrl: string | null
  runtimeMinutes: number | null
}

