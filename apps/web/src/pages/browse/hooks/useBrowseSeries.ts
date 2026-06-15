import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { PAGE_SIZE, defaultSeriesFilters } from '../constants'
import type { ActiveFilterChip, ContentRating, CountryOption, FilterRanges, Series } from '../types'
import type { SeriesFilters, SortField, SortOrder } from '../components'
import { buildSeriesActiveFilterChips } from '../utils/activeFilterChips'

interface UseBrowseSeriesOptions {
  tabIndex: number
  persistSortPreferences: (sortBy: SortField, sortOrder: SortOrder) => void
}

interface SeriesResponse {
  series: Series[]
  total: number
}

interface BrowseSeriesResult {
  series: Series[]
  seriesGenres: string[]
  networks: string[]
  seriesContentRatings: ContentRating[]
  seriesCountries: CountryOption[]
  seriesRanges: FilterRanges & { seasons?: { min: number; max: number } }
  seriesLoading: boolean
  seriesLoadingMore: boolean
  seriesError: string | null
  seriesSearch: Dispatch<SetStateAction<string>>
  seriesGenre: Dispatch<SetStateAction<string>>
  network: Dispatch<SetStateAction<string>>
  seriesFilters: SeriesFilters
  setSeriesFilters: Dispatch<SetStateAction<SeriesFilters>>
  seriesSortBy: SortField
  setSeriesSortBy: Dispatch<SetStateAction<SortField>>
  seriesSortOrder: SortOrder
  setSeriesSortOrder: Dispatch<SetStateAction<SortOrder>>
  seriesTotal: number
  seriesHasMore: boolean
  seriesLoadMoreRef: RefObject<HTMLDivElement | null>
  activeFilters: ActiveFilterChip[]
  handleSeriesSortChange: (sortBy: SortField, sortOrder: SortOrder) => void
}

export function useBrowseSeries({ tabIndex, persistSortPreferences }: UseBrowseSeriesOptions): BrowseSeriesResult {
  const { t } = useTranslation()
  const [series, setSeries] = useState<Series[]>([])
  const [seriesGenres, setSeriesGenres] = useState<string[]>([])
  const [networks, setNetworks] = useState<string[]>([])
  const [seriesContentRatings, setSeriesContentRatings] = useState<ContentRating[]>([])
  const [seriesCountries, setSeriesCountries] = useState<CountryOption[]>([])
  const [seriesRanges, setSeriesRanges] = useState<FilterRanges & { seasons?: { min: number; max: number } }>({
    year: { min: 1950, max: new Date().getFullYear() },
    seasons: { min: 1, max: 30 },
    rating: { min: 0, max: 10 },
  })
  const [seriesLoading, setSeriesLoading] = useState(true)
  const [seriesLoadingMore, setSeriesLoadingMore] = useState(false)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  const [seriesSearch, setSeriesSearch] = useState('')
  const [seriesGenre, setSeriesGenre] = useState('')
  const [network, setNetwork] = useState('')
  const [seriesFilters, setSeriesFilters] = useState<SeriesFilters>(defaultSeriesFilters)
  const [seriesSortBy, setSeriesSortBy] = useState<SortField>('title')
  const [seriesSortOrder, setSeriesSortOrder] = useState<SortOrder>('asc')
  const [seriesPage, setSeriesPage] = useState(1)
  const [seriesHasMore, setSeriesHasMore] = useState(true)
  const [seriesTotal, setSeriesTotal] = useState(0)
  const seriesObserverRef = useRef<IntersectionObserver | null>(null)
  const seriesLoadMoreRef = useRef<HTMLDivElement | null>(null)

  const resetSeries = useCallback(() => {
    setSeries([])
    setSeriesPage(1)
    setSeriesHasMore(true)
  }, [])

  const fetchSeries = useCallback(
    async (page: number, append = false) => {
      if (append) {
        setSeriesLoadingMore(true)
      } else {
        setSeriesLoading(true)
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortBy: seriesSortBy,
          sortOrder: seriesSortOrder,
        })
        if (seriesSearch) params.set('search', seriesSearch)
        if (seriesGenre) params.set('genre', seriesGenre)
        if (network) params.set('network', network)

        if (seriesFilters.yearRange[0] > seriesRanges.year.min) params.set('minYear', String(seriesFilters.yearRange[0]))
        if (seriesFilters.yearRange[1] < seriesRanges.year.max) params.set('maxYear', String(seriesFilters.yearRange[1]))
        if (seriesFilters.seasonsRange[0] > (seriesRanges.seasons?.min || 1)) params.set('minSeasons', String(seriesFilters.seasonsRange[0]))
        if (seriesFilters.seasonsRange[1] < (seriesRanges.seasons?.max || 30)) params.set('maxSeasons', String(seriesFilters.seasonsRange[1]))
        if (seriesFilters.communityRating[0] > 0) params.set('minCommunityRating', String(seriesFilters.communityRating[0]))
        if (seriesFilters.rtScore[0] > 0) params.set('minRtScore', String(seriesFilters.rtScore[0]))
        if (seriesFilters.metacritic[0] > 0) params.set('minMetacritic', String(seriesFilters.metacritic[0]))
        seriesFilters.contentRatings.forEach((rating) => params.append('contentRating', rating))
        seriesFilters.status.forEach((status) => params.append('status', status))
        seriesFilters.countries.forEach((country) => params.append('country', country))
        if (seriesFilters.watchStatus !== 'any') params.set('watchStatus', seriesFilters.watchStatus)
        if (seriesFilters.minWatchers !== null && seriesFilters.minWatchers > 0) params.set('minWatchers', String(seriesFilters.minWatchers))
        if (seriesFilters.maxWatchers !== null && seriesFilters.maxWatchers >= 0) params.set('maxWatchers', String(seriesFilters.maxWatchers))

        const response = await fetch(`/api/series?${params}`, { credentials: 'include' })
        if (!response.ok) {
          setSeriesError(t('browse.errors.loadSeries'))
          return
        }

        const data = (await response.json()) as SeriesResponse
        if (append) {
          setSeries((prev) => [...prev, ...data.series])
        } else {
          setSeries(data.series)
        }
        setSeriesTotal(data.total)
        setSeriesHasMore(data.series.length === PAGE_SIZE && (append ? series.length + data.series.length : data.series.length) < data.total)
        setSeriesError(null)
      } catch {
        setSeriesError(t('browse.errors.connect'))
      } finally {
        setSeriesLoading(false)
        setSeriesLoadingMore(false)
      }
    },
    [network, series.length, seriesFilters, seriesGenre, seriesRanges, seriesSearch, seriesSortBy, seriesSortOrder, t]
  )

  const fetchSeriesMetadata = useCallback(async () => {
    try {
      const [genresRes, networksRes, contentRatingsRes, countriesRes, rangesRes] = await Promise.all([
        fetch('/api/series/genres', { credentials: 'include' }),
        fetch('/api/series/networks', { credentials: 'include' }),
        fetch('/api/series/content-ratings', { credentials: 'include' }),
        fetch('/api/series/countries', { credentials: 'include' }),
        fetch('/api/series/filter-ranges', { credentials: 'include' }),
      ])

      if (genresRes.ok) {
        const data = (await genresRes.json()) as { genres?: string[] }
        setSeriesGenres(data.genres || [])
      }
      if (networksRes.ok) {
        const data = (await networksRes.json()) as { networks?: string[] }
        setNetworks(data.networks || [])
      }
      if (contentRatingsRes.ok) {
        const data = (await contentRatingsRes.json()) as { contentRatings?: ContentRating[] }
        setSeriesContentRatings(data.contentRatings || [])
      }
      if (countriesRes.ok) {
        const data = (await countriesRes.json()) as { countries?: CountryOption[] }
        setSeriesCountries(data.countries || [])
      }
      if (rangesRes.ok) {
        const data = (await rangesRes.json()) as FilterRanges & { seasons?: { min: number; max: number } }
        setSeriesRanges(data)
        setSeriesFilters((prev) => ({
          ...prev,
          yearRange: [data.year.min, data.year.max],
          seasonsRange: [data.seasons?.min || 1, data.seasons?.max || 30],
        }))
      }
    } catch {
      // Ignore metadata errors.
    }
  }, [])

  useEffect(() => {
    void fetchSeriesMetadata()
  }, [fetchSeriesMetadata])

  useEffect(() => {
    resetSeries()
    const debounce = setTimeout(() => {
      void fetchSeries(1, false)
    }, seriesSearch ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchSeries, network, resetSeries, seriesFilters, seriesGenre, seriesSearch, seriesSortBy, seriesSortOrder])

  useEffect(() => {
    if (seriesObserverRef.current) {
      seriesObserverRef.current.disconnect()
    }

    if (!seriesHasMore || seriesLoading || seriesLoadingMore || tabIndex !== 1) return

    seriesObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && seriesHasMore && !seriesLoadingMore) {
          const nextPage = seriesPage + 1
          setSeriesPage(nextPage)
          void fetchSeries(nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (seriesLoadMoreRef.current) {
      seriesObserverRef.current.observe(seriesLoadMoreRef.current)
    }

    return () => {
      if (seriesObserverRef.current) {
        seriesObserverRef.current.disconnect()
      }
    }
  }, [fetchSeries, seriesHasMore, seriesLoading, seriesLoadingMore, seriesPage, tabIndex])

  const activeFilters = useMemo(
    () =>
      buildSeriesActiveFilterChips({
        seriesGenre,
        network,
        seriesFilters,
        seriesRanges,
        t,
        setSeriesGenre,
        setNetwork,
        setSeriesFilters,
      }),
    [network, seriesFilters, seriesGenre, seriesRanges, t]
  )

  const handleSeriesSortChange = useCallback(
    (sortBy: SortField, sortOrder: SortOrder) => {
      setSeriesSortBy(sortBy)
      setSeriesSortOrder(sortOrder)
      persistSortPreferences(sortBy, sortOrder)
    },
    [persistSortPreferences]
  )

  return {
    series,
    seriesGenres,
    networks,
    seriesContentRatings,
    seriesCountries,
    seriesRanges,
    seriesLoading,
    seriesLoadingMore,
    seriesError,
    seriesSearch,
    setSeriesSearch,
    seriesGenre,
    setSeriesGenre,
    network,
    setNetwork,
    seriesFilters,
    setSeriesFilters,
    seriesSortBy,
    setSeriesSortBy,
    seriesSortOrder,
    setSeriesSortOrder,
    seriesTotal,
    seriesHasMore,
    seriesLoadMoreRef,
    activeFilters,
    handleSeriesSortChange,
  }
}
