import { setTimeout as sleep } from 'node:timers/promises'
import { WorkQueue } from '../../lib/workQueue.js'
import type { EmbyProviderBase } from './base.js'
import type { EmbyLibrary, EmbyLibraryResponse } from './types.js'
import { EmbyHttpError } from './fetchHelpers.js'

interface ServerRefreshState {
  queue: WorkQueue
  nextRequestAt: number
  blockedUntil: number
}

const servers = new Map<string, ServerRefreshState>()
const REFRESH_GAP_MS = 5_000
const REFRESH_WAIT_MS = 15 * 60 * 1000

/** Serialize and pace refresh submissions across all Emby provider instances. */
export async function queueLibraryRefresh(
  provider: EmbyProviderBase,
  apiKey: string,
  libraryId: string
): Promise<void> {
  let state = servers.get(provider.baseUrl)
  if (!state) {
    state = { queue: new WorkQueue(1), nextRequestAt: 0, blockedUntil: 0 }
    servers.set(provider.baseUrl, state)
  }
  const server = state
  await server.queue.run(async () => {
    if (Date.now() < server.blockedUntil)
      throw new Error('Emby refreshes are temporarily deferred after a failed refresh')
    const deadline = Date.now() + REFRESH_WAIT_MS
    const waitForIdle = async () => {
      while (true) {
        const response = await provider.fetch<EmbyLibrary[] | EmbyLibraryResponse>(
          '/Library/VirtualFolders',
          apiKey
        )
        const libraries = Array.isArray(response) ? response : (response.Items ?? [])
        // Some Emby versions omit RefreshStatus while idle. Respect reported
        // active work; the submission gap also applies when state is omitted.
        const busy = libraries.some((library) =>
          /^(running|refreshing|queued|pending)$/i.test(library.RefreshStatus ?? '')
        )
        if (!busy) return
        if (Date.now() >= deadline)
          throw new Error('Emby library refresh did not finish within 15 minutes')
        await sleep(2_000)
      }
    }
    try {
      await sleep(Math.max(0, server.nextRequestAt - Date.now()))
      await waitForIdle()
      await provider.fetch(`/Items/${encodeURIComponent(libraryId)}/Refresh`, apiKey, {
        method: 'POST',
      })
      server.nextRequestAt = Date.now() + REFRESH_GAP_MS
      await sleep(1_000)
      await waitForIdle()
    } catch (err) {
      // A stalled server should receive fewer requests, not one full timeout
      // for every remaining user's library in the same publishing run.
      if (!(err instanceof EmbyHttpError && err.status === 404)) {
        server.blockedUntil = Date.now() + 60_000
      }
      throw err
    }
  })
}
