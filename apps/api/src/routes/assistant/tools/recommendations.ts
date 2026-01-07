/**
 * Recommendation tools with Tool UI output schemas
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query } from '../../../lib/db.js'
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

export function createRecommendationTools(ctx: ToolContext) {
  return {
    getMyRecommendations: tool({
      description: "Get the user's current AI-generated personalized recommendations.",
      inputSchema: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        limit: z.number().optional().default(15).describe('Number of results (default 15, max 50)'),
      }),
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
            description:
              'No recommendations generated yet. Ask an admin to run the recommendation job.',
          }
        }

        return {
          id: `recs-${Date.now()}`,
          title: 'Your AI Recommendations',
          description: `${items.length} personalized picks for you`,
          items,
        }
      },
    }),

    getTopRated: tool({
      description: 'Get the highest-rated content in the library.',
      inputSchema: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        genre: z.string().optional().describe('Filter by genre'),
        limit: z.number().optional().default(15).describe('Number of results (default 15, max 50)'),
      }),
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
            `SELECT id, title, year, genres, community_rating, poster_url, provider_item_id
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
            `SELECT id, title, year, genres, network, community_rating, poster_url, provider_item_id
             FROM series ${whereClause}
             ORDER BY community_rating DESC LIMIT $${paramIndex}`,
            params
          )

          for (const s of series.rows) {
            const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
            items.push(formatContentItem(s, 'series', playLink))
          }
        }

        const title = genre ? `Top Rated ${genre}` : 'Top Rated'
        return {
          id: `top-rated-${Date.now()}`,
          title,
          items,
        }
      },
    }),

    getUnwatched: tool({
      description: 'Get content the user has NOT watched yet.',
      inputSchema: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
        genre: z.string().optional().describe('Filter by genre'),
        minRating: z.number().optional().describe('Minimum community rating'),
        limit: z.number().optional().default(15).describe('Number of results (default 15, max 50)'),
      }),
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
            `SELECT m.id, m.title, m.year, m.genres, m.community_rating, m.poster_url, m.provider_item_id
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
            `SELECT s.id, s.title, s.year, s.genres, s.network, s.community_rating, s.poster_url, s.provider_item_id
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
          title: 'Unwatched Content',
          description: `${items.length} titles you haven't watched yet`,
          items,
        }
      },
    }),
  }
}
