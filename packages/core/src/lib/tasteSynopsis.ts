/**
 * Taste Synopsis Generator
 *
 * Generates a natural language summary of a user's movie taste
 * based on their watch history and preferences.
 */

import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'
import { getTextGenerationModelInstance, isAIFunctionConfigured } from './ai-provider.js'
import { streamText } from 'ai'
import { getUserExcludedLibraries } from './libraryExclusions.js'
import { analyzeMovieTaste, formatTasteProfileForAI } from './tasteAnalyzer.js'

const logger = createChildLogger('taste-synopsis')

export interface TasteSynopsis {
  synopsis: string
  updatedAt: Date
  stats: {
    totalWatched: number
    topGenres: string[]
    avgRating: number
    favoriteDecade: string | null
    recentFavorites: string[]
  }
}

interface WatchHistoryStats {
  total_watched: number
  avg_rating: number
  favorite_count: number
}

/**
 * Stream generate a taste synopsis for a user
 * Returns an async generator that yields text chunks
 */
export async function* streamTasteSynopsis(
  userId: string
): AsyncGenerator<string, TasteSynopsis['stats'], void> {
  logger.info({ userId }, 'Streaming taste synopsis generation')

  // Get user's excluded libraries to filter watch history
  const excludedLibraryIds = await getUserExcludedLibraries(userId)
  logger.debug(
    { userId, excludedLibraryIds },
    'Filtering streaming taste synopsis by excluded libraries'
  )

  // Get watch history stats (filtered by excluded libraries)
  const stats = await queryOne<WatchHistoryStats>(
    `
    SELECT 
      COUNT(DISTINCT wh.movie_id) as total_watched,
      AVG(m.community_rating) as avg_rating,
      COUNT(CASE WHEN wh.is_favorite THEN 1 END) as favorite_count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1
      AND (CARDINALITY($2::text[]) = 0 OR m.provider_library_id::text != ALL($2::text[]))
  `,
    [userId, excludedLibraryIds]
  )

  if (!stats || stats.total_watched === 0) {
    yield "We're still getting to know you! Watch some movies and we'll build your taste profile."
    return {
      totalWatched: 0,
      topGenres: [],
      avgRating: 0,
      favoriteDecade: null,
      recentFavorites: [],
    }
  }

  // Use embedding-powered taste analyzer for abstract profile
  const tasteProfile = await analyzeMovieTaste(userId)
  const abstractPrompt = formatTasteProfileForAI(tasteProfile, 'movie')

  const topGenres = tasteProfile.genres.map((g) => g.genre)
  const favoriteDecade = tasteProfile.decades[0]?.decade || null

  // Log the prompt being sent to verify no movie titles are included
  logger.info(
    { userId, diversity: tasteProfile.diversity.description },
    'Streaming: Using embedding-powered taste analyzer'
  )
  logger.debug(
    {
      userId,
      promptLength: abstractPrompt.length,
      promptPreview: abstractPrompt.substring(0, 500),
    },
    'Taste analyzer prompt (no movie titles)'
  )

  // Check if text generation is configured
  const isConfigured = await isAIFunctionConfigured('textGeneration')
  if (!isConfigured) {
    logger.warn({ userId }, 'Text generation not configured, using fallback synopsis')
    const fallback = buildFallbackSynopsis({
      totalWatched: Number(stats.total_watched),
      topGenres,
      favoriteDecade,
    })
    yield fallback

    // Store fallback
    await query(
      `INSERT INTO user_preferences (user_id, taste_synopsis, taste_synopsis_updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET taste_synopsis = $2, taste_synopsis_updated_at = NOW()`,
      [userId, fallback]
    )

    return {
      totalWatched: Number(stats.total_watched),
      topGenres,
      avgRating: Number(stats.avg_rating || 0),
      favoriteDecade,
      recentFavorites: [],
    }
  }

  // Stream with AI
  let fullText = ''
  try {
    const model = await getTextGenerationModelInstance()
    const result = streamText({
      model,
      system: `Write a viewer personality profile using this exact structure:

### What Draws You In
[1-2 paragraphs about genres, moods, and narrative styles they prefer]

### Your Viewing Style  
[1 paragraph about viewing habits - rewatcher, completionist, etc.]

### Core Traits
- **[Trait Name]**: [Brief description]
- **[Trait Name]**: [Brief description]
- **[Trait Name]**: [Brief description]

Rules:
- Discuss ONLY genres, moods, pacing, and abstract narrative qualities
- NEVER mention any movie or franchise names
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
    logger.error({ error, userId }, 'Failed to stream synopsis')
    const fallback = buildFallbackSynopsis({
      totalWatched: Number(stats.total_watched),
      topGenres,
      favoriteDecade,
    })
    yield fallback
    fullText = fallback
  }

  // Store the complete synopsis
  await query(
    `INSERT INTO user_preferences (user_id, taste_synopsis, taste_synopsis_updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET taste_synopsis = $2, taste_synopsis_updated_at = NOW()`,
    [userId, fullText]
  )

  logger.info({ userId, synopsisLength: fullText.length }, 'Taste synopsis streamed')

  return {
    totalWatched: Number(stats.total_watched),
    topGenres,
    avgRating: Number(stats.avg_rating || 0),
    favoriteDecade,
    recentFavorites: [],
  }
}

/**
 * Get existing synopsis - never auto-regenerates on page load.
 * Background job handles periodic refresh based on user's refresh_interval_days setting.
 * User can manually regenerate via streamTasteSynopsis().
 */
export async function getTasteSynopsis(userId: string): Promise<TasteSynopsis> {
  // Check for existing synopsis
  const existing = await queryOne<{
    taste_synopsis: string | null
    taste_synopsis_updated_at: Date | null
  }>(
    `
    SELECT taste_synopsis, taste_synopsis_updated_at
    FROM user_preferences
    WHERE user_id = $1
  `,
    [userId]
  )

  // Get stats for display (always needed)
  const stats = await getQuickStats(userId)

  // Return existing synopsis if available
  if (existing?.taste_synopsis) {
    return {
      synopsis: existing.taste_synopsis,
      updatedAt: existing.taste_synopsis_updated_at 
        ? new Date(existing.taste_synopsis_updated_at) 
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
 * Uses a single CTE query instead of 4 sequential queries for better performance
 */
async function getQuickStats(userId: string): Promise<TasteSynopsis['stats']> {
  const result = await queryOne<{
    total_watched: string
    avg_rating: string | null
    top_genres: string[] | null
    favorite_decade: string | null
    recent_favorites: string[] | null
  }>(
    `
    WITH watched_movies AS (
      SELECT m.id, m.genres, m.community_rating, m.year, m.title, 
             wh.is_favorite, wh.last_played_at
      FROM watch_history wh
      JOIN movies m ON m.id = wh.movie_id
      WHERE wh.user_id = $1
    ),
    stats AS (
      SELECT 
        COUNT(DISTINCT id) as total_watched,
        AVG(community_rating) as avg_rating
      FROM watched_movies
    ),
    genres AS (
      SELECT unnest(genres) as genre, COUNT(*) as cnt
      FROM watched_movies
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 5
    ),
    decades AS (
      SELECT (FLOOR(year / 10) * 10)::TEXT || 's' as decade, COUNT(*) as cnt
      FROM watched_movies
      WHERE year IS NOT NULL
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 1
    ),
    favorites AS (
      SELECT title
      FROM watched_movies
      WHERE is_favorite = true OR community_rating >= 7
      ORDER BY last_played_at DESC NULLS LAST
      LIMIT 5
    )
    SELECT 
      (SELECT total_watched FROM stats) as total_watched,
      (SELECT avg_rating FROM stats) as avg_rating,
      (SELECT ARRAY_AGG(genre) FROM genres) as top_genres,
      (SELECT decade FROM decades) as favorite_decade,
      (SELECT ARRAY_AGG(title) FROM favorites) as recent_favorites
  `,
    [userId]
  )

  return {
    totalWatched: Number(result?.total_watched || 0),
    topGenres: result?.top_genres || [],
    avgRating: Number(result?.avg_rating || 0),
    favoriteDecade: result?.favorite_decade || null,
    recentFavorites: result?.recent_favorites || [],
  }
}

/**
 * Build fallback synopsis if OpenAI fails
 */
function buildFallbackSynopsis(data: {
  totalWatched: number
  topGenres: string[]
  favoriteDecade: string | null
}): string {
  const genreText =
    data.topGenres.length > 0
      ? `Your top genres are ${data.topGenres.slice(0, 3).join(', ')}`
      : `You enjoy a diverse range of genres`

  const decadeText = data.favoriteDecade
    ? `, with a particular fondness for movies from the ${data.favoriteDecade}`
    : ``

  return `Based on ${data.totalWatched} movies in your watch history, we're getting to know your taste! ${genreText}${decadeText}. Keep watching and we'll refine your profile even further.`
}
