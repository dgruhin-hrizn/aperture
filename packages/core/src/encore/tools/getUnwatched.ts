import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';
import type { ContentItem } from '../schemas/index.js';
import type { ToolContext, MovieResult, SeriesResult } from '../types.js';
import { formatContentItem } from './shared/search.js';
export function createGetUnwatchedTool(ctx: ToolContext): ToolSet { return {
getUnwatched: tool({
      description: 'Get content the user has NOT watched yet.',
      inputSchema: nullSafe(z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        genre: z.string().optional().describe('Filter by genre'),
        minRating: z.number().optional().describe('Minimum community rating'),
        limit: z.number().optional().default(15).describe('Number of results (default 15, max 50)'),
      })),
      execute: async ({ type, genre, minRating, limit = 15 }) => {
        const items: ContentItem[] = []

        if (type === 'movies' || type === 'both') {
          let whereClause = `WHERE m.id NOT IN (
            SELECT movie_id FROM watch_history WHERE user_id = $1 AND movie_id IS NOT NULL)`
          const params: unknown[] = [ctx.userId]
          let paramIndex = 2

          if (genre) {
            whereClause += ` AND $${paramIndex} = ANY(m.genres)`
            params.push(genre)
            paramIndex++
          }
          if (minRating) {
            whereClause += ` AND m.community_rating >= $${paramIndex}`
            params.push(minRating)
            paramIndex++
          }
          params.push(limit)

          const movies = await query<MovieResult & { provider_item_id?: string }>(
            `SELECT m.id, m.title, m.year, m.genres, m.community_rating, m.overview, m.poster_url, m.provider_item_id
             FROM movies m ${whereClause}
             ORDER BY m.community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )

          for (const m of movies.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
            items.push(formatContentItem(m, 'movie', playLink))
          }
        }

        if (type === 'series' || type === 'both') {
          let whereClause = `WHERE s.id NOT IN (
            SELECT DISTINCT ep.series_id FROM watch_history wh
            JOIN episodes ep ON ep.id = wh.episode_id
            WHERE wh.user_id = $1)`
          const params: unknown[] = [ctx.userId]
          let paramIndex = 2

          if (genre) {
            whereClause += ` AND $${paramIndex} = ANY(s.genres)`
            params.push(genre)
            paramIndex++
          }
          if (minRating) {
            whereClause += ` AND s.community_rating >= $${paramIndex}`
            params.push(minRating)
            paramIndex++
          }
          params.push(limit)

          const series = await query<SeriesResult & { provider_item_id?: string }>(
            `SELECT s.id, s.title, s.year, s.genres, s.network, s.community_rating, s.overview, s.poster_url, s.provider_item_id
             FROM series s ${whereClause}
             ORDER BY s.community_rating DESC NULLS LAST LIMIT $${paramIndex}`,
            params
          )

          for (const s of series.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
            items.push(formatContentItem(s, 'series', playLink))
          }
        }

        return {
          id: `unwatched-${Date.now()}`,
          titleKey: 'carouselUnwatchedTitle',
          descriptionKey: 'carouselUnwatchedDesc',
          descriptionParams: { count: items.length },
          items,
        }
      },
    })
}; }
