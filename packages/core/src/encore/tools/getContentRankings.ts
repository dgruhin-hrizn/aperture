import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';

import type { ToolContext } from '../types.js';
import { rankingTitleKey } from './shared/library.js';
export function createGetContentRankingsTool(ctx: ToolContext): ToolSet { return {
getContentRankings: tool({
      description:
        'Get content rankings/leaderboards. Use for questions like "which series has the most episodes", "longest movie", "highest rated series", "oldest movie", etc.',
      inputSchema: nullSafe(z.object({
        rankBy: z
          .enum([
            'most_episodes',
            'longest_runtime',
            'highest_rated',
            'lowest_rated',
            'newest',
            'oldest',
            'most_seasons',
          ])
          .describe('What to rank by'),
        type: z.enum(['movies', 'series']).describe('Content type to rank'),
        limit: z.number().optional().default(10),
      })),
      execute: async ({ rankBy, type, limit = 10 }) => {
        if (type === 'series') {
          if (rankBy === 'most_episodes') {
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              episode_count: string
            }>(
              `SELECT s.id, s.title, s.year, s.poster_url, s.provider_item_id,
               COUNT(e.id) as episode_count
               FROM series s LEFT JOIN episodes e ON e.series_id = s.id
               GROUP BY s.id ORDER BY episode_count DESC LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              titleKey: rankingTitleKey('most_episodes', 'series'),
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'series',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${parseInt(r.episode_count)} episodes`,
                detailsUrl: `/series/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series'),
              })),
            }
          }

          if (rankBy === 'most_seasons') {
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              season_count: string
            }>(
              `SELECT s.id, s.title, s.year, s.poster_url, s.provider_item_id,
               COUNT(DISTINCT e.season_number) as season_count
               FROM series s LEFT JOIN episodes e ON e.series_id = s.id
               GROUP BY s.id ORDER BY season_count DESC LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              titleKey: rankingTitleKey('most_seasons', 'series'),
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'series',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${parseInt(r.season_count)} seasons`,
                detailsUrl: `/series/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series'),
              })),
            }
          }

          if (rankBy === 'highest_rated' || rankBy === 'lowest_rated') {
            const order = rankBy === 'highest_rated' ? 'DESC' : 'ASC'
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              community_rating: number
            }>(
              `SELECT id, title, year, poster_url, provider_item_id, community_rating
               FROM series WHERE community_rating IS NOT NULL
               ORDER BY community_rating ${order} LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              titleKey: rankingTitleKey(rankBy, 'series'),
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'series',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${r.community_rating} rating`,
                detailsUrl: `/series/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series'),
              })),
            }
          }

          if (rankBy === 'newest' || rankBy === 'oldest') {
            const order = rankBy === 'newest' ? 'DESC' : 'ASC'
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
            }>(
              `SELECT id, title, year, poster_url, provider_item_id
               FROM series WHERE year IS NOT NULL
               ORDER BY year ${order} LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              titleKey: rankingTitleKey(rankBy, 'series'),
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'series',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${r.year}`,
                detailsUrl: `/series/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'series'),
              })),
            }
          }
        }

        if (type === 'movies') {
          if (rankBy === 'longest_runtime') {
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              runtime_minutes: number
            }>(
              `SELECT id, title, year, poster_url, provider_item_id, runtime_minutes
               FROM movies WHERE runtime_minutes IS NOT NULL
               ORDER BY runtime_minutes DESC LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              titleKey: rankingTitleKey('longest_runtime', 'movies'),
              items: results.rows.map((r, i) => {
                const hours = Math.floor(r.runtime_minutes / 60)
                const mins = r.runtime_minutes % 60
                return {
                  rank: i + 1,
                  id: r.id,
                  type: 'movie',
                  name: r.title,
                  year: r.year,
                  image: r.poster_url,
                  value: `${hours}h ${mins}m`,
                  detailsUrl: `/movies/${r.id}`,
                  playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'movie'),
                }
              }),
            }
          }

          if (rankBy === 'highest_rated' || rankBy === 'lowest_rated') {
            const order = rankBy === 'highest_rated' ? 'DESC' : 'ASC'
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
              community_rating: number
            }>(
              `SELECT id, title, year, poster_url, provider_item_id, community_rating
               FROM movies WHERE community_rating IS NOT NULL
               ORDER BY community_rating ${order} LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              titleKey: rankingTitleKey(rankBy, 'movies'),
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'movie',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${r.community_rating} rating`,
                detailsUrl: `/movies/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'movie'),
              })),
            }
          }

          if (rankBy === 'newest' || rankBy === 'oldest') {
            const order = rankBy === 'newest' ? 'DESC' : 'ASC'
            const results = await query<{
              id: string
              title: string
              year: number | null
              poster_url: string | null
              provider_item_id: string | null
            }>(
              `SELECT id, title, year, poster_url, provider_item_id
               FROM movies WHERE year IS NOT NULL
               ORDER BY year ${order} LIMIT $1`,
              [limit]
            )
            return {
              id: `ranking-${Date.now()}`,
              titleKey: rankingTitleKey(rankBy, 'movies'),
              items: results.rows.map((r, i) => ({
                rank: i + 1,
                id: r.id,
                type: 'movie',
                name: r.title,
                year: r.year,
                image: r.poster_url,
                value: `${r.year}`,
                detailsUrl: `/movies/${r.id}`,
                playUrl: buildPlayLink(ctx.mediaServer, r.provider_item_id, 'movie'),
              })),
            }
          }
        }

        return {
          id: `ranking-error-${Date.now()}`,
          error: `Invalid combination: ${rankBy} for ${type}`,
        }
      },
    })
}; }
