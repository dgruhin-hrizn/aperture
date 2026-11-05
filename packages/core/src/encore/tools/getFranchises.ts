import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';

import type { ToolContext } from '../types.js';
export function createGetFranchisesTool(ctx: ToolContext): ToolSet { return {
getFranchises: tool({
      description:
        'Get movie franchises/collections in the library with watch progress. Use for "what franchises do I have", "Star Wars movies", "MCU progress", etc.',
      inputSchema: nullSafe(z.object({
        search: z.string().optional().describe('Optional search term to filter franchises'),
        limit: z.number().optional().default(20),
      })),
      execute: async ({ search, limit = 20 }) => {
        const searchCondition = search ? ` AND m.collection_name ILIKE $2` : ''
        const params: unknown[] = [ctx.userId]
        if (search) params.push(`%${search}%`)

        const result = await query<{
          collection_name: string
          movie_count: string
          watched_count: string
          avg_rating: number | null
          movies: string[]
          years: (number | null)[]
        }>(
          `SELECT 
             m.collection_name,
             COUNT(m.id)::text as movie_count,
             COUNT(wh.id)::text as watched_count,
             ROUND(AVG(m.community_rating)::numeric, 1) as avg_rating,
             ARRAY_AGG(m.title ORDER BY m.year) as movies,
             ARRAY_AGG(m.year ORDER BY m.year) as years
           FROM movies m
           LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = $1
           WHERE m.collection_name IS NOT NULL${searchCondition}
           GROUP BY m.collection_name
           ORDER BY COUNT(m.id) DESC
           LIMIT ${search ? '$3' : '$2'}`,
          search ? [...params, limit] : [ctx.userId, limit]
        )

        return {
          id: `franchises-${Date.now()}`,
          franchiseCount: result.rows.length,
          franchises: result.rows.map((f) => ({
            name: f.collection_name,
            movieCount: parseInt(f.movie_count),
            watchedCount: parseInt(f.watched_count),
            progress: Math.round((parseInt(f.watched_count) / parseInt(f.movie_count)) * 100),
            averageRating: f.avg_rating,
            movies: f.movies,
            yearRange:
              f.years.filter(Boolean).length > 0
                ? `${Math.min(...(f.years.filter(Boolean) as number[]))} - ${Math.max(...(f.years.filter(Boolean) as number[]))}`
                : null,
          })),
        }
      },
    })
}; }
