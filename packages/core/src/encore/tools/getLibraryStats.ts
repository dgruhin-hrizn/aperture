import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query, queryOne } from '../scopedDb.js';


import type { ToolContext } from '../types.js';

export function createGetLibraryStatsTool(ctx: ToolContext): ToolSet { return {
getLibraryStats: tool({
      description:
        'Get comprehensive statistics about the user\'s media library. Use for "how many movies", "library size", etc.',
      inputSchema: nullSafe(z.object({})),
      execute: async () => {
        const movieStats = await queryOne<{
          count: string
          avg_rating: number
          total_runtime: string
        }>(
          `SELECT COUNT(*) as count, ROUND(AVG(community_rating)::numeric, 2) as avg_rating,
           SUM(runtime_minutes) as total_runtime FROM movies`
        )

        const seriesStats = await queryOne<{
          count: string
          episode_count: string
          avg_rating: number
        }>(
          `SELECT COUNT(DISTINCT s.id) as count, COUNT(e.id) as episode_count,
           ROUND(AVG(s.community_rating)::numeric, 2) as avg_rating
           FROM series s LEFT JOIN episodes e ON e.series_id = s.id`
        )

        const movieGenres = await query<{ genre: string; count: string }>(
          `SELECT unnest(genres) as genre, COUNT(*) as count FROM movies
           GROUP BY genre ORDER BY count DESC LIMIT 10`
        )

        const watchStats = await queryOne<{
          movies_watched: string
          series_started: string
          total_plays: string
        }>(
          `SELECT 
           COUNT(DISTINCT movie_id) FILTER (WHERE movie_id IS NOT NULL) as movies_watched,
           COUNT(DISTINCT (SELECT e2.series_id FROM episodes e2 WHERE e2.id = wh.episode_id)) FILTER (WHERE episode_id IS NOT NULL) as series_started,
           SUM(play_count) as total_plays 
           FROM watch_history wh WHERE user_id = $1`,
          [ctx.userId]
        )

        const ratingStats = await queryOne<{ total_ratings: string; avg_rating: number }>(
          `SELECT COUNT(*) as total_ratings, ROUND(AVG(rating)::numeric, 1) as avg_rating
           FROM user_ratings WHERE user_id = $1`,
          [ctx.userId]
        )

        const totalRuntime = parseInt(movieStats?.total_runtime || '0')
        const days = Math.floor(totalRuntime / 60 / 24)
        const hours = Math.floor((totalRuntime / 60) % 24)

        return {
          id: `stats-${Date.now()}`,
          movieCount: parseInt(movieStats?.count || '0'),
          seriesCount: parseInt(seriesStats?.count || '0'),
          episodeCount: parseInt(seriesStats?.episode_count || '0'),
          totalRuntimeMinutes: totalRuntime,
          totalRuntimeFormatted: `${days} days, ${hours} hours`,
          averageRating: movieStats?.avg_rating || null,
          topGenres: movieGenres.rows.map((g) => ({
            genre: g.genre,
            count: parseInt(g.count),
          })),
          watchStats: {
            moviesWatched: parseInt(watchStats?.movies_watched || '0'),
            seriesStarted: parseInt(watchStats?.series_started || '0'),
            totalPlayCount: parseInt(watchStats?.total_plays || '0'),
          },
          ratingStats: {
            totalRated: parseInt(ratingStats?.total_ratings || '0'),
            averageUserRating: ratingStats?.avg_rating || null,
          },
        }
      },
    })
}; }
