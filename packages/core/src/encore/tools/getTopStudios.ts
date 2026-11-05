import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import type { ToolContext } from '../types.js';
export function createGetTopStudiosTool(ctx: ToolContext): ToolSet { return {
getTopStudios: tool({
      description: "Get the user's most watched studios and networks.",
      inputSchema: nullSafe(z.object({
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        limit: z.number().optional().default(10),
      })),
      execute: async ({ type = 'both', limit = 10 }) => {
        const result: {
          id: string
          studios?: Array<{
            name: string
            movieCount: number
            topTitles: Array<{ id: string; type: 'movie'; title: string }>
          }>
          networks?: Array<{
            name: string
            seriesCount: number
            topTitles: Array<{ id: string; type: 'series'; title: string }>
          }>
        } = { id: `studios-${Date.now()}` }

        if (type === 'movies' || type === 'both') {
          // Studios is now JSONB array of {id, name} objects
          const studioData = await query<{ studio: string; count: string }>(
            `SELECT studio_obj->>'name' as studio, COUNT(DISTINCT m.id) as count
             FROM movies m 
             JOIN watch_history wh ON wh.movie_id = m.id,
             LATERAL jsonb_array_elements(m.studios) as studio_obj
             WHERE wh.user_id = $1 AND studio_obj->>'name' IS NOT NULL
             GROUP BY studio_obj->>'name' ORDER BY count DESC LIMIT $2`,
            [ctx.userId, limit]
          )

          const studios: Array<{
            name: string
            movieCount: number
            topTitles: Array<{ id: string; type: 'movie'; title: string }>
          }> = []

          for (const row of studioData.rows) {
            const topMovies = await query<{ id: string; title: string }>(
              `SELECT m.id, m.title FROM movies m 
               JOIN watch_history wh ON wh.movie_id = m.id
               WHERE wh.user_id = $1 
                 AND EXISTS (
                   SELECT 1 FROM jsonb_array_elements(m.studios) s 
                   WHERE s->>'name' = $2
                 )
               ORDER BY m.community_rating DESC NULLS LAST LIMIT 3`,
              [ctx.userId, row.studio]
            )
            studios.push({
              name: row.studio,
              movieCount: parseInt(row.count),
              topTitles: topMovies.rows.map((m) => ({
                id: m.id,
                type: 'movie' as const,
                title: m.title,
              })),
            })
          }
          result.studios = studios
        }

        if (type === 'series' || type === 'both') {
          const networkData = await query<{ network: string; count: string }>(
            `SELECT s.network, COUNT(DISTINCT s.id) as count
             FROM series s JOIN episodes e ON e.series_id = s.id
             JOIN watch_history wh ON wh.episode_id = e.id
             WHERE wh.user_id = $1 AND s.network IS NOT NULL
             GROUP BY s.network ORDER BY count DESC LIMIT $2`,
            [ctx.userId, limit]
          )

          const networks: Array<{
            name: string
            seriesCount: number
            topTitles: Array<{ id: string; type: 'series'; title: string }>
          }> = []

          for (const row of networkData.rows) {
            const topSeries = await query<{ id: string; title: string }>(
              `SELECT DISTINCT s.id, s.title FROM series s
               JOIN episodes e ON e.series_id = s.id
               JOIN watch_history wh ON wh.episode_id = e.id
               WHERE wh.user_id = $1 AND s.network = $2
               ORDER BY s.community_rating DESC NULLS LAST LIMIT 3`,
              [ctx.userId, row.network]
            )
            networks.push({
              name: row.network,
              seriesCount: parseInt(row.count),
              topTitles: topSeries.rows.map((s) => ({
                id: s.id,
                type: 'series' as const,
                title: s.title,
              })),
            })
          }
          result.networks = networks
        }

        return result
      },
    })
}; }
