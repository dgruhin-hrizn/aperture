/**
 * Schema for a carousel of content items
 */
import { z } from 'zod'
import { ContentItemSchema } from './contentItem.js'

/** Allowlisted i18n key suffixes (client resolves under `assistantToolUi.<key>`). */
export const ContentCarouselI18nKeySchema = z.enum([
  // Recommendations
  'carouselRecommendationsTitle',
  'carouselRecommendationsDesc',
  'carouselRecommendationsEmpty',
  'carouselTopRatedTitle',
  'carouselTopRatedGenreTitle',
  'carouselUnwatchedTitle',
  'carouselUnwatchedDesc',
  // History / ratings
  'carouselWatchHistoryTitle',
  'carouselWatchHistoryDesc',
  'carouselRatingsTitle',
  'carouselRatingsDesc',
  // Library rankings
  'carouselRankingSeriesMostEpisodes',
  'carouselRankingSeriesMostSeasons',
  'carouselRankingHighestRatedSeries',
  'carouselRankingLowestRatedSeries',
  'carouselRankingNewestSeries',
  'carouselRankingOldestSeries',
  'carouselRankingLongestMovies',
  'carouselRankingHighestRatedMovies',
  'carouselRankingLowestRatedMovies',
  'carouselRankingNewestMovies',
  'carouselRankingOldestMovies',
  // Search (content)
  'carouselSearchTitleDefault',
  'carouselSearchTitleQuery',
  'carouselSearchTitleGenreMovies',
  'carouselSearchTitleGenreSeries',
  'carouselSearchTitleGenreBoth',
  'carouselSearchNoResults',
  // Semantic search
  'carouselSemanticTitleMovies',
  'carouselSemanticTitleSeries',
  'carouselSemanticTitleBoth',
  'carouselSemanticEmpty',
  'carouselSemanticDesc',
  'carouselSemanticError',
  // Similar content
  'carouselSimilarTitle',
  'carouselSimilarLookupNotFound',
  'carouselSimilarNoEmbedding',
  'carouselSimilarEmptyMovie',
  'carouselSimilarEmptySeries',
  'carouselSimilarDescMovie',
  'carouselSimilarDescSeries',
  'carouselSimilarDescMovieUnwatched',
  'carouselSimilarDescSeriesUnwatched',
  'carouselSimilarError',
])

export type ContentCarouselI18nKey = z.infer<typeof ContentCarouselI18nKeySchema>

const I18nParamsSchema = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .optional()
  .describe('Interpolation values for i18n strings')

// Content carousel schema matching Tool UI ItemCarousel format
export const ContentCarouselSchema = z.object({
  id: z.string().describe('Unique carousel ID'),
  title: z.string().optional().describe('Carousel heading (fallback when titleKey omitted)'),
  description: z.string().optional().describe('Optional description (fallback when descriptionKey omitted)'),
  titleKey: ContentCarouselI18nKeySchema.optional().describe('i18n key under assistantToolUi for title'),
  descriptionKey: ContentCarouselI18nKeySchema.optional().describe('i18n key under assistantToolUi for description'),
  titleParams: I18nParamsSchema,
  descriptionParams: I18nParamsSchema,
  items: z.array(ContentItemSchema).describe('Content items to display'),
})

export type ContentCarousel = z.infer<typeof ContentCarouselSchema>

export type CreateCarouselResultOptions = {
  title?: string
  description?: string
  titleKey?: ContentCarouselI18nKey
  descriptionKey?: ContentCarouselI18nKey
  titleParams?: Record<string, string | number>
  descriptionParams?: Record<string, string | number>
}

// Helper to create a carousel result
export function createCarouselResult(
  id: string,
  items: z.infer<typeof ContentItemSchema>[],
  options?: CreateCarouselResultOptions
): z.infer<typeof ContentCarouselSchema> {
  const o = options ?? {}
  return {
    id,
    title: o.title,
    description: o.description,
    titleKey: o.titleKey,
    descriptionKey: o.descriptionKey,
    titleParams: o.titleParams,
    descriptionParams: o.descriptionParams,
    items,
  }
}
