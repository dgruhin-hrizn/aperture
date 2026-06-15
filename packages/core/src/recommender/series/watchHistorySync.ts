import { createChildLogger } from '../../lib/logger.js'
import { mergeWatchHistorySyncRow } from '../watchHistorySyncRows.js'
import { query, queryOne } from '../../lib/db.js'
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

const logger = createChildLogger('sync-series')

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

  // Get user's excluded library IDs
  const { getUserExcludedLibraries } = await import('../../lib/libraryExclusions.js')
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  const excludedSet = new Set(excludedLibraryIds)

  // Get all series and episodes we have in our database
  const [allSeries, allEpisodes] = await Promise.all([
    query<{
      id: string
      provider_item_id: string
      provider_library_id: string | null
      tmdb_id: string | null
      imdb_id: string | null
      tvdb_id: string | null
    }>(
      'SELECT id, provider_item_id, provider_library_id, tmdb_id, imdb_id, tvdb_id FROM series WHERE provider_item_id IS NOT NULL'
    ),
    query<{
      id: string
      provider_item_id: string
      series_id: string
      season_number: number
      episode_number: number
      provider_library_id: string | null
      runtime_minutes: number | null
    }>(
      `SELECT e.id, e.provider_item_id, e.series_id, e.season_number, e.episode_number, e.runtime_minutes, s.provider_library_id
       FROM episodes e
       JOIN series s ON e.series_id = s.id
       WHERE e.provider_item_id IS NOT NULL`
    ),
  ])

  const providerSeriesIdToDbId = new Map<string, string>()
  const tmdbIdToSeriesId = new Map<string, string>()
  const imdbIdToSeriesId = new Map<string, string>()
  const tvdbIdToSeriesId = new Map<string, string>()
  for (const series of allSeries.rows) {
    providerSeriesIdToDbId.set(series.provider_item_id, series.id)
    if (series.tmdb_id) tmdbIdToSeriesId.set(series.tmdb_id, series.id)
    if (series.imdb_id) imdbIdToSeriesId.set(series.imdb_id, series.id)
    if (series.tvdb_id) tvdbIdToSeriesId.set(series.tvdb_id, series.id)
  }

  const providerIdToEpisodeId = new Map<string, string>()
  const episodeKeyToId = new Map<string, string>()
  const episodeIdToLibraryId = new Map<string, string | null>()
  const episodeIdToRuntimeTicks = new Map<string, number>()
  for (const episode of allEpisodes.rows) {
    providerIdToEpisodeId.set(episode.provider_item_id, episode.id)
    episodeKeyToId.set(
      `${episode.series_id}:${episode.season_number}:${episode.episode_number}`,
      episode.id
    )
    episodeIdToLibraryId.set(episode.id, episode.provider_library_id)
    if (episode.runtime_minutes) {
      episodeIdToRuntimeTicks.set(episode.id, episode.runtime_minutes * 600000000)
    }
  }

  const resolveEpisodeId = (item: (typeof watchedEpisodes)[number]): string | undefined => {
    const byProviderId = providerIdToEpisodeId.get(item.episodeId)
    if (byProviderId) return byProviderId

    let seriesDbId = providerSeriesIdToDbId.get(item.seriesId)
    if (!seriesDbId && item.tmdbId) seriesDbId = tmdbIdToSeriesId.get(item.tmdbId)
    if (!seriesDbId && item.imdbId) seriesDbId = imdbIdToSeriesId.get(item.imdbId)
    if (!seriesDbId && item.tvdbId) seriesDbId = tvdbIdToSeriesId.get(item.tvdbId)

    if (
      seriesDbId &&
      item.seasonNumber != null &&
      item.episodeNumber != null
    ) {
      return episodeKeyToId.get(`${seriesDbId}:${item.seasonNumber}:${item.episodeNumber}`)
    }

    return undefined
  }

  // Get current episode watch history for this user
  const existingHistory = await query<{ episode_id: string }>(
    "SELECT episode_id FROM watch_history WHERE user_id = $1 AND media_type = 'episode'",
    [userId]
  )
  const existingEpisodeIds = new Set(existingHistory.rows.map((r) => r.episode_id))

  // Prepare bulk data - filter to items we have in our database and not excluded
  const toSyncMap = new Map<
    string,
    {
      episodeId: string
      playCount: number
      lastPlayedAt: Date | null
      isFavorite: boolean
      played: boolean
      playbackPositionTicks: number | null
      runtimeTicks: number | null
    }
  >()

  let excludedCount = 0
  let fallbackMappedCount = 0
  for (const item of watchedEpisodes) {
    const episodeId = resolveEpisodeId(item)
    if (episodeId) {
      if (!providerIdToEpisodeId.has(item.episodeId)) {
        fallbackMappedCount++
      }
      const libraryId = episodeIdToLibraryId.get(episodeId)
      if (libraryId && excludedSet.has(libraryId)) {
        excludedCount++
        continue
      }

      const row = {
        episodeId,
        playCount: item.playCount,
        lastPlayedAt: item.lastPlayedDate ? new Date(item.lastPlayedDate) : null,
        isFavorite: item.isFavorite,
        played: item.played ?? false,
        playbackPositionTicks: item.playbackPositionTicks ?? null,
        runtimeTicks: item.runtimeTicks ?? episodeIdToRuntimeTicks.get(episodeId) ?? null,
      }
      const existing = toSyncMap.get(episodeId)
      toSyncMap.set(
        episodeId,
        existing ? { episodeId, ...mergeWatchHistorySyncRow(existing, row) } : row
      )
    }
  }

  const toSync = [...toSyncMap.values()]

  if (excludedCount > 0) {
    logger.debug({ userId, excludedCount }, 'Excluded episode watch history items from excluded libraries')
  }
  if (fallbackMappedCount > 0) {
    logger.debug({ userId, fallbackMappedCount }, 'Mapped episode watch history via series/season fallback')
  }

  const syncedEpisodeIds = new Set<string>(toSync.map((t) => t.episodeId))
  let synced = 0

  // Bulk upsert watch history using unnest()
  if (toSync.length > 0) {
    const result = await query(
      `INSERT INTO watch_history (user_id, episode_id, media_type, play_count, last_played_at, is_favorite, played, playback_position_ticks, runtime_ticks)
       SELECT $1, episode_id, 'episode', play_count, last_played_at, is_favorite, played, playback_position_ticks, runtime_ticks
       FROM unnest($2::uuid[], $3::int[], $4::timestamptz[], $5::boolean[], $6::boolean[], $7::bigint[], $8::bigint[])
         AS t(episode_id, play_count, last_played_at, is_favorite, played, playback_position_ticks, runtime_ticks)
       ON CONFLICT (user_id, episode_id) WHERE episode_id IS NOT NULL DO UPDATE SET
         play_count = EXCLUDED.play_count,
         last_played_at = EXCLUDED.last_played_at,
         is_favorite = EXCLUDED.is_favorite,
         played = EXCLUDED.played,
         playback_position_ticks = EXCLUDED.playback_position_ticks,
         runtime_ticks = EXCLUDED.runtime_ticks,
         updated_at = NOW()`,
      [
        userId,
        toSync.map((t) => t.episodeId),
        toSync.map((t) => t.playCount),
        toSync.map((t) => t.lastPlayedAt),
        toSync.map((t) => t.isFavorite),
        toSync.map((t) => t.played),
        toSync.map((t) => t.playbackPositionTicks),
        toSync.map((t) => t.runtimeTicks),
      ]
    )
    synced = result.rowCount || toSync.length
  }

  // Remove watch history entries no longer present in Emby (played, resume, or favorites)
  // Only do this on full sync (delta sync only adds/updates)
  let removed = 0
  if (fullSync && existingEpisodeIds.size > 0) {
    const toRemove = [...existingEpisodeIds].filter((id) => !syncedEpisodeIds.has(id))
    if (toRemove.length > 0) {
      const deleteResult = await query(
        `DELETE FROM watch_history WHERE user_id = $1 AND episode_id = ANY($2::uuid[]) AND media_type = 'episode'`,
        [userId, toRemove]
      )
      removed = deleteResult.rowCount || toRemove.length
      logger.debug({ userId, removed }, 'Removed stale episode watch history entries')
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
 * Sync series watch history for all users (not just Aperture-enabled)
 * Skips users disabled on the media server (API calls would fail).
 * This is needed for Top Picks which aggregates watch data from all active users.
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
          `INSERT INTO users (username, provider_user_id, provider, is_admin, is_enabled, movies_enabled, series_enabled, email)
           VALUES ($1, $2, $3, $4, false, false, false, $5)`,
          [pu.name, pu.id, providerType, pu.isAdmin || false, pu.email || null]
        )
        imported++
        addLog(jobId, 'info', `➕ Imported user: ${pu.name}`)
      } else if (pu.email) {
        // Update email for existing users if not locked
        await query(
          `UPDATE users SET email = $1, updated_at = NOW() 
           WHERE provider_user_id = $2 AND email_locked = FALSE AND (email IS NULL OR email != $1)`,
          [pu.email, pu.id]
        )
      }
    }

    if (imported > 0) {
      addLog(jobId, 'info', `✅ Imported ${imported} new user(s) from media server`)
    }

    // Step 2: Get users eligible for watch history sync (excludes provider-disabled)
    setJobStep(jobId, 1, 'Finding users')
    const result = await query<{ id: string; provider_user_id: string; username: string }>(
      'SELECT id, provider_user_id, username FROM users WHERE provider_user_id IS NOT NULL AND provider_disabled = false'
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
