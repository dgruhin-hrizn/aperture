import { contentOverviewExcerpt } from './shared/search.js';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';
import type { ToolContext } from '../types.js';
export function createGetFranchiseProgressTool(ctx: ToolContext): ToolSet { return {
getFranchiseProgress: tool({
      description:
        'Get detailed progress for a specific franchise/collection. Use for "my Star Wars progress", "how many Marvel movies have I seen", etc.',
      inputSchema: nullSafe(z.object({
        franchiseName: z.string().describe('Name of the franchise/collection to check'),
      })),
      execute: async ({ franchiseName }) => {
        const movies = await query<{
          id: string
          title: string
          year: number | null
          overview: string | null
          poster_url: string | null
          provider_item_id: string | null
          community_rating: number | null
          rt_critic_score: number | null
          watched: boolean
        }>(
          `SELECT 
             m.id, m.title, m.year, m.overview, m.poster_url, m.provider_item_id,
             m.community_rating, m.rt_critic_score,
             CASE WHEN wh.id IS NOT NULL THEN true ELSE false END as watched
           FROM movies m
           LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = $1
           WHERE m.collection_name ILIKE $2
           ORDER BY m.year NULLS LAST LIMIT 200`,
          [ctx.userId, `%${franchiseName}%`]
        )

        if (movies.rows.length === 0) {
          return {
            id: `franchise-progress-${Date.now()}`,
            error: `No franchise found matching "${franchiseName}"`,
            found: false,
          }
        }

        const watchedCount = movies.rows.filter((m) => m.watched).length
        const totalCount = movies.rows.length
        const progress = Math.round((watchedCount / totalCount) * 100)

        return {
          id: `franchise-progress-${Date.now()}`,
          found: true,
          franchiseName: franchiseName,
          progress,
          truncated: movies.rows.length === 200,
          watchedCount,
          totalCount,
          nextToWatch: movies.rows.find((m) => !m.watched),
          movies: movies.rows.map((m) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            image: m.poster_url,
            overview: contentOverviewExcerpt(m.overview),
            detailsUrl: `/movies/${m.id}`,
            playUrl: buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie'),
            watched: m.watched,
            rating: m.community_rating,
            rtScore: m.rt_critic_score,
          })),
        }
      },
    })
}; }
