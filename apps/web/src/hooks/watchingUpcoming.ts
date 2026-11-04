import { apiFetch } from '../lib/api'
import type { UpcomingEpisode } from './watching-context'

export interface UpcomingBatch {
  episodes: Record<string, UpcomingEpisode>
  resolvedSeriesIds: string[]
  seriesIds: string[]
  requestedSeriesIds: string[]
}
/** Two small browser reads at a time; server limits shared TMDb concurrency across users. */
export async function loadUpcomingBatches(
  ids: string[],
  signal: AbortSignal,
  apply: (batch: UpcomingBatch) => void
): Promise<boolean> {
  const unique = [...new Set(ids)]
  let offset = 0,
    complete = true
  const worker = async () => {
    while (offset < unique.length && !signal.aborted) {
      const batch = unique.slice(offset, offset + 10)
      offset += 10
      try {
        const response = await apiFetch(
          `/api/watching/upcoming?seriesIds=${batch.join(',')}`,
          { signal },
          60_000
        )
        if (!response.ok) throw new Error('Upcoming episode lookup failed')
        const data = (await response.json()) as UpcomingBatch
        if (signal.aborted) return
        if (data.resolvedSeriesIds.length !== data.seriesIds.length) complete = false
        apply({ ...data, requestedSeriesIds: batch })
      } catch {
        if (!signal.aborted) complete = false
      }
    }
  }
  await Promise.all([worker(), worker()])
  return complete && !signal.aborted
}
