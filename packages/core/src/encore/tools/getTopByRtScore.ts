import { contentOverviewExcerpt } from './shared/search.js';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';
import type { ToolContext } from '../types.js';
export function createGetTopByRtScoreTool(ctx: ToolContext): ToolSet { return {
getTopByRtScore: tool({
      description:
        'Get movies and series ranked by Rotten Tomatoes score. Use for "highest rated on Rotten Tomatoes", "critically acclaimed", "fresh movies", etc.',
      inputSchema: nullSafe(z.object({
        type: z.enum(['movies', 'series', 'both']).default('both').describe('Content type to search'),
        minScore: z.number().optional().default(75).describe('Minimum RT score (0-100)'),
        genre: z.string().optional().describe('Optional genre filter'),
        limit: z.number().optional().default(15),
      })),
      execute: async ({ type, minScore = 75, genre, limit = 15 }) => {
        const results: Array<{
          id: string
          type: 'movie' | 'series'
          title: string
          year: number | null
          posterUrl: string | null
          overview?: string
          providerItemId: string | null
          rtCriticScore: number
          rtAudienceScore: number | null
          genres: string[]
        }> = []

        const genreCondition = genre ? ` AND $3 = ANY(genres)` : ''

        if (type === 'movies' || type === 'both') {
          const movies = await query<{
            id: string
            title: string
            year: number | null
            overview: string | null
            poster_url: string | null
            provider_item_id: string | null
            rt_critic_score: number
            rt_audience_score: number | null
            genres: string[]
          }>(
            `SELECT id, title, year, overview, poster_url, provider_item_id, rt_critic_score, rt_audience_score, genres
             FROM movies 
             WHERE rt_critic_score >= $1
               ${genreCondition}
             ORDER BY rt_critic_score DESC
             LIMIT $2`,
            genre ? [minScore, limit, genre] : [minScore, limit]
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
              rtCriticScore: m.rt_critic_score,
              rtAudienceScore: m.rt_audience_score,
              genres: m.genres,
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
            rt_critic_score: number
            rt_audience_score: number | null
            genres: string[]
          }>(
            `SELECT id, title, year, overview, poster_url, provider_item_id, rt_critic_score, rt_audience_score, genres
             FROM series 
             WHERE rt_critic_score >= $1
               ${genreCondition}
             ORDER BY rt_critic_score DESC
             LIMIT $2`,
            genre ? [minScore, limit, genre] : [minScore, limit]
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
              rtCriticScore: s.rt_critic_score,
              rtAudienceScore: s.rt_audience_score,
              genres: s.genres,
            })
          }
        }

        // Sort by critic score
        results.sort((a, b) => b.rtCriticScore - a.rtCriticScore)

        return {
          id: `rt-top-${Date.now()}`,
          minScore,
          genre: genre || null,
          resultCount: results.length,
          items: results.slice(0, limit).map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            year: r.year,
            image: r.posterUrl,
            overview: r.overview,
            detailsUrl: `/${r.type === 'movie' ? 'movies' : 'series'}/${r.id}`,
            playUrl: buildPlayLink(ctx.mediaServer, r.providerItemId, r.type),
            rtCriticScore: r.rtCriticScore,
            rtAudienceScore: r.rtAudienceScore,
            genres: r.genres,
            freshStatus: r.rtCriticScore >= 60 ? 'Fresh 🍅' : 'Rotten 🤢',
          })),
        }
      },
    })
}; }
