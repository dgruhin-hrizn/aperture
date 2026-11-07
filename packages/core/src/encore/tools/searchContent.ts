import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';

import { query } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';

import type { ContentItem } from '../schemas/index.js';
import type { ToolContext, MovieResult, SeriesResult } from '../types.js';
import { searchContentTitleKey, formatContentItem } from './shared/search.js';

import { literalTitlePattern, MIN_TITLE_RELEVANCE, titleRelevance } from '../../lib/titleSearch.js'

export function createSearchContentTool(ctx: ToolContext): ToolSet { return {
searchContent: tool({
      description:
        'Find movies and TV series in the user’s library by exact or approximate title, original title, keywords, or metadata filters. Use semanticSearch for themes and plot descriptions.',
      inputSchema: nullSafe(z.object({
        // Text search
        query: z.string().optional().describe('Title or keywords to match. Pass the title as the user wrote it, without surrounding conversation.'),

        // Basic filters
        genre: z
          .string()
          .optional()
          .describe('Genre (e.g. "Action", "Comedy", "Drama", "Science Fiction", "Horror")'),
        year: z.number().optional().describe('Exact release year'),
        yearMin: z.number().optional().describe('Minimum release year (for ranges)'),
        yearMax: z.number().optional().describe('Maximum release year (for ranges)'),

        // Ratings
        minRating: z.number().optional().describe('Minimum community rating (0-10)'),
        maxRating: z.number().optional().describe('Maximum community rating (0-10)'),
        minCriticRating: z.number().optional().describe('Minimum critic rating (0-100)'),

        // Content rating (MPAA/TV ratings)
        contentRating: z
          .string()
          .optional()
          .describe(
            'Content rating: G, PG, PG-13, R, NC-17, TV-Y, TV-Y7, TV-G, TV-PG, TV-14, TV-MA'
          ),

        // Runtime (movies)
        minRuntime: z.number().optional().describe('Minimum runtime in minutes'),
        maxRuntime: z.number().optional().describe('Maximum runtime in minutes'),

        // People
        director: z.string().optional().describe('Director name'),
        actor: z.string().optional().describe('Actor name'),

        // Production
        studio: z.string().optional().describe('Studio or production company name'),
        network: z.string().optional().describe('TV network (for series): HBO, Netflix, AMC, etc.'),

        // Series-specific
        status: z.enum(['Continuing', 'Ended']).optional().describe('Series status'),
        minSeasons: z.number().optional().describe('Minimum number of seasons'),

        // Tags
        tag: z.string().optional().describe('Content tag (e.g. "superhero", "based on novel")'),

        // Type and limit
        type: z.enum(['movies', 'series', 'both']).optional().default('both'),
        limit: z.number().optional().default(15).describe('Number of results (default 15, max 50)'),

        // Sorting
        sortBy: z
          .enum(['rating', 'year', 'title', 'runtime', 'critic_rating'])
          .optional()
          .default('rating'),
        sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
      })),
      execute: async (params) => {
        const {
          query: rawQuery,
          genre,
          year,
          yearMin,
          yearMax,
          minRating,
          maxRating,
          minCriticRating,
          contentRating,
          minRuntime,
          maxRuntime,
          director,
          actor,
          studio,
          network,
          status,
          minSeasons,
          tag,
          type = 'both',
          limit = 15,
          sortBy = 'rating',
          sortOrder = 'desc',
        } = params

        const searchQuery = rawQuery?.trim()
        const safeLimit = Math.min(limit ?? 15, 50)

        // Helper to build WHERE clause
        const buildWhere = (isMovie: boolean) => {
          const conditions: string[] = []
          const values: unknown[] = []
          let idx = 1

          if (searchQuery) {
            conditions.push(`(title_match.relevance >= ${MIN_TITLE_RELEVANCE} OR overview ILIKE $2)`)
            values.push(searchQuery, literalTitlePattern(searchQuery))
            idx += 2
          }
          if (genre) {
            conditions.push(`$${idx} = ANY(genres)`)
            values.push(genre)
            idx++
          }
          if (year) {
            conditions.push(`year = $${idx}`)
            values.push(year)
            idx++
          }
          if (yearMin) {
            conditions.push(`year >= $${idx}`)
            values.push(yearMin)
            idx++
          }
          if (yearMax) {
            conditions.push(`year <= $${idx}`)
            values.push(yearMax)
            idx++
          }
          if (minRating) {
            conditions.push(`community_rating >= $${idx}`)
            values.push(minRating)
            idx++
          }
          if (maxRating) {
            conditions.push(`community_rating <= $${idx}`)
            values.push(maxRating)
            idx++
          }
          if (minCriticRating) {
            conditions.push(`critic_rating >= $${idx}`)
            values.push(minCriticRating)
            idx++
          }
          if (contentRating) {
            conditions.push(`content_rating ILIKE $${idx}`)
            values.push(contentRating)
            idx++
          }
          if (minRuntime && isMovie) {
            conditions.push(`runtime_minutes >= $${idx}`)
            values.push(minRuntime)
            idx++
          }
          if (maxRuntime && isMovie) {
            conditions.push(`runtime_minutes <= $${idx}`)
            values.push(maxRuntime)
            idx++
          }
          if (director) {
            conditions.push(`$${idx} ILIKE ANY(directors)`)
            values.push(`%${director}%`)
            idx++
          }
          if (actor) {
            conditions.push(`actors::text ILIKE $${idx}`)
            values.push(`%${actor}%`)
            idx++
          }
          if (studio) {
            conditions.push(`studios::text ILIKE $${idx}`)
            values.push(`%${studio}%`)
            idx++
          }
          if (network && !isMovie) {
            conditions.push(`network ILIKE $${idx}`)
            values.push(`%${network}%`)
            idx++
          }
          if (status && !isMovie) {
            conditions.push(`status = $${idx}`)
            values.push(status)
            idx++
          }
          if (minSeasons && !isMovie) {
            conditions.push(`total_seasons >= $${idx}`)
            values.push(minSeasons)
            idx++
          }
          if (tag) {
            conditions.push(`$${idx} ILIKE ANY(tags)`)
            values.push(`%${tag}%`)
            idx++
          }

          values.push(safeLimit)
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
          return { whereClause, values, limitIdx: idx }
        }

        // Sort column mapping
        const sortColumn =
          {
            rating: 'community_rating',
            year: 'year',
            title: 'title',
            runtime: 'runtime_minutes',
            critic_rating: 'critic_rating',
          }[sortBy] || 'community_rating'
        const order = sortOrder === 'asc' ? 'ASC' : 'DESC'
        const nullsOrder = sortOrder === 'asc' ? 'NULLS FIRST' : 'NULLS LAST'

        const search = async (mediaType: 'movie' | 'series') => {
          const isMovie = mediaType === 'movie'
          const { whereClause, values, limitIdx } = buildWhere(isMovie)
          const column = !isMovie && sortColumn === 'runtime_minutes' ? 'community_rating' : sortColumn
          const { rows } = await query<(MovieResult | SeriesResult) & { relevance: number }>(
            `SELECT id, title, year, genres, community_rating, overview, poster_url, provider_item_id,
                    ${searchQuery ? `CASE WHEN title_match.relevance >= ${MIN_TITLE_RELEVANCE}
                                         THEN title_match.relevance ELSE 0 END` : '0'} AS relevance
             FROM ${isMovie ? 'movies' : 'series'}
             ${searchQuery ? `CROSS JOIN LATERAL (SELECT ${titleRelevance} AS relevance) AS title_match` : ''}
             ${whereClause}
             ORDER BY relevance DESC, ${column} ${order} ${nullsOrder}
             LIMIT $${limitIdx}`,
            values
          )
          return rows.map((row) => ({ row, mediaType }))
        }

        const results = [
          ...(type !== 'series' ? await search('movie') : []),
          ...(type !== 'movies' ? await search('series') : []),
        ]
        if (searchQuery) results.sort((a, b) => b.row.relevance - a.row.relevance)

        const items: ContentItem[] = []
        const seenTitles = new Set<string>()
        for (const { row, mediaType } of results) {
          const titleKey = row.title.toLowerCase()
          if (seenTitles.has(titleKey)) continue
          seenTitles.add(titleKey)
          items.push(formatContentItem(row, mediaType, buildPlayLink(ctx.mediaServer, row.provider_item_id, mediaType)))
          if (searchQuery && items.length >= safeLimit) break
        }

        if (items.length === 0) {
          return {
            id: `search-empty-${Date.now()}`,
            items: [],
            descriptionKey: 'carouselSearchNoResults',
          }
        }

        const { titleKey, titleParams } = searchContentTitleKey(searchQuery, genre, type)
        return {
          id: `search-${Date.now()}`,
          titleKey,
          ...(titleParams ? { titleParams } : {}),
          items,
        }
      },
    })
}; }
