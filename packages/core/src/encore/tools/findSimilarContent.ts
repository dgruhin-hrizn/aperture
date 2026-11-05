import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { nullSafe } from './utils.js';
import { z } from 'zod';
import { getActiveEmbeddingTableName } from '../../index.js';
import { query, queryOne } from '../scopedDb.js';
import { buildPlayLink } from '../helpers/mediaServer.js';

import type { ContentItem } from '../schemas/index.js';
import type { ToolContext, MovieResult, SeriesResult } from '../types.js';
import { similarSuccessDescriptionKey, formatContentItem } from './shared/search.js';
export function createFindSimilarContentTool(ctx: ToolContext): ToolSet { return {
findSimilarContent: tool({
      description:
        'Find movies or TV series similar to a given title using AI embeddings. Returns ONLY the same type (movies for movies, series for series). Can optionally exclude content the user has already watched.',
      inputSchema: nullSafe(z.object({
        title: z.string().describe('The title to find similar content for'),
        type: z
          .enum(['movies', 'series'])
          .optional()
          .describe('Force search type. If omitted, auto-detects from title.'),
        excludeWatched: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, only return unwatched content'),
        limit: z
          .number()
          .optional()
          .default(15)
          .describe('Number of results to return (default 15, max 50)'),
      })),
      execute: async ({ title, type, excludeWatched = false, limit = 15 }) => {
        try {
          const items: ContentItem[] = []
          let foundTitle = ''
          let foundType: 'movie' | 'series' | '' = ''

          // If type is specified, only search that type
          const searchMovies = !type || type === 'movies'
          const searchSeries = !type || type === 'series'

          // Get model ID for database query
          const modelId = ctx.embeddingModelId

          // Try to find as movie - get rich metadata for intelligent embedding
          interface MovieWithMeta {
            id: string
            title: string
            overview: string | null
            year: number | null
            tagline: string | null
            directors: string[] | null
            actors: Array<{ name: string }> | null
            studios: string[] | null
            tags: string[] | null
          }
          let movie: MovieWithMeta | null = null
          if (searchMovies) {
            const movieEmbeddingTable = await getActiveEmbeddingTableName('embeddings')
            movie = await queryOne<MovieWithMeta>(
              `SELECT m.id, m.title, m.overview, m.year, m.tagline, m.directors, m.actors, m.studios, m.tags
               FROM movies m
               LEFT JOIN ${movieEmbeddingTable} e ON e.movie_id = m.id AND e.model = $2
               WHERE m.title ILIKE $1
               ORDER BY 
                 CASE 
                   WHEN LOWER(m.title) = LOWER($3) THEN 0
                   WHEN LOWER(m.title) LIKE LOWER($4) THEN 1
                   ELSE 2
                 END,
                 e.id IS NOT NULL DESC
               LIMIT 1`,
              [`%${title}%`, modelId, title, `${title}%`]
            )
          }

          // Try to find as series - get overview for better embedding
          let series: {
            id: string
            title: string
            overview: string | null
            year: number | null
          } | null = null
          if (searchSeries) {
            const seriesEmbeddingTable = await getActiveEmbeddingTableName('series_embeddings')
            series = await queryOne<{
              id: string
              title: string
              overview: string | null
              year: number | null
            }>(
              `SELECT s.id, s.title, s.overview, s.year FROM series s
               LEFT JOIN ${seriesEmbeddingTable} se ON se.series_id = s.id AND se.model = $2
               WHERE s.title ILIKE $1
               ORDER BY 
                 CASE 
                   WHEN LOWER(s.title) = LOWER($3) THEN 0
                   WHEN LOWER(s.title) LIKE LOWER($4) THEN 1
                   ELSE 2
                 END,
                 se.id IS NOT NULL DESC
               LIMIT 1`,
              [`%${title}%`, modelId, title, `${title}%`]
            )
          }

          if (!movie && !series) {
            return {
              id: `similar-error-${Date.now()}`,
              items: [],
              descriptionKey: 'carouselSimilarLookupNotFound',
              descriptionParams: { title },
            }
          }

          // Determine which one to use - prefer series if both found and user asked for "show"
          // or prefer exact title match
          const useMovie = movie && (!series || type === 'movies')
          const useSeries = series && (!movie || type === 'series')

          if (useMovie && movie) {
            foundTitle = movie.title
            foundType = 'movie'

            // Get the stored embedding for this movie (same approach as details page)
            const movieEmbeddingTable = await getActiveEmbeddingTableName('embeddings')
            const embeddingResult = await queryOne<{ embedding: string }>(
              `SELECT embedding::text FROM ${movieEmbeddingTable} WHERE movie_id = $1 AND model = $2`,
              [movie.id, modelId]
            )

            if (!embeddingResult) {
              return {
                id: `similar-error-${Date.now()}`,
                items: [],
                descriptionKey: 'carouselSimilarNoEmbedding',
                descriptionParams: { title: movie.title },
              }
            }

            const embeddingStr = embeddingResult.embedding

            const watchedFilter = excludeWatched
              ? `AND m.id NOT IN (SELECT movie_id FROM watch_history WHERE user_id = $4 AND movie_id IS NOT NULL)`
              : ''
            const params = excludeWatched
              ? [movie.id, modelId, embeddingStr, ctx.userId, limit]
              : [movie.id, modelId, embeddingStr, limit]

            const similar = await query<MovieResult & { provider_item_id?: string }>(
              `SELECT m.id, m.title, m.year, m.genres, m.community_rating, m.overview, m.poster_url, m.provider_item_id
               FROM ${movieEmbeddingTable} e JOIN movies m ON m.id = e.movie_id
               WHERE e.movie_id != $1 AND e.model = $2 ${watchedFilter}
               ORDER BY e.embedding <=> $3::halfvec 
               LIMIT ${excludeWatched ? '$5' : '$4'}`,
              params
            )

            for (const m of similar.rows) {
              const playLink = buildPlayLink(ctx.mediaServer, m.provider_item_id, 'movie')
              items.push(formatContentItem(m, 'movie', playLink))
            }
          } else if (useSeries && series) {
            foundTitle = series.title
            foundType = 'series'

            // Get the stored embedding for this series (same approach as details page)
            const seriesEmbeddingTable = await getActiveEmbeddingTableName('series_embeddings')
            const embeddingResult = await queryOne<{ embedding: string }>(
              `SELECT embedding::text FROM ${seriesEmbeddingTable} WHERE series_id = $1 AND model = $2`,
              [series.id, modelId]
            )

            if (!embeddingResult) {
              return {
                id: `similar-error-${Date.now()}`,
                items: [],
                descriptionKey: 'carouselSimilarNoEmbedding',
                descriptionParams: { title: series.title },
              }
            }

            const embeddingStr = embeddingResult.embedding

            const watchedFilter = excludeWatched
              ? `AND s.id NOT IN (
                  SELECT DISTINCT ep.series_id FROM watch_history wh
                  JOIN episodes ep ON ep.id = wh.episode_id
                  WHERE wh.user_id = $4
                )`
              : ''

            const params = excludeWatched
              ? [series.id, modelId, embeddingStr, ctx.userId, limit]
              : [series.id, modelId, embeddingStr, limit]

            const similar = await query<SeriesResult & { provider_item_id?: string }>(
              `SELECT s.id, s.title, s.year, s.genres, s.network, s.community_rating, s.overview, s.poster_url, s.provider_item_id
               FROM ${seriesEmbeddingTable} se 
               JOIN series s ON s.id = se.series_id
               WHERE se.series_id != $1 
                 AND se.model = $2 
                 ${watchedFilter}
               ORDER BY se.embedding <=> $3::halfvec
               LIMIT ${excludeWatched ? '$5' : '$4'}`,
              params
            )

            for (const s of similar.rows) {
              const playLink = buildPlayLink(ctx.mediaServer, s.provider_item_id, 'series')
              items.push(formatContentItem(s, 'series', playLink))
            }
          }

          if (items.length === 0) {
            return {
              id: `similar-empty-${Date.now()}`,
              items: [],
              ...(foundTitle
                ? {
                    descriptionKey:
                      foundType === 'movie' ? 'carouselSimilarEmptyMovie' : 'carouselSimilarEmptySeries',
                    descriptionParams: { title: foundTitle },
                  }
                : {
                    descriptionKey: 'carouselSimilarLookupNotFound',
                    descriptionParams: { title },
                  }),
            }
          }

          return {
            id: `similar-${Date.now()}`,
            titleKey: 'carouselSimilarTitle',
            titleParams: { title: foundTitle },
            descriptionKey: similarSuccessDescriptionKey(
              foundType === 'series' ? 'series' : 'movie',
              excludeWatched
            ),
            descriptionParams: { count: items.length },
            items,
          }
        } catch (err) {
          console.error('[findSimilarContent] Error:', err)
          return {
            id: `similar-error-${Date.now()}`,
            items: [],
            descriptionKey: 'carouselSimilarError',
            descriptionParams: {
              message: err instanceof Error ? err.message : 'Unknown error',
            },
          }
        }
      },
    })
}; }
