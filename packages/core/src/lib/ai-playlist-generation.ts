import { generateText } from 'ai'
import { query } from './db.js'
import { getTextGenerationModelInstance } from './ai-provider.js'
import { buildAiLanguageInstruction, DEFAULT_LOCALE, type AppLocaleCode } from './locales.js'
import { resolveEffectiveAiLanguage } from './userSettings.js'

export type PlaylistTextMode = 'channel' | 'graph'

export interface MovieRowBasic {
  title: string
  year: number | null
  genres: string[]
}

export interface MovieRowFull extends MovieRowBasic {
  overview: string | null
}

export interface MediaItem {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
}

export async function resolvePlaylistAiLocale(userId?: string): Promise<AppLocaleCode> {
  return userId ? resolveEffectiveAiLanguage(userId) : DEFAULT_LOCALE
}

export function cleanPlaylistName(text: string): string {
  return text.trim().replace(/^["']|["']$/g, '')
}

export async function fetchMoviesBasicByIds(movieIds: string[]): Promise<MovieRowBasic[]> {
  if (movieIds.length === 0) return []

  const result = await query<MovieRowBasic>(
    'SELECT title, year, genres FROM movies WHERE id = ANY($1)',
    [movieIds]
  )
  return result.rows
}

export async function fetchMoviesFullByIds(movieIds: string[]): Promise<MovieRowFull[]> {
  if (movieIds.length === 0) return []

  const result = await query<MovieRowFull>(
    'SELECT title, year, genres, overview FROM movies WHERE id = ANY($1)',
    [movieIds]
  )
  return result.rows
}

export async function fetchMoviesWithOverviewByIds(movieIds: string[]): Promise<MediaItem[]> {
  if (movieIds.length === 0) return []

  const result = await query<MediaItem>(
    'SELECT id, title, year, genres, overview FROM movies WHERE id = ANY($1)',
    [movieIds]
  )
  return result.rows
}

export async function fetchSeriesWithOverviewByIds(seriesIds: string[]): Promise<MediaItem[]> {
  if (seriesIds.length === 0) return []

  const result = await query<MediaItem>(
    'SELECT id, title, year, genres, overview FROM series WHERE id = ANY($1)',
    [seriesIds]
  )
  return result.rows
}

function buildPlaylistNameSystemPrompt(mode: PlaylistTextMode, langBlock: string): string {
  const contextLine =
    mode === 'channel'
      ? 'Generate a single catchy, memorable playlist name based on the provided context.'
      : 'Generate a single catchy, memorable playlist name based on the provided movies/shows.'

  const modeRules =
    mode === 'channel'
      ? `- Capture the mood/vibe of the movies
- Don't include genre names directly unless cleverly incorporated`
      : `- Find the common thread: franchise, director, era, mood, theme
- If it's clearly a franchise (Star Wars, Marvel, etc.), reference it cleverly`

  const examples =
    mode === 'channel'
      ? `- "Neon Noir Nights" (cyberpunk/noir)
- "Popcorn Apocalypse" (action/disaster)
- "Cozy Crimes" (mystery/comfort)
- "Starlight Escapes" (sci-fi/adventure)
- "Midnight Mayhem" (horror/thriller)
- "Retro Rewind" (80s movies)`
      : `- "Galaxy Far Away" (Star Wars movies)
- "Nolan's Mind Games" (Christopher Nolan films)
- "Caped Crusaders" (superhero movies)
- "Cozy Mysteries" (detective/mystery)
- "Midnight Thrills" (horror/thriller mix)
- "Epic Quests" (adventure/fantasy)`

  return `You are a creative playlist naming expert. ${contextLine}

Rules:
- Keep it short (2-4 words max)
- Be creative and evocative, not generic
${modeRules}
- Can use alliteration, wordplay, or cultural references
- Don't use generic words like "Collection", "Playlist", "Mix"

Examples of good names:
${examples}

Return ONLY the playlist name, nothing else.${langBlock}`
}

export interface PlaylistDescriptionOptions {
  playlistName?: string
  itemCount?: number
  mediaType?: string
}

function buildPlaylistDescriptionSystemPrompt(
  mode: PlaylistTextMode,
  langBlock: string,
  options: PlaylistDescriptionOptions = {}
): string {
  const graphIntro =
    mode === 'graph'
      ? ' This playlist was created from a similarity graph exploration, so the items are connected by themes, genres, or creative relationships.'
      : ''

  const connectionRule =
    mode === 'graph' && options.mediaType
      ? `- Highlight what connects these ${options.mediaType} (themes, franchises, directors, mood)`
      : '- Highlight the mood, themes, or experience'

  const itemCountRule =
    mode === 'graph' && options.itemCount !== undefined
      ? `- This collection has ${options.itemCount} items`
      : ''

  const examples =
    mode === 'graph'
      ? `- "Journey through the complete saga of galactic conflicts and family drama. 12 films that defined a generation."
- "Dark, atmospheric thrillers where nothing is as it seems. Prepare for twist endings and sleepless nights."
- "A curated selection of mind-bending narratives from cinema's most innovative directors."`
      : `- "A pulse-pounding journey through high-stakes heists and impossible escapes. Every film delivers edge-of-your-seat tension."
- "Heartwarming tales of unlikely friendships and second chances. Perfect for when you need to believe in happy endings."
- "Dark, atmospheric thrillers where nothing is as it seems. Prepare for twist endings and sleepless nights."`

  return `You are a movie curator writing a brief playlist description.${graphIntro}

Write 1-2 sentences that capture what makes this collection special.

Rules:
- Be concise and engaging
${connectionRule}
- Don't list genres directly - describe the feeling
- If a playlist name is provided, the description should complement it
- Write in third person (describe the playlist, not "you")
${itemCountRule}

Examples:
${examples}

Return ONLY the description, nothing else.${langBlock}`
}

export async function generatePlaylistText(params: {
  mode: PlaylistTextMode
  kind: 'name' | 'description'
  prompt: string
  userId?: string
  descriptionOptions?: PlaylistDescriptionOptions
}): Promise<string> {
  const aiLocale = await resolvePlaylistAiLocale(params.userId)
  const langBlock = `\n\n${buildAiLanguageInstruction(aiLocale)}`
  const model = await getTextGenerationModelInstance()

  const system =
    params.kind === 'name'
      ? buildPlaylistNameSystemPrompt(params.mode, langBlock)
      : buildPlaylistDescriptionSystemPrompt(params.mode, langBlock, params.descriptionOptions)

  const { text } = await generateText({
    model,
    system,
    prompt: params.prompt,
    temperature: params.kind === 'name' ? 0.9 : 0.8,
    maxOutputTokens: params.kind === 'name' ? 50 : 150,
  })

  if (!text) {
    throw new Error('No response from AI')
  }

  return params.kind === 'name' ? cleanPlaylistName(text) : text.trim()
}
