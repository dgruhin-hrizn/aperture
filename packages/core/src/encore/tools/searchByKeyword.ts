import { contentOverviewExcerpt } from './shared/search.js';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';
import type { ToolContext } from '../types.js';
export function createSearchByKeywordTool(ctx: ToolContext): ToolSet { return {
searchByKeyword: tool({
      description:
        'Find movies and series by thematic keywords. Use for questions like "movies about time travel", "films with heists", "series about dystopia", etc.',
      inputSchema: nullSafe(z.object({
        keyword: z.string().describe('The keyword or theme to search for (e.g., "time travel", "heist", "dystopia")'),
        type: z.enum(['movies', 'series', 'both']).default('both').describe('Content type to search'),
        limit: z.number().optional().default(10),
      })),
      execute: async ({ keyword, type, limit = 10 }) => {
        const keywordLower = keyword.toLowerCase()
        const results: Array<{
          id: string
          type: 'movie' | 'series'
          title: string
          year: number | null
          posterUrl: string | null
          overview?: string
          providerItemId: string | null
          matchedKeywords: string[]
        }> = []

        if (type === 'movies' || type === 'both') {
          const movies = await query<{
            id: string
            title: string
            year: number | null
            overview: string | null
            poster_url: string | null
            provider_item_id: string | null
            keywords: string[]
          }>(
            `SELECT id, title, year, overview, poster_url, provider_item_id, keywords
             FROM movies 
             WHERE keywords IS NOT NULL 
               AND EXISTS (SELECT 1 FROM unnest(keywords) k WHERE k ILIKE $1)
             ORDER BY year DESC NULLS LAST
             LIMIT $2`,
            [`%${keywordLower}%`, limit]
          )

          for (const m of movies.rows) {
            results.push({
              id: m.id,
              type: 'movie',
              title: m.title,
              year: m.year,
              posterUrl: m.poster_url,
              overview: contentOverviewExcerpt(m.overview),
              providerItemId: m.provider_item_id,
              matchedKeywords: m.keywords.filter((k) => k.toLowerCase().includes(keywordLower)),
            })
          }
        }

        if (type === 'series' || type === 'both') {
          const series = await query<{
            id: string
            title: string
            year: number | null
            overview: string | null
            poster_url: string | null
            provider_item_id: string | null
            keywords: string[]
          }>(
            `SELECT id, title, year, overview, poster_url, provider_item_id, keywords
             FROM series 
             WHERE keywords IS NOT NULL 
               AND EXISTS (SELECT 1 FROM unnest(keywords) k WHERE k ILIKE $1)
             ORDER BY year DESC NULLS LAST
             LIMIT $2`,
            [`%${keywordLower}%`, limit]
          )

          for (const s of series.rows) {
            results.push({
              id: s.id,
              type: 'series',
              title: s.title,
              year: s.year,
              posterUrl: s.poster_url,
              overview: contentOverviewExcerpt(s.overview),
              providerItemId: s.provider_item_id,
              matchedKeywords: s.keywords.filter((k) => k.toLowerCase().includes(keywordLower)),
            })
          }
        }

        return {
          id: `keyword-search-${Date.now()}`,
          keyword,
          resultCount: results.length,
          items: results.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            year: r.year,
            image: r.posterUrl,
            overview: r.overview,
            detailsUrl: `/${r.type === 'movie' ? 'movies' : 'series'}/${r.id}`,
            playUrl: buildPlayLink(ctx.mediaServer, r.providerItemId, r.type),
            matchedKeywords: r.matchedKeywords,
          })),
        }
      },
    })
}; }
