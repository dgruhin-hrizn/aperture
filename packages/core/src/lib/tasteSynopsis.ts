/**
 * Taste Synopsis Generator
 *
 * Generates a natural language summary of a user's movie taste
 * based on their watch history and preferences.
 */

import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'
import { getTextGenerationModelInstance, isAIFunctionConfigured } from './ai-provider.js'
import { generateText } from 'ai'

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

interface GenreCount {
  genre: string
  count: number
}

interface DecadeCount {
  decade: string
  count: number
}

interface RecentMovie {
  title: string
  year: number | null
  genres: string[]
  community_rating: number | null
}

/**
 * Generate a taste synopsis for a user
 */
export async function generateTasteSynopsis(userId: string): Promise<TasteSynopsis> {
  logger.info({ userId }, 'Generating taste synopsis')

  // Get watch history stats
  const stats = await queryOne<WatchHistoryStats>(
    `
    SELECT 
      COUNT(DISTINCT wh.movie_id) as total_watched,
      AVG(m.community_rating) as avg_rating,
      COUNT(CASE WHEN wh.is_favorite THEN 1 END) as favorite_count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1
  `,
    [userId]
  )

  if (!stats || stats.total_watched === 0) {
    return {
      synopsis:
        "We're still getting to know you! Watch some movies and we'll build your taste profile.",
      updatedAt: new Date(),
      stats: {
        totalWatched: 0,
        topGenres: [],
        avgRating: 0,
        favoriteDecade: null,
        recentFavorites: [],
      },
    }
  }

  // Get top genres
  const genreResults = await query<GenreCount>(
    `
    SELECT unnest(m.genres) as genre, COUNT(*) as count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1
    GROUP BY unnest(m.genres)
    ORDER BY count DESC
    LIMIT 5
  `,
    [userId]
  )
  const topGenres = genreResults.rows.map((r) => r.genre)

  // Get favorite decade
  const decadeResults = await query<DecadeCount>(
    `
    SELECT 
      (FLOOR(m.year / 10) * 10)::TEXT || 's' as decade,
      COUNT(*) as count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1 AND m.year IS NOT NULL
    GROUP BY FLOOR(m.year / 10)
    ORDER BY count DESC
    LIMIT 1
  `,
    [userId]
  )
  const favoriteDecade = decadeResults.rows[0]?.decade || null

  // Get top favorites - ordered by play count and favorite status, not just recent
  const topFavorites = await query<RecentMovie>(
    `
    SELECT m.title, m.year, m.genres, m.community_rating
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1 AND wh.is_favorite = true
    ORDER BY wh.play_count DESC, wh.last_played_at DESC NULLS LAST
    LIMIT 10
  `,
    [userId]
  )

  // Get most rewatched movies (high engagement indicates strong preference)
  const mostRewatched = await query<RecentMovie & { play_count: number }>(
    `
    SELECT m.title, m.year, m.genres, m.community_rating, wh.play_count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1 AND wh.play_count > 1
    ORDER BY wh.play_count DESC
    LIMIT 10
  `,
    [userId]
  )

  // Get a diverse sample: mix of favorites, high play count, and some recent
  // This ensures we capture the full breadth of taste
  const diverseSample = await query<RecentMovie>(
    `
    WITH ranked AS (
      SELECT m.title, m.year, m.genres, m.community_rating,
             wh.is_favorite, wh.play_count, wh.last_played_at,
             ROW_NUMBER() OVER (PARTITION BY m.genres[1] ORDER BY wh.play_count DESC) as genre_rank
      FROM watch_history wh
      JOIN movies m ON m.id = wh.movie_id
      WHERE wh.user_id = $1
    )
    SELECT title, year, genres, community_rating
    FROM ranked
    WHERE genre_rank <= 3
    ORDER BY is_favorite DESC, play_count DESC
    LIMIT 20
  `,
    [userId]
  )

  // Build the prompt for OpenAI
  const prompt = buildSynopsisPrompt({
    totalWatched: Number(stats.total_watched),
    avgRating: Number(stats.avg_rating || 0),
    favoriteCount: Number(stats.favorite_count),
    topGenres,
    favoriteDecade,
    topFavorites: topFavorites.rows,
    mostRewatched: mostRewatched.rows,
    diverseSample: diverseSample.rows,
  })

  // Generate synopsis with AI provider
  let synopsis: string

  // Check if text generation is configured
  const isConfigured = await isAIFunctionConfigured('textGeneration')
  if (!isConfigured) {
    logger.warn({ userId }, 'Text generation not configured, using fallback synopsis')
    synopsis = buildFallbackSynopsis({
      totalWatched: Number(stats.total_watched),
      topGenres,
      favoriteDecade,
    })
  } else {
    try {
      const model = await getTextGenerationModelInstance()
      const { text } = await generateText({
        model,
        system: `You are a friendly movie expert writing a personalized taste profile for a user. 
Write in second person ("You love...", "Your taste tends toward...").
Be warm, insightful, and specific. Reference actual movies they've watched when relevant.
Keep it to 2-3 short paragraphs (about 100-150 words total).
Don't be generic - make observations that feel personal and perceptive.
If they have eclectic taste, celebrate that. If they have focused preferences, dive deep into what that reveals.`,
        prompt,
        temperature: 0.8,
        maxOutputTokens: 300,
      })

      synopsis = text || 'Unable to generate synopsis.'
    } catch (error) {
      logger.error({ error, userId }, 'Failed to generate synopsis')
      synopsis = buildFallbackSynopsis({
        totalWatched: Number(stats.total_watched),
        topGenres,
        favoriteDecade,
      })
    }
  }

  // Store the synopsis
  const now = new Date()
  await query(
    `
    INSERT INTO user_preferences (user_id, taste_synopsis, taste_synopsis_updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET
      taste_synopsis = $2,
      taste_synopsis_updated_at = $3,
      updated_at = NOW()
  `,
    [userId, synopsis, now]
  )

  logger.info({ userId, synopsisLength: synopsis.length }, 'Taste synopsis generated')

  return {
    synopsis,
    updatedAt: now,
    stats: {
      totalWatched: Number(stats.total_watched),
      topGenres,
      avgRating: Number(stats.avg_rating || 0),
      favoriteDecade,
      recentFavorites: topFavorites.rows.map((m) => m.title),
    },
  }
}

/**
 * Get existing synopsis or generate a new one if stale/missing
 */
export async function getTasteSynopsis(userId: string, maxAgeHours = 24): Promise<TasteSynopsis> {
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

  const now = new Date()
  const maxAge = maxAgeHours * 60 * 60 * 1000 // Convert hours to ms

  // Return existing if fresh enough
  if (
    existing?.taste_synopsis &&
    existing.taste_synopsis_updated_at &&
    now.getTime() - new Date(existing.taste_synopsis_updated_at).getTime() < maxAge
  ) {
    // Get stats for display
    const stats = await getQuickStats(userId)
    return {
      synopsis: existing.taste_synopsis,
      updatedAt: new Date(existing.taste_synopsis_updated_at),
      stats,
    }
  }

  // Generate new synopsis
  return generateTasteSynopsis(userId)
}

/**
 * Get quick stats without regenerating synopsis
 */
async function getQuickStats(userId: string): Promise<TasteSynopsis['stats']> {
  const stats = await queryOne<WatchHistoryStats>(
    `
    SELECT 
      COUNT(DISTINCT wh.movie_id) as total_watched,
      AVG(m.community_rating) as avg_rating,
      COUNT(CASE WHEN wh.is_favorite THEN 1 END) as favorite_count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1
  `,
    [userId]
  )

  const genreResults = await query<GenreCount>(
    `
    SELECT unnest(m.genres) as genre, COUNT(*) as count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1
    GROUP BY unnest(m.genres)
    ORDER BY count DESC
    LIMIT 5
  `,
    [userId]
  )

  const decadeResults = await query<DecadeCount>(
    `
    SELECT 
      (FLOOR(m.year / 10) * 10)::TEXT || 's' as decade,
      COUNT(*) as count
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1 AND m.year IS NOT NULL
    GROUP BY FLOOR(m.year / 10)
    ORDER BY count DESC
    LIMIT 1
  `,
    [userId]
  )

  const recentFavorites = await query<{ title: string }>(
    `
    SELECT m.title
    FROM watch_history wh
    JOIN movies m ON m.id = wh.movie_id
    WHERE wh.user_id = $1 AND (wh.is_favorite = true OR m.community_rating >= 7)
    ORDER BY wh.last_played_at DESC NULLS LAST
    LIMIT 5
  `,
    [userId]
  )

  return {
    totalWatched: Number(stats?.total_watched || 0),
    topGenres: genreResults.rows.map((r) => r.genre),
    avgRating: Number(stats?.avg_rating || 0),
    favoriteDecade: decadeResults.rows[0]?.decade || null,
    recentFavorites: recentFavorites.rows.map((m) => m.title),
  }
}

/**
 * Build the prompt for OpenAI
 */
function buildSynopsisPrompt(data: {
  totalWatched: number
  avgRating: number
  favoriteCount: number
  topGenres: string[]
  favoriteDecade: string | null
  topFavorites: RecentMovie[]
  mostRewatched: (RecentMovie & { play_count?: number })[]
  diverseSample: RecentMovie[]
}): string {
  const lines = [
    `User's Complete Movie Watching Profile:`,
    `- Total movies watched: ${data.totalWatched}`,
    `- Movies marked as favorites: ${data.favoriteCount}`,
    `- Average rating of watched movies: ${data.avgRating.toFixed(1)}/10`,
    `- Top genres by watch count: ${data.topGenres.join(', ') || 'Diverse'}`,
    `- Most watched decade: ${data.favoriteDecade || 'Various decades'}`,
    ``,
  ]

  if (data.topFavorites.length > 0) {
    lines.push(`Movies they've marked as FAVORITES (these define their taste):`)
    for (const movie of data.topFavorites.slice(0, 8)) {
      lines.push(
        `- "${movie.title}" (${movie.year || 'N/A'}) - ${movie.genres?.join(', ') || 'Unknown genre'}`
      )
    }
    lines.push(``)
  }

  if (data.mostRewatched.length > 0) {
    lines.push(`Most REWATCHED movies (high engagement = strong preference):`)
    for (const movie of data.mostRewatched.slice(0, 6)) {
      const playCount = movie.play_count ? ` [watched ${movie.play_count}x]` : ''
      lines.push(
        `- "${movie.title}" (${movie.year || 'N/A'})${playCount} - ${movie.genres?.join(', ') || 'Unknown genre'}`
      )
    }
    lines.push(``)
  }

  lines.push(`Diverse sample across their watch history (represents full taste breadth):`)
  for (const movie of data.diverseSample.slice(0, 12)) {
    lines.push(
      `- "${movie.title}" (${movie.year || 'N/A'}) - ${movie.genres?.join(', ') || 'Unknown genre'}`
    )
  }

  lines.push(``)
  lines.push(
    `Write a personalized taste profile that captures the FULL breadth of their preferences.`
  )
  lines.push(
    `Don't over-emphasize any single movie or franchise - look for patterns across ALL the data.`
  )
  lines.push(`Mention specific movies by name when they exemplify a pattern in their taste.`)

  return lines.join('\n')
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
