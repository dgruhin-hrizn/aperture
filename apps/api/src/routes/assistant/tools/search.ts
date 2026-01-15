/**
 * Search and similarity tools with Tool UI output schemas
 */
import { tool, embed, generateObject } from 'ai'
import { z } from 'zod'
import { getTextGenerationModelInstance, getActiveEmbeddingTableName } from '@aperture/core'
import { query, queryOne } from '../../../lib/db.js'
import { buildPlayLink } from '../helpers/mediaServer.js'
import type { ContentItem } from '../schemas/index.js'
import type { ToolContext, MovieResult, SeriesResult } from '../types.js'

/**
 * AI-powered semantic search query generator
 * The AI knows what content is about - let it describe what to search for!
 */
async function generateSearchQuery(
  title: string,
  type: 'movie' | 'series'
): Promise<string> {
  try {
    const model = await getTextGenerationModelInstance()
    const { object } = await generateObject({
      model,
      schema: z.object({
        searchQuery: z.string().describe('A specific description for semantic search'),
      }),
      prompt: `You know about "${title}" (${type}). Write a SPECIFIC semantic search query to find truly SIMILAR content.

Be SPECIFIC about:
1. Core plot elements (what actually happens in the story)
2. Specific themes (not just "drama" but "corporate conspiracy", "identity crisis", etc.)
3. Tone combination (dark comedy + social satire, not just "comedy")
4. Setting/world (dystopian suburb, underground lab, small town mystery, etc.)
5. What makes it unique vs generic films

DO NOT be vague. DO NOT just list genres.

WRONG (too vague): "Sci-fi comedy about experiments and dark themes."
RIGHT (specific): "Government conspiracy involving human cloning in Black neighborhoods. Social satire blending blaxploitation homage with sci-fi mystery. Characters discover they're part of a sinister experiment."

WRONG: "Drama about family and relationships."
RIGHT: "Multigenerational Korean immigrant family running a convenience store. Cultural identity clash, language barriers, and the American dream's cost."

Now write a SPECIFIC search query for "${title}":`,
    })
    console.log(`[generateSearchQuery] "${title}" → "${object.searchQuery}"`)
    return object.searchQuery
  } catch (err) {
    console.error('[generateSearchQuery] Error:', err)
    return title // Fallback to just the title
  }
}

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
      {
        id: 'details',
        label: 'Details',
        href: `/${type === 'movie' ? 'movies' : 'series'}/${item.id}`,
        variant: 'secondary',
      },
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
        'Comprehensive search for movies and TV series with ALL available filters. Use for specific queries with known criteria. For conceptual/vague queries like "mind-bending movies", use semanticSearch instead.',
      inputSchema: z.object({
        // Text search
        query: z.string().optional().describe('Title or keywords to match'),

        // Basic filters
        genre: z
          .string()
          .optional()
          .describe('Genre (e.g. "Action", "Comedy", "Drama", "Science Fiction", "Horror")'),
        year: z.number().optional().describe('Exact release year'),
        yearMin: z.number().optional().describe('Minimum release year (for ranges)'),
        yearMax: z.number().optional().describe('Maximum release year (for ranges)'),

        // Ratings
        minRating: z.number().optional().describe('Minimum community rating (0-10)'),
        maxRating: z.number().optional().describe('Maximum community rating (0-10)'),
        minCriticRating: z.number().optional().describe('Minimum critic rating (0-100)'),

        // Content rating (MPAA/TV ratings)
        contentRating: z
          .string()
          .optional()
          .describe(
            'Content rating: G, PG, PG-13, R, NC-17, TV-Y, TV-Y7, TV-G, TV-PG, TV-14, TV-MA'
          ),

        // Runtime (movies)
        minRuntime: z.number().optional().describe('Minimum runtime in minutes'),
        maxRuntime: z.number().optional().describe('Maximum runtime in minutes'),

        // People
        director: z.string().optional().describe('Director name'),
        actor: z.string().optional().describe('Actor name'),

        // Production
        studio: z.string().optional().describe('Studio or production company name'),
        network: z.string().optional().describe('TV network (for series): HBO, Netflix, AMC, etc.'),

        // Series-specific
        status: z.enum(['Continuing', 'Ended']).optional().describe('Series status'),
        minSeasons: z.number().optional().describe('Minimum number of seasons'),

        // Tags
        tag: z.string().optional().describe('Content tag (e.g. "superhero", "based on novel")'),

        // Type and limit
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        limit: z.number().optional().default(15).describe('Number of results (default 15, max 50)'),

        // Sorting
        sortBy: z
          .enum(['rating', 'year', 'title', 'runtime', 'critic_rating'])
          .optional()
          .default('rating'),
        sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      }),
      execute: async (params) => {
        const {
          query: searchQuery,
          genre,
          year,
          yearMin,
          yearMax,
          minRating,
          maxRating,
          minCriticRating,
          contentRating,
          minRuntime,
          maxRuntime,
          director,
          actor,
          studio,
          network,
          status,
          minSeasons,
          tag,
          type = 'both',
          limit = 15,
          sortBy = 'rating',
          sortOrder = 'desc',
        } = params

        const items: ContentItem[] = []
        const seenTitles = new Set<string>()
        const safeLimit = Math.min(limit ?? 15, 50)

        // Helper to build WHERE clause
        const buildWhere = (isMovie: boolean) => {
          const conditions: string[] = []
          const values: unknown[] = []
          let idx = 1

          if (searchQuery) {
            conditions.push(`(title ILIKE $${idx} OR overview ILIKE $${idx})`)
            values.push(`%${searchQuery}%`)
            idx++
          }
          if (genre) {
            conditions.push(`$${idx} = ANY(genres)`)
            values.push(genre)
            idx++
          }
          if (year) {
            conditions.push(`year = $${idx}`)
            values.push(year)
            idx++
          }
          if (yearMin) {
            conditions.push(`year >= $${idx}`)
            values.push(yearMin)
            idx++
          }
          if (yearMax) {
            conditions.push(`year <= $${idx}`)
            values.push(yearMax)
            idx++
          }
          if (minRating) {
            conditions.push(`community_rating >= $${idx}`)
            values.push(minRating)
            idx++
          }
          if (maxRating) {
            conditions.push(`community_rating <= $${idx}`)
            values.push(maxRating)
            idx++
          }
          if (minCriticRating) {
            conditions.push(`critic_rating >= $${idx}`)
            values.push(minCriticRating)
            idx++
          }
          if (contentRating) {
            conditions.push(`content_rating ILIKE $${idx}`)
            values.push(contentRating)
            idx++
          }
          if (minRuntime && isMovie) {
            conditions.push(`runtime_minutes >= $${idx}`)
            values.push(minRuntime)
            idx++
          }
          if (maxRuntime && isMovie) {
            conditions.push(`runtime_minutes <= $${idx}`)
            values.push(maxRuntime)
            idx++
          }
          if (director) {
            conditions.push(`$${idx} ILIKE ANY(directors)`)
            values.push(`%${director}%`)
            idx++
          }
          if (actor) {
            conditions.push(`actors::text ILIKE $${idx}`)
            values.push(`%${actor}%`)
            idx++
          }
          if (studio) {
            conditions.push(`studios::text ILIKE $${idx}`)
            values.push(`%${studio}%`)
            idx++
          }
          if (network && !isMovie) {
            conditions.push(`network ILIKE $${idx}`)
            values.push(`%${network}%`)
            idx++
          }
          if (status && !isMovie) {
            conditions.push(`status = $${idx}`)
            values.push(status)
            idx++
          }
          if (minSeasons && !isMovie) {
            conditions.push(`total_seasons >= $${idx}`)
            values.push(minSeasons)
            idx++
          }
          if (tag) {
            conditions.push(`$${idx} ILIKE ANY(tags)`)
            values.push(`%${tag}%`)
            idx++
          }

          values.push(safeLimit)
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
          return { whereClause, values, limitIdx: idx }
        }

        // Sort column mapping
        const sortColumn =
          {
            rating: 'community_rating',
            year: 'year',
            title: 'title',
            runtime: 'runtime_minutes',
            critic_rating: 'critic_rating',
          }[sortBy] || 'community_rating'
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC'
        const nullsOrder = sortOrder === 'asc' ? 'NULLS FIRST' : 'NULLS LAST'

        if (type === 'movies' || type === 'both') {
          const { whereClause, values, limitIdx } = buildWhere(true)
          const movieResult = await query<MovieResult & { provider_item_id?: string }>(
            `SELECT id, title, year, genres, community_rating, poster_url, provider_item_id
             FROM movies ${whereClause}
             ORDER BY ${sortColumn} ${order} ${nullsOrder} LIMIT $${limitIdx}`,
            values
          )

          for (const m of movieResult.rows) {
            const titleKey = m.title.toLowerCase()
            if (!seenTitles.has(titleKey)) {
              seenTitles.add(titleKey)
              const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
              items.push(formatContentItem(m, 'movie', playLink))
            }
          }
        }

        if (type === 'series' || type === 'both') {
          const { whereClause, values, limitIdx } = buildWhere(false)
          const seriesResult = await query<SeriesResult & { provider_item_id?: string }>(
            `SELECT id, title, year, genres, network, community_rating, poster_url, provider_item_id
             FROM series ${whereClause}
             ORDER BY ${sortColumn !== 'runtime_minutes' ? sortColumn : 'community_rating'} ${order} ${nullsOrder} LIMIT $${limitIdx}`,
            values
          )

          for (const s of seriesResult.rows) {
            const titleKey = s.title.toLowerCase()
            if (!seenTitles.has(titleKey)) {
              seenTitles.add(titleKey)
              const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
              items.push(formatContentItem(s, 'series', playLink))
            }
          }
        }

        if (items.length === 0) {
          return {
            id: `search-empty-${Date.now()}`,
            items: [],
            description: 'No results found. Try adjusting your filters.',
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

    semanticSearch: tool({
      description:
        'Search for movies and TV series by concept, theme, mood, or description using AI embeddings. BEST for vague or conceptual queries like "mind-bending sci-fi", "feel-good comedies", "dark thrillers with plot twists", "movies like Inception but darker". Use this instead of searchContent for non-literal searches.',
      inputSchema: z.object({
        concept: z
          .string()
          .describe(
            'The concept, theme, mood, or description to search for. Be descriptive - e.g. "psychological thrillers with unreliable narrators" or "uplifting sports underdog stories"'
          ),
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        excludeTitle: z
          .string()
          .optional()
          .describe('Title to EXCLUDE from results (use when user says "I liked X, what else...")'),
        limit: z
          .number()
          .optional()
          .default(15)
          .describe('Number of results to return (default 15, max 50)'),
      }),
      execute: async ({ concept, type = 'both', excludeTitle, limit = 15 }) => {
        try {
          const safeLimit = Math.min(limit ?? 15, 50)

          // Generate embedding for the search concept using AI SDK
          const { embedding: queryEmbedding } = await embed({
            model: ctx.embeddingModel,
            value: concept,
          })
          const embeddingStr = `[${queryEmbedding.join(',')}]`

          const items: ContentItem[] = []
          const seenTitles = new Set<string>() // Deduplicate by title

          // If user mentioned a title they already watched, exclude it
          const excludeLower = excludeTitle?.toLowerCase()

          // Get model ID for database query (stored in db as string identifier)
          const modelId = ctx.embeddingModelId

          if (type === 'movies' || type === 'both') {
            const movieTableName = await getActiveEmbeddingTableName('embeddings')
            const movieResults = await query<
              MovieResult & { provider_item_id?: string; similarity: number }
            >(
              `SELECT m.id, m.title, m.year, m.genres, m.community_rating, m.poster_url, m.provider_item_id,
                      1 - (e.embedding <=> $1::halfvec) as similarity
               FROM ${movieTableName} e
               JOIN movies m ON m.id = e.movie_id
               WHERE e.model = $2
               ORDER BY e.embedding <=> $1::halfvec
               LIMIT $3`,
              [embeddingStr, modelId, safeLimit + 5] // Get extra to account for exclusion
            )

            for (const m of movieResults.rows) {
              const titleKey = m.title.toLowerCase()
              // Skip if this is the excluded title or a duplicate
              if (excludeLower && titleKey.includes(excludeLower)) continue
              if (seenTitles.has(titleKey)) continue
              seenTitles.add(titleKey)
              const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
              items.push(formatContentItem(m, 'movie', playLink))
            }
          }

          if (type === 'series' || type === 'both') {
            const seriesTableName = await getActiveEmbeddingTableName('series_embeddings')
            const seriesResults = await query<
              SeriesResult & { provider_item_id?: string; similarity: number }
            >(
              `SELECT s.id, s.title, s.year, s.genres, s.network, s.community_rating, s.poster_url, s.provider_item_id,
                      1 - (se.embedding <=> $1::halfvec) as similarity
               FROM ${seriesTableName} se
               JOIN series s ON s.id = se.series_id
               WHERE se.model = $2
               ORDER BY se.embedding <=> $1::halfvec
               LIMIT $3`,
              [embeddingStr, modelId, safeLimit + 5] // Get extra to account for exclusion
            )

            for (const s of seriesResults.rows) {
              const titleKey = s.title.toLowerCase()
              // Skip if this is the excluded title or a duplicate
              if (excludeLower && titleKey.includes(excludeLower)) continue
              if (seenTitles.has(titleKey)) continue
              seenTitles.add(titleKey)
              const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
              items.push(formatContentItem(s, 'series', playLink))
            }
          }

          // Sort combined results by rating (since we can't compare similarity scores across tables)
          items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

          // Limit final results
          const finalItems = items.slice(0, safeLimit)

          if (finalItems.length === 0) {
            return {
              id: `semantic-empty-${Date.now()}`,
              items: [],
              description: `No content found matching "${concept}". Try a different description.`,
            }
          }

          // Build descriptive title
          const typeLabel =
            type === 'movies' ? 'Movies' : type === 'series' ? 'TV Series' : 'Content'
          return {
            id: `semantic-${Date.now()}`,
            title: `${typeLabel} matching "${concept}"`,
            description: `Found ${finalItems.length} titles matching your search`,
            items: finalItems,
          }
        } catch (err) {
          console.error('[semanticSearch] Error:', err)
          return {
            id: `semantic-error-${Date.now()}`,
            items: [],
            description: `Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          }
        }
      },
    }),

    findSimilarContent: tool({
      description:
        'Find movies or TV series similar to a given title using AI embeddings. Returns ONLY the same type (movies for movies, series for series). Can optionally exclude content the user has already watched.',
      inputSchema: z.object({
        title: z.string().describe('The title to find similar content for'),
        type: z
          .enum(['movies', 'series'])
          .optional()
          .describe('Force search type. If omitted, auto-detects from title.'),
        excludeWatched: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, only return unwatched content'),
        limit: z
          .number()
          .optional()
          .default(15)
          .describe('Number of results to return (default 15, max 50)'),
      }),
      execute: async ({ title, type, excludeWatched = false, limit = 15 }) => {
        try {
          const items: ContentItem[] = []
          let foundTitle = ''
          let foundType: 'movie' | 'series' | '' = ''

          // If type is specified, only search that type
          const searchMovies = !type || type === 'movies'
          const searchSeries = !type || type === 'series'

          // Get model ID for database query
          const modelId = ctx.embeddingModelId

          // Try to find as movie - get rich metadata for intelligent embedding
          interface MovieWithMeta {
            id: string
            title: string
            overview: string | null
            year: number | null
            tagline: string | null
            directors: string[] | null
            actors: Array<{ name: string }> | null
            studios: string[] | null
            tags: string[] | null
          }
          let movie: MovieWithMeta | null = null
          if (searchMovies) {
            const movieEmbeddingTable = await getActiveEmbeddingTableName('embeddings')
            movie = await queryOne<MovieWithMeta>(
              `SELECT m.id, m.title, m.overview, m.year, m.tagline, m.directors, m.actors, m.studios, m.tags
               FROM movies m
               LEFT JOIN ${movieEmbeddingTable} e ON e.movie_id = m.id AND e.model = $2
               WHERE m.title ILIKE $1
               ORDER BY 
                 CASE 
                   WHEN LOWER(m.title) = LOWER($3) THEN 0
                   WHEN LOWER(m.title) LIKE LOWER($4) THEN 1
                   ELSE 2
                 END,
                 e.id IS NOT NULL DESC
               LIMIT 1`,
              [`%${title}%`, modelId, title, `${title}%`]
            )
          }

          // Try to find as series - get overview for better embedding
          let series: {
            id: string
            title: string
            overview: string | null
            year: number | null
          } | null = null
          if (searchSeries) {
            const seriesEmbeddingTable = await getActiveEmbeddingTableName('series_embeddings')
            series = await queryOne<{
              id: string
              title: string
              overview: string | null
              year: number | null
            }>(
              `SELECT s.id, s.title, s.overview, s.year FROM series s
               LEFT JOIN ${seriesEmbeddingTable} se ON se.series_id = s.id AND se.model = $2
               WHERE s.title ILIKE $1
               ORDER BY 
                 CASE 
                   WHEN LOWER(s.title) = LOWER($3) THEN 0
                   WHEN LOWER(s.title) LIKE LOWER($4) THEN 1
                   ELSE 2
                 END,
                 se.id IS NOT NULL DESC
               LIMIT 1`,
              [`%${title}%`, modelId, title, `${title}%`]
            )
          }

          if (!movie && !series) {
            return {
              id: `similar-error-${Date.now()}`,
              items: [],
              description: `"${title}" not found in your library.`,
            }
          }

          // Determine which one to use - prefer series if both found and user asked for "show"
          // or prefer exact title match
          const useMovie = movie && (!series || type === 'movies')
          const useSeries = series && (!movie || type === 'series')

          if (useMovie && movie) {
            foundTitle = movie.title
            foundType = 'movie'

            // AI-POWERED SEMANTIC SEARCH
            // The AI KNOWS what this movie is about - let it describe what to search for!
            const searchQuery = await generateSearchQuery(movie.title, 'movie')

            const { embedding: queryEmbedding } = await embed({
              model: ctx.embeddingModel,
              value: searchQuery,
            })
            const embeddingStr = `[${queryEmbedding.join(',')}]`

            const watchedFilter = excludeWatched
              ? `AND m.id NOT IN (SELECT movie_id FROM watch_history WHERE user_id = $4 AND movie_id IS NOT NULL)`
              : ''
            const params = excludeWatched
              ? [movie.id, modelId, embeddingStr, ctx.userId, limit]
              : [movie.id, modelId, embeddingStr, limit]

            const movieSimilarTable = await getActiveEmbeddingTableName('embeddings')
            const similar = await query<MovieResult & { provider_item_id?: string }>(
              `SELECT m.id, m.title, m.year, m.genres, m.community_rating, m.poster_url, m.provider_item_id
               FROM ${movieSimilarTable} e JOIN movies m ON m.id = e.movie_id
               WHERE e.movie_id != $1 AND e.model = $2 ${watchedFilter}
               ORDER BY e.embedding <=> $3::halfvec 
               LIMIT ${excludeWatched ? '$5' : '$4'}`,
              params
            )

            for (const m of similar.rows) {
              const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
              items.push(formatContentItem(m, 'movie', playLink))
            }
          } else if (useSeries && series) {
            foundTitle = series.title
            foundType = 'series'

            // AI-POWERED SEMANTIC SEARCH
            // The AI KNOWS what this show is about - let it describe what to search for!
            // This is smarter than matching embeddings because:
            // - AI uses world knowledge, not just our DB's potentially wrong genre tags
            // - AI understands tone, themes, audience - not just surface features

            const searchQuery = await generateSearchQuery(series.title, 'series')

            // Generate embedding from AI's semantic description
            const { embedding: queryEmbedding } = await embed({
              model: ctx.embeddingModel,
              value: searchQuery,
            })
            const embeddingStr = `[${queryEmbedding.join(',')}]`

            const watchedFilter = excludeWatched
              ? `AND s.id NOT IN (
                  SELECT DISTINCT ep.series_id FROM watch_history wh
                  JOIN episodes ep ON ep.id = wh.episode_id
                  WHERE wh.user_id = $4
                )`
              : ''

            const params = excludeWatched
              ? [series.id, modelId, embeddingStr, ctx.userId, limit]
              : [series.id, modelId, embeddingStr, limit]

            const seriesSimilarTable = await getActiveEmbeddingTableName('series_embeddings')
            const similar = await query<SeriesResult & { provider_item_id?: string }>(
              `SELECT s.id, s.title, s.year, s.genres, s.network, s.community_rating, s.poster_url, s.provider_item_id
               FROM ${seriesSimilarTable} se 
               JOIN series s ON s.id = se.series_id
               WHERE se.series_id != $1 
                 AND se.model = $2 
                 ${watchedFilter}
               ORDER BY se.embedding <=> $3::halfvec
               LIMIT ${excludeWatched ? '$5' : '$4'}`,
              params
            )

            for (const s of similar.rows) {
              const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
              items.push(formatContentItem(s, 'series', playLink))
            }
          }

          if (items.length === 0) {
            return {
              id: `similar-empty-${Date.now()}`,
              items: [],
              description: foundTitle
                ? `No similar ${foundType === 'movie' ? 'movies' : 'series'} found for "${foundTitle}". The title may not have embeddings generated yet.`
                : `"${title}" not found in your library.`,
            }
          }

          const unwatchedNote = excludeWatched ? " that you haven't watched" : ''
          return {
            id: `similar-${Date.now()}`,
            title: `Similar to "${foundTitle}"`,
            description: `Found ${items.length} ${foundType === 'movie' ? 'movies' : 'series'} similar to this ${foundType}${unwatchedNote}`,
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
