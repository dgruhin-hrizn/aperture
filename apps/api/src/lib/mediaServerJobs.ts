import { WorkQueue } from '@aperture/core'

// Parent import jobs are deliberately excluded: they acquire a slot for each
// child job, so holding a parent slot would deadlock the import.
export const EMBY_HEAVY_JOBS = new Set([
  'sync-users',
  'sync-movies',
  'sync-series',
  'sync-movie-watch-history',
  'sync-series-watch-history',
  'sync-movie-libraries',
  'sync-series-libraries',
  'sync-watching-favorites',
  'refresh-top-picks',
])

const embyJobQueue = new WorkQueue(1)

export async function runEmbyJob(
  work: () => Promise<void>,
  cancelled: () => boolean
): Promise<void> {
  await embyJobQueue.run(async () => {
    if (!cancelled()) await work()
  })
}
