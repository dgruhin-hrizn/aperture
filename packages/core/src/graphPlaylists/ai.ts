import { createChildLogger } from '../lib/logger.js'
import {
  fetchMoviesWithOverviewByIds,
  fetchSeriesWithOverviewByIds,
  generatePlaylistText,
  type MediaItem,
} from '../lib/ai-playlist-generation.js'

const logger = createChildLogger('graphPlaylists')

async function buildGraphContext(
  movieIds: string[],
  seriesIds: string[]
): Promise<{ context: string; items: MediaItem[] }> {
  const [movies, series] = await Promise.all([
    fetchMoviesWithOverviewByIds(movieIds),
    fetchSeriesWithOverviewByIds(seriesIds),
  ])

  const allItems = [...movies, ...series]
  if (allItems.length === 0) {
    return { context: '', items: [] }
  }

  const titleList = allItems
    .map((item) => `"${item.title}" (${item.year || 'N/A'})`)
    .join(', ')

  const allGenres = [...new Set(allItems.flatMap((item) => item.genres || []))]

  const contextParts: string[] = []
  contextParts.push(`TITLES: ${titleList}`)

  if (allGenres.length > 0) {
    contextParts.push(`GENRES: ${allGenres.join(', ')}`)
  }

  const overviews = allItems
    .filter((item) => item.overview)
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.overview?.substring(0, 150)}...`)

  if (overviews.length > 0) {
    contextParts.push(`SAMPLE SYNOPSES:\n${overviews.join('\n')}`)
  }

  return { context: contextParts.join('\n\n'), items: allItems }
}

export async function generateGraphPlaylistName(
  movieIds: string[],
  seriesIds: string[],
  userId?: string
): Promise<string> {
  logger.info({ movieCount: movieIds.length, seriesCount: seriesIds.length }, 'Generating graph playlist name')

  const { context, items } = await buildGraphContext(movieIds, seriesIds)

  if (!context || items.length === 0) {
    return 'My Collection'
  }

  try {
    const cleanName = await generatePlaylistText({
      mode: 'graph',
      kind: 'name',
      prompt: context,
      userId,
    })
    logger.info({ name: cleanName }, 'Generated graph playlist name')
    return cleanName
  } catch (error) {
    logger.error({ error }, 'Failed to generate graph playlist name')
    throw new Error('Failed to generate playlist name. Please try again.')
  }
}

export async function generateGraphPlaylistDescription(
  movieIds: string[],
  seriesIds: string[],
  playlistName?: string,
  userId?: string
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
    const description = await generatePlaylistText({
      mode: 'graph',
      kind: 'description',
      prompt: context + nameContext,
      userId,
      descriptionOptions: { playlistName, itemCount, mediaType },
    })
    logger.info({ descriptionLength: description.length }, 'Generated graph playlist description')
    return description
  } catch (error) {
    logger.error({ error }, 'Failed to generate graph playlist description')
    throw new Error('Failed to generate playlist description. Please try again.')
  }
}
