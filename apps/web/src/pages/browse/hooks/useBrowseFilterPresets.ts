import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { FilterPreset, MovieFilters, SeriesFilters, SortField, SortOrder } from '../components'

export type BrowsePreferenceType = 'movies' | 'series'

interface UseBrowseFilterPresetsOptions {
  setMovieSortBy: Dispatch<SetStateAction<SortField>>
  setMovieSortOrder: Dispatch<SetStateAction<SortOrder>>
  setSeriesSortBy: Dispatch<SetStateAction<SortField>>
  setSeriesSortOrder: Dispatch<SetStateAction<SortOrder>>
}

interface PreferencesResponse {
  browseSort?: {
    movies?: { sortBy?: SortField; sortOrder?: SortOrder }
    series?: { sortBy?: SortField; sortOrder?: SortOrder }
  }
  browseFilterPresets?: FilterPreset[]
}

interface UseBrowseFilterPresetsResult {
  filterPresets: FilterPreset[]
  persistSortPreferences: (type: BrowsePreferenceType, sortBy: SortField, sortOrder: SortOrder) => Promise<void>
  handleSaveMoviePreset: (name: string, movieFilters: MovieFilters, movieGenre: string, collection: string) => Promise<void>
  handleSaveSeriesPreset: (name: string, seriesFilters: SeriesFilters, seriesGenre: string, network: string) => Promise<void>
  handleLoadMoviePreset: (
    preset: FilterPreset,
    setMovieFilters: Dispatch<SetStateAction<MovieFilters>>,
    setMovieGenre: Dispatch<SetStateAction<string>>,
    setCollection: Dispatch<SetStateAction<string>>
  ) => void
  handleLoadSeriesPreset: (
    preset: FilterPreset,
    setSeriesFilters: Dispatch<SetStateAction<SeriesFilters>>,
    setSeriesGenre: Dispatch<SetStateAction<string>>,
    setNetwork: Dispatch<SetStateAction<string>>
  ) => void
  handleDeletePreset: (id: string) => Promise<void>
  handleRenamePreset: (id: string, newName: string) => Promise<void>
}

export function useBrowseFilterPresets({
  setMovieSortBy,
  setMovieSortOrder,
  setSeriesSortBy,
  setSeriesSortOrder,
}: UseBrowseFilterPresetsOptions): UseBrowseFilterPresetsResult {
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([])
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  const persistSortPreferences = useCallback(
    async (type: BrowsePreferenceType, sortBy: SortField, sortOrder: SortOrder) => {
      if (!preferencesLoaded) return

      try {
        await fetch('/api/auth/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ browseSort: { [type]: { sortBy, sortOrder } } }),
        })
      } catch (err) {
        console.error('Failed to persist sort preferences:', err)
      }
    },
    [preferencesLoaded]
  )

  const loadPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me/preferences', { credentials: 'include' })
      if (!res.ok) return

      const prefs = (await res.json()) as PreferencesResponse
      if (prefs.browseSort?.movies) {
        setMovieSortBy(prefs.browseSort.movies.sortBy || 'title')
        setMovieSortOrder(prefs.browseSort.movies.sortOrder || 'asc')
      }
      if (prefs.browseSort?.series) {
        setSeriesSortBy(prefs.browseSort.series.sortBy || 'title')
        setSeriesSortOrder(prefs.browseSort.series.sortOrder || 'asc')
      }
      if (prefs.browseFilterPresets) {
        setFilterPresets(prefs.browseFilterPresets)
      }
    } catch (err) {
      console.error('Failed to load browse preferences:', err)
    } finally {
      setPreferencesLoaded(true)
    }
  }, [setMovieSortBy, setMovieSortOrder, setSeriesSortBy, setSeriesSortOrder])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  const handleSaveMoviePreset = useCallback(
    async (name: string, movieFilters: MovieFilters, movieGenre: string, collection: string) => {
      try {
        const res = await fetch('/api/auth/me/filter-presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name,
            type: 'movies',
            filters: {
              ...movieFilters,
              genre: movieGenre || undefined,
              collection: collection || undefined,
            },
          }),
        })
        if (res.ok) {
          const preset = (await res.json()) as FilterPreset
          setFilterPresets((prev) => [...prev, preset])
        }
      } catch (err) {
        console.error('Failed to save filter preset:', err)
      }
    },
    []
  )

  const handleSaveSeriesPreset = useCallback(
    async (name: string, seriesFilters: SeriesFilters, seriesGenre: string, network: string) => {
      try {
        const res = await fetch('/api/auth/me/filter-presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name,
            type: 'series',
            filters: {
              ...seriesFilters,
              genre: seriesGenre || undefined,
              network: network || undefined,
            },
          }),
        })
        if (res.ok) {
          const preset = (await res.json()) as FilterPreset
          setFilterPresets((prev) => [...prev, preset])
        }
      } catch (err) {
        console.error('Failed to save filter preset:', err)
      }
    },
    []
  )

  const handleDeletePreset = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/auth/me/filter-presets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setFilterPresets((prev) => prev.filter((preset) => preset.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete filter preset:', err)
    }
  }, [])

  const handleRenamePreset = useCallback(async (id: string, newName: string) => {
    try {
      const res = await fetch(`/api/auth/me/filter-presets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName }),
      })
      if (res.ok) {
        setFilterPresets((prev) => prev.map((preset) => (preset.id === id ? { ...preset, name: newName } : preset)))
      }
    } catch (err) {
      console.error('Failed to rename filter preset:', err)
    }
  }, [])

  const handleLoadMoviePreset = useCallback(
    (
      preset: FilterPreset,
      setMovieFilters: Dispatch<SetStateAction<MovieFilters>>,
      setMovieGenre: Dispatch<SetStateAction<string>>,
      setCollection: Dispatch<SetStateAction<string>>
    ) => {
      if (preset.filters.yearRange) setMovieFilters((filters) => ({ ...filters, yearRange: preset.filters.yearRange! }))
      if (preset.filters.runtimeRange) setMovieFilters((filters) => ({ ...filters, runtimeRange: preset.filters.runtimeRange! }))
      if (preset.filters.communityRating) setMovieFilters((filters) => ({ ...filters, communityRating: preset.filters.communityRating! }))
      if (preset.filters.rtScore) setMovieFilters((filters) => ({ ...filters, rtScore: preset.filters.rtScore! }))
      if (preset.filters.metacritic) setMovieFilters((filters) => ({ ...filters, metacritic: preset.filters.metacritic! }))
      if (preset.filters.contentRatings) setMovieFilters((filters) => ({ ...filters, contentRatings: preset.filters.contentRatings! }))
      if (preset.filters.resolutions) setMovieFilters((filters) => ({ ...filters, resolutions: preset.filters.resolutions! }))
      if (preset.filters.countries) setMovieFilters((filters) => ({ ...filters, countries: preset.filters.countries! }))
      if (preset.filters.watchStatus) setMovieFilters((filters) => ({ ...filters, watchStatus: preset.filters.watchStatus! }))
      if (preset.filters.minWatchers !== undefined) setMovieFilters((filters) => ({ ...filters, minWatchers: preset.filters.minWatchers ?? null }))
      if (preset.filters.maxWatchers !== undefined) setMovieFilters((filters) => ({ ...filters, maxWatchers: preset.filters.maxWatchers ?? null }))
      if (preset.filters.genre) setMovieGenre(preset.filters.genre)
      if (preset.filters.collection) setCollection(preset.filters.collection)
    },
    []
  )

  const handleLoadSeriesPreset = useCallback(
    (
      preset: FilterPreset,
      setSeriesFilters: Dispatch<SetStateAction<SeriesFilters>>,
      setSeriesGenre: Dispatch<SetStateAction<string>>,
      setNetwork: Dispatch<SetStateAction<string>>
    ) => {
      if (preset.filters.yearRange) setSeriesFilters((filters) => ({ ...filters, yearRange: preset.filters.yearRange! }))
      if (preset.filters.seasonsRange) setSeriesFilters((filters) => ({ ...filters, seasonsRange: preset.filters.seasonsRange! }))
      if (preset.filters.communityRating) setSeriesFilters((filters) => ({ ...filters, communityRating: preset.filters.communityRating! }))
      if (preset.filters.rtScore) setSeriesFilters((filters) => ({ ...filters, rtScore: preset.filters.rtScore! }))
      if (preset.filters.metacritic) setSeriesFilters((filters) => ({ ...filters, metacritic: preset.filters.metacritic! }))
      if (preset.filters.contentRatings) setSeriesFilters((filters) => ({ ...filters, contentRatings: preset.filters.contentRatings! }))
      if (preset.filters.status) setSeriesFilters((filters) => ({ ...filters, status: preset.filters.status! }))
      if (preset.filters.countries) setSeriesFilters((filters) => ({ ...filters, countries: preset.filters.countries! }))
      if (preset.filters.watchStatus) setSeriesFilters((filters) => ({ ...filters, watchStatus: preset.filters.watchStatus! }))
      if (preset.filters.minWatchers !== undefined) setSeriesFilters((filters) => ({ ...filters, minWatchers: preset.filters.minWatchers ?? null }))
      if (preset.filters.maxWatchers !== undefined) setSeriesFilters((filters) => ({ ...filters, maxWatchers: preset.filters.maxWatchers ?? null }))
      if (preset.filters.genre) setSeriesGenre(preset.filters.genre)
      if (preset.filters.network) setNetwork(preset.filters.network)
    },
    []
  )

  return {
    filterPresets,
    persistSortPreferences,
    handleSaveMoviePreset,
    handleSaveSeriesPreset,
    handleLoadMoviePreset,
    handleLoadSeriesPreset,
    handleDeletePreset,
    handleRenamePreset,
  }
}
