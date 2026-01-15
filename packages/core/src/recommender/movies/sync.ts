import { createChildLogger } from '../../lib/logger.js'
import { query, queryOne } from '../../lib/db.js'
import { getEnabledLibraryIds } from '../../lib/libraryConfig.js'
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
import type { Movie, PaginatedResult } from '../../media/types.js'
import type { MediaServerProvider } from '../../media/MediaServerProvider.js'

const logger = createChildLogger('sync')

/**
 * Clamp a rating value to fit within NUMERIC(5,2) column constraints (max 999.99)
 * Ratings from media servers should be 0-10 (community) or 0-100 (critic),
 * but bad metadata can sometimes have unexpected values
 */
function clampRating(rating: number | null | undefined): number | null {
  if (rating === null || rating === undefined) return null
  // Clamp to valid range for NUMERIC(5,2) - max is 999.99
  return Math.min(Math.max(0, rating), 999.99)
}

// ============================================================================
// PERFORMANCE TUNING CONSTANTS
// ============================================================================
// These values are optimized for local Emby/Jellyfin servers which have no rate limits.
// Adjust if you experience issues with your specific setup.

/** Number of movies to fetch per API request (Emby/Jellyfin can handle 500+ easily) */
const PAGE_SIZE = 500

/** Number of concurrent API requests for fetching pages */
const PARALLEL_FETCHES = 4

/** Number of movies to batch insert/update in a single DB transaction */
const DB_BATCH_SIZE = 100

export interface SyncMoviesResult {
  added: number
  updated: number
  total: number
  jobId: string
}

/**
 * Prepared movie data ready for database insertion
 */
interface PreparedMovie {
  movie: Movie
  runtimeMinutes: number | null
  posterUrl: string | null
  backdropUrl: string | null
  libraryId: string | null
}

/**
 * Fetch multiple pages of movies in parallel
 */
async function fetchMoviesParallel(
  provider: MediaServerProvider,
  apiKey: string,
  libraryId: string | null,
  totalCount: number,
  pageSize: number,
  parallelFetches: number,
  jobId: string,
  onProgress?: (fetched: number) => void
): Promise<Movie[]> {
  const allMovies: Movie[] = []
  const totalPages = Math.ceil(totalCount / pageSize)
  let currentPage = 0

  while (currentPage < totalPages) {
    // Fetch up to parallelFetches pages at once
    const pagesToFetch = Math.min(parallelFetches, totalPages - currentPage)
    const fetchPromises: Promise<Movie[]>[] = []

    for (let i = 0; i < pagesToFetch; i++) {
      const startIndex = (currentPage + i) * pageSize
      fetchPromises.push(
        provider
          .getMovies(apiKey, {
            startIndex,
            limit: pageSize,
            parentIds: libraryId ? [libraryId] : undefined,
          })
          .then((result: PaginatedResult<Movie>) => result.items)
      )
    }

    const results = await Promise.all(fetchPromises)
    for (const movies of results) {
      allMovies.push(...movies)
    }

    currentPage += pagesToFetch
    onProgress?.(allMovies.length)

    if (currentPage < totalPages) {
      addLog(
        jobId,
        'debug',
        `📥 Fetched ${allMovies.length}/${totalCount} movies (${currentPage}/${totalPages} pages)`
      )
    }
  }

  return allMovies
}

/**
 * Process movies in batches for database insertion
 */
/**
 * Process a batch of movies using bulk SQL operations
 * 
 * OPTIMIZED: Uses PostgreSQL unnest() for bulk INSERT/UPDATE instead of
 * individual queries. This reduces ~100 queries per batch to just 2 queries.
 */
async function processMovieBatch(
  movies: PreparedMovie[],
  existingProviderIds: Set<string>,
  existingTitleYears: Map<string, string>,
  _jobId: string
): Promise<{ added: number; updated: number }> {
  // Separate into updates and inserts
  const toUpdate: PreparedMovie[] = []
  const toInsert: PreparedMovie[] = []

  for (const pm of movies) {
    if (existingProviderIds.has(pm.movie.id)) {
      toUpdate.push(pm)
    } else {
      // Check for duplicate by title + year
      const key = `${pm.movie.name?.toLowerCase()}|${pm.movie.year}`
      if (!existingTitleYears.has(key)) {
        toInsert.push(pm)
        existingTitleYears.set(key, pm.movie.id)
      }
    }
  }

  let added = 0
  let updated = 0

  // Bulk UPDATE existing movies using unnest
  // Note: Array columns (genres, directors, writers, tags, production_countries) are passed as JSONB
  // and converted back to text[] in SQL to avoid unnest() flattening 2D arrays incorrectly
  if (toUpdate.length > 0) {
    try {
      const result = await query(
        `UPDATE movies SET
          title = data.title,
          original_title = data.original_title,
          year = data.year,
          genres = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.genres)), '{}'),
          overview = data.overview,
          community_rating = data.community_rating,
          critic_rating = data.critic_rating,
          runtime_minutes = data.runtime_minutes,
          path = data.path,
          media_sources = data.media_sources,
          poster_url = data.poster_url,
          backdrop_url = data.backdrop_url,
          provider_library_id = data.provider_library_id,
          tagline = data.tagline,
          content_rating = data.content_rating,
          premiere_date = data.premiere_date,
          studios = data.studios,
          directors = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.directors)), '{}'),
          writers = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.writers)), '{}'),
          actors = data.actors,
          imdb_id = data.imdb_id,
          tmdb_id = data.tmdb_id,
          tags = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.tags)), '{}'),
          sort_title = data.sort_title,
          production_countries = COALESCE(ARRAY(SELECT jsonb_array_elements_text(data.production_countries)), '{}'),
          awards = data.awards,
          video_resolution = data.video_resolution,
          video_codec = data.video_codec,
          audio_codec = data.audio_codec,
          container = data.container,
          updated_at = NOW()
        FROM (
          SELECT * FROM unnest(
            $1::text[], $2::text[], $3::text[], $4::int[], $5::jsonb[],
            $6::text[], $7::real[], $8::real[], $9::int[], $10::text[],
            $11::jsonb[], $12::text[], $13::text[], $14::text[], $15::text[],
            $16::text[], $17::date[], $18::jsonb[], $19::jsonb[], $20::jsonb[],
            $21::jsonb[], $22::text[], $23::text[], $24::jsonb[], $25::text[],
            $26::jsonb[], $27::text[], $28::text[], $29::text[], $30::text[], $31::text[]
          ) AS t(
            provider_item_id, title, original_title, year, genres, overview,
            community_rating, critic_rating, runtime_minutes, path, media_sources,
            poster_url, backdrop_url, provider_library_id, tagline, content_rating,
            premiere_date, studios, directors, writers, actors, imdb_id, tmdb_id,
            tags, sort_title, production_countries, awards, video_resolution,
            video_codec, audio_codec, container
          )
        ) AS data
        WHERE movies.provider_item_id = data.provider_item_id`,
        [
          toUpdate.map((pm) => pm.movie.id),
          toUpdate.map((pm) => pm.movie.name),
          toUpdate.map((pm) => pm.movie.originalTitle || null),
          toUpdate.map((pm) => pm.movie.year || null),
          toUpdate.map((pm) => JSON.stringify(pm.movie.genres || [])),
          toUpdate.map((pm) => pm.movie.overview || null),
          toUpdate.map((pm) => clampRating(pm.movie.communityRating)),
          toUpdate.map((pm) => clampRating(pm.movie.criticRating)),
          toUpdate.map((pm) => pm.runtimeMinutes),
          toUpdate.map((pm) => pm.movie.path || null),
          toUpdate.map((pm) => JSON.stringify(pm.movie.mediaSources || [])),
          toUpdate.map((pm) => pm.posterUrl),
          toUpdate.map((pm) => pm.backdropUrl),
          toUpdate.map((pm) => pm.libraryId),
          toUpdate.map((pm) => pm.movie.tagline || null),
          toUpdate.map((pm) => pm.movie.contentRating || null),
          toUpdate.map((pm) =>
            pm.movie.premiereDate ? pm.movie.premiereDate.split('T')[0] : null
          ),
          toUpdate.map((pm) => JSON.stringify(pm.movie.studios || [])),
          toUpdate.map((pm) => JSON.stringify(pm.movie.directors || [])),
          toUpdate.map((pm) => JSON.stringify(pm.movie.writers || [])),
          toUpdate.map((pm) => JSON.stringify(pm.movie.actors || [])),
          toUpdate.map((pm) => pm.movie.imdbId || null),
          toUpdate.map((pm) => pm.movie.tmdbId || null),
          toUpdate.map((pm) => JSON.stringify(pm.movie.tags || [])),
          toUpdate.map((pm) => pm.movie.sortName || null),
          toUpdate.map((pm) => JSON.stringify(pm.movie.productionCountries || [])),
          toUpdate.map((pm) => pm.movie.awards || null),
          toUpdate.map((pm) => pm.movie.videoResolution || null),
          toUpdate.map((pm) => pm.movie.videoCodec || null),
          toUpdate.map((pm) => pm.movie.audioCodec || null),
          toUpdate.map((pm) => pm.movie.container || null),
        ]
      )
      updated = result.rowCount || toUpdate.length
      for (const pm of toUpdate) {
        existingProviderIds.add(pm.movie.id)
      }
    } catch (err) {
      logger.error({ err, count: toUpdate.length }, 'Failed to bulk update movies')
    }
  }

  // Bulk INSERT new movies using unnest
  // Note: Array columns (genres, directors, writers, tags, production_countries) are passed as JSONB
  // and converted back to text[] in SQL to avoid unnest() flattening 2D arrays incorrectly
  if (toInsert.length > 0) {
    try {
      const result = await query(
        `INSERT INTO movies (
          provider_item_id, title, original_title, year, genres, overview,
          community_rating, critic_rating, runtime_minutes, path, media_sources,
          poster_url, backdrop_url, provider_library_id, tagline, content_rating,
          premiere_date, studios, directors, writers, actors, imdb_id, tmdb_id,
          tags, sort_title, production_countries, awards, video_resolution,
          video_codec, audio_codec, container
        )
        SELECT
          t.provider_item_id, t.title, t.original_title, t.year,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.genres)), '{}'),
          t.overview, t.community_rating, t.critic_rating, t.runtime_minutes, t.path,
          t.media_sources, t.poster_url, t.backdrop_url, t.provider_library_id,
          t.tagline, t.content_rating, t.premiere_date, t.studios,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.directors)), '{}'),
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.writers)), '{}'),
          t.actors, t.imdb_id, t.tmdb_id,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.tags)), '{}'),
          t.sort_title,
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(t.production_countries)), '{}'),
          t.awards, t.video_resolution, t.video_codec, t.audio_codec, t.container
        FROM unnest(
          $1::text[], $2::text[], $3::text[], $4::int[], $5::jsonb[],
          $6::text[], $7::real[], $8::real[], $9::int[], $10::text[],
          $11::jsonb[], $12::text[], $13::text[], $14::text[], $15::text[],
          $16::text[], $17::date[], $18::jsonb[], $19::jsonb[], $20::jsonb[],
          $21::jsonb[], $22::text[], $23::text[], $24::jsonb[], $25::text[],
          $26::jsonb[], $27::text[], $28::text[], $29::text[], $30::text[], $31::text[]
        ) AS t(
          provider_item_id, title, original_title, year, genres, overview,
          community_rating, critic_rating, runtime_minutes, path, media_sources,
          poster_url, backdrop_url, provider_library_id, tagline, content_rating,
          premiere_date, studios, directors, writers, actors, imdb_id, tmdb_id,
          tags, sort_title, production_countries, awards, video_resolution,
          video_codec, audio_codec, container
        )
        ON CONFLICT (provider_item_id) DO NOTHING`,
        [
          toInsert.map((pm) => pm.movie.id),
          toInsert.map((pm) => pm.movie.name),
          toInsert.map((pm) => pm.movie.originalTitle || null),
          toInsert.map((pm) => pm.movie.year || null),
          toInsert.map((pm) => JSON.stringify(pm.movie.genres || [])),
          toInsert.map((pm) => pm.movie.overview || null),
          toInsert.map((pm) => clampRating(pm.movie.communityRating)),
          toInsert.map((pm) => clampRating(pm.movie.criticRating)),
          toInsert.map((pm) => pm.runtimeMinutes),
          toInsert.map((pm) => pm.movie.path || null),
          toInsert.map((pm) => JSON.stringify(pm.movie.mediaSources || [])),
          toInsert.map((pm) => pm.posterUrl),
          toInsert.map((pm) => pm.backdropUrl),
          toInsert.map((pm) => pm.libraryId),
          toInsert.map((pm) => pm.movie.tagline || null),
          toInsert.map((pm) => pm.movie.contentRating || null),
          toInsert.map((pm) =>
            pm.movie.premiereDate ? pm.movie.premiereDate.split('T')[0] : null
          ),
          toInsert.map((pm) => JSON.stringify(pm.movie.studios || [])),
          toInsert.map((pm) => JSON.stringify(pm.movie.directors || [])),
          toInsert.map((pm) => JSON.stringify(pm.movie.writers || [])),
          toInsert.map((pm) => JSON.stringify(pm.movie.actors || [])),
          toInsert.map((pm) => pm.movie.imdbId || null),
          toInsert.map((pm) => pm.movie.tmdbId || null),
          toInsert.map((pm) => JSON.stringify(pm.movie.tags || [])),
          toInsert.map((pm) => pm.movie.sortName || null),
          toInsert.map((pm) => JSON.stringify(pm.movie.productionCountries || [])),
          toInsert.map((pm) => pm.movie.awards || null),
          toInsert.map((pm) => pm.movie.videoResolution || null),
          toInsert.map((pm) => pm.movie.videoCodec || null),
          toInsert.map((pm) => pm.movie.audioCodec || null),
          toInsert.map((pm) => pm.movie.container || null),
        ]
      )
      added = result.rowCount || toInsert.length
      for (const pm of toInsert) {
        existingProviderIds.add(pm.movie.id)
      }
    } catch (err) {
      logger.error({ err, count: toInsert.length }, 'Failed to bulk insert movies')
    }
  }

  return { added, updated }
}

/**
 * Sync all movies from the media server to the database
 * 
 * OPTIMIZED: Uses parallel API fetching and batch database operations
 * for significantly faster sync times on large libraries.
 */
export async function syncMovies(existingJobId?: string): Promise<SyncMoviesResult> {
  const jobId = existingJobId || randomUUID()
  createJobProgress(jobId, 'sync-movies', 3)

  try {
    const provider = await getMediaServerProvider()
    const apiKey = await getMediaServerApiKey()

    if (!apiKey) {
      throw new Error('MEDIA_SERVER_API_KEY environment variable is required')
    }

    // Step 1: Connect to media server and check library config
    setJobStep(jobId, 0, 'Connecting to media server')
    const config = await getMediaServerConfig()
    const serverType = config.type || 'emby'
    const serverUrl = config.baseUrl || 'Not configured'

    addLog(jobId, 'info', `🔌 Connecting to ${serverType.toUpperCase()} server...`)
    addLog(jobId, 'info', `📡 Server URL: ${serverUrl}`)
    addLog(
      jobId,
      'info',
      `🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
    )
    addLog(jobId, 'info', `⚡ Performance: ${PAGE_SIZE} items/page, ${PARALLEL_FETCHES} parallel fetches`)

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

    // Get total count per library
    const libraryCounts: Array<{ libraryId: string | null; count: number }> = []
    let totalMovies = 0

    if (librariesToSync.length > 0) {
      for (const libId of librariesToSync) {
        const countResult = await provider.getMovies(apiKey, {
          startIndex: 0,
          limit: 1,
          parentIds: [libId],
        })
        libraryCounts.push({ libraryId: libId, count: countResult.totalRecordCount })
        totalMovies += countResult.totalRecordCount
        addLog(jobId, 'debug', `Library ${libId}: ${countResult.totalRecordCount} movies`)
      }
    } else {
      const countResult = await provider.getMovies(apiKey, {
        startIndex: 0,
        limit: 1,
      })
      libraryCounts.push({ libraryId: null, count: countResult.totalRecordCount })
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

    // Pre-fetch existing movies from database for fast duplicate checking
    addLog(jobId, 'info', '🔍 Loading existing movies from database...')
    const existingMovies = await query<{ provider_item_id: string; title: string; year: number | null }>(
      'SELECT provider_item_id, title, year FROM movies'
    )
    const existingProviderIds = new Set<string>()
    const existingTitleYears = new Map<string, string>()
    for (const m of existingMovies.rows) {
      existingProviderIds.add(m.provider_item_id)
      if (m.title && m.year) {
        existingTitleYears.set(`${m.title.toLowerCase()}|${m.year}`, m.provider_item_id)
      }
    }
    addLog(jobId, 'info', `📊 Found ${existingMovies.rows.length} existing movies in database`)

    // Step 3: Process movies - fetch and sync
    setJobStep(jobId, 2, 'Processing movies', totalMovies)

    let added = 0
    let updated = 0
    let processed = 0
    const startTime = Date.now()

    for (const { libraryId, count } of libraryCounts) {
      if (count === 0) continue

      addLog(jobId, 'info', `📂 Fetching ${count} movies from library${libraryId ? ` ${libraryId}` : ''}...`)

      // Fetch all movies from this library in parallel
      // Note: We don't update job progress during fetch since it's fast (~7s for 12k movies)
      // Progress updates happen during the processing phase below
      const movies = await fetchMoviesParallel(
        provider,
        apiKey,
        libraryId,
        count,
        PAGE_SIZE,
        PARALLEL_FETCHES,
        jobId
      )

      addLog(jobId, 'info', `✅ Fetched ${movies.length} movies, now processing...`)

      // Prepare movie data
      const preparedMovies: PreparedMovie[] = movies.map((movie) => ({
        movie,
        runtimeMinutes: movie.runtimeTicks ? Math.round(movie.runtimeTicks / 600000000) : null,
        posterUrl: movie.posterImageTag ? provider.getPosterUrl(movie.id, movie.posterImageTag) : null,
        backdropUrl: movie.backdropImageTag ? provider.getBackdropUrl(movie.id, movie.backdropImageTag) : null,
        libraryId,
      }))

      // Process in batches
      for (let i = 0; i < preparedMovies.length; i += DB_BATCH_SIZE) {
        const batch = preparedMovies.slice(i, i + DB_BATCH_SIZE)
        const result = await processMovieBatch(batch, existingProviderIds, existingTitleYears, jobId)
        added += result.added
        updated += result.updated
        processed += batch.length

        updateJobProgress(
          jobId,
          processed,
          totalMovies,
          `${processed}/${totalMovies} (${added} new, ${updated} updated)`
        )

        // Log progress every few batches
        if (i % (DB_BATCH_SIZE * 5) === 0 && i > 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = Math.round(processed / elapsed)
          addLog(
            jobId,
            'info',
            `📊 Progress: ${processed}/${totalMovies} movies (${rate}/sec, ${added} new, ${updated} updated)`
          )
        }
      }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
    const finalResult = { added, updated, total: processed, jobId }
    completeJob(jobId, finalResult)

    addLog(
      jobId,
      'info',
      `🎉 Sync complete in ${totalDuration}s: ${added} new movies, ${updated} updated, ${processed} total`
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
  const provider = await getMediaServerProvider()
  const apiKey = await getMediaServerApiKey()

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

  // Prepare bulk data - filter to items we have in our database
  const toSync: {
    movieId: string
    playCount: number
    lastPlayedAt: Date | null
    isFavorite: boolean
  }[] = []

  for (const item of watchedItems) {
    const movieId = providerIdToMovieId.get(item.movieId)
    if (movieId) {
      toSync.push({
        movieId,
        playCount: item.playCount,
        lastPlayedAt: item.lastPlayedDate ? new Date(item.lastPlayedDate) : null,
        isFavorite: item.isFavorite,
      })
    }
  }

  const syncedMovieIds = new Set<string>(toSync.map((t) => t.movieId))
  let synced = 0

  // Bulk upsert watch history using unnest()
  if (toSync.length > 0) {
    const result = await query(
      `INSERT INTO watch_history (user_id, movie_id, play_count, last_played_at, is_favorite, media_type)
       SELECT $1, movie_id, play_count, last_played_at, is_favorite, 'movie'
       FROM unnest($2::uuid[], $3::int[], $4::timestamptz[], $5::boolean[])
         AS t(movie_id, play_count, last_played_at, is_favorite)
       ON CONFLICT (user_id, movie_id) WHERE movie_id IS NOT NULL DO UPDATE SET
         play_count = EXCLUDED.play_count,
         last_played_at = EXCLUDED.last_played_at,
         is_favorite = EXCLUDED.is_favorite,
         updated_at = NOW()`,
      [
        userId,
        toSync.map((t) => t.movieId),
        toSync.map((t) => t.playCount),
        toSync.map((t) => t.lastPlayedAt),
        toSync.map((t) => t.isFavorite),
      ]
    )
    synced = result.rowCount || toSync.length
  }

  // Remove watch history entries for movies no longer marked as watched
  // Only do this on full sync (delta sync only adds/updates)
  let removed = 0
  if (fullSync && existingMovieIds.size > 0) {
    const toRemove = [...existingMovieIds].filter((id) => !syncedMovieIds.has(id))
    if (toRemove.length > 0) {
      const deleteResult = await query(
        `DELETE FROM watch_history WHERE user_id = $1 AND movie_id = ANY($2::uuid[])`,
        [userId, toRemove]
      )
      removed = deleteResult.rowCount || toRemove.length
      logger.debug({ userId, removed }, 'Removed stale watch history entries')
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
    const existingProviderIds = new Set(existingUsers.rows.map(u => u.provider_user_id))

    // Import any missing users
    const msConfig = await getMediaServerConfig()
    const providerType = msConfig.type || 'emby'
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
