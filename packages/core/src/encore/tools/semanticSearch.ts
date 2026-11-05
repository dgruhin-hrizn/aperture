import { semanticFilters } from './shared/semanticFilters.js'
import type { ToolSet } from 'ai';
import { tool, embed } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { getActiveEmbeddingTableName } from '../../index.js';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';

import type { ContentItem } from '../schemas/index.js';
import type { ToolContext, MovieResult, SeriesResult } from '../types.js';
import { semanticSearchTitleKey, formatContentItem } from './shared/search.js';
export function createSemanticSearchTool(ctx: ToolContext): ToolSet { return {
semanticSearch: tool({
      description:
        'Search for movies and TV series by concept, theme, mood, or description using AI embeddings. BEST for vague or conceptual queries like "mind-bending sci-fi", "feel-good comedies", "dark thrillers with plot twists", "movies like Inception but darker". Use this instead of searchContent for non-literal searches.',
      inputSchema: nullSafe(z.object({
        concept: z
          .string()
          .describe(
            'The concept, theme, mood, or description to search for. Be descriptive - e.g. "psychological thrillers with unreliable narrators" or "uplifting sports underdog stories"'
          ),
        genre: z.string().max(80).optional(),
        maxRuntime: z.number().int().positive().max(1000).optional().describe('Movie minutes or approximate average episode length'),
        minRating: z.number().min(0).max(10).optional(),
        yearMin: z.number().int().min(1888).max(2200).optional(),
        yearMax: z.number().int().min(1888).max(2200).optional(),
        contentRating: z.string().max(20).optional(),
        excludeWatched: z.boolean().default(true),
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
      })),
      execute: async ({ concept, type = 'both', excludeTitle, limit = 15, ...filters }) => {
        try {
          const safeLimit = Math.min(limit ?? 15, 50)

          // Generate embedding for the search concept using AI SDK
          const { embedding: queryEmbedding } = await embed({
            model: ctx.embeddingModel ?? (() => { throw new Error('Semantic search requires an embedding provider') })(),
            value: concept,
          })
          const embeddingStr = `[${queryEmbedding.join(',')}]`

          const items: ContentItem[] = []
          const seenTitles = new Set<string>() // Deduplicate by title
          const relevance = new Map<string, number>()

          // If user mentioned a title they already watched, exclude it
          const excludeLower = excludeTitle?.toLowerCase()

          // Get model ID for database query (stored in db as string identifier)
          const modelId = ctx.embeddingModelId

          if (type === 'movies' || type === 'both') {
            const movieTableName = await getActiveEmbeddingTableName('embeddings')
            const movieValues: unknown[] = [embeddingStr, modelId, safeLimit + 5]
            const movieFilters = semanticFilters('m', movieValues, filters, ctx.userId)
            const movieResults = await query<
              MovieResult & { provider_item_id?: string; similarity: number }
            >(
              `SELECT m.id, m.title, m.year, m.genres, m.community_rating, m.poster_url, m.provider_item_id,
                      1 - (e.embedding <=> $1::halfvec) as similarity
               FROM ${movieTableName} e
               JOIN movies m ON m.id = e.movie_id
               WHERE e.model = $2 ${movieFilters}
               ORDER BY e.embedding <=> $1::halfvec
               LIMIT $3`,
              movieValues
            )

            for (const m of movieResults.rows) {
              const titleKey = m.title.toLowerCase()
              // Skip if this is the excluded title or a duplicate
              if (excludeLower && titleKey.includes(excludeLower)) continue
              if (seenTitles.has(titleKey)) continue
              seenTitles.add(titleKey)
              const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
              items.push(formatContentItem(m, 'movie', playLink))
              relevance.set(m.id, m.similarity)
            }
          }

          if (type === 'series' || type === 'both') {
            const seriesTableName = await getActiveEmbeddingTableName('series_embeddings')
            const seriesValues: unknown[] = [embeddingStr, modelId, safeLimit + 5]
            const seriesFilters = semanticFilters('s', seriesValues, filters, ctx.userId)
            const seriesResults = await query<
              SeriesResult & { provider_item_id?: string; similarity: number }
            >(
              `SELECT s.id, s.title, s.year, s.genres, s.network, s.community_rating, s.poster_url, s.provider_item_id,
                      1 - (se.embedding <=> $1::halfvec) as similarity
               FROM ${seriesTableName} se
               JOIN series s ON s.id = se.series_id
               WHERE se.model = $2 ${seriesFilters}
               ORDER BY se.embedding <=> $1::halfvec
               LIMIT $3`,
              seriesValues
            )

            for (const s of seriesResults.rows) {
              const titleKey = s.title.toLowerCase()
              // Skip if this is the excluded title or a duplicate
              if (excludeLower && titleKey.includes(excludeLower)) continue
              if (seenTitles.has(titleKey)) continue
              seenTitles.add(titleKey)
              const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
              items.push(formatContentItem(s, 'series', playLink))
              relevance.set(s.id, s.similarity)
            }
          }

          // Preserve semantic relevance; ratings break ties only. Both tables use the active model.
          items.sort((a, b) => (relevance.get(b.id) ?? 0) - (relevance.get(a.id) ?? 0) || (b.rating ?? 0) - (a.rating ?? 0))

          // Limit final results
          const finalItems = items.slice(0, safeLimit)

          if (finalItems.length === 0) {
            return {
              id: `semantic-empty-${Date.now()}`,
              items: [],
              descriptionKey: 'carouselSemanticEmpty',
              descriptionParams: { concept },
            }
          }

          return {
            id: `semantic-${Date.now()}`,
            titleKey: semanticSearchTitleKey(type),
            titleParams: { concept },
            descriptionKey: 'carouselSemanticDesc',
            descriptionParams: { count: finalItems.length },
            items: finalItems,
          }
        } catch (err) {
          console.error('[semanticSearch] Error:', err)
          return {
            id: `semantic-error-${Date.now()}`,
            items: [],
            descriptionKey: 'carouselSemanticError',
            descriptionParams: {
              message: err instanceof Error ? err.message : 'Unknown error',
            },
          }
        }
      },
    })
}; }
