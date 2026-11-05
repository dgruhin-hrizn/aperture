import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';
import type { ContentItem } from '../schemas/index.js';
import type { ToolContext, MovieResult, SeriesResult } from '../types.js';
import { formatContentItem } from './shared/search.js';
export function createGetTopRatedTool(ctx: ToolContext): ToolSet { return {
getTopRated: tool({
      description: 'Get the highest-rated content in the library.',
      inputSchema: nullSafe(z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        genre: z.string().optional().describe('Filter by genre'),
        limit: z.number().optional().default(15).describe('Number of results (default 15, max 50)'),
      })),
      execute: async ({ type, genre, limit = 15 }) => {
        const items: ContentItem[] = []

        if (type === 'movies' || type === 'both') {
          let whereClause = 'WHERE community_rating IS NOT NULL'
          const params: unknown[] = []
          let paramIndex = 1

          if (genre) {
            whereClause += ` AND $${paramIndex} = ANY(genres)`
            params.push(genre)
            paramIndex++
          }
          params.push(limit)

          const movies = await query<MovieResult & { provider_item_id?: string }>(
            `SELECT id, title, year, genres, community_rating, overview, poster_url, provider_item_id
             FROM movies ${whereClause}
             ORDER BY community_rating DESC LIMIT $${paramIndex}`,
            params
          )

          for (const m of movies.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
            items.push(formatContentItem(m, 'movie', playLink))
          }
        }

        if (type === 'series' || type === 'both') {
          let whereClause = 'WHERE community_rating IS NOT NULL'
          const params: unknown[] = []
          let paramIndex = 1

          if (genre) {
            whereClause += ` AND $${paramIndex} = ANY(genres)`
            params.push(genre)
            paramIndex++
          }
          params.push(limit)

          const series = await query<SeriesResult & { provider_item_id?: string }>(
            `SELECT id, title, year, genres, network, community_rating, overview, poster_url, provider_item_id
             FROM series ${whereClause}
             ORDER BY community_rating DESC LIMIT $${paramIndex}`,
            params
          )

          for (const s of series.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
            items.push(formatContentItem(s, 'series', playLink))
          }
        }

        return {
          id: `top-rated-${Date.now()}`,
          ...(genre
            ? {
                titleKey: 'carouselTopRatedGenreTitle' as const,
                titleParams: { genre },
              }
            : { titleKey: 'carouselTopRatedTitle' as const }),
          items,
        }
      },
    })
}; }
