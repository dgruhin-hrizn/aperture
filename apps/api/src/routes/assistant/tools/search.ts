/**
 * Search and similarity tools with Tool UI output schemas
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query, queryOne } from '../../../lib/db.js'
import { buildPlayLink } from '../helpers/mediaServer.js'
import type { ContentItem } from '../schemas/index.js'
import type { ToolContext, MovieResult, SeriesResult } from '../types.js'

// Helper to format content item for Tool UI
function formatContentItem(
  item: MovieResult | SeriesResult,
  type: 'movie' | 'series',
  playLink: string | null,
  rank?: number
): ContentItem {
  const genres = item.genres?.slice(0, 2).join(', ') || ''
  const subtitle = [item.year, genres].filter(Boolean).join(' · ')

  return {
    id: item.id,
    type,
    name: item.title,
    subtitle,
    image: item.poster_url,
    rating: item.community_rating,
    rank,
    actions: [
      { id: 'details', label: 'Details', href: `/${type}s/${item.id}`, variant: 'secondary' },
      ...(playLink
        ? [{ id: 'play', label: 'Play', href: playLink, variant: 'primary' as const }]
        : []),
    ],
  }
}

export function createSearchTools(ctx: ToolContext) {
  return {
    searchContent: tool({
      description:
        'Search for movies and/or TV series by title, genre, year, or other criteria. PRIMARY search tool.',
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe('Search query - matches title, overview, cast, director'),
        genre: z.string().optional().describe('Filter by genre'),
        year: z.number().optional().describe('Filter by release year'),
        minRating: z.number().optional().describe('Minimum community rating (0-10)'),
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({
        query: searchQuery,
        genre,
        year,
        minRating,
        type = 'both',
        limit = 10,
      }) => {
        const items: ContentItem[] = []
        const safeLimit = Math.min(limit ?? 10, 20)

        if (type === 'movies' || type === 'both') {
          let whereClause = ''
          const params: unknown[] = []
          let paramIndex = 1

          if (searchQuery) {
            whereClause = `WHERE (title ILIKE $${paramIndex} OR overview ILIKE $${paramIndex})`
            params.push(`%${searchQuery}%`)
            paramIndex++
          }
          if (genre) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `$${paramIndex} = ANY(genres)`
            params.push(genre)
            paramIndex++
          }
          if (year) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `year = $${paramIndex}`
            params.push(year)
            paramIndex++
          }
          if (minRating) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `community_rating >= $${paramIndex}`
            params.push(minRating)
            paramIndex++
          }
          params.push(safeLimit)

          const movieResult = await query<MovieResult & { provider_item_id?: string }>(
            `SELECT id, title, year, genres, community_rating, poster_url, provider_item_id
             FROM movies ${whereClause}
             ORDER BY community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )

          for (const m of movieResult.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
            items.push(formatContentItem(m, 'movie', playLink))
          }
        }

        if (type === 'series' || type === 'both') {
          let whereClause = ''
          const params: unknown[] = []
          let paramIndex = 1

          if (searchQuery) {
            whereClause = `WHERE (title ILIKE $${paramIndex} OR overview ILIKE $${paramIndex})`
            params.push(`%${searchQuery}%`)
            paramIndex++
          }
          if (genre) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `$${paramIndex} = ANY(genres)`
            params.push(genre)
            paramIndex++
          }
          if (year) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `year = $${paramIndex}`
            params.push(year)
            paramIndex++
          }
          if (minRating) {
            whereClause += whereClause ? ' AND ' : 'WHERE '
            whereClause += `community_rating >= $${paramIndex}`
            params.push(minRating)
            paramIndex++
          }
          params.push(safeLimit)

          const seriesResult = await query<SeriesResult & { provider_item_id?: string }>(
            `SELECT id, title, year, genres, network, community_rating, poster_url, provider_item_id
             FROM series ${whereClause}
             ORDER BY community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )

          for (const s of seriesResult.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
            items.push(formatContentItem(s, 'series', playLink))
          }
        }

        if (items.length === 0) {
          return {
            id: `search-empty-${Date.now()}`,
            items: [],
            description: 'No results found. Try a different search term or browse by genre.',
          }
        }

        // Build title
        let title = 'Search Results'
        if (searchQuery) title = `Results for "${searchQuery}"`
        else if (genre)
          title = `${genre} ${type === 'movies' ? 'Movies' : type === 'series' ? 'Series' : 'Content'}`

        return {
          id: `search-${Date.now()}`,
          title,
          items,
        }
      },
    }),

    findSimilarContent: tool({
      description:
        'Find movies and TV series similar to a given title using AI embeddings. Can optionally exclude content the user has already watched.',
      inputSchema: z.object({
        title: z.string().describe('The title to find similar content for'),
        excludeWatched: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, only return unwatched content'),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ title, excludeWatched = false, limit = 5 }) => {
        try {
          const items: ContentItem[] = []
          let foundTitle = ''
          let foundType = ''

          // Try to find as movie - prefer exact/better matches, then ones with embeddings
          const movie = await queryOne<{ id: string; title: string }>(
            `SELECT m.id, m.title FROM movies m
             LEFT JOIN embeddings e ON e.movie_id = m.id AND e.model = $2
             WHERE m.title ILIKE $1
             ORDER BY 
               CASE 
                 WHEN LOWER(m.title) = LOWER($3) THEN 0
                 WHEN LOWER(m.title) LIKE LOWER($4) THEN 1
                 ELSE 2
               END,
               e.id IS NOT NULL DESC
             LIMIT 1`,
            [`%${title}%`, ctx.embeddingModel, title, `${title}%`]
          )

          // Try to find as series - prefer exact/better matches, then ones with embeddings
          const series = await queryOne<{ id: string; title: string }>(
            `SELECT s.id, s.title FROM series s
             LEFT JOIN series_embeddings se ON se.series_id = s.id AND se.model = $2
             WHERE s.title ILIKE $1
             ORDER BY 
               CASE 
                 WHEN LOWER(s.title) = LOWER($3) THEN 0
                 WHEN LOWER(s.title) LIKE LOWER($4) THEN 1
                 ELSE 2
               END,
               se.id IS NOT NULL DESC
             LIMIT 1`,
            [`%${title}%`, ctx.embeddingModel, title, `${title}%`]
          )

          if (!movie && !series) {
            return {
              id: `similar-error-${Date.now()}`,
              items: [],
              description: `"${title}" not found in your library.`,
            }
          }

          if (movie) {
            foundTitle = movie.title
            foundType = 'movie'

            const embedding = await queryOne<{ embedding: string }>(
              `SELECT embedding::text FROM embeddings WHERE movie_id = $1 AND model = $2`,
              [movie.id, ctx.embeddingModel]
            )

            if (embedding) {
              // Build query with optional watched filter
              const watchedFilter = excludeWatched
                ? `AND m.id NOT IN (SELECT movie_id FROM watch_history WHERE user_id = $5 AND movie_id IS NOT NULL)`
                : ''
              const params = excludeWatched
                ? [movie.id, ctx.embeddingModel, embedding.embedding, limit, ctx.userId]
                : [movie.id, ctx.embeddingModel, embedding.embedding, limit]

              const similar = await query<MovieResult & { provider_item_id?: string }>(
                `SELECT m.id, m.title, m.year, m.genres, m.community_rating, m.poster_url, m.provider_item_id
                 FROM embeddings e JOIN movies m ON m.id = e.movie_id
                 WHERE e.movie_id != $1 AND e.model = $2 ${watchedFilter}
                 ORDER BY e.embedding <=> $3::halfvec LIMIT $4`,
                params
              )

              for (const m of similar.rows) {
                const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
                items.push(formatContentItem(m, 'movie', playLink))
              }
            }
          }

          if (series) {
            if (!foundTitle) {
              foundTitle = series.title
              foundType = 'series'
            }

            const embedding = await queryOne<{ embedding: string }>(
              `SELECT embedding::text FROM series_embeddings WHERE series_id = $1 AND model = $2`,
              [series.id, ctx.embeddingModel]
            )

            if (embedding) {
              // Build query with optional watched filter (series is watched if any episode is watched)
              const watchedFilter = excludeWatched
                ? `AND s.id NOT IN (
                    SELECT DISTINCT ep.series_id FROM watch_history wh
                    JOIN episodes ep ON ep.id = wh.episode_id
                    WHERE wh.user_id = $5
                  )`
                : ''
              const params = excludeWatched
                ? [series.id, ctx.embeddingModel, embedding.embedding, limit, ctx.userId]
                : [series.id, ctx.embeddingModel, embedding.embedding, limit]

              const similar = await query<SeriesResult & { provider_item_id?: string }>(
                `SELECT s.id, s.title, s.year, s.genres, s.network, s.community_rating, s.poster_url, s.provider_item_id
                 FROM series_embeddings se JOIN series s ON s.id = se.series_id
                 WHERE se.series_id != $1 AND se.model = $2 ${watchedFilter}
                 ORDER BY se.embedding <=> $3::halfvec LIMIT $4`,
                params
              )

              for (const s of similar.rows) {
                const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
                items.push(formatContentItem(s, 'series', playLink))
              }
            }
          }

          const unwatchedNote = excludeWatched ? " that you haven't watched" : ''
          return {
            id: `similar-${Date.now()}`,
            title: `Similar to "${foundTitle}"`,
            description: `Found ${items.length} titles similar to this ${foundType}${unwatchedNote}`,
            items,
          }
        } catch (err) {
          console.error('[findSimilarContent] Error:', err)
          return {
            id: `similar-error-${Date.now()}`,
            items: [],
            description: `Failed to find similar content: ${err instanceof Error ? err.message : 'Unknown error'}`,
          }
        }
      },
    }),
  }
}
