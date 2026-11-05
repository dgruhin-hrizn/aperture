





import type { ContentCarouselI18nKey } from '../../schemas/contentCarousel.js';

export function rankingTitleKey(
  rankBy:
    | 'most_episodes'
    | 'most_seasons'
    | 'highest_rated'
    | 'lowest_rated'
    | 'newest'
    | 'oldest'
    | 'longest_runtime',
  mediaType: 'movies' | 'series'
): ContentCarouselI18nKey {
  if (mediaType === 'series') {
    switch (rankBy) {
      case 'most_episodes':
        return 'carouselRankingSeriesMostEpisodes'
      case 'most_seasons':
        return 'carouselRankingSeriesMostSeasons'
      case 'highest_rated':
        return 'carouselRankingHighestRatedSeries'
      case 'lowest_rated':
        return 'carouselRankingLowestRatedSeries'
      case 'newest':
        return 'carouselRankingNewestSeries'
      case 'oldest':
        return 'carouselRankingOldestSeries'
      default:
        return 'carouselRankingSeriesMostEpisodes'
    }
  }
  switch (rankBy) {
    case 'longest_runtime':
      return 'carouselRankingLongestMovies'
    case 'highest_rated':
      return 'carouselRankingHighestRatedMovies'
    case 'lowest_rated':
      return 'carouselRankingLowestRatedMovies'
    case 'newest':
      return 'carouselRankingNewestMovies'
    case 'oldest':
      return 'carouselRankingOldestMovies'
    default:
      return 'carouselRankingLongestMovies'
  }
}