import fs from 'fs/promises'
import path from 'path'
import OpenAI from 'openai'
import { createChildLogger } from '../lib/logger.js'
import { query, queryOne } from '../lib/db.js'
import { getMediaServerProvider } from '../media/index.js'
import { getMovieEmbedding, averageEmbeddings } from '../recommender/embeddings.js'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const logger = createChildLogger('channels')

interface Channel {
  id: string
  ownerId: string
  name: string
  description: string | null
  genreFilters: string[]
  textPreferences: string | null
  exampleMovieIds: string[]
  isPinnedRow: boolean
  playlistId: string | null
  isActive: boolean
}

interface ChannelRecommendation {
  movieId: string
  providerItemId: string
  title: string
  year: number | null
  score: number
}

/**
 * Weighted random sampling - picks items with probability proportional to their weight
 */
function weightedRandomSample<T extends { score: number }>(
  items: T[],
  count: number
): T[] {
  if (items.length <= count) return items

  const selected: T[] = []
  const remaining = [...items]

  // Normalize scores to be positive weights (similarity scores are typically 0-1)
  // Square the scores to give higher-scored items more weight while still allowing variety
  const getWeight = (score: number) => Math.pow(Math.max(0.1, score), 2)

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + getWeight(item.score), 0)
    let random = Math.random() * totalWeight

    for (let j = 0; j < remaining.length; j++) {
      random -= getWeight(remaining[j].score)
      if (random <= 0) {
        selected.push(remaining[j])
        remaining.splice(j, 1)
        break
      }
    }
  }

  // Sort selected by score descending for a nice order in the playlist
  return selected.sort((a, b) => b.score - a.score)
}

/**
 * Generate recommendations for a specific channel
 */
export async function generateChannelRecommendations(
  channelId: string,
  limit = 20
): Promise<ChannelRecommendation[]> {
  // Get channel details with owner's parental rating
  const channel = await queryOne<{
    id: string
    owner_id: string
    name: string
    genre_filters: string[]
    text_preferences: string | null
    example_movie_ids: string[]
    max_parental_rating: number | null
  }>(
    `SELECT c.*, u.max_parental_rating 
     FROM channels c
     JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1`,
    [channelId]
  )

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  logger.info({ 
    channelId, 
    name: channel.name, 
    maxParentalRating: channel.max_parental_rating 
  }, 'Generating channel recommendations')

  // Build channel taste profile from example movies
  let tasteProfile: number[] | null = null

  if (channel.example_movie_ids && channel.example_movie_ids.length > 0) {
    const embeddings: number[][] = []

    for (const movieId of channel.example_movie_ids) {
      const emb = await getMovieEmbedding(movieId)
      if (emb) {
        embeddings.push(emb)
      }
    }

    if (embeddings.length > 0) {
      tasteProfile = averageEmbeddings(embeddings)
    }
  }

  // Get user's watch history to exclude watched movies
  const watched = await query<{ movie_id: string }>(
    'SELECT movie_id FROM watch_history WHERE user_id = $1',
    [channel.owner_id]
  )
  const watchedIds = new Set(watched.rows.map((r) => r.movie_id))

  // Build query for candidates
  const whereClauses: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  // Genre filter
  if (channel.genre_filters && channel.genre_filters.length > 0) {
    whereClauses.push(`m.genres && $${paramIndex++}`)
    params.push(channel.genre_filters)
  }

  // Parental rating filter - filter movies based on user's max allowed rating
  if (channel.max_parental_rating !== null) {
    whereClauses.push(`(
      m.content_rating IS NULL OR
      COALESCE((SELECT prv.rating_value FROM parental_rating_values prv WHERE prv.rating_name = m.content_rating LIMIT 1), 0) <= $${paramIndex++}
    )`)
    params.push(channel.max_parental_rating)
  }

  const whereClause = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : ''

  // Fetch more candidates than needed (3x) to enable variety through weighted sampling
  const poolSize = limit * 3

  let candidates: ChannelRecommendation[]

  if (tasteProfile) {
    // Use embedding similarity
    const vectorStr = `[${tasteProfile.join(',')}]`
    params.push(vectorStr)

    const result = await query<{
      id: string
      provider_item_id: string
      title: string
      year: number | null
      similarity: number
    }>(
      `SELECT m.id, m.provider_item_id, m.title, m.year,
              1 - (e.embedding <=> $${paramIndex}::halfvec) as similarity
       FROM embeddings e
       JOIN movies m ON m.id = e.movie_id
       ${whereClause}
       ORDER BY e.embedding <=> $${paramIndex}::halfvec
       LIMIT $${paramIndex + 1}`,
      [...params, poolSize + watchedIds.size]
    )

    const pool = result.rows
      .filter((r) => !watchedIds.has(r.id))
      .slice(0, poolSize)
      .map((r) => ({
        movieId: r.id,
        providerItemId: r.provider_item_id,
        title: r.title,
        year: r.year,
        score: r.similarity,
      }))

    // Weighted random sampling for variety
    candidates = weightedRandomSample(pool, limit)
  } else {
    // Fallback to rating-based ordering
    const result = await query<{
      id: string
      provider_item_id: string
      title: string
      year: number | null
      community_rating: number | null
    }>(
      `SELECT m.id, m.provider_item_id, m.title, m.year, m.community_rating
       FROM movies m
       ${whereClause}
       ORDER BY m.community_rating DESC NULLS LAST
       LIMIT $${paramIndex}`,
      [...params, poolSize + watchedIds.size]
    )

    const pool = result.rows
      .filter((r) => !watchedIds.has(r.id))
      .slice(0, poolSize)
      .map((r) => ({
        movieId: r.id,
        providerItemId: r.provider_item_id,
        title: r.title,
        year: r.year,
        score: r.community_rating ? r.community_rating / 10 : 0.5,
      }))

    // Weighted random sampling for variety
    candidates = weightedRandomSample(pool, limit)
  }

  logger.info(
    { channelId, candidateCount: candidates.length, topScores: candidates.slice(0, 3).map((c) => c.score.toFixed(3)) },
    'Generated channel recommendations with variability'
  )

  return candidates
}

/**
 * Update a channel's playlist in the media server
 */
export async function updateChannelPlaylist(channelId: string): Promise<string> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Get channel details with owner info
  const channel = await queryOne<{
    id: string
    owner_id: string
    name: string
    playlist_id: string | null
    provider_user_id: string
    display_name: string | null
    username: string
  }>(
    `SELECT c.*, u.provider_user_id, u.display_name, u.username
     FROM channels c
     JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1`,
    [channelId]
  )

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  // Generate recommendations
  const recommendations = await generateChannelRecommendations(channelId)
  const itemIds = recommendations.map((r) => r.providerItemId)

  // Create/update playlist
  const result = await provider.createOrUpdatePlaylist(
    apiKey,
    channel.provider_user_id,
    channel.name,
    itemIds
  )

  // Store playlist ID if new
  if (!channel.playlist_id || channel.playlist_id !== result.playlistId) {
    await query(
      `UPDATE channels SET playlist_id = $1, last_generated_at = NOW() WHERE id = $2`,
      [result.playlistId, channelId]
    )

    // Also store in playlists table
    await query(
      `INSERT INTO playlists (user_id, channel_id, name, provider_playlist_id, playlist_type, item_count)
       VALUES ($1, $2, $3, $4, 'channel', $5)
       ON CONFLICT DO NOTHING`,
      [channel.owner_id, channelId, channel.name, result.playlistId, itemIds.length]
    )
  } else {
    await query(
      `UPDATE channels SET last_generated_at = NOW() WHERE id = $1`,
      [channelId]
    )
  }

  logger.info({ channelId, playlistId: result.playlistId, itemCount: itemIds.length }, 'Channel playlist updated')

  return result.playlistId
}

/**
 * Create shared playlist for a channel viewer
 */
export async function createSharedPlaylist(
  channelId: string,
  sharedWithUserId: string
): Promise<string> {
  const provider = getMediaServerProvider()
  const apiKey = process.env.MEDIA_SERVER_API_KEY

  if (!apiKey) {
    throw new Error('MEDIA_SERVER_API_KEY is required')
  }

  // Get channel details
  const channel = await queryOne<{
    id: string
    name: string
    owner_username: string
    owner_display_name: string | null
  }>(
    `SELECT c.id, c.name, u.username as owner_username, u.display_name as owner_display_name
     FROM channels c
     JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1`,
    [channelId]
  )

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  // Get viewer's provider user ID
  const viewer = await queryOne<{ provider_user_id: string }>(
    'SELECT provider_user_id FROM users WHERE id = $1',
    [sharedWithUserId]
  )

  if (!viewer) {
    throw new Error(`User not found: ${sharedWithUserId}`)
  }

  // Generate recommendations for the channel
  const recommendations = await generateChannelRecommendations(channelId)
  const itemIds = recommendations.map((r) => r.providerItemId)

  // Create playlist with owner's name
  const ownerName = channel.owner_display_name || channel.owner_username
  const playlistName = `${ownerName} - ${channel.name}`

  const result = await provider.createOrUpdatePlaylist(
    apiKey,
    viewer.provider_user_id,
    playlistName,
    itemIds
  )

  // Store in channel_shares
  await query(
    `UPDATE channel_shares SET viewer_playlist_id = $1 WHERE channel_id = $2 AND shared_with_user_id = $3`,
    [result.playlistId, channelId, sharedWithUserId]
  )

  // Store in playlists table
  const share = await queryOne<{ id: string }>(
    'SELECT id FROM channel_shares WHERE channel_id = $1 AND shared_with_user_id = $2',
    [channelId, sharedWithUserId]
  )

  if (share) {
    await query(
      `INSERT INTO playlists (user_id, channel_id, name, provider_playlist_id, playlist_type, channel_share_id, item_count)
       VALUES ($1, $2, $3, $4, 'shared_channel', $5, $6)
       ON CONFLICT DO NOTHING`,
      [sharedWithUserId, channelId, playlistName, result.playlistId, share.id, itemIds.length]
    )
  }

  logger.info({ channelId, sharedWithUserId, playlistId: result.playlistId }, 'Shared playlist created')

  return result.playlistId
}

/**
 * Process all active channels (generate playlists)
 */
export async function processAllChannels(): Promise<{
  success: number
  failed: number
}> {
  const channels = await query<{ id: string; name: string }>(
    'SELECT id, name FROM channels WHERE is_active = true'
  )

  let success = 0
  let failed = 0

  for (const channel of channels.rows) {
    try {
      await updateChannelPlaylist(channel.id)

      // Also update shared playlists
      const shares = await query<{ shared_with_user_id: string }>(
        'SELECT shared_with_user_id FROM channel_shares WHERE channel_id = $1',
        [channel.id]
      )

      for (const share of shares.rows) {
        try {
          await createSharedPlaylist(channel.id, share.shared_with_user_id)
        } catch (err) {
          logger.error({ err, channelId: channel.id, userId: share.shared_with_user_id }, 'Failed to create shared playlist')
        }
      }

      success++
    } catch (err) {
      logger.error({ err, channelId: channel.id }, 'Failed to process channel')
      failed++
    }
  }

  return { success, failed }
}

/**
 * Write STRM files for a pinned channel
 */
export async function writeChannelStrm(channelId: string): Promise<{
  written: number
  libraryPath: string
}> {
  // Get channel details
  const channel = await queryOne<{
    id: string
    name: string
    owner_id: string
    provider_user_id: string
    owner_display_name: string | null
    owner_username: string
  }>(
    `SELECT c.id, c.name, c.owner_id, u.provider_user_id, u.display_name as owner_display_name, u.username as owner_username
     FROM channels c
     JOIN users u ON u.id = c.owner_id
     WHERE c.id = $1 AND c.is_pinned_row = true`,
    [channelId]
  )

  if (!channel) {
    throw new Error(`Pinned channel not found: ${channelId}`)
  }

  const ownerName = channel.owner_display_name || channel.owner_username
  const libraryPathPrefix = process.env.AI_LIBRARY_PATH_PREFIX || '/strm/aperture/'
  const libraryPath = path.join(libraryPathPrefix, 'channels', channel.id)

  // Ensure directory exists
  await fs.mkdir(libraryPath, { recursive: true })

  // Generate recommendations
  const recommendations = await generateChannelRecommendations(channelId)

  // Write STRM files
  for (const rec of recommendations) {
    const filename = `${rec.title.replace(/[<>:"/\\|?*]/g, '')} (${rec.year || 'Unknown'}) [${rec.providerItemId}].strm`
    const filePath = path.join(libraryPath, filename)

    // Get streaming URL
    const provider = getMediaServerProvider()
    const apiKey = process.env.MEDIA_SERVER_API_KEY || ''
    const content = provider.getStreamUrl(apiKey, rec.providerItemId)

    await fs.writeFile(filePath, content, 'utf-8')
  }

  logger.info({ channelId, written: recommendations.length, libraryPath }, 'Channel STRM files written')

  return {
    written: recommendations.length,
    libraryPath,
  }
}

/**
 * Generate AI-powered text preferences for a channel based on:
 * - User's taste profile/synopsis
 * - Selected genres
 * - Example movies
 */
export async function generateAIPreferences(
  userId: string,
  genres: string[],
  exampleMovieIds: string[]
): Promise<string> {
  logger.info({ userId, genres, exampleMovieCount: exampleMovieIds.length }, 'Generating AI preferences')

  // Get user's taste synopsis
  const tasteProfile = await queryOne<{ taste_synopsis: string | null }>(
    'SELECT taste_synopsis FROM user_preferences WHERE user_id = $1',
    [userId]
  )

  // Get example movie details
  let exampleMovies: Array<{ title: string; year: number | null; genres: string[]; overview: string | null }> = []
  if (exampleMovieIds.length > 0) {
    const moviesResult = await query<{
      title: string
      year: number | null
      genres: string[]
      overview: string | null
    }>(
      'SELECT title, year, genres, overview FROM movies WHERE id = ANY($1)',
      [exampleMovieIds]
    )
    exampleMovies = moviesResult.rows
  }

  // Build context for AI
  const contextParts: string[] = []

  if (tasteProfile?.taste_synopsis) {
    contextParts.push(`USER'S TASTE PROFILE:\n${tasteProfile.taste_synopsis}`)
  }

  if (genres.length > 0) {
    contextParts.push(`SELECTED GENRES:\n${genres.join(', ')}`)
  }

  if (exampleMovies.length > 0) {
    const movieList = exampleMovies
      .map((m) => `- "${m.title}" (${m.year || 'N/A'}) - ${m.genres?.join(', ') || 'Unknown genres'}`)
      .join('\n')
    contextParts.push(`EXAMPLE MOVIES (defining the playlist's style):\n${movieList}`)
  }

  if (contextParts.length === 0) {
    return 'Please select some genres or example movies to help generate preferences.'
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a movie curator helping create a custom playlist. Based on the user's taste profile, selected genres, and example movies, generate 2-3 short preference paragraphs that describe what kind of movies should be included in this playlist.

Be specific and actionable. Reference the qualities, themes, and styles evident in the example movies. Consider what makes these movies work together as a collection.

Focus on:
- Tone and mood (e.g., "dark and atmospheric" vs "light-hearted and fun")
- Storytelling style (e.g., "character-driven narratives" vs "plot-heavy thrillers")
- Visual or stylistic preferences (e.g., "practical effects", "neon-lit aesthetics")
- Thematic elements (e.g., "underdog stories", "moral ambiguity", "found family")
- Era or time period preferences
- What to avoid if implied by the examples

Write in first person as if the user is describing what they want. Keep it concise but specific - each paragraph should be 1-2 sentences. Don't use bullet points.`,
        },
        {
          role: 'user',
          content: contextParts.join('\n\n'),
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const preferences = response.choices[0]?.message?.content
    if (!preferences) {
      throw new Error('No response from AI')
    }

    logger.info({ userId, preferencesLength: preferences.length }, 'AI preferences generated')
    return preferences
  } catch (error) {
    logger.error({ error, userId }, 'Failed to generate AI preferences')
    throw new Error('Failed to generate AI preferences. Please try again.')
  }
}

/**
 * Build context string from genres, example movies, and preferences
 */
async function buildPlaylistContext(
  genres: string[],
  exampleMovieIds: string[],
  textPreferences?: string
): Promise<string> {
  const contextParts: string[] = []

  if (genres.length > 0) {
    contextParts.push(`GENRES: ${genres.join(', ')}`)
  }

  if (exampleMovieIds.length > 0) {
    const moviesResult = await query<{
      title: string
      year: number | null
      genres: string[]
    }>(
      'SELECT title, year, genres FROM movies WHERE id = ANY($1)',
      [exampleMovieIds]
    )
    const movieList = moviesResult.rows
      .map((m) => `"${m.title}" (${m.year || 'N/A'})`)
      .join(', ')
    contextParts.push(`EXAMPLE MOVIES: ${movieList}`)
  }

  if (textPreferences) {
    contextParts.push(`PREFERENCES: ${textPreferences}`)
  }

  return contextParts.join('\n')
}

/**
 * Generate an AI-powered playlist name
 */
export async function generateAIPlaylistName(
  genres: string[],
  exampleMovieIds: string[],
  textPreferences?: string
): Promise<string> {
  logger.info({ genres, exampleMovieCount: exampleMovieIds.length }, 'Generating AI playlist name')

  const context = await buildPlaylistContext(genres, exampleMovieIds, textPreferences)

  if (!context) {
    return 'My Playlist'
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a creative playlist naming expert. Generate a single catchy, memorable playlist name based on the provided context.

Rules:
- Keep it short (2-4 words max)
- Be creative and evocative, not generic
- Capture the mood/vibe of the movies
- Can use alliteration, wordplay, or cultural references
- Don't use generic words like "Collection", "Playlist", "Mix"
- Don't include genre names directly unless cleverly incorporated

Examples of good names:
- "Neon Noir Nights" (cyberpunk/noir)
- "Popcorn Apocalypse" (action/disaster)
- "Cozy Crimes" (mystery/comfort)
- "Starlight Escapes" (sci-fi/adventure)
- "Midnight Mayhem" (horror/thriller)
- "Retro Rewind" (80s movies)

Return ONLY the playlist name, nothing else.`,
        },
        {
          role: 'user',
          content: context,
        },
      ],
      temperature: 0.9,
      max_tokens: 50,
    })

    const name = response.choices[0]?.message?.content?.trim()
    if (!name) {
      throw new Error('No response from AI')
    }

    // Remove quotes if AI added them
    return name.replace(/^["']|["']$/g, '')
  } catch (error) {
    logger.error({ error }, 'Failed to generate AI playlist name')
    throw new Error('Failed to generate playlist name. Please try again.')
  }
}

/**
 * Generate an AI-powered playlist description
 */
export async function generateAIPlaylistDescription(
  genres: string[],
  exampleMovieIds: string[],
  textPreferences?: string,
  playlistName?: string
): Promise<string> {
  logger.info({ genres, exampleMovieCount: exampleMovieIds.length, playlistName }, 'Generating AI playlist description')

  const context = await buildPlaylistContext(genres, exampleMovieIds, textPreferences)

  if (!context) {
    return 'A curated collection of movies.'
  }

  const nameContext = playlistName ? `\nPLAYLIST NAME: "${playlistName}"` : ''

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a movie curator writing a brief playlist description. Write 1-2 sentences that capture what makes this playlist special.

Rules:
- Be concise and engaging
- Highlight the mood, themes, or experience
- Don't list genres directly - describe the feeling
- If a playlist name is provided, the description should complement it
- Write in third person (describe the playlist, not "you")

Examples:
- "A pulse-pounding journey through high-stakes heists and impossible escapes. Every film delivers edge-of-your-seat tension."
- "Heartwarming tales of unlikely friendships and second chances. Perfect for when you need to believe in happy endings."
- "Dark, atmospheric thrillers where nothing is as it seems. Prepare for twist endings and sleepless nights."

Return ONLY the description, nothing else.`,
        },
        {
          role: 'user',
          content: context + nameContext,
        },
      ],
      temperature: 0.8,
      max_tokens: 150,
    })

    const description = response.choices[0]?.message?.content?.trim()
    if (!description) {
      throw new Error('No response from AI')
    }

    return description
  } catch (error) {
    logger.error({ error }, 'Failed to generate AI playlist description')
    throw new Error('Failed to generate playlist description. Please try again.')
  }
}

