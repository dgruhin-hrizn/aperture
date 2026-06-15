import type { TFunction } from 'i18next'
import type { Dispatch, SetStateAction } from 'react'
import type { MovieFilters, SeriesFilters } from '../components'
import type { ActiveFilterChip, FilterRanges } from '../types'

interface MovieChipOptions {
  t: TFunction
  movieGenre: string
  setMovieGenre: (value: string) => void
  collection: string
  setCollection: (value: string) => void
  movieFilters: MovieFilters
  setMovieFilters: Dispatch<SetStateAction<MovieFilters>>
  movieRanges: FilterRanges
}

interface SeriesChipOptions {
  t: TFunction
  seriesGenre: string
  setSeriesGenre: (value: string) => void
  network: string
  setNetwork: (value: string) => void
  seriesFilters: SeriesFilters
  setSeriesFilters: Dispatch<SetStateAction<SeriesFilters>>
  seriesRanges: FilterRanges
}

export function buildMovieActiveFilterChips({
  t,
  movieGenre,
  setMovieGenre,
  collection,
  setCollection,
  movieFilters,
  setMovieFilters,
  movieRanges,
}: MovieChipOptions): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []

  if (movieGenre) chips.push({ label: movieGenre, onDelete: () => setMovieGenre('') })
  if (collection) chips.push({ label: collection, onDelete: () => setCollection('') })
  if (movieFilters.yearRange[0] > movieRanges.year.min || movieFilters.yearRange[1] < movieRanges.year.max) {
    chips.push({
      label: `${movieFilters.yearRange[0]}-${movieFilters.yearRange[1]}`,
      onDelete: () => setMovieFilters((filters) => ({ ...filters, yearRange: [movieRanges.year.min, movieRanges.year.max] })),
    })
  }
  if (movieFilters.communityRating[0] > 0) {
    chips.push({
      label: t('browse.chips.ratingMin', { min: movieFilters.communityRating[0] }),
      onDelete: () => setMovieFilters((filters) => ({ ...filters, communityRating: [0, 10] })),
    })
  }
  if (movieFilters.rtScore[0] > 0) {
    chips.push({
      label: t('browse.chips.rtMin', { min: movieFilters.rtScore[0] }),
      onDelete: () => setMovieFilters((filters) => ({ ...filters, rtScore: [0, 100] })),
    })
  }
  if (movieFilters.metacritic[0] > 0) {
    chips.push({
      label: t('browse.chips.mcMin', { min: movieFilters.metacritic[0] }),
      onDelete: () => setMovieFilters((filters) => ({ ...filters, metacritic: [0, 100] })),
    })
  }
  if (movieFilters.runtimeRange[0] > (movieRanges.runtime?.min ?? 0) || movieFilters.runtimeRange[1] < (movieRanges.runtime?.max ?? 300)) {
    chips.push({
      label: t('browse.chips.runtimeRange', { min: movieFilters.runtimeRange[0], max: movieFilters.runtimeRange[1] }),
      onDelete: () => setMovieFilters((filters) => ({ ...filters, runtimeRange: [movieRanges.runtime?.min ?? 0, movieRanges.runtime?.max ?? 300] })),
    })
  }
  movieFilters.contentRatings.forEach((rating) => chips.push({
    label: rating,
    onDelete: () => setMovieFilters((filters) => ({ ...filters, contentRatings: filters.contentRatings.filter((item) => item !== rating) })),
  }))
  movieFilters.resolutions.forEach((resolution) => chips.push({
    label: resolution,
    onDelete: () => setMovieFilters((filters) => ({ ...filters, resolutions: filters.resolutions.filter((item) => item !== resolution) })),
  }))
  movieFilters.countries.forEach((country) => chips.push({
    label: country,
    onDelete: () => setMovieFilters((filters) => ({ ...filters, countries: filters.countries.filter((item) => item !== country) })),
  }))
  if (movieFilters.watchStatus === 'watched') {
    chips.push({ label: t('browse.watchStatus.watchedYou'), onDelete: () => setMovieFilters((filters) => ({ ...filters, watchStatus: 'any' })) })
  } else if (movieFilters.watchStatus === 'unwatched') {
    chips.push({ label: t('browse.watchStatus.unwatchedYou'), onDelete: () => setMovieFilters((filters) => ({ ...filters, watchStatus: 'any' })) })
  }
  if (movieFilters.minWatchers !== null && movieFilters.minWatchers > 0) {
    chips.push({ label: t('browse.chips.watchersMin', { min: movieFilters.minWatchers }), onDelete: () => setMovieFilters((filters) => ({ ...filters, minWatchers: null })) })
  }
  if (movieFilters.maxWatchers !== null) {
    chips.push({ label: t('browse.chips.watchersMax', { max: movieFilters.maxWatchers }), onDelete: () => setMovieFilters((filters) => ({ ...filters, maxWatchers: null })) })
  }

  return chips
}

export function buildSeriesActiveFilterChips({
  t,
  seriesGenre,
  setSeriesGenre,
  network,
  setNetwork,
  seriesFilters,
  setSeriesFilters,
  seriesRanges,
}: SeriesChipOptions): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []

  if (seriesGenre) chips.push({ label: seriesGenre, onDelete: () => setSeriesGenre('') })
  if (network) chips.push({ label: network, onDelete: () => setNetwork('') })
  if (seriesFilters.yearRange[0] > seriesRanges.year.min || seriesFilters.yearRange[1] < seriesRanges.year.max) {
    chips.push({
      label: `${seriesFilters.yearRange[0]}-${seriesFilters.yearRange[1]}`,
      onDelete: () => setSeriesFilters((filters) => ({ ...filters, yearRange: [seriesRanges.year.min, seriesRanges.year.max] })),
    })
  }
  if (seriesFilters.communityRating[0] > 0) {
    chips.push({
      label: t('browse.chips.ratingMin', { min: seriesFilters.communityRating[0] }),
      onDelete: () => setSeriesFilters((filters) => ({ ...filters, communityRating: [0, 10] })),
    })
  }
  if (seriesFilters.rtScore[0] > 0) {
    chips.push({
      label: t('browse.chips.rtMin', { min: seriesFilters.rtScore[0] }),
      onDelete: () => setSeriesFilters((filters) => ({ ...filters, rtScore: [0, 100] })),
    })
  }
  if (seriesFilters.metacritic[0] > 0) {
    chips.push({
      label: t('browse.chips.mcMin', { min: seriesFilters.metacritic[0] }),
      onDelete: () => setSeriesFilters((filters) => ({ ...filters, metacritic: [0, 100] })),
    })
  }
  if (seriesFilters.seasonsRange[0] > (seriesRanges.seasons?.min ?? 1) || seriesFilters.seasonsRange[1] < (seriesRanges.seasons?.max ?? 30)) {
    chips.push({
      label: t('browse.chips.seasonsRange', { min: seriesFilters.seasonsRange[0], max: seriesFilters.seasonsRange[1] }),
      onDelete: () => setSeriesFilters((filters) => ({ ...filters, seasonsRange: [seriesRanges.seasons?.min ?? 1, seriesRanges.seasons?.max ?? 30] })),
    })
  }
  seriesFilters.contentRatings.forEach((rating) => chips.push({
    label: rating,
    onDelete: () => setSeriesFilters((filters) => ({ ...filters, contentRatings: filters.contentRatings.filter((item) => item !== rating) })),
  }))
  seriesFilters.status.forEach((status) => chips.push({
    label: status === 'Continuing' ? t('browse.seriesStatus.airing') : status,
    onDelete: () => setSeriesFilters((filters) => ({ ...filters, status: filters.status.filter((item) => item !== status) })),
  }))
  seriesFilters.countries.forEach((country) => chips.push({
    label: country,
    onDelete: () => setSeriesFilters((filters) => ({ ...filters, countries: filters.countries.filter((item) => item !== country) })),
  }))
  if (seriesFilters.watchStatus === 'watched') {
    chips.push({ label: t('browse.watchStatus.watchedYou'), onDelete: () => setSeriesFilters((filters) => ({ ...filters, watchStatus: 'any' })) })
  } else if (seriesFilters.watchStatus === 'unwatched') {
    chips.push({ label: t('browse.watchStatus.unwatchedYou'), onDelete: () => setSeriesFilters((filters) => ({ ...filters, watchStatus: 'any' })) })
  }
  if (seriesFilters.minWatchers !== null && seriesFilters.minWatchers > 0) {
    chips.push({ label: t('browse.chips.watchersMin', { min: seriesFilters.minWatchers }), onDelete: () => setSeriesFilters((filters) => ({ ...filters, minWatchers: null })) })
  }
  if (seriesFilters.maxWatchers !== null) {
    chips.push({ label: t('browse.chips.watchersMax', { max: seriesFilters.maxWatchers }), onDelete: () => setSeriesFilters((filters) => ({ ...filters, maxWatchers: null })) })
  }

  return chips
}

export const getMovieActiveFilterChips = buildMovieActiveFilterChips
export const getSeriesActiveFilterChips = buildSeriesActiveFilterChips
