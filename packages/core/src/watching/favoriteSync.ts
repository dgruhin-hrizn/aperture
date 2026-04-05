/**
 * Bidirectional sync between user_watching_series and media server (Emby/Jellyfin) series favorites.
 *
 * 1. Push: favorited in Aperture but not on server → POST FavoriteItems
 * 2. Refetch server favorites
 * 3. Remove DB rows for series no longer favorited on server
 * 4. Pull: favorited on server but not in Aperture → INSERT (when series exists in catalog)
 *
 * Unfavoriting on the server when the user removes a show in Aperture is handled by the DELETE /api/watching route.
 */

import crypto from 'crypto'
import { createChildLogger } from '../lib/logger.js'
import { query } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMediaServerApiKey, getWatchingLibraryConfig } from '../settings/systemSettings.js'
import {
  createJobProgress,
  setJobStep,
  updateJobProgress,
  addLog,
  completeJob,
  failJob,
} from '../jobs/index.js'

const logger = createChildLogger('watching-favorite-sync')

export interface ReconcileWatchingFavoritesResult {
  skipped: boolean
  reason?: string
  pushedToServer: number
  removedFromDb: number
  pulledIntoDb: number
  pushErrors: number
}

function asSet(ids: string[]): Set<string> {
  return new Set(ids)
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = []
  for (const x of a) {
    if (!b.has(x)) out.push(x)
  }
  return out
}

export async function reconcileWatchingFavoritesForUser(
  userId: string,
  providerUserId: string | null | undefined
): Promise<ReconcileWatchingFavoritesResult> {
  const empty: ReconcileWatchingFavoritesResult = {
    skipped: true,
    pushedToServer: 0,
    removedFromDb: 0,
    pulledIntoDb: 0,
    pushErrors: 0,
  }

  if (!providerUserId) {
    return { ...empty, reason: 'no_provider_user_id' }
  }

  const watchingConfig = await getWatchingLibraryConfig()
  if (!watchingConfig.enabled) {
    return { ...empty, reason: 'watching_disabled' }
  }

  const apiKey = await getMediaServerApiKey()
  if (!apiKey) {
    return { ...empty, reason: 'no_api_key' }
  }

  const provider = await getMediaServerProvider()

  const watchingRows = await query<{ series_id: string; provider_item_id: string }>(
    `SELECT uws.series_id, s.provider_item_id
     FROM user_watching_series uws
     JOIN series s ON s.id = uws.series_id
     WHERE uws.user_id = $1`,
    [userId]
  )

  const d0 = asSet(watchingRows.rows.map((r) => r.provider_item_id))

  let e0: string[]
  try {
    e0 = await provider.getFavoriteSeriesIdsForUser(apiKey, providerUserId)
  } catch (err) {
    logger.error({ err, userId }, 'Failed to list favorite series from media server')
    return { ...empty, skipped: true, reason: 'list_favorites_failed' }
  }

  const e0Set = asSet(e0)

  let pushedToServer = 0
  let pushErrors = 0
  for (const id of setDiff(d0, e0Set)) {
    try {
      await provider.favoriteSeriesItem(apiKey, providerUserId, id)
      pushedToServer++
    } catch (err) {
      pushErrors++
      logger.warn({ err, userId, providerItemId: id }, 'Failed to favorite series on media server')
    }
  }

  let e1: string[]
  try {
    e1 = await provider.getFavoriteSeriesIdsForUser(apiKey, providerUserId)
  } catch (err) {
    logger.error({ err, userId }, 'Failed to refetch favorite series after push')
    return {
      skipped: false,
      pushedToServer,
      removedFromDb: 0,
      pulledIntoDb: 0,
      pushErrors,
    }
  }

  const e1Set = asSet(e1)

  let removedFromDb = 0
  for (const row of watchingRows.rows) {
    if (!e1Set.has(row.provider_item_id)) {
      const del = await query(
        `DELETE FROM user_watching_series WHERE user_id = $1 AND series_id = $2`,
        [userId, row.series_id]
      )
      if (del.rowCount && del.rowCount > 0) removedFromDb++
    }
  }

  const afterDelete = await query<{ provider_item_id: string }>(
    `SELECT s.provider_item_id
     FROM user_watching_series uws
     JOIN series s ON s.id = uws.series_id
     WHERE uws.user_id = $1`,
    [userId]
  )
  const d1Set = asSet(afterDelete.rows.map((r) => r.provider_item_id))

  let pulledIntoDb = 0
  for (const providerId of setDiff(e1Set, d1Set)) {
    const ins = await query(
      `INSERT INTO user_watching_series (user_id, series_id)
       SELECT $1, id FROM series WHERE provider_item_id = $2
       ON CONFLICT (user_id, series_id) DO NOTHING`,
      [userId, providerId]
    )
    if (ins.rowCount && ins.rowCount > 0) pulledIntoDb++
  }

  logger.info(
    {
      userId,
      pushedToServer,
      removedFromDb,
      pulledIntoDb,
      pushErrors,
    },
    'Watching favorites reconciled with media server'
  )

  return {
    skipped: false,
    pushedToServer,
    removedFromDb,
    pulledIntoDb,
    pushErrors,
  }
}

/**
 * After a single series is added to watching in DB — favorite on media server (best effort).
 */
export async function favoriteWatchingSeriesOnMediaServer(
  providerUserId: string | null | undefined,
  seriesId: string
): Promise<void> {
  if (!providerUserId) return

  const watchingConfig = await getWatchingLibraryConfig()
  if (!watchingConfig.enabled) return

  const apiKey = await getMediaServerApiKey()
  if (!apiKey) return

  const result = await query<{ provider_item_id: string }>(
    `SELECT s.provider_item_id FROM series s WHERE s.id = $1`,
    [seriesId]
  )
  const providerItemId = result.rows[0]?.provider_item_id
  if (!providerItemId) return

  const provider = await getMediaServerProvider()
  await provider.favoriteSeriesItem(apiKey, providerUserId, providerItemId)
}

/**
 * After a single series is removed from watching in DB — unfavorite on media server (best effort).
 */
export async function unfavoriteWatchingSeriesOnMediaServer(
  providerUserId: string | null | undefined,
  seriesId: string
): Promise<void> {
  if (!providerUserId) return

  const watchingConfig = await getWatchingLibraryConfig()
  if (!watchingConfig.enabled) return

  const apiKey = await getMediaServerApiKey()
  if (!apiKey) return

  const result = await query<{ provider_item_id: string }>(
    `SELECT s.provider_item_id FROM series s WHERE s.id = $1`,
    [seriesId]
  )
  const providerItemId = result.rows[0]?.provider_item_id
  if (!providerItemId) return

  const provider = await getMediaServerProvider()
  await provider.unfavoriteSeriesItem(apiKey, providerUserId, providerItemId)
}

/**
 * Reconcile Shows You Watch ↔ media server favorites for every user with a linked provider account.
 * Scheduled job entry point: `sync-watching-favorites`.
 */
export async function processWatchingFavoritesForAllUsers(jobId?: string): Promise<{
  success: number
  failed: number
  jobId: string
  users: Array<{
    userId: string
    displayName: string
    skipped?: boolean
    reason?: string
    error?: string
  }>
}> {
  const actualJobId = jobId || crypto.randomUUID()

  createJobProgress(actualJobId, 'sync-watching-favorites', 2)

  const users: Array<{
    userId: string
    displayName: string
    skipped?: boolean
    reason?: string
    error?: string
  }> = []

  try {
    const watchingConfig = await getWatchingLibraryConfig()
    if (!watchingConfig.enabled) {
      addLog(actualJobId, 'info', '⏭️ Watching library feature is disabled, skipping job')
      completeJob(actualJobId, { success: 0, failed: 0, skipped: true })
      return { success: 0, failed: 0, jobId: actualJobId, users: [] }
    }

    setJobStep(actualJobId, 0, 'Finding users with media server accounts')
    addLog(actualJobId, 'info', '🔍 Finding users for Shows You Watch ↔ favorites sync...')

    const usersResult = await query<{
      id: string
      provider_user_id: string
      display_name: string | null
      username: string
    }>(
      `SELECT u.id, u.provider_user_id, u.display_name, u.username
       FROM users u
       WHERE u.is_enabled = true
         AND u.provider_user_id IS NOT NULL
         AND TRIM(u.provider_user_id) <> ''`
    )

    const totalUsers = usersResult.rows.length

    if (totalUsers === 0) {
      addLog(actualJobId, 'info', '📭 No enabled users with a linked media server account')
      completeJob(actualJobId, { success: 0, failed: 0 })
      return { success: 0, failed: 0, jobId: actualJobId, users: [] }
    }

    addLog(actualJobId, 'info', `👥 Reconciling favorites for ${totalUsers} user(s)`)
    setJobStep(actualJobId, 1, 'Syncing favorites with media server', totalUsers)

    let success = 0
    let failed = 0

    for (let i = 0; i < usersResult.rows.length; i++) {
      const user = usersResult.rows[i]
      const displayName = user.display_name || user.username

      try {
        addLog(actualJobId, 'info', `❤️ ${displayName}`)
        const res = await reconcileWatchingFavoritesForUser(user.id, user.provider_user_id)
        users.push({
          userId: user.id,
          displayName,
          skipped: res.skipped,
          reason: res.reason,
        })
        if (res.skipped) {
          addLog(
            actualJobId,
            'debug',
            `  ⏭️ Skipped: ${res.reason ?? 'unknown'}`
          )
        } else {
          addLog(
            actualJobId,
            'info',
            `  ✅ pushed ${res.pushedToServer}, removed from db ${res.removedFromDb}, added to db ${res.pulledIntoDb}, push errors ${res.pushErrors}`
          )
        }
        success++
        updateJobProgress(
          actualJobId,
          success + failed,
          totalUsers,
          `${success + failed}/${totalUsers} users`
        )
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to reconcile watching favorites')
        addLog(actualJobId, 'error', `❌ Failed for ${displayName}: ${errorMsg}`)
        users.push({
          userId: user.id,
          displayName,
          error: errorMsg,
        })
        failed++
        updateJobProgress(
          actualJobId,
          success + failed,
          totalUsers,
          `${success + failed}/${totalUsers} users (${failed} failed)`
        )
      }
    }

    const finalResult = { success, failed, jobId: actualJobId, users }

    if (failed > 0) {
      addLog(
        actualJobId,
        'warn',
        `⚠️ Completed with ${failed} failure(s): ${success} succeeded, ${failed} failed`
      )
    } else {
      addLog(actualJobId, 'info', `🎉 Watching favorites sync complete for ${success} user(s)`)
    }

    completeJob(actualJobId, finalResult)
    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'Failed to run watching favorites sync job')
    failJob(actualJobId, error)
    throw err
  }
}
