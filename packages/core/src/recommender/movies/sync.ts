import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getEnabledLibraryIds } from '../../lib/libraryConfig.js'
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

const logger = createChildLogger('sync')

export interface SyncMoviesResult {
  added: number
  updated: number
  total: number
  jobId: string
}

/**
 * Sync all movies from the media server to the database
 */
export async function syncMovies(existingJobId?: string): Promise<SyncMoviesResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'sync-movies', 3)

  try {
    const provider = getMediaServerProvider()
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
    addLog(
      jobId,
      'info',
      `🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
    )

    // Get enabled library IDs from config
    const enabledLibraryIds = await getEnabledLibraryIds()

    if (enabledLibraryIds !== null && enabledLibraryIds.length === 0) {
      addLog(jobId, 'warn', '⚠️ No libraries enabled for sync!')
      addLog(jobId, 'info', '💡 Enable libraries in Settings → Library Configuration')
      completeJob(jobId, { added: 0, updated: 0, total: 0 })
      return { added: 0, updated: 0, total: 0, jobId }
    }

    // Determine which libraries to sync
    const librariesToSync = enabledLibraryIds ?? []

    if (librariesToSync.length > 0) {
      addLog(jobId, 'info', `📚 Syncing from ${librariesToSync.length} selected library/libraries`)
    } else {
      addLog(jobId, 'info', '📚 Syncing from ALL movie libraries (no filter configured)')
    }

    // Step 2: Fetch movie count
    setJobStep(jobId, 1, 'Fetching movie list')
    addLog(jobId, 'info', '📋 Querying media server for movie library...')
    addLog(jobId, 'debug', 'Making initial API call to get total count...')

    // Get total count - must query each library separately (Emby doesn't support multiple ParentIds)
    let totalMovies = 0
    if (librariesToSync.length > 0) {
      for (const libId of librariesToSync) {
        const countResult = await provider.getMovies(apiKey, {
          startIndex: 0,
          limit: 1,
          parentIds: [libId],
        })
        totalMovies += countResult.totalRecordCount
        addLog(jobId, 'debug', `Library ${libId}: ${countResult.totalRecordCount} movies`)
      }
    } else {
      // No filter - query all
      const countResult = await provider.getMovies(apiKey, {
        startIndex: 0,
        limit: 1,
      })
      totalMovies = countResult.totalRecordCount
    }

    addLog(jobId, 'info', `🎬 Found ${totalMovies} movies in selected libraries`)

    if (totalMovies === 0) {
      addLog(jobId, 'warn', '⚠️ No movies found in media server library!')
      addLog(jobId, 'info', '💡 Check that your MEDIA_SERVER_API_KEY has access to movie libraries')
      completeJob(jobId, { added: 0, updated: 0, total: 0 })
      return { added: 0, updated: 0, total: 0, jobId }
    }
    updateJobProgress(jobId, 0, totalMovies)

    let added = 0
    let updated = 0
    let processed = 0
    const pageSize = 50 // Smaller batches for better progress updates

    // Step 3: Process movies - sync each library separately to track library IDs correctly
    setJobStep(jobId, 2, 'Processing movies', totalMovies)

    // Helper function to sync movies from a specific library
    const syncLibrary = async (libraryId: string | null, _libraryName: string) => {
      let startIndex = 0

      while (true) {
        const result = await provider.getMovies(apiKey, {
          startIndex,
          limit: pageSize,
          parentIds: libraryId ? [libraryId] : undefined,
        })

        if (result.items.length === 0) {
          break
        }

        for (const movie of result.items) {
          processed++
          updateJobProgress(jobId, processed, totalMovies, `${movie.name} (${movie.year || 'N/A'})`)

          try {
            const existing = await queryOne<{ id: string }>(
              'SELECT id FROM movies WHERE provider_item_id = $1',
              [movie.id]
            )

            // Convert runtime from ticks to minutes (Emby/Jellyfin use 10,000,000 ticks per second)
            const runtimeMinutes = movie.runtimeTicks
              ? Math.round(movie.runtimeTicks / 600000000)
              : null

            // Build poster and backdrop URLs
            const posterUrl = movie.posterImageTag
              ? provider.getPosterUrl(movie.id, movie.posterImageTag)
              : null
            const backdropUrl = movie.backdropImageTag
              ? provider.getBackdropUrl(movie.id, movie.backdropImageTag)
              : null

            // Log detailed movie info for first few movies
            if (processed <= 3) {
              addLog(jobId, 'debug', `🔍 Movie details: ${movie.name}`, {
                providerId: movie.id,
                title: movie.name,
                originalTitle: movie.originalTitle,
                year: movie.year,
                genres: movie.genres,
                hasOverview: !!movie.overview,
                overviewLength: movie.overview?.length || 0,
                rating: movie.communityRating,
                runtimeMinutes,
                path: movie.path,
                mediaSources: movie.mediaSources?.length || 0,
                hasPoster: !!posterUrl,
                hasBackdrop: !!backdropUrl,
                libraryId,
              })
            }

            // Use the library ID we're querying from, not the movie's parent folder
            const libraryIdToStore = libraryId

            // Check for existing movie by provider_item_id first
            if (existing) {
              // Update existing movie (same provider item ID) with all metadata
              await query(
                `UPDATE movies SET
                  title = $2,
                  original_title = $3,
                  year = $4,
                  genres = $5,
                  overview = $6,
                  community_rating = $7,
                  critic_rating = $8,
                  runtime_minutes = $9,
                  path = $10,
                  media_sources = $11,
                  poster_url = $12,
                  backdrop_url = $13,
                  provider_library_id = $14,
                  tagline = $15,
                  content_rating = $16,
                  premiere_date = $17,
                  studios = $18,
                  directors = $19,
                  writers = $20,
                  actors = $21,
                  imdb_id = $22,
                  tmdb_id = $23,
                  tags = $24,
                  sort_title = $25,
                  production_countries = $26,
                  awards = $27,
                  video_resolution = $28,
                  video_codec = $29,
                  audio_codec = $30,
                  container = $31,
                  updated_at = NOW()
                 WHERE id = $1`,
                [
                  existing.id,
                  movie.name,
                  movie.originalTitle,
                  movie.year,
                  movie.genres,
                  movie.overview,
                  movie.communityRating,
                  movie.criticRating,
                  runtimeMinutes,
                  movie.path,
                  JSON.stringify(movie.mediaSources || []),
                  posterUrl,
                  backdropUrl,
                  libraryIdToStore,
                  movie.tagline,
                  movie.contentRating,
                  movie.premiereDate ? movie.premiereDate.split('T')[0] : null,
                  JSON.stringify(movie.studios || []),
                  movie.directors || [],
                  movie.writers || [],
                  JSON.stringify(movie.actors || []),
                  movie.imdbId,
                  movie.tmdbId,
                  movie.tags || [],
                  movie.sortName,
                  movie.productionCountries || [],
                  movie.awards,
                  movie.videoResolution,
                  movie.videoCodec,
                  movie.audioCodec,
                  movie.container,
                ]
              )
              updated++
            } else {
              // Check for duplicate by title + year (different provider item ID but same movie)
              // This handles cases where Emby has multiple versions (4K, 1080p, etc.) of the same movie
              const duplicateByTitleYear = await queryOne<{ id: string; provider_item_id: string }>(
                'SELECT id, provider_item_id FROM movies WHERE LOWER(title) = LOWER($1) AND year = $2',
                [movie.name, movie.year]
              )

              if (duplicateByTitleYear) {
                // Skip - we already have this movie (different version)
                if (processed <= 10 || processed % 100 === 0) {
                  addLog(
                    jobId,
                    'debug',
                    `⏭️ Skipping duplicate version: ${movie.name} (${movie.year || 'N/A'})`,
                    {
                      existingProviderId: duplicateByTitleYear.provider_item_id,
                      skippedProviderId: movie.id,
                    }
                  )
                }
                // Don't count as added or updated - just skip
              } else {
                // Insert new movie with all metadata
                await query(
                  `INSERT INTO movies (
                    provider_item_id, title, original_title, year, genres, overview,
                    community_rating, critic_rating, runtime_minutes, path, media_sources,
                    poster_url, backdrop_url, provider_library_id,
                    tagline, content_rating, premiere_date, studios, directors, writers,
                    actors, imdb_id, tmdb_id, tags, sort_title, production_countries,
                    awards, video_resolution, video_codec, audio_codec, container
                  ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                    $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
                    $27, $28, $29, $30, $31
                  )`,
                  [
                    movie.id,
                    movie.name,
                    movie.originalTitle,
                    movie.year,
                    movie.genres,
                    movie.overview,
                    movie.communityRating,
                    movie.criticRating,
                    runtimeMinutes,
                    movie.path,
                    JSON.stringify(movie.mediaSources || []),
                    posterUrl,
                    backdropUrl,
                    libraryIdToStore,
                    movie.tagline,
                    movie.contentRating,
                    movie.premiereDate ? movie.premiereDate.split('T')[0] : null,
                    JSON.stringify(movie.studios || []),
                    movie.directors || [],
                    movie.writers || [],
                    JSON.stringify(movie.actors || []),
                    movie.imdbId,
                    movie.tmdbId,
                    movie.tags || [],
                    movie.sortName,
                    movie.productionCountries || [],
                    movie.awards,
                    movie.videoResolution,
                    movie.videoCodec,
                    movie.audioCodec,
                    movie.container,
                  ]
                )
                added++
                addLog(jobId, 'info', `➕ Added: ${movie.name} (${movie.year || 'N/A'})`, {
                  genres: movie.genres,
                  rating: movie.communityRating,
                  runtime: runtimeMinutes ? `${runtimeMinutes}m` : 'N/A',
                })
              }
            }

            // Log progress every 25 movies
            if (processed % 25 === 0) {
              addLog(
                jobId,
                'info',
                `📊 Progress: ${processed}/${totalMovies} movies (${added} new, ${updated} updated)`
              )
            }
          } catch (movieErr) {
            const movieError = movieErr instanceof Error ? movieErr.message : 'Unknown error'
            addLog(
              jobId,
              'error',
              `❌ Failed to sync movie: ${movie.name} (${movie.year || 'N/A'})`,
              {
                error: movieError,
                movieId: movie.id,
                title: movie.name,
                year: movie.year,
                communityRating: movie.communityRating,
                criticRating: movie.criticRating,
                runtimeTicks: movie.runtimeTicks,
              }
            )
            // Continue with next movie instead of failing entire job
            logger.error({ err: movieErr, movie: movie.name }, 'Failed to sync individual movie')
          }
        }

        if (startIndex + result.items.length >= result.totalRecordCount) {
          break
        }

        startIndex += pageSize
      }
    }

    // Sync each library separately to properly track library IDs
    if (librariesToSync.length > 0) {
      for (const libraryId of librariesToSync) {
        addLog(jobId, 'info', `📂 Syncing library: ${libraryId}`)
        await syncLibrary(libraryId, libraryId)
      }
    } else {
      // No filter - sync all (library ID will be null)
      await syncLibrary(null, 'All Libraries')
    }

    const finalResult = { added, updated, total: processed, jobId }
    completeJob(jobId, finalResult)

    addLog(
      jobId,
      'info',
      `🎉 Sync complete: ${added} new movies, ${updated} updated, ${processed} total`
    )

    return finalResult
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    failJob(jobId, error)
    throw err
  }
}

/**
 * Sync watch history for a specific user
 * @param fullSync - If true, performs a full sync regardless of last sync time
 */
export async function syncWatchHistoryForUser(
  userId: string,
  providerUserId: string,
  fullSync: boolean = false
): Promise<{ synced: number; removed: number }> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
  }

  // Get user's last sync time for delta sync
  const userRecord = await queryOne<{ watch_history_synced_at: Date | null }>(
    'SELECT watch_history_synced_at FROM users WHERE id = $1',
    [userId]
  )
  
  const sinceDate = fullSync ? undefined : userRecord?.watch_history_synced_at || undefined

  logger.info({ userId, providerUserId, deltaSync: !!sinceDate, fullSync }, 'Syncing watch history')

  const watchedItems = await provider.getWatchHistory(apiKey, providerUserId, sinceDate)

  // Get all movies we have in our database with their provider IDs
  const allMovies = await query<{ id: string; provider_item_id: string }>(
    'SELECT id, provider_item_id FROM movies WHERE provider_item_id IS NOT NULL'
  )

  const providerIdToMovieId = new Map<string, string>()
  for (const movie of allMovies.rows) {
    providerIdToMovieId.set(movie.provider_item_id, movie.id)
  }

  // Get current watch history for this user
  const existingHistory = await query<{ movie_id: string }>(
    'SELECT movie_id FROM watch_history WHERE user_id = $1',
    [userId]
  )
  const existingMovieIds = new Set(existingHistory.rows.map((r) => r.movie_id))

  let synced = 0
  const syncedMovieIds = new Set<string>()

  for (const item of watchedItems) {
    const movieId = providerIdToMovieId.get(item.movieId)

    if (!movieId) {
      logger.debug({ providerItemId: item.movieId }, 'Movie not found in database, skipping')
      continue
    }

    // Upsert watch history (uses partial unique index idx_watch_history_user_movie_unique)
    await query(
      `INSERT INTO watch_history (user_id, movie_id, play_count, last_played_at, is_favorite, media_type)
       VALUES ($1, $2, $3, $4, $5, 'movie')
       ON CONFLICT (user_id, movie_id) WHERE movie_id IS NOT NULL DO UPDATE SET
         play_count = EXCLUDED.play_count,
         last_played_at = EXCLUDED.last_played_at,
         is_favorite = EXCLUDED.is_favorite,
         updated_at = NOW()`,
      [userId, movieId, item.playCount, item.lastPlayedDate || null, item.isFavorite]
    )

    syncedMovieIds.add(movieId)
    synced++
  }

  // Remove watch history entries for movies no longer marked as watched
  // Only do this on full sync (delta sync only adds/updates)
  let removed = 0
  if (fullSync) {
    for (const existingMovieId of existingMovieIds) {
      if (!syncedMovieIds.has(existingMovieId)) {
        await query('DELETE FROM watch_history WHERE user_id = $1 AND movie_id = $2', [
          userId,
          existingMovieId,
        ])
        removed++
        logger.debug({ userId, movieId: existingMovieId }, 'Removed stale watch history entry')
      }
    }
  }

  // Update user's last sync timestamp
  await query('UPDATE users SET watch_history_synced_at = NOW() WHERE id = $1', [userId])

  logger.info({ userId, synced, removed, deltaSync: !fullSync }, 'Watch history sync completed')
  return { synced, removed }
}

export interface SyncWatchHistoryResult {
  success: number
  failed: number
  totalItems: number
  jobId: string
}

/**
 * Sync watch history for all users (not just enabled)
 * This is needed for Top Picks which aggregates watch data from all users
 * Auto-imports any Emby/Jellyfin users not yet in our database
 * @param fullSync - If true, performs a full sync regardless of last sync time
 */
export async function syncWatchHistoryForAllUsers(
  existingJobId?: string,
  fullSync: boolean = false
): Promise<SyncWatchHistoryResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'sync-movie-watch-history', 3)

  try {
    const provider = getMediaServerProvider()
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
    addLog(jobId, 'info', `👥 Syncing watch history for ${users.length} user(s)`)

    if (users.length === 0) {
      addLog(jobId, 'warn', '⚠️ No users found with media server accounts')
      completeJob(jobId, { success: 0, failed: 0, totalItems: 0 })
      return { success: 0, failed: 0, totalItems: 0, jobId }
    }

    const syncMode = fullSync ? 'full' : 'delta'
    addLog(jobId, 'info', `🔄 Sync mode: ${syncMode}`)

    // Step 3: Sync each user
    setJobStep(jobId, 2, 'Syncing watch history', users.length)

    let success = 0
    let failed = 0
    let totalItems = 0

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      updateJobProgress(jobId, i, users.length, user.username)

      try {
        addLog(jobId, 'info', `🔄 Syncing watch history for ${user.username}...`)
        const syncResult = await syncWatchHistoryForUser(user.id, user.provider_user_id, fullSync)
        totalItems += syncResult.synced
        success++
        const removedMsg = syncResult.removed > 0 ? `, ${syncResult.removed} removed` : ''
        addLog(
          jobId,
          'info',
          `✅ ${user.username}: ${syncResult.synced} watched items synced${removedMsg}`
        )
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        logger.error({ err, userId: user.id }, 'Failed to sync watch history')
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
