import { createChildLogger } from '../lib/logger.js'
import { getOpenAIClient } from '../lib/openai.js'
import { query, queryOne } from '../lib/db.js'
import { getTextGenerationModel } from '../settings/systemSettings.js'

const logger = createChildLogger('channels')

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
    const model = await getTextGenerationModel()
    const openai = await getOpenAIClient()
    const response = await openai.chat.completions.create({
      model,
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
    const model = await getTextGenerationModel()
    const openai = await getOpenAIClient()
    const response = await openai.chat.completions.create({
      model,
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
    const model = await getTextGenerationModel()
    const openai = await getOpenAIClient()
    const response = await openai.chat.completions.create({
      model,
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

