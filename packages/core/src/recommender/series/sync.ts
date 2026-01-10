import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getEnabledTvLibraryIds } from '../../lib/libraryConfig.js'
import { getMediaServerProvider } from '../../media/index.js'
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
 * Sync all series and episodes from the media server to the database
 */
export async function syncSeries(existingJobId?: string): Promise<SyncSeriesResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'sync-series', 4)

  try {
    const provider = await getMediaServerProvider()
    const apiKey = process.env.MEDIA_SERVER_API_KEY

    if (!apiKey) {
      throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
    }

    // Step 1: Connect to media server and check library config
    setJobStep(jobId, 0, 'Connecting to media server')
    const serverType = process.env.MEDIA_SERVER_TYPE || 'emby'
    const serverUrl = process.env.MEDIA_SERVER_BASE_URL || 'Not configured'

    addLog(jobId, 'info', `🔌 Connecting to ${serverType.toUpperCase()} server...`)
    addLog(jobId, 'info', `📡 Server URL: ${serverUrl}`)

    // Get enabled TV library IDs from config
    const enabledLibraryIds = await getEnabledTvLibraryIds()

    if (enabledLibraryIds !== null && enabledLibraryIds.length === 0) {
      addLog(jobId, 'warn', '⚠️ No TV libraries enabled for sync!')
      addLog(jobId, 'info', '💡 Enable TV libraries in Settings → Library Configuration')
      completeJob(jobId, { seriesAdded: 0, seriesUpdated: 0, episodesAdded: 0, episodesUpdated: 0, totalSeries: 0, totalEpisodes: 0 })
      return { seriesAdded: 0, seriesUpdated: 0, episodesAdded: 0, episodesUpdated: 0, totalSeries: 0, totalEpisodes: 0, jobId }
    }

    const librariesToSync = enabledLibraryIds ?? []

    if (librariesToSync.length > 0) {
      addLog(jobId, 'info', `📚 Syncing from ${librariesToSync.length} selected TV library/libraries`)
    } else {
      addLog(jobId, 'info', '📚 Syncing from ALL TV libraries (no filter configured)')
    }

    // Step 2: Fetch series count
    setJobStep(jobId, 1, 'Fetching series list')
    addLog(jobId, 'info', '📋 Querying media server for TV libraries...')

    let totalSeries = 0
    if (librariesToSync.length > 0) {
      for (const libId of librariesToSync) {
        const countResult = await provider.getSeries(apiKey, {
          startIndex: 0,
          limit: 1,
          parentIds: [libId],
        })
        totalSeries += countResult.totalRecordCount
        addLog(jobId, 'debug', `Library ${libId}: ${countResult.totalRecordCount} series`)
      }
    } else {
      const countResult = await provider.getSeries(apiKey, {
        startIndex: 0,
        limit: 1,
      })
      totalSeries = countResult.totalRecordCount
    }

    addLog(jobId, 'info', `📺 Found ${totalSeries} series in selected libraries`)

    if (totalSeries === 0) {
      addLog(jobId, 'warn', '⚠️ No series found in media server library!')
      completeJob(jobId, { seriesAdded: 0, seriesUpdated: 0, episodesAdded: 0, episodesUpdated: 0, totalSeries: 0, totalEpisodes: 0 })
      return { seriesAdded: 0, seriesUpdated: 0, episodesAdded: 0, episodesUpdated: 0, totalSeries: 0, totalEpisodes: 0, jobId }
    }

    let seriesAdded = 0
    let seriesUpdated = 0
    let episodesAdded = 0
    let episodesUpdated = 0
    let processedSeries = 0
    let processedEpisodes = 0
    const pageSize = 100

    // Step 3: Process series
    setJobStep(jobId, 2, 'Processing series', totalSeries)

    const syncSeriesFromLibrary = async (libraryId: string | null) => {
      let startIndex = 0

      while (true) {
        const result = await provider.getSeries(apiKey, {
          startIndex,
          limit: pageSize,
          parentIds: libraryId ? [libraryId] : undefined,
        })

        if (result.items.length === 0) {
          break
        }

        for (const series of result.items) {
          processedSeries++
          updateJobProgress(jobId, processedSeries, totalSeries, `${series.name} (${series.year || 'N/A'})`)

          try {
            const existing = await queryOne<{ id: string }>(
              'SELECT id FROM series WHERE provider_item_id = $1',
              [series.id]
            )

            const posterUrl = series.posterImageTag
              ? provider.getPosterUrl(series.id, series.posterImageTag)
              : null
            const backdropUrl = series.backdropImageTag
              ? provider.getBackdropUrl(series.id, series.backdropImageTag)
              : null

            const libraryIdToStore = libraryId

            if (existing) {
              // Update existing series
              await query(
                `UPDATE series SET
                  title = $2,
                  original_title = $3,
                  sort_title = $4,
                  year = $5,
                  end_year = $6,
                  genres = $7,
                  overview = $8,
                  tagline = $9,
                  community_rating = $10,
                  critic_rating = $11,
                  content_rating = $12,
                  status = $13,
                  total_seasons = $14,
                  total_episodes = $15,
                  air_days = $16,
                  network = $17,
                  studios = $18,
                  directors = $19,
                  writers = $20,
                  actors = $21,
                  imdb_id = $22,
                  tmdb_id = $23,
                  tvdb_id = $24,
                  tags = $25,
                  production_countries = $26,
                  awards = $27,
                  poster_url = $28,
                  backdrop_url = $29,
                  provider_library_id = $30,
                  updated_at = NOW()
                WHERE id = $1`,
                [
                  existing.id,
                  series.name,
                  series.originalTitle,
                  series.sortName,
                  series.year,
                  series.endYear,
                  series.genres,
                  series.overview,
                  series.tagline,
                  series.communityRating,
                  series.criticRating,
                  series.contentRating,
                  series.status,
                  series.totalSeasons,
                  series.totalEpisodes,
                  series.airDays || [],
                  series.network,
                  JSON.stringify(series.studios || []),
                  series.directors || [],
                  series.writers || [],
                  JSON.stringify(series.actors || []),
                  series.imdbId,
                  series.tmdbId,
                  series.tvdbId,
                  series.tags || [],
                  series.productionCountries || [],
                  series.awards,
                  posterUrl,
                  backdropUrl,
                  libraryIdToStore,
                ]
              )
              seriesUpdated++
            } else {
              // Insert new series
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
                  series.id,
                  series.name,
                  series.originalTitle,
                  series.sortName,
                  series.year,
                  series.endYear,
                  series.genres,
                  series.overview,
                  series.tagline,
                  series.communityRating,
                  series.criticRating,
                  series.contentRating,
                  series.status,
                  series.totalSeasons,
                  series.totalEpisodes,
                  series.airDays || [],
                  series.network,
                  JSON.stringify(series.studios || []),
                  series.directors || [],
                  series.writers || [],
                  JSON.stringify(series.actors || []),
                  series.imdbId,
                  series.tmdbId,
                  series.tvdbId,
                  series.tags || [],
                  series.productionCountries || [],
                  series.awards,
                  posterUrl,
                  backdropUrl,
                  libraryIdToStore,
                ]
              )
              seriesAdded++
              addLog(jobId, 'info', `➕ Added series: ${series.name} (${series.year || 'N/A'})`)
            }

            if (processedSeries % 25 === 0) {
              addLog(
                jobId,
                'info',
                `📊 Series progress: ${processedSeries}/${totalSeries} (${seriesAdded} new, ${seriesUpdated} updated)`
              )
            }
          } catch (seriesErr) {
            const seriesError = seriesErr instanceof Error ? seriesErr.message : 'Unknown error'
            addLog(
              jobId,
              'error',
              `❌ Failed to sync series: ${series.name} (${series.year || 'N/A'})`,
              { error: seriesError }
            )
            logger.error({ err: seriesErr, series: series.name }, 'Failed to sync series')
          }
        }

        if (startIndex + result.items.length >= result.totalRecordCount) {
          break
        }

        startIndex += pageSize
      }
    }

    // Sync series from each library
    if (librariesToSync.length > 0) {
      for (const libraryId of librariesToSync) {
        addLog(jobId, 'info', `📂 Syncing series from library: ${libraryId}`)
        await syncSeriesFromLibrary(libraryId)
      }
    } else {
      await syncSeriesFromLibrary(null)
    }

    // Step 4: Process episodes
    setJobStep(jobId, 3, 'Processing episodes')
    addLog(jobId, 'info', '📺 Syncing episodes...')

    // Get all series from our database to sync episodes for
    const allSeries = await query<{ id: string; provider_item_id: string; title: string }>(
      'SELECT id, provider_item_id, title FROM series'
    )

    const providerToDbSeriesId = new Map<string, string>()
    for (const s of allSeries.rows) {
      providerToDbSeriesId.set(s.provider_item_id, s.id)
    }

    // Get total episode count
    let totalEpisodes = 0
    if (librariesToSync.length > 0) {
      for (const libId of librariesToSync) {
        const countResult = await provider.getEpisodes(apiKey, {
          startIndex: 0,
          limit: 1,
          parentIds: [libId],
        })
        totalEpisodes += countResult.totalRecordCount
      }
    } else {
      const countResult = await provider.getEpisodes(apiKey, {
        startIndex: 0,
        limit: 1,
      })
      totalEpisodes = countResult.totalRecordCount
    }

    addLog(jobId, 'info', `📺 Found ${totalEpisodes} episodes to sync`)
    updateJobProgress(jobId, 0, totalEpisodes)

    const syncEpisodesFromLibrary = async (libraryId: string | null) => {
      let startIndex = 0

      while (true) {
        const result = await provider.getEpisodes(apiKey, {
          startIndex,
          limit: pageSize,
          parentIds: libraryId ? [libraryId] : undefined,
        })

        if (result.items.length === 0) {
          break
        }

        for (const episode of result.items) {
          processedEpisodes++
          
          // Skip Aperture sorting placeholder episodes (used for Emby home row sorting)
          if (episode.name === 'Aperture Sorting Placeholder' || 
              (episode.seasonNumber === 0 && episode.episodeNumber === 0 && episode.name?.includes('Aperture'))) {
            continue
          }
          
          if (processedEpisodes % 100 === 0) {
            updateJobProgress(jobId, processedEpisodes, totalEpisodes, `S${episode.seasonNumber}E${episode.episodeNumber}`)
          }

          try {
            // Find the series ID in our database
            const seriesDbId = providerToDbSeriesId.get(episode.seriesId)
            if (!seriesDbId) {
              // Series not synced yet, skip this episode
              continue
            }

            const existing = await queryOne<{ id: string }>(
              'SELECT id FROM episodes WHERE provider_item_id = $1',
              [episode.id]
            )

            const posterUrl = episode.posterImageTag
              ? provider.getPosterUrl(episode.id, episode.posterImageTag)
              : null

            const runtimeMinutes = episode.runtimeTicks
              ? Math.round(episode.runtimeTicks / 600000000)
              : null

            if (existing) {
              // Update existing episode
              await query(
                `UPDATE episodes SET
                  series_id = $2,
                  season_number = $3,
                  episode_number = $4,
                  title = $5,
                  overview = $6,
                  premiere_date = $7,
                  year = $8,
                  runtime_minutes = $9,
                  community_rating = $10,
                  directors = $11,
                  writers = $12,
                  guest_stars = $13,
                  path = $14,
                  media_sources = $15,
                  poster_url = $16,
                  updated_at = NOW()
                WHERE id = $1`,
                [
                  existing.id,
                  seriesDbId,
                  episode.seasonNumber,
                  episode.episodeNumber,
                  episode.name,
                  episode.overview,
                  episode.premiereDate ? episode.premiereDate.split('T')[0] : null,
                  episode.year,
                  runtimeMinutes,
                  episode.communityRating,
                  episode.directors || [],
                  episode.writers || [],
                  JSON.stringify(episode.guestStars || []),
                  episode.path,
                  JSON.stringify(episode.mediaSources || []),
                  posterUrl,
                ]
              )
              episodesUpdated++
            } else {
              // Insert new episode
              await query(
                `INSERT INTO episodes (
                  provider_item_id, series_id, season_number, episode_number, title,
                  overview, premiere_date, year, runtime_minutes, community_rating,
                  directors, writers, guest_stars, path, media_sources, poster_url
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                )
                ON CONFLICT (series_id, season_number, episode_number) DO UPDATE SET
                  provider_item_id = EXCLUDED.provider_item_id,
                  title = EXCLUDED.title,
                  overview = EXCLUDED.overview,
                  premiere_date = EXCLUDED.premiere_date,
                  year = EXCLUDED.year,
                  runtime_minutes = EXCLUDED.runtime_minutes,
                  community_rating = EXCLUDED.community_rating,
                  directors = EXCLUDED.directors,
                  writers = EXCLUDED.writers,
                  guest_stars = EXCLUDED.guest_stars,
                  path = EXCLUDED.path,
                  media_sources = EXCLUDED.media_sources,
                  poster_url = EXCLUDED.poster_url,
                  updated_at = NOW()`,
                [
                  episode.id,
                  seriesDbId,
                  episode.seasonNumber,
                  episode.episodeNumber,
                  episode.name,
                  episode.overview,
                  episode.premiereDate ? episode.premiereDate.split('T')[0] : null,
                  episode.year,
                  runtimeMinutes,
                  episode.communityRating,
                  episode.directors || [],
                  episode.writers || [],
                  JSON.stringify(episode.guestStars || []),
                  episode.path,
                  JSON.stringify(episode.mediaSources || []),
                  posterUrl,
                ]
              )
              episodesAdded++
            }

            if (processedEpisodes % 500 === 0) {
              addLog(
                jobId,
                'info',
                `📊 Episodes progress: ${processedEpisodes}/${totalEpisodes} (${episodesAdded} new, ${episodesUpdated} updated)`
              )
            }
          } catch (episodeErr) {
            const episodeError = episodeErr instanceof Error ? episodeErr.message : 'Unknown error'
            logger.error({ err: episodeErr, episode: episode.name }, 'Failed to sync episode')
            // Continue with next episode
          }
        }

        if (startIndex + result.items.length >= result.totalRecordCount) {
          break
        }

        startIndex += pageSize
      }
    }

    // Sync episodes from each library
    if (librariesToSync.length > 0) {
      for (const libraryId of librariesToSync) {
        addLog(jobId, 'info', `📂 Syncing episodes from library: ${libraryId}`)
        await syncEpisodesFromLibrary(libraryId)
      }
    } else {
      await syncEpisodesFromLibrary(null)
    }

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
      `🎉 Sync complete: ${seriesAdded} new series, ${seriesUpdated} updated | ${episodesAdded} new episodes, ${episodesUpdated} updated`
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
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
  }

  // Get user's last sync time for delta sync
  const userRecord = await queryOne<{ series_watch_history_synced_at: Date | null }>(
    'SELECT series_watch_history_synced_at FROM users WHERE id = $1',
    [userId]
  )
  
  const sinceDate = fullSync ? undefined : userRecord?.series_watch_history_synced_at || undefined

  logger.info({ userId, providerUserId, deltaSync: !!sinceDate, fullSync }, 'Syncing series watch history')

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
        logger.debug({ userId, episodeId: existingEpisodeId }, 'Removed stale episode watch history entry')
      }
    }
  }

  // Update user's last sync timestamp
  await query('UPDATE users SET series_watch_history_synced_at = NOW() WHERE id = $1', [userId])

  logger.info({ userId, synced, removed, deltaSync: !fullSync }, 'Series watch history sync completed')
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
    const apiKey = process.env.MEDIA_SERVER_API_KEY

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
    const existingProviderIds = new Set(existingUsers.rows.map(u => u.provider_user_id))

    // Import any missing users
    const providerType = process.env.MEDIA_SERVER_TYPE || 'emby'
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
        const syncResult = await syncSeriesWatchHistoryForUser(user.id, user.provider_user_id, fullSync)
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

