/**
 * Remove Aperture AI recommendation virtual libraries from the media server,
 * delete output folders on disk, and clear strm_libraries rows.
 */

import fs from 'fs/promises'
import path from 'path'
import { query, queryOne } from '../lib/db.js'
import { createChildLogger } from '../lib/logger.js'
import { getMediaServerProvider } from '../media/index.js'
import { getAiRecsOutputConfig, getMediaServerApiKey } from '../settings/systemSettings.js'
import { cleanupEmbyRecommendationPlaylists } from './embyPlaylists.js'
import { getConfig } from './config.js'
import { getUserFolderName } from './filenames.js'
import { addLog } from '../jobs/progress.js'

const logger = createChildLogger('strm-cleanup')

export type StrmLibraryMediaType = 'movies' | 'series'

interface StrmLibraryRow {
  id: string
  name: string
  media_type: string
  series_group_id: string | null
  provider_library_id: string | null
}

interface UserForCleanup {
  id: string
  provider_user_id: string
  display_name: string | null
  username: string
}

/**
 * Remove STRM library records for a user: delete virtual library in Emby/Jellyfin,
 * remove local output directory, delete DB rows.
 *
 * @param mediaType - If set, only removes that library type; otherwise removes both AI library types when present.
 */
export async function cleanupUserLibraries(
  userId: string,
  mediaType?: StrmLibraryMediaType
): Promise<void> {
  const user = await queryOne<UserForCleanup>(
    `SELECT id, provider_user_id, display_name, username FROM users WHERE id = $1`,
    [userId]
  )
  if (!user) {
    logger.warn({ userId }, 'cleanupUserLibraries: user not found')
    return
  }

  await cleanupEmbyRecommendationPlaylists(userId, mediaType)

  const sql = `SELECT id, name, media_type, series_group_id, provider_library_id FROM strm_libraries
     WHERE user_id = $1
     AND (
       ($2::text IS NULL AND (
         (channel_id IS NULL AND media_type = 'movies') OR media_type = 'series'
       ))
       OR ($2 = 'movies' AND channel_id IS NULL AND media_type = 'movies')
       OR ($2 = 'series' AND media_type = 'series')
     )`
  const params: unknown[] = [userId, mediaType ?? null]

  const result = await query<StrmLibraryRow>(sql, params)
  if (result.rows.length === 0) {
    return
  }

  await removeStrmLibraryRecords(user, result.rows)
}

export async function cleanupRetiredSeriesOutputs(
  user: UserForCleanup,
  activeGroupIds: Array<string | null>
): Promise<void> {
  const { rows } = await query<StrmLibraryRow>(
    "SELECT id, name, media_type, series_group_id, provider_library_id FROM strm_libraries WHERE user_id = $1 AND media_type = 'series'",
    [user.id]
  )
  const retired = rows.filter((row) => !activeGroupIds.includes(row.series_group_id))
  if (retired.length > 0) await removeStrmLibraryRecords(user, retired)
}

async function removeStrmLibraryRecords(
  user: UserForCleanup,
  rows: StrmLibraryRow[]
): Promise<void> {
  const displayName = user.display_name || user.username
  const config = await getConfig()
  const userFolder = getUserFolderName(displayName, user.provider_user_id)
  const touchedMovies = rows.some((r) => r.media_type === 'movies')

  if (touchedMovies) {
    const localMovies = path.join(config.strmRoot, 'aperture', userFolder)
    try {
      await fs.rm(localMovies, { recursive: true, force: true })
      logger.info({ path: localMovies }, 'Removed local movie STRM directory')
    } catch (err) {
      logger.warn({ err, path: localMovies }, 'cleanup: failed to remove movie output directory')
    }
  }
  for (const row of rows.filter((record) => record.media_type === 'series')) {
    const folder = row.series_group_id ? `${user.id}-group-${row.series_group_id}` : userFolder
    const localSeries = path.join(config.strmRoot, 'aperture-tv', folder)
    try {
      await fs.rm(localSeries, { recursive: true, force: true })
      logger.info({ path: localSeries }, 'Removed local series STRM directory')
    } catch (err) {
      logger.error({ err, path: localSeries }, 'cleanup: failed to remove series output directory')
      throw err
    }
  }

  const apiKey = await getMediaServerApiKey()
  const ids: string[] = []
  if (apiKey) {
    const provider = await getMediaServerProvider()
    const libraries = await provider.getLibraries(apiKey)
    for (const row of rows) {
      try {
        const library = libraries.find((lib) => lib.id === row.provider_library_id)
        if (library) await provider.deleteVirtualLibrary(apiKey, library.name)
        ids.push(row.id)
      } catch (err) {
        logger.warn({ err, userId: user.id, name: row.name }, 'Could not delete virtual library; will retry cleanup')
      }
    }
  }
  if (ids.length > 0) {
    await query('DELETE FROM strm_libraries WHERE id = ANY($1::uuid[])', [ids])
  }
}

/**
 * Remove AI STRM libraries for users who are disabled or have recommendations off,
 * but still have strm_libraries rows (e.g. toggle happened while API was down).
 */
export async function reconcileStaleStrmLibraries(jobId?: string): Promise<void> {
  const log = (level: 'info' | 'warn' | 'error', message: string) => {
    if (jobId) {
      addLog(jobId, level, message)
    }
    if (level === 'error') logger.error({ msg: message })
    else if (level === 'warn') logger.warn({ msg: message })
    else logger.info({ msg: message })
  }

  type StaleRow = StrmLibraryRow & {
    user_id: string
    provider_user_id: string
    display_name: string | null
    username: string
  }

  await cleanupEmbyRecommendationPlaylists()
  const output = await getAiRecsOutputConfig()
  const result = await query<StaleRow>(
    `SELECT sl.id, sl.name, sl.media_type, sl.series_group_id, sl.provider_library_id, sl.user_id,
            u.provider_user_id, u.display_name, u.username
     FROM strm_libraries sl
     JOIN users u ON u.id = sl.user_id
     WHERE sl.user_id IS NOT NULL
     AND (
       (sl.media_type = 'movies' AND sl.channel_id IS NULL AND (
         u.provider_disabled OR NOT u.is_enabled OR NOT u.movies_enabled OR $1
       ))
       OR
       (sl.media_type = 'series' AND (
         u.provider_disabled OR NOT u.is_enabled OR NOT u.series_enabled OR $2
       ))
     )`,
    [output.moviesOutputMode !== 'library', output.seriesOutputMode !== 'library']
  )

  if (result.rows.length === 0) {
    log('info', 'Reconcile: no stale STRM libraries found')
    return
  }

  log('info', `Reconcile: cleaning ${result.rows.length} stale STRM library record(s)`)

  const byUser = new Map<
    string,
    { user: UserForCleanup; rows: StrmLibraryRow[] }
  >()

  for (const row of result.rows) {
    const key = row.user_id
    let entry = byUser.get(key)
    if (!entry) {
      entry = {
        user: {
          id: row.user_id,
          provider_user_id: row.provider_user_id,
          display_name: row.display_name,
          username: row.username,
        },
        rows: [],
      }
      byUser.set(key, entry)
    }
    entry.rows.push(row)
  }

  for (const { user, rows } of byUser.values()) {
    try {
      await removeStrmLibraryRecords(user, rows)
    } catch (err) {
      logger.error({ err, userId: user.id }, 'reconcile: failed to clean user libraries')
      log('error', `Reconcile failed for user ${user.username}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
