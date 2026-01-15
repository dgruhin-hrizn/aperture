/**
 * Series Taste Synopsis Generator
 * 
 * Generates a natural language summary of a user's TV series taste
 * based on their watch history and preferences.
 */

import { query, queryOne } from './db.js'
import { createChildLogger } from './logger.js'
import { getTextGenerationModelInstance, isAIFunctionConfigured } from './ai-provider.js'
import { generateText } from 'ai'

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
 * Generate a series taste synopsis for a user
 */
export async function generateSeriesTasteSynopsis(userId: string): Promise<SeriesTasteSynopsis> {
  logger.info({ userId }, 'Generating series taste synopsis')

  // Get watch history stats
  const stats = await queryOne<SeriesWatchStats>(`
    SELECT 
      COUNT(DISTINCT e.series_id) as series_count,
      COUNT(DISTINCT wh.episode_id) as episode_count,
      AVG(s.community_rating) as avg_rating,
      COUNT(CASE WHEN wh.is_favorite THEN 1 END) as favorite_count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode'
  `, [userId])

  if (!stats || stats.series_count === 0) {
    return {
      synopsis: "We're still getting to know your TV preferences! Watch some episodes and we'll build your series taste profile.",
      updatedAt: new Date(),
      stats: {
        totalSeriesStarted: 0,
        totalEpisodesWatched: 0,
        topGenres: [],
        avgRating: 0,
        favoriteDecade: null,
        favoriteNetworks: [],
        recentFavorites: [],
      },
    }
  }

  // Get top genres
  const genreResults = await query<GenreCount>(`
    SELECT unnest(s.genres) as genre, COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode'
    GROUP BY unnest(s.genres)
    ORDER BY count DESC
    LIMIT 5
  `, [userId])
  const topGenres = genreResults.rows.map(r => r.genre)

  // Get favorite networks
  const networkResults = await query<NetworkCount>(`
    SELECT s.network, COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s.network IS NOT NULL
    GROUP BY s.network
    ORDER BY count DESC
    LIMIT 3
  `, [userId])
  const favoriteNetworks = networkResults.rows.map(r => r.network)

  // Get favorite decade
  const decadeResults = await query<DecadeCount>(`
    SELECT 
      (FLOOR(s.year / 10) * 10)::TEXT || 's' as decade,
      COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s.year IS NOT NULL
    GROUP BY FLOOR(s.year / 10)
    ORDER BY count DESC
    LIMIT 1
  `, [userId])
  const favoriteDecade = decadeResults.rows[0]?.decade || null

  // Get most watched series with completion rates
  const topSeries = await query<WatchedSeries>(`
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
    GROUP BY s.id, s.title, s.year, s.genres, s.community_rating, s.network, s.total_episodes
    ORDER BY episodes_watched DESC
    LIMIT 15
  `, [userId])

  // Get series with favorite episodes
  const seriesWithFavorites = await query<{ title: string; favorite_count: number }>(`
    SELECT s.title, COUNT(*) as favorite_count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND wh.is_favorite = true
    GROUP BY s.id, s.title
    ORDER BY favorite_count DESC
    LIMIT 10
  `, [userId])

  // Get completed series (high engagement)
  const completedSeries = await query<WatchedSeries>(`
    SELECT 
      s.title, s.year, s.genres, s.community_rating, s.network,
      COUNT(DISTINCT wh.episode_id) as episodes_watched,
      s.total_episodes,
      ROUND(COUNT(DISTINCT wh.episode_id)::numeric / s.total_episodes * 100) as completion_rate
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s.total_episodes > 0
    GROUP BY s.id, s.title, s.year, s.genres, s.community_rating, s.network, s.total_episodes
    HAVING COUNT(DISTINCT wh.episode_id)::numeric / s.total_episodes >= 0.75
    ORDER BY s.total_episodes DESC
    LIMIT 10
  `, [userId])

  // Build the prompt for OpenAI
  const prompt = buildSeriesSynopsisPrompt({
    seriesCount: Number(stats.series_count),
    episodeCount: Number(stats.episode_count),
    avgRating: Number(stats.avg_rating || 0),
    favoriteCount: Number(stats.favorite_count),
    topGenres,
    favoriteNetworks,
    favoriteDecade,
    topSeries: topSeries.rows,
    seriesWithFavorites: seriesWithFavorites.rows,
    completedSeries: completedSeries.rows,
  })

  // Generate synopsis with AI provider
  let synopsis: string
  
  // Check if text generation is configured
  const isConfigured = await isAIFunctionConfigured('textGeneration')
  if (!isConfigured) {
    logger.warn({ userId }, 'Text generation not configured, using fallback synopsis')
    synopsis = buildFallbackSeriesSynopsis({
      seriesCount: Number(stats.series_count),
      episodeCount: Number(stats.episode_count),
      topGenres,
      favoriteNetworks,
      favoriteDecade,
    })
  } else {
    try {
      const model = await getTextGenerationModelInstance()
      const { text } = await generateText({
        model,
        system: `You are a friendly TV expert writing a personalized taste profile for a user's TV series preferences.
Write in second person ("You love...", "Your taste tends toward...").
Be warm, insightful, and specific. Reference actual shows they've watched when relevant.
Keep it to 2-3 short paragraphs (about 100-150 words total).
Don't be generic - make observations that feel personal and perceptive.
Note their viewing habits: do they complete series or sample many? Do they prefer certain networks or eras?
If they have eclectic taste, celebrate that. If they have focused preferences, dive deep into what that reveals.`,
        prompt,
        temperature: 0.8,
        maxOutputTokens: 300,
      })

      synopsis = text || 'Unable to generate synopsis.'
    } catch (error) {
      logger.error({ error, userId }, 'Failed to generate series synopsis')
      synopsis = buildFallbackSeriesSynopsis({
        seriesCount: Number(stats.series_count),
        episodeCount: Number(stats.episode_count),
        topGenres,
        favoriteNetworks,
        favoriteDecade,
      })
    }
  }

  // Store the synopsis
  const now = new Date()
  await query(`
    INSERT INTO user_preferences (user_id, series_taste_synopsis, series_taste_synopsis_updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET
      series_taste_synopsis = $2,
      series_taste_synopsis_updated_at = $3,
      updated_at = NOW()
  `, [userId, synopsis, now])

  logger.info({ userId, synopsisLength: synopsis.length }, 'Series taste synopsis generated')

  return {
    synopsis,
    updatedAt: now,
    stats: {
      totalSeriesStarted: Number(stats.series_count),
      totalEpisodesWatched: Number(stats.episode_count),
      topGenres,
      avgRating: Number(stats.avg_rating || 0),
      favoriteDecade,
      favoriteNetworks,
      recentFavorites: topSeries.rows.slice(0, 5).map(s => s.title),
    },
  }
}

/**
 * Get existing series synopsis or generate a new one if stale/missing
 */
export async function getSeriesTasteSynopsis(userId: string, maxAgeHours = 24): Promise<SeriesTasteSynopsis> {
  // Check for existing synopsis
  const existing = await queryOne<{
    series_taste_synopsis: string | null
    series_taste_synopsis_updated_at: Date | null
  }>(`
    SELECT series_taste_synopsis, series_taste_synopsis_updated_at
    FROM user_preferences
    WHERE user_id = $1
  `, [userId])

  const now = new Date()
  const maxAge = maxAgeHours * 60 * 60 * 1000 // Convert hours to ms

  // Return existing if fresh enough
  if (
    existing?.series_taste_synopsis &&
    existing.series_taste_synopsis_updated_at &&
    now.getTime() - new Date(existing.series_taste_synopsis_updated_at).getTime() < maxAge
  ) {
    // Get stats for display
    const stats = await getSeriesQuickStats(userId)
    return {
      synopsis: existing.series_taste_synopsis,
      updatedAt: new Date(existing.series_taste_synopsis_updated_at),
      stats,
    }
  }

  // Generate new synopsis
  return generateSeriesTasteSynopsis(userId)
}

/**
 * Get quick stats without regenerating synopsis
 */
async function getSeriesQuickStats(userId: string): Promise<SeriesTasteSynopsis['stats']> {
  const stats = await queryOne<SeriesWatchStats>(`
    SELECT 
      COUNT(DISTINCT e.series_id) as series_count,
      COUNT(DISTINCT wh.episode_id) as episode_count,
      AVG(s.community_rating) as avg_rating,
      COUNT(CASE WHEN wh.is_favorite THEN 1 END) as favorite_count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode'
  `, [userId])

  const genreResults = await query<GenreCount>(`
    SELECT unnest(s.genres) as genre, COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode'
    GROUP BY unnest(s.genres)
    ORDER BY count DESC
    LIMIT 5
  `, [userId])

  const networkResults = await query<NetworkCount>(`
    SELECT s.network, COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s.network IS NOT NULL
    GROUP BY s.network
    ORDER BY count DESC
    LIMIT 3
  `, [userId])

  const decadeResults = await query<DecadeCount>(`
    SELECT 
      (FLOOR(s.year / 10) * 10)::TEXT || 's' as decade,
      COUNT(DISTINCT e.series_id) as count
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' AND s.year IS NOT NULL
    GROUP BY FLOOR(s.year / 10)
    ORDER BY count DESC
    LIMIT 1
  `, [userId])

  const recentFavorites = await query<{ title: string }>(`
    SELECT DISTINCT s.title
    FROM watch_history wh
    JOIN episodes e ON e.id = wh.episode_id
    JOIN series s ON s.id = e.series_id
    WHERE wh.user_id = $1 AND wh.media_type = 'episode' 
      AND (wh.is_favorite = true OR s.community_rating >= 7)
    ORDER BY s.title
    LIMIT 5
  `, [userId])

  return {
    totalSeriesStarted: Number(stats?.series_count || 0),
    totalEpisodesWatched: Number(stats?.episode_count || 0),
    topGenres: genreResults.rows.map(r => r.genre),
    avgRating: Number(stats?.avg_rating || 0),
    favoriteDecade: decadeResults.rows[0]?.decade || null,
    favoriteNetworks: networkResults.rows.map(r => r.network),
    recentFavorites: recentFavorites.rows.map(s => s.title),
  }
}

/**
 * Build the prompt for OpenAI
 */
function buildSeriesSynopsisPrompt(data: {
  seriesCount: number
  episodeCount: number
  avgRating: number
  favoriteCount: number
  topGenres: string[]
  favoriteNetworks: string[]
  favoriteDecade: string | null
  topSeries: WatchedSeries[]
  seriesWithFavorites: Array<{ title: string; favorite_count: number }>
  completedSeries: WatchedSeries[]
}): string {
  const lines = [
    `User's Complete TV Series Watching Profile:`,
    `- Total series started: ${data.seriesCount}`,
    `- Total episodes watched: ${data.episodeCount}`,
    `- Episodes marked as favorites: ${data.favoriteCount}`,
    `- Average rating of watched series: ${data.avgRating.toFixed(1)}/10`,
    `- Top genres: ${data.topGenres.join(', ') || 'Diverse'}`,
    `- Favorite networks: ${data.favoriteNetworks.join(', ') || 'Various'}`,
    `- Most watched decade: ${data.favoriteDecade || 'Various decades'}`,
    ``,
  ]

  if (data.topSeries.length > 0) {
    lines.push(`Most watched series (ranked by episode count):`)
    for (const series of data.topSeries.slice(0, 10)) {
      const completion = series.completion_rate ? ` (${series.completion_rate}% complete)` : ''
      const network = series.network ? ` [${series.network}]` : ''
      lines.push(`- "${series.title}" (${series.year || 'N/A'}) - ${series.episodes_watched} episodes${completion}${network}`)
    }
    lines.push(``)
  }

  if (data.completedSeries.length > 0) {
    lines.push(`Series they've committed to (75%+ completion):`)
    for (const series of data.completedSeries.slice(0, 6)) {
      lines.push(`- "${series.title}" - ${series.genres?.join(', ') || 'Unknown genre'}`)
    }
    lines.push(``)
  }

  if (data.seriesWithFavorites.length > 0) {
    lines.push(`Series with favorited episodes (emotional engagement):`)
    for (const series of data.seriesWithFavorites.slice(0, 6)) {
      lines.push(`- "${series.title}" - ${series.favorite_count} favorite episode(s)`)
    }
    lines.push(``)
  }

  lines.push(`Write a personalized taste profile that captures their TV viewing style.`)
  lines.push(`Note patterns: Do they complete series or sample many? Prefer certain networks/eras?`)
  lines.push(`Mention specific shows by name when they exemplify patterns in their taste.`)

  return lines.join('\n')
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
  const genreText = data.topGenres.length > 0
    ? `Your top genres are ${data.topGenres.slice(0, 3).join(', ')}`
    : `You enjoy a diverse range of genres`

  const networkText = data.favoriteNetworks.length > 0
    ? `, often from ${data.favoriteNetworks[0]}`
    : ``

  const decadeText = data.favoriteDecade
    ? `, with a particular fondness for shows from the ${data.favoriteDecade}`
    : ``

  return `Based on ${data.seriesCount} series and ${data.episodeCount} episodes in your watch history, we're getting to know your TV taste! ${genreText}${networkText}${decadeText}. Keep watching and we'll refine your profile even further.`
}

