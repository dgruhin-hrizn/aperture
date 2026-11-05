import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';


import type { ToolContext } from '../types.js';

export function createGetAvailableGenresTool(_ctx: ToolContext): ToolSet { return {
getAvailableGenres: tool({
      description: 'Get a list of all available genres in the library with counts.',
      inputSchema: nullSafe(z.object({
        type: z.enum(['movies', 'series', 'both']).default('both'),
      })),
      execute: async ({ type }) => {
        const result: {
          id: string
          movieGenres?: Array<{ genre: string; count: number }>
          seriesGenres?: Array<{ genre: string; count: number }>
        } = { id: `genres-${Date.now()}` }

        if (type === 'movies' || type === 'both') {
          const movieGenres = await query<{ genre: string; count: string }>(
            `SELECT unnest(genres) as genre, COUNT(*) as count FROM movies
             GROUP BY genre ORDER BY count DESC`
          )
          result.movieGenres = movieGenres.rows.map((g) => ({
            genre: g.genre,
            count: parseInt(g.count),
          }))
        }

        if (type === 'series' || type === 'both') {
          const seriesGenres = await query<{ genre: string; count: string }>(
            `SELECT unnest(genres) as genre, COUNT(*) as count FROM series
             GROUP BY genre ORDER BY count DESC`
          )
          result.seriesGenres = seriesGenres.rows.map((g) => ({
            genre: g.genre,
            count: parseInt(g.count),
          }))
        }

        return result
      },
    })
}; }
