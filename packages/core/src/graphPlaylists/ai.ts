/**
 * AI generation for graph playlist names and descriptions
 */

import { createChildLogger } from '../lib/logger.js'
import { getOpenAIClient } from '../lib/openai.js'
import { query } from '../lib/db.js'
import { getTextGenerationModel } from '../settings/systemSettings.js'

const logger = createChildLogger('graphPlaylists')

interface MediaItem {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
}

/**
 * Fetch movie details by IDs
 */
async function getMovieDetails(movieIds: string[]): Promise<MediaItem[]> {
  if (movieIds.length === 0) return []

  const result = await query<{
    id: string
    title: string
    year: number | null
    genres: string[]
    overview: string | null
  }>(
    'SELECT id, title, year, genres, overview FROM movies WHERE id = ANY($1)',
    [movieIds]
  )
  return result.rows
}

/**
 * Fetch series details by IDs
 */
async function getSeriesDetails(seriesIds: string[]): Promise<MediaItem[]> {
  if (seriesIds.length === 0) return []

  const result = await query<{
    id: string
    title: string
    year: number | null
    genres: string[]
    overview: string | null
  }>(
    'SELECT id, title, year, genres, overview FROM series WHERE id = ANY($1)',
    [seriesIds]
  )
  return result.rows
}

/**
 * Build context from movies and series for AI prompts
 */
async function buildGraphContext(
  movieIds: string[],
  seriesIds: string[]
): Promise<{ context: string; items: MediaItem[] }> {
  const [movies, series] = await Promise.all([
    getMovieDetails(movieIds),
    getSeriesDetails(seriesIds),
  ])

  const allItems = [...movies, ...series]
  if (allItems.length === 0) {
    return { context: '', items: [] }
  }

  // Build title list
  const titleList = allItems
    .map((item) => `"${item.title}" (${item.year || 'N/A'})`)
    .join(', ')

  // Collect all unique genres
  const allGenres = [...new Set(allItems.flatMap((item) => item.genres || []))]

  // Build context
  const contextParts: string[] = []
  contextParts.push(`TITLES: ${titleList}`)
  
  if (allGenres.length > 0) {
    contextParts.push(`GENRES: ${allGenres.join(', ')}`)
  }

  // Add a few overviews for thematic context (not all - too verbose)
  const overviews = allItems
    .filter((item) => item.overview)
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.overview?.substring(0, 150)}...`)
  
  if (overviews.length > 0) {
    contextParts.push(`SAMPLE SYNOPSES:\n${overviews.join('\n')}`)
  }

  return { context: contextParts.join('\n\n'), items: allItems }
}

/**
 * Generate an AI-powered playlist name from graph items
 */
export async function generateGraphPlaylistName(
  movieIds: string[],
  seriesIds: string[]
): Promise<string> {
  logger.info({ movieCount: movieIds.length, seriesCount: seriesIds.length }, 'Generating graph playlist name')

  const { context, items } = await buildGraphContext(movieIds, seriesIds)

  if (!context || items.length === 0) {
    return 'My Collection'
  }

  try {
    const model = await getTextGenerationModel()
    const openai = await getOpenAIClient()
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a creative playlist naming expert. Generate a single catchy, memorable playlist name based on the provided movies/shows.

Rules:
- Keep it short (2-4 words max)
- Be creative and evocative - capture what connects these titles
- Find the common thread: franchise, director, era, mood, theme
- Can use alliteration, wordplay, or cultural references
- Don't use generic words like "Collection", "Playlist", "Mix"
- If it's clearly a franchise (Star Wars, Marvel, etc.), reference it cleverly

Examples of good names:
- "Galaxy Far Away" (Star Wars movies)
- "Nolan's Mind Games" (Christopher Nolan films)
- "Caped Crusaders" (superhero movies)
- "Cozy Mysteries" (detective/mystery)
- "Midnight Thrills" (horror/thriller mix)
- "Epic Quests" (adventure/fantasy)

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
    const cleanName = name.replace(/^["']|["']$/g, '')
    logger.info({ name: cleanName }, 'Generated graph playlist name')
    return cleanName
  } catch (error) {
    logger.error({ error }, 'Failed to generate graph playlist name')
    throw new Error('Failed to generate playlist name. Please try again.')
  }
}

/**
 * Generate an AI-powered playlist description from graph items
 */
export async function generateGraphPlaylistDescription(
  movieIds: string[],
  seriesIds: string[],
  playlistName?: string
): Promise<string> {
  logger.info(
    { movieCount: movieIds.length, seriesCount: seriesIds.length, playlistName },
    'Generating graph playlist description'
  )

  const { context, items } = await buildGraphContext(movieIds, seriesIds)

  if (!context || items.length === 0) {
    return 'A curated collection of movies and shows.'
  }

  const nameContext = playlistName ? `\nPLAYLIST NAME: "${playlistName}"` : ''
  const itemCount = items.length
  const hasMovies = movieIds.length > 0
  const hasSeries = seriesIds.length > 0
  const mediaType = hasMovies && hasSeries ? 'movies and shows' : hasMovies ? 'movies' : 'shows'

  try {
    const model = await getTextGenerationModel()
    const openai = await getOpenAIClient()
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a movie curator writing a brief playlist description. This playlist was created from a similarity graph exploration, so the items are connected by themes, genres, or creative relationships.

Write 1-2 sentences that capture what makes this collection special.

Rules:
- Be concise and engaging
- Highlight what connects these ${mediaType} (themes, franchises, directors, mood)
- Don't just list genres - describe the experience
- If a playlist name is provided, the description should complement it
- Write in third person
- This collection has ${itemCount} items

Examples:
- "Journey through the complete saga of galactic conflicts and family drama. 12 films that defined a generation."
- "Dark, atmospheric thrillers where nothing is as it seems. Prepare for twist endings and sleepless nights."
- "A curated selection of mind-bending narratives from cinema's most innovative directors."

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

    logger.info({ descriptionLength: description.length }, 'Generated graph playlist description')
    return description
  } catch (error) {
    logger.error({ error }, 'Failed to generate graph playlist description')
    throw new Error('Failed to generate playlist description. Please try again.')
  }
}

