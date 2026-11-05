






import type { ContentCarouselI18nKey } from '../../schemas/contentCarousel.js';
import type { ContentItem } from '../../schemas/index.js';
import type { MovieResult, SeriesResult } from '../../types.js';
export function searchContentTitleKey(
  searchQuery: string | undefined,
  genre: string | undefined,
  type: 'movies' | 'series' | 'both'
): { titleKey: ContentCarouselI18nKey; titleParams?: Record<string, string | number> } {
  if (searchQuery) {
    return { titleKey: 'carouselSearchTitleQuery', titleParams: { query: searchQuery } }
  }
  if (genre) {
    if (type === 'movies') return { titleKey: 'carouselSearchTitleGenreMovies', titleParams: { genre } }
    if (type === 'series') return { titleKey: 'carouselSearchTitleGenreSeries', titleParams: { genre } }
    return { titleKey: 'carouselSearchTitleGenreBoth', titleParams: { genre } }
  }
  return { titleKey: 'carouselSearchTitleDefault' }
}
export function semanticSearchTitleKey(type: 'movies' | 'series' | 'both'): ContentCarouselI18nKey {
  if (type === 'movies') return 'carouselSemanticTitleMovies'
  if (type === 'series') return 'carouselSemanticTitleSeries'
  return 'carouselSemanticTitleBoth'
}
export function similarSuccessDescriptionKey(
  foundType: 'movie' | 'series',
  excludeWatched: boolean
): ContentCarouselI18nKey {
  if (foundType === 'movie') {
    return excludeWatched ? 'carouselSimilarDescMovieUnwatched' : 'carouselSimilarDescMovie'
  }
  return excludeWatched ? 'carouselSimilarDescSeriesUnwatched' : 'carouselSimilarDescSeries'
}
export function formatContentItem(
  item: MovieResult | SeriesResult,
  type: 'movie' | 'series',
  playLink: string | null,
  rank?: number
): ContentItem {
  const genres = item.genres?.slice(0, 2).join(', ') || ''
  const subtitle = [item.year, genres].filter(Boolean).join(' · ')

  return {
    id: item.id,
    type,
    name: item.title,
    subtitle,
    image: item.poster_url,
    rating: item.community_rating,
    rank,
    actions: [
      {
        id: 'details',
        label: 'Details',
        href: `/${type === 'movie' ? 'movies' : 'series'}/${item.id}`,
        variant: 'secondary',
      },
      ...(playLink
        ? [{ id: 'play', label: 'Play', href: playLink, variant: 'primary' as const }]
        : []),
    ],
  }
}