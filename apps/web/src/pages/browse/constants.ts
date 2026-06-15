import type { MovieFilters, SeriesFilters } from './components'

export const PAGE_SIZE = 24

export function browseTabFromSearchParam(tab: string | null): number {
  if (tab === 'series') return 1
  if (tab === 'people') return 2
  return 0
}

export const defaultMovieFilters: MovieFilters = {
  yearRange: [1900, new Date().getFullYear()],
  runtimeRange: [0, 300],
  communityRating: [0, 10],
  rtScore: [0, 100],
  metacritic: [0, 100],
  contentRatings: [],
  resolutions: [],
  countries: [],
  watchStatus: 'any',
  minWatchers: null,
  maxWatchers: null,
}

export const defaultSeriesFilters: SeriesFilters = {
  yearRange: [1950, new Date().getFullYear()],
  seasonsRange: [1, 30],
  communityRating: [0, 10],
  rtScore: [0, 100],
  metacritic: [0, 100],
  contentRatings: [],
  status: [],
  countries: [],
  watchStatus: 'any',
  minWatchers: null,
  maxWatchers: null,
}
