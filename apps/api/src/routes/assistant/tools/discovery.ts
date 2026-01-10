/**
 * Discovery tools for enriched metadata: keywords, franchises, awards, RT scores
 */
import { tool } from 'ai'
import { z } from 'zod'
import { query } from '../../../lib/db.js'
import { buildPlayLink } from '../helpers/mediaServer.js'
import type { ToolContext } from '../types.js'

export function createDiscoveryTools(ctx: ToolContext) {
  return {
    searchByKeyword: tool({
      description:
        'Find movies and series by thematic keywords. Use for questions like "movies about time travel", "films with heists", "series about dystopia", etc.',
      inputSchema: z.object({
        keyword: z.string().describe('The keyword or theme to search for (e.g., "time travel", "heist", "dystopia")'),
        type: z.enum(['movies', 'series', 'both']).default('both').describe('Content type to search'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ keyword, type, limit = 10 }) => {
        const keywordLower = keyword.toLowerCase()
        const results: Array<{
          id: string
          type: 'movie' | 'series'
          title: string
          year: number | null
          posterUrl: string | null
          providerItemId: string | null
          matchedKeywords: string[]
        }> = []

        if (type === 'movies' || type === 'both') {
          const movies = await query<{
            id: string
            title: string
            year: number | null
            poster_url: string | null
            provider_item_id: string | null
            keywords: string[]
          }>(
            `SELECT id, title, year, poster_url, provider_item_id, keywords
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
            poster_url: string | null
            provider_item_id: string | null
            keywords: string[]
          }>(
            `SELECT id, title, year, poster_url, provider_item_id, keywords
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
            detailsUrl: `/${r.type === 'movie' ? 'movies' : 'series'}/${r.id}`,
            playUrl: buildPlayLink(ctx.mediaServer, r.providerItemId, r.type),
            matchedKeywords: r.matchedKeywords,
          })),
        }
      },
    }),

    getFranchises: tool({
      description:
        'Get movie franchises/collections in the library with watch progress. Use for "what franchises do I have", "Star Wars movies", "MCU progress", etc.',
      inputSchema: z.object({
        search: z.string().optional().describe('Optional search term to filter franchises'),
        limit: z.number().optional().default(20),
      }),
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
    }),

    getAwardWinners: tool({
      description:
        'Find award-winning movies and series. Use for "Oscar winners", "Emmy winning shows", "Golden Globe movies", etc.',
      inputSchema: z.object({
        awardType: z
          .enum(['oscar', 'emmy', 'golden_globe', 'bafta', 'any'])
          .default('any')
          .describe('Type of award to filter by'),
        type: z.enum(['movies', 'series', 'both']).default('both').describe('Content type to search'),
        winnersOnly: z.boolean().default(false).describe('Only include winners (not just nominees)'),
        limit: z.number().optional().default(15),
      }),
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
    }),

    getTopByRtScore: tool({
      description:
        'Get movies and series ranked by Rotten Tomatoes score. Use for "highest rated on Rotten Tomatoes", "critically acclaimed", "fresh movies", etc.',
      inputSchema: z.object({
        type: z.enum(['movies', 'series', 'both']).default('both').describe('Content type to search'),
        minScore: z.number().optional().default(75).describe('Minimum RT score (0-100)'),
        genre: z.string().optional().describe('Optional genre filter'),
        limit: z.number().optional().default(15),
      }),
      execute: async ({ type, minScore = 75, genre, limit = 15 }) => {
        const results: Array<{
          id: string
          type: 'movie' | 'series'
          title: string
          year: number | null
          posterUrl: string | null
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
            poster_url: string | null
            provider_item_id: string | null
            rt_critic_score: number
            rt_audience_score: number | null
            genres: string[]
          }>(
            `SELECT id, title, year, poster_url, provider_item_id, rt_critic_score, rt_audience_score, genres
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
            poster_url: string | null
            provider_item_id: string | null
            rt_critic_score: number
            rt_audience_score: number | null
            genres: string[]
          }>(
            `SELECT id, title, year, poster_url, provider_item_id, rt_critic_score, rt_audience_score, genres
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
            detailsUrl: `/${r.type === 'movie' ? 'movies' : 'series'}/${r.id}`,
            playUrl: buildPlayLink(ctx.mediaServer, r.providerItemId, r.type),
            rtCriticScore: r.rtCriticScore,
            rtAudienceScore: r.rtAudienceScore,
            genres: r.genres,
            freshStatus: r.rtCriticScore >= 60 ? 'Fresh 🍅' : 'Rotten 🤢',
          })),
        }
      },
    }),

    getFranchiseProgress: tool({
      description:
        'Get detailed progress for a specific franchise/collection. Use for "my Star Wars progress", "how many Marvel movies have I seen", etc.',
      inputSchema: z.object({
        franchiseName: z.string().describe('Name of the franchise/collection to check'),
      }),
      execute: async ({ franchiseName }) => {
        const movies = await query<{
          id: string
          title: string
          year: number | null
          poster_url: string | null
          provider_item_id: string | null
          community_rating: number | null
          rt_critic_score: number | null
          watched: boolean
        }>(
          `SELECT 
             m.id, m.title, m.year, m.poster_url, m.provider_item_id, 
             m.community_rating, m.rt_critic_score,
             CASE WHEN wh.id IS NOT NULL THEN true ELSE false END as watched
           FROM movies m
           LEFT JOIN watch_history wh ON wh.movie_id = m.id AND wh.user_id = $1
           WHERE m.collection_name ILIKE $2
           ORDER BY m.year NULLS LAST`,
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
          watchedCount,
          totalCount,
          nextToWatch: movies.rows.find((m) => !m.watched),
          movies: movies.rows.map((m) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            image: m.poster_url,
            detailsUrl: `/movies/${m.id}`,
            playUrl: buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie'),
            watched: m.watched,
            rating: m.community_rating,
            rtScore: m.rt_critic_score,
          })),
        }
      },
    }),
  }
}


