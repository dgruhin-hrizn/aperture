import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';
import type { ContentItem } from '../schemas/index.js';
import type { ToolContext } from '../types.js';
export function createGetUserRatingsTool(ctx: ToolContext): ToolSet { return {
getUserRatings: tool({
      description: 'Get the user\'s ratings. Use for "what have I rated", "my ratings".',
      inputSchema: nullSafe(z.object({
        minRating: z.number().optional().describe('Minimum rating (1-10)'),
        maxRating: z.number().optional().describe('Maximum rating (1-10)'),
        limit: z.number().optional().default(20),
      })),
      execute: async ({ minRating, maxRating, limit = 20 }) => {
        const items: ContentItem[] = []

        let whereClause = 'WHERE ur.user_id = $1'
        const params: unknown[] = [ctx.userId]
        let paramIndex = 2

        if (minRating !== undefined) {
          whereClause += ` AND ur.rating >= $${paramIndex++}`
          params.push(minRating)
        }
        if (maxRating !== undefined) {
          whereClause += ` AND ur.rating <= $${paramIndex++}`
          params.push(maxRating)
        }
        params.push(limit)

        const movieRatings = await query<{
          id: string
          title: string
          year: number | null
          poster_url: string | null
          genres: string[]
          community_rating: number | null
          provider_item_id: string | null
          rating: number
        }>(
          `SELECT m.id, m.title, m.year, m.poster_url, m.genres, m.community_rating,
           m.provider_item_id, ur.rating
           FROM user_ratings ur JOIN movies m ON m.id = ur.movie_id
           ${whereClause} AND ur.movie_id IS NOT NULL
           ORDER BY ur.rating DESC, ur.updated_at DESC LIMIT $${paramIndex}`,
          params
        )

        for (const m of movieRatings.rows) {
          const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
          const genres = m.genres?.slice(0, 2).join(', ') || ''
          const subtitle = [m.year, genres, `${m.rating}❤️`].filter(Boolean).join(' · ')

          items.push({
            id: m.id,
            type: 'movie',
            name: m.title,
            subtitle,
            image: m.poster_url,
            rating: m.community_rating,
            userRating: m.rating,
            actions: [
              { id: 'details', label: 'Details', href: `/movies/${m.id}`, variant: 'secondary' },
              ...(playLink
                ? [{ id: 'play', label: 'Play', href: playLink, variant: 'primary' as const }]
                : []),
            ],
          })
        }

        const seriesRatings = await query<{
          id: string
          title: string
          year: number | null
          poster_url: string | null
          genres: string[]
          community_rating: number | null
          provider_item_id: string | null
          rating: number
        }>(
          `SELECT s.id, s.title, s.year, s.poster_url, s.genres, s.community_rating,
           s.provider_item_id, ur.rating
           FROM user_ratings ur JOIN series s ON s.id = ur.series_id
           ${whereClause} AND ur.series_id IS NOT NULL
           ORDER BY ur.rating DESC, ur.updated_at DESC LIMIT $${paramIndex}`,
          params
        )

        for (const s of seriesRatings.rows) {
          const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
          const genres = s.genres?.slice(0, 2).join(', ') || ''
          const subtitle = [s.year, genres, `${s.rating}❤️`].filter(Boolean).join(' · ')

          items.push({
            id: s.id,
            type: 'series',
            name: s.title,
            subtitle,
            image: s.poster_url,
            rating: s.community_rating,
            userRating: s.rating,
            actions: [
              { id: 'details', label: 'Details', href: `/series/${s.id}`, variant: 'secondary' },
              ...(playLink
                ? [{ id: 'play', label: 'Play', href: playLink, variant: 'primary' as const }]
                : []),
            ],
          })
        }

        return {
          id: `ratings-${Date.now()}`,
          titleKey: 'carouselRatingsTitle',
          descriptionKey: 'carouselRatingsDesc',
          descriptionParams: { count: items.length },
          items,
        }
      },
    })
}; }
