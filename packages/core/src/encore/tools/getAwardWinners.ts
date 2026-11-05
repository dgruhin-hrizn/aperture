import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';
import type { ToolContext } from '../types.js';
export function createGetAwardWinnersTool(ctx: ToolContext): ToolSet { return {
getAwardWinners: tool({
      description:
        'Find award-winning movies and series. Use for "Oscar winners", "Emmy winning shows", "Golden Globe movies", etc.',
      inputSchema: nullSafe(z.object({
        awardType: z
          .enum(['oscar', 'emmy', 'golden_globe', 'bafta', 'any'])
          .default('any')
          .describe('Type of award to filter by'),
        type: z.enum(['movies', 'series', 'both']).default('both').describe('Content type to search'),
        winnersOnly: z.boolean().default(false).describe('Only include winners (not just nominees)'),
        limit: z.number().optional().default(15),
      })),
      execute: async ({ awardType, type, winnersOnly, limit = 15 }) => {
        const awardPatterns: Record<string, string> = {
          oscar: 'oscar|academy award',
          emmy: 'emmy',
          golden_globe: 'golden globe',
          bafta: 'bafta',
          any: '.*',
        }

        const pattern = awardPatterns[awardType]
        const winCondition = winnersOnly ? "AND awards_summary ~* 'won'" : ''

        const results: Array<{
          id: string
          type: 'movie' | 'series'
          title: string
          year: number | null
          posterUrl: string | null
          providerItemId: string | null
          awards: string
          rtScore: number | null
        }> = []

        if (type === 'movies' || type === 'both') {
          const movies = await query<{
            id: string
            title: string
            year: number | null
            poster_url: string | null
            provider_item_id: string | null
            awards_summary: string
            rt_critic_score: number | null
          }>(
            `SELECT id, title, year, poster_url, provider_item_id, awards_summary, rt_critic_score
             FROM movies 
             WHERE awards_summary IS NOT NULL 
               AND awards_summary ~* $1
               ${winCondition}
             ORDER BY rt_critic_score DESC NULLS LAST
             LIMIT $2`,
            [pattern, limit]
          )

          for (const m of movies.rows) {
            results.push({
              id: m.id,
              type: 'movie',
              title: m.title,
              year: m.year,
              posterUrl: m.poster_url,
              providerItemId: m.provider_item_id,
              awards: m.awards_summary,
              rtScore: m.rt_critic_score,
            })
          }
        }

        if (type === 'series' || type === 'both') {
          const series = await query<{
            id: string
            title: string
            year: number | null
            poster_url: string | null
            provider_item_id: string | null
            awards_summary: string
            rt_critic_score: number | null
          }>(
            `SELECT id, title, year, poster_url, provider_item_id, awards_summary, rt_critic_score
             FROM series 
             WHERE awards_summary IS NOT NULL 
               AND awards_summary ~* $1
               ${winCondition}
             ORDER BY rt_critic_score DESC NULLS LAST
             LIMIT $2`,
            [pattern, limit]
          )

          for (const s of series.rows) {
            results.push({
              id: s.id,
              type: 'series',
              title: s.title,
              year: s.year,
              posterUrl: s.poster_url,
              providerItemId: s.provider_item_id,
              awards: s.awards_summary,
              rtScore: s.rt_critic_score,
            })
          }
        }

        // Sort by RT score
        results.sort((a, b) => (b.rtScore || 0) - (a.rtScore || 0))

        return {
          id: `awards-${Date.now()}`,
          awardType,
          winnersOnly,
          resultCount: results.length,
          items: results.slice(0, limit).map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            year: r.year,
            image: r.posterUrl,
            detailsUrl: `/${r.type === 'movie' ? 'movies' : 'series'}/${r.id}`,
            playUrl: buildPlayLink(ctx.mediaServer, r.providerItemId, r.type),
            awards: r.awards,
            rtScore: r.rtScore,
          })),
        }
      },
    })
}; }
