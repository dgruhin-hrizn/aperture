/**
 * Series Taste Synopsis Generator
 *
 * Generates a natural language summary of a user's TV series taste
 * based on their watch history and preferences.
 */

import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'
import { getTextGenerationModelInstance, isAIFunctionConfigured } from './ai-provider.js'
import { streamText } from 'ai'
import { getUserExcludedLibraries } from './libraryExclusions.js'
import { analyzeSeriesTaste, formatTasteProfileForAI } from './tasteAnalyzer.js'

const logger = createChildLogger('taste-series-synopsis')

export interface SeriesTasteSynopsis {
  synopsis: string
  updatedAt: Date
  stats: {
    totalSeriesStarted: number
    totalEpisodesWatched: number
    topGenres: string[]
    avgRating: number
    favoriteDecade: string | null
    favoriteNetworks: string[]
    recentFavorites: string[]
  }
}

interface SeriesWatchStats {
  series_count: number
  episode_count: number
  avg_rating: number
  favorite_count: number
}

interface GenreCount {
  genre: string
  count: number
}

interface NetworkCount {
  network: string
  count: number
}

interface DecadeCount {
  decade: string
  count: number
}

interface WatchedSeries {
  title: string
  year: number | null
  genres: string[]
  community_rating: number | null
  network: string | null
  episodes_watched: number
  total_episodes: number | null
  completion_rate: number | null
}

/**
 * Stream generate a series taste synopsis for a user
 * Returns an async generator that yields text chunks
 */
export async function* streamSeriesTasteSynopsis(
  userId: string
): AsyncGenerator<string, SeriesTasteSynopsis['stats'], void> {
  logger.info({ userId }, 'Streaming series taste synopsis generation')

  // Get user's excluded libraries to filter watch history
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  logger.debug(
    { userId, excludedLibraryIds },
    'Filtering streaming series taste synopsis by excluded libraries'
  )

  // Get watch history stats (filtered by excluded libraries)
  const stats = await queryOne<SeriesWatchStats>(
    `
    SELECT 
      COUNT(DISTINCT e.series_id) as series_count,
      COUNT(DISTINCT wh.episode_id) as episode_count,
      AVG(s.community_rating) as avg_rating,
      COUNT(CASE WHEN wh.is_favorite THEN 1 END) as favorite_count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode'
      AND (CARDINALITY($2::text[]) = 0 OR s.provider_library_id::text != ALL($2::text[]))
  `,
    [userId, excludedLibraryIds]
  )

  if (!stats || stats.series_count === 0) {
    yield "We're still getting to know your TV preferences! Watch some episodes and we'll build your series taste profile."
    return {
      totalSeriesStarted: 0,
      totalEpisodesWatched: 0,
      topGenres: [],
      avgRating: 0,
      favoriteDecade: null,
      favoriteNetworks: [],
      recentFavorites: [],
    }
  }

  // Get top genres (filtered by excluded libraries)
  const genreResults = await query<GenreCount>(
    `
    SELECT unnest(s.genres) as genre, COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode'
      AND (CARDINALITY($2::text[]) = 0 OR s.provider_library_id::text != ALL($2::text[]))
    GROUP BY unnest(s.genres)
    ORDER BY count DESC
    LIMIT 5
  `,
    [userId, excludedLibraryIds]
  )
  const topGenres = genreResults.rows.map((r) => r.genre)

  // Get favorite networks (filtered by excluded libraries)
  const networkResults = await query<NetworkCount>(
    `
    SELECT s.network, COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s.network IS NOT NULL
      AND (CARDINALITY($2::text[]) = 0 OR s.provider_library_id::text != ALL($2::text[]))
    GROUP BY s.network
    ORDER BY count DESC
    LIMIT 3
  `,
    [userId, excludedLibraryIds]
  )
  const favoriteNetworks = networkResults.rows.map((r) => r.network)

  // Get favorite decade (filtered by excluded libraries)
  const decadeResults = await query<DecadeCount>(
    `
    SELECT 
      (FLOOR(s.year / 10) * 10)::TEXT || 's' as decade,
      COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s.year IS NOT NULL
      AND (CARDINALITY($2::text[]) = 0 OR s.provider_library_id::text != ALL($2::text[]))
    GROUP BY FLOOR(s.year / 10)
    ORDER BY count DESC
    LIMIT 1
  `,
    [userId, excludedLibraryIds]
  )
  const favoriteDecade = decadeResults.rows[0]?.decade || null

  // Get most watched series (filtered by excluded libraries)
  const topSeries = await query<WatchedSeries>(
    `
    SELECT 
      s.title, s.year, s.genres, s.community_rating, s.network,
      COUNT(DISTINCT wh.episode_id) as episodes_watched,
      s.total_episodes,
      CASE WHEN s.total_episodes > 0 
        THEN ROUND(COUNT(DISTINCT wh.episode_id)::numeric / s.total_episodes * 100)
        ELSE NULL
      END as completion_rate
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode'
      AND (CARDINALITY($2::text[]) = 0 OR s.provider_library_id::text != ALL($2::text[]))
    GROUP BY s.id, s.title, s.year, s.genres, s.community_rating, s.network, s.total_episodes
    ORDER BY episodes_watched DESC
    LIMIT 15
  `,
    [userId, excludedLibraryIds]
  )

  // Use embedding-powered taste analyzer for abstract profile
  const tasteProfile = await analyzeSeriesTaste(userId)
  const abstractPrompt = formatTasteProfileForAI(tasteProfile, 'series')

  logger.debug(
    { userId, diversity: tasteProfile.diversity },
    'Streaming: Analyzed series taste profile'
  )

  // Check if text generation is configured
  const isConfigured = await isAIFunctionConfigured('textGeneration')
  if (!isConfigured) {
    logger.warn({ userId }, 'Text generation not configured, using fallback synopsis')
    const fallback = buildFallbackSeriesSynopsis({
      seriesCount: Number(stats.series_count),
      episodeCount: Number(stats.episode_count),
      topGenres,
      favoriteNetworks,
      favoriteDecade,
    })
    yield fallback

    // Store fallback
    await query(
      `
      INSERT INTO user_preferences (user_id, series_taste_synopsis, series_taste_synopsis_updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE SET series_taste_synopsis = $2, series_taste_synopsis_updated_at = NOW()
    `,
      [userId, fallback]
    )

    return {
      totalSeriesStarted: Number(stats.series_count),
      totalEpisodesWatched: Number(stats.episode_count),
      topGenres,
      avgRating: Number(stats.avg_rating || 0),
      favoriteDecade,
      favoriteNetworks,
      recentFavorites: [],
    }
  }

  // Stream with AI
  let fullText = ''
  try {
    const model = await getTextGenerationModelInstance()
    const result = streamText({
      model,
      system: `Write a TV viewer personality profile using this exact structure:

### What Draws You In
[1-2 paragraphs about genres, moods, and narrative styles they prefer]

### Your Viewing Style  
[1 paragraph about viewing habits - binger, completionist, sampler, etc.]

### Core Traits
- **[Trait Name]**: [Brief description]
- **[Trait Name]**: [Brief description]
- **[Trait Name]**: [Brief description]

Rules:
- Discuss ONLY genres, moods, pacing, and abstract narrative qualities
- NEVER mention any show, series, or franchise names
- Write in second person ("You gravitate toward...")
- Use **bold** markdown for trait names`,
      prompt: abstractPrompt,
      temperature: 0.4,
      maxOutputTokens: 400,
    })

    for await (const chunk of result.textStream) {
      fullText += chunk
      yield chunk
    }
  } catch (error) {
    logger.error({ error, userId }, 'Failed to stream series synopsis')
    const fallback = buildFallbackSeriesSynopsis({
      seriesCount: Number(stats.series_count),
      episodeCount: Number(stats.episode_count),
      topGenres,
      favoriteNetworks,
      favoriteDecade,
    })
    yield fallback
    fullText = fallback
  }

  // Store the complete synopsis
  await query(
    `
    INSERT INTO user_preferences (user_id, series_taste_synopsis, series_taste_synopsis_updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET series_taste_synopsis = $2, series_taste_synopsis_updated_at = NOW()
  `,
    [userId, fullText]
  )

  logger.info({ userId, synopsisLength: fullText.length }, 'Series taste synopsis streamed')

  return {
    totalSeriesStarted: Number(stats.series_count),
    totalEpisodesWatched: Number(stats.episode_count),
    topGenres,
    avgRating: Number(stats.avg_rating || 0),
    favoriteDecade,
    favoriteNetworks,
    recentFavorites: topSeries.rows.slice(0, 5).map((s) => s.title),
  }
}

/**
 * Get existing series synopsis - never auto-regenerates on page load.
 * Background job handles periodic refresh based on user's refresh_interval_days setting.
 * User can manually regenerate via streamSeriesTasteSynopsis().
 */
export async function getSeriesTasteSynopsis(userId: string): Promise<SeriesTasteSynopsis> {
  // Check for existing synopsis
  const existing = await queryOne<{
    series_taste_synopsis: string | null
    series_taste_synopsis_updated_at: Date | null
  }>(
    `
    SELECT series_taste_synopsis, series_taste_synopsis_updated_at
    FROM user_preferences
    WHERE user_id = $1
  `,
    [userId]
  )

  // Get stats for display (always needed)
  const stats = await getSeriesQuickStats(userId)

  // Return existing synopsis if available
  if (existing?.series_taste_synopsis) {
    return {
      synopsis: existing.series_taste_synopsis,
      updatedAt: existing.series_taste_synopsis_updated_at
        ? new Date(existing.series_taste_synopsis_updated_at)
        : new Date(),
      stats,
    }
  }

  // No synopsis yet - return empty, let user click "Generate Identity"
  return {
    synopsis: '',
    updatedAt: new Date(),
    stats,
  }
}

/**
 * Get quick stats without regenerating synopsis
 * Uses a single CTE query instead of 5 sequential queries for better performance
 */
async function getSeriesQuickStats(userId: string): Promise<SeriesTasteSynopsis['stats']> {
  const result = await queryOne<{
    series_count: string
    episode_count: string
    avg_rating: string | null
    top_genres: string[] | null
    favorite_networks: string[] | null
    favorite_decade: string | null
    recent_favorites: string[] | null
  }>(
    `
    WITH watched_series AS (
      SELECT DISTINCT ON (s.id)
        s.id, s.title, s.genres, s.community_rating, s.year, s.network,
        wh.is_favorite
      FROM watch_history wh
      JOIN episodes e ON e.id = wh.episode_id
      JOIN series s ON s.id = e.series_id
      WHERE wh.user_id = $1 AND wh.media_type = 'episode'
    ),
    episode_counts AS (
      SELECT COUNT(DISTINCT wh.episode_id) as episode_count
      FROM watch_history wh
      WHERE wh.user_id = $1 AND wh.media_type = 'episode'
    ),
    stats AS (
      SELECT 
        COUNT(*) as series_count,
        AVG(community_rating) as avg_rating
      FROM watched_series
    ),
    genres AS (
      SELECT unnest(genres) as genre, COUNT(*) as cnt
      FROM watched_series
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 5
    ),
    networks AS (
      SELECT network, COUNT(*) as cnt
      FROM watched_series
      WHERE network IS NOT NULL
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 3
    ),
    decades AS (
      SELECT (FLOOR(year / 10) * 10)::TEXT || 's' as decade, COUNT(*) as cnt
      FROM watched_series
      WHERE year IS NOT NULL
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 1
    ),
    favorites AS (
      SELECT title
      FROM watched_series
      WHERE is_favorite = true OR community_rating >= 7
      ORDER BY title
      LIMIT 5
    )
    SELECT 
      (SELECT series_count FROM stats) as series_count,
      (SELECT episode_count FROM episode_counts) as episode_count,
      (SELECT avg_rating FROM stats) as avg_rating,
      (SELECT ARRAY_AGG(genre) FROM genres) as top_genres,
      (SELECT ARRAY_AGG(network) FROM networks) as favorite_networks,
      (SELECT decade FROM decades) as favorite_decade,
      (SELECT ARRAY_AGG(title) FROM favorites) as recent_favorites
  `,
    [userId]
  )

  return {
    totalSeriesStarted: Number(result?.series_count || 0),
    totalEpisodesWatched: Number(result?.episode_count || 0),
    topGenres: result?.top_genres || [],
    avgRating: Number(result?.avg_rating || 0),
    favoriteDecade: result?.favorite_decade || null,
    favoriteNetworks: result?.favorite_networks || [],
    recentFavorites: result?.recent_favorites || [],
  }
}

/**
 * Build fallback synopsis if OpenAI fails
 */
function buildFallbackSeriesSynopsis(data: {
  seriesCount: number
  episodeCount: number
  topGenres: string[]
  favoriteNetworks: string[]
  favoriteDecade: string | null
}): string {
  const genreText =
    data.topGenres.length > 0
      ? `Your top genres are ${data.topGenres.slice(0, 3).join(', ')}`
      : `You enjoy a diverse range of genres`

  const networkText =
    data.favoriteNetworks.length > 0 ? `, often from ${data.favoriteNetworks[0]}` : ``

  const decadeText = data.favoriteDecade
    ? `, with a particular fondness for shows from the ${data.favoriteDecade}`
    : ``

  return `Based on ${data.seriesCount} series and ${data.episodeCount} episodes in your watch history, we're getting to know your TV taste! ${genreText}${networkText}${decadeText}. Keep watching and we'll refine your profile even further.`
}
