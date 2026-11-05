import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';
import type { ContentItem } from '../schemas/index.js';
import type { ToolContext, MovieResult, SeriesResult } from '../types.js';
import { formatContentItem } from './shared/recommendations.js';
export function createGetMyRecommendationsTool(ctx: ToolContext): ToolSet { return {
getMyRecommendations: tool({
      description: "Get the user's current AI-generated personalized recommendations.",
      inputSchema: nullSafe(z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        limit: z.number().optional().default(15).describe('Number of results (default 15, max 50)'),
      })),
      execute: async ({ type, limit = 15 }) => {
        const items: ContentItem[] = []

        if (type === 'movies' || type === 'both') {
          const movieRecs = await query<{
            id: string
            title: string
            year: number | null
            rank: number
            genres: string[]
            poster_url: string | null
            community_rating: number | null
            provider_item_id: string | null
          }>(
            `SELECT m.id, m.title, m.year, rc.selected_rank as rank, m.genres, m.poster_url, 
             m.community_rating, m.provider_item_id
             FROM recommendation_candidates rc
             JOIN recommendation_runs rr ON rr.id = rc.run_id
             JOIN movies m ON m.id = rc.movie_id
             WHERE rr.user_id = $1 AND rr.status = 'completed' AND rr.media_type = 'movie'
             AND rc.is_selected = true
             ORDER BY rr.created_at DESC, rc.selected_rank ASC LIMIT $2`,
            [ctx.userId, limit]
          )

          for (const r of movieRecs.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, r.provider_item_id, 'movie')
            items.push(formatContentItem(r as unknown as MovieResult, 'movie', playLink, r.rank))
          }
        }

        if (type === 'series' || type === 'both') {
          const seriesRecs = await query<{
            id: string
            title: string
            year: number | null
            rank: number
            genres: string[]
            poster_url: string | null
            community_rating: number | null
            provider_item_id: string | null
          }>(
            `SELECT s.id, s.title, s.year, rc.selected_rank as rank, s.genres, s.poster_url,
             s.community_rating, s.provider_item_id
             FROM recommendation_candidates rc
             JOIN recommendation_runs rr ON rr.id = rc.run_id
             JOIN series s ON s.id = rc.series_id
             WHERE rr.user_id = $1 AND rr.status = 'completed' AND rr.media_type = 'series'
             AND rc.is_selected = true
             ORDER BY rr.created_at DESC, rc.selected_rank ASC LIMIT $2`,
            [ctx.userId, limit]
          )

          for (const r of seriesRecs.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series')
            items.push(formatContentItem(r as unknown as SeriesResult, 'series', playLink, r.rank))
          }
        }

        if (items.length === 0) {
          return {
            id: `recs-empty-${Date.now()}`,
            items: [],
            descriptionKey: 'carouselRecommendationsEmpty',
          }
        }

        return {
          id: `recs-${Date.now()}`,
          titleKey: 'carouselRecommendationsTitle',
          descriptionKey: 'carouselRecommendationsDesc',
          descriptionParams: { count: items.length },
          items,
        }
      },
    })
}; }
