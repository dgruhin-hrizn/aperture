import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Skeleton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'
import { useWatching } from '../hooks/useWatching'
import { useViewMode } from '../hooks/useViewMode'
import {
  BrowseMovieListItem,
  BrowseSeriesListItem,
  FilterPopper,
  SortPopper,
  FilterPresetManager,
  type MovieFilters,
  type SeriesFilters,
  type SortField,
  type SortOrder,
  type FilterPreset,
} from './browse/components'

interface Movie {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
}

interface Series {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
  network: string | null
  status: string | null
  total_seasons: number | null
}

interface Collection {
  name: string
  count: number
}

interface ContentRating {
  rating: string
  count: number
}

interface Resolution {
  resolution: string
  count: number
}

interface FilterRanges {
  year: { min: number; max: number }
  runtime?: { min: number; max: number }
  seasons?: { min: number; max: number }
  rating: { min: number; max: number }
}

const defaultMovieFilters: MovieFilters = {
  yearRange: [1900, new Date().getFullYear()],
  runtimeRange: [0, 300],
  communityRating: [0, 10],
  rtScore: [0, 100],
  metacritic: [0, 100],
  contentRatings: [],
  resolutions: [],
}

const defaultSeriesFilters: SeriesFilters = {
  yearRange: [1950, new Date().getFullYear()],
  seasonsRange: [1, 30],
  communityRating: [0, 10],
  rtScore: [0, 100],
  metacritic: [0, 100],
  contentRatings: [],
  status: [],
}

export function BrowsePage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  const { viewMode, setViewMode } = useViewMode('browse')

  const initialTab = searchParams.get('tab') === 'series' ? 1 : 0
  const [tabIndex, setTabIndex] = useState(initialTab)

  // Movies state
  const [movies, setMovies] = useState<Movie[]>([])
  const [movieGenres, setMovieGenres] = useState<string[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [movieContentRatings, setMovieContentRatings] = useState<ContentRating[]>([])
  const [movieResolutions, setMovieResolutions] = useState<Resolution[]>([])
  const [movieRanges, setMovieRanges] = useState<FilterRanges>({
    year: { min: 1900, max: new Date().getFullYear() },
    runtime: { min: 0, max: 300 },
    rating: { min: 0, max: 10 },
  })
  const [moviesLoading, setMoviesLoading] = useState(true)
  const [moviesLoadingMore, setMoviesLoadingMore] = useState(false)
  const [moviesError, setMoviesError] = useState<string | null>(null)
  const [movieSearch, setMovieSearch] = useState('')
  const [movieGenre, setMovieGenre] = useState('')
  const [collection, setCollection] = useState('')
  const [movieFilters, setMovieFilters] = useState<MovieFilters>(defaultMovieFilters)
  const [movieSortBy, setMovieSortBy] = useState<SortField>('title')
  const [movieSortOrder, setMovieSortOrder] = useState<SortOrder>('asc')
  const [moviePage, setMoviePage] = useState(1)
  const [movieHasMore, setMovieHasMore] = useState(true)
  const [movieTotal, setMovieTotal] = useState(0)

  // Series state
  const [series, setSeries] = useState<Series[]>([])
  const [seriesGenres, setSeriesGenres] = useState<string[]>([])
  const [networks, setNetworks] = useState<string[]>([])
  const [seriesContentRatings, setSeriesContentRatings] = useState<ContentRating[]>([])
  const [seriesRanges, setSeriesRanges] = useState<FilterRanges>({
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

  // Filter presets
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([])
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  const pageSize = 24
  const movieObserverRef = useRef<IntersectionObserver | null>(null)
  const seriesObserverRef = useRef<IntersectionObserver | null>(null)
  const movieLoadMoreRef = useRef<HTMLDivElement | null>(null)
  const seriesLoadMoreRef = useRef<HTMLDivElement | null>(null)

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue)
    setSearchParams({ tab: newValue === 1 ? 'series' : 'movies' })
  }

  const handleRateMovie = useCallback(
    async (movieId: string, rating: number | null) => {
      try {
        await setRating('movie', movieId, rating)
      } catch (err) {
        console.error('Failed to rate movie:', err)
      }
    },
    [setRating]
  )

  const handleRateSeries = useCallback(
    async (seriesId: string, rating: number | null) => {
      try {
        await setRating('series', seriesId, rating)
      } catch (err) {
        console.error('Failed to rate series:', err)
      }
    },
    [setRating]
  )

  // Reset functions
  const resetMovies = useCallback(() => {
    setMovies([])
    setMoviePage(1)
    setMovieHasMore(true)
  }, [])

  const resetSeries = useCallback(() => {
    setSeries([])
    setSeriesPage(1)
    setSeriesHasMore(true)
  }, [])

  // Load user preferences (sort defaults and filter presets)
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const res = await fetch('/api/auth/me/preferences', { credentials: 'include' })
        if (res.ok) {
          const prefs = await res.json()
          // Apply saved sort preferences
          if (prefs.browseSort?.movies) {
            setMovieSortBy(prefs.browseSort.movies.sortBy || 'title')
            setMovieSortOrder(prefs.browseSort.movies.sortOrder || 'asc')
          }
          if (prefs.browseSort?.series) {
            setSeriesSortBy(prefs.browseSort.series.sortBy || 'title')
            setSeriesSortOrder(prefs.browseSort.series.sortOrder || 'asc')
          }
          // Load filter presets
          if (prefs.browseFilterPresets) {
            setFilterPresets(prefs.browseFilterPresets)
          }
        }
      } catch (err) {
        console.error('Failed to load browse preferences:', err)
      } finally {
        setPreferencesLoaded(true)
      }
    }
    loadPreferences()
  }, [])

  // Persist sort preferences when they change
  const persistSortPreferences = useCallback(
    async (type: 'movies' | 'series', sortBy: SortField, sortOrder: SortOrder) => {
      if (!preferencesLoaded) return
      try {
        await fetch('/api/auth/me/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            browseSort: {
              [type]: { sortBy, sortOrder },
            },
          }),
        })
      } catch (err) {
        console.error('Failed to persist sort preferences:', err)
      }
    },
    [preferencesLoaded]
  )

  // Handle sort changes with persistence
  const handleMovieSortChange = useCallback(
    (sortBy: SortField, sortOrder: SortOrder) => {
      setMovieSortBy(sortBy)
      setMovieSortOrder(sortOrder)
      persistSortPreferences('movies', sortBy, sortOrder)
    },
    [persistSortPreferences]
  )

  const handleSeriesSortChange = useCallback(
    (sortBy: SortField, sortOrder: SortOrder) => {
      setSeriesSortBy(sortBy)
      setSeriesSortOrder(sortOrder)
      persistSortPreferences('series', sortBy, sortOrder)
    },
    [persistSortPreferences]
  )

  // Filter preset handlers
  const handleSaveMoviePreset = useCallback(
    async (name: string) => {
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
          const preset = await res.json()
          setFilterPresets((prev) => [...prev, preset])
        }
      } catch (err) {
        console.error('Failed to save filter preset:', err)
      }
    },
    [movieFilters, movieGenre, collection]
  )

  const handleSaveSeriesPreset = useCallback(
    async (name: string) => {
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
          const preset = await res.json()
          setFilterPresets((prev) => [...prev, preset])
        }
      } catch (err) {
        console.error('Failed to save filter preset:', err)
      }
    },
    [seriesFilters, seriesGenre, network]
  )

  const handleDeletePreset = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/auth/me/filter-presets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setFilterPresets((prev) => prev.filter((p) => p.id !== id))
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
        setFilterPresets((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)))
      }
    } catch (err) {
      console.error('Failed to rename filter preset:', err)
    }
  }, [])

  const handleLoadMoviePreset = useCallback((preset: FilterPreset) => {
    if (preset.filters.yearRange) setMovieFilters((f) => ({ ...f, yearRange: preset.filters.yearRange! }))
    if (preset.filters.runtimeRange) setMovieFilters((f) => ({ ...f, runtimeRange: preset.filters.runtimeRange! }))
    if (preset.filters.communityRating) setMovieFilters((f) => ({ ...f, communityRating: preset.filters.communityRating! }))
    if (preset.filters.rtScore) setMovieFilters((f) => ({ ...f, rtScore: preset.filters.rtScore! }))
    if (preset.filters.metacritic) setMovieFilters((f) => ({ ...f, metacritic: preset.filters.metacritic! }))
    if (preset.filters.contentRatings) setMovieFilters((f) => ({ ...f, contentRatings: preset.filters.contentRatings! }))
    if (preset.filters.resolutions) setMovieFilters((f) => ({ ...f, resolutions: preset.filters.resolutions! }))
    if (preset.filters.genre) setMovieGenre(preset.filters.genre)
    if (preset.filters.collection) setCollection(preset.filters.collection)
  }, [])

  const handleLoadSeriesPreset = useCallback((preset: FilterPreset) => {
    if (preset.filters.yearRange) setSeriesFilters((f) => ({ ...f, yearRange: preset.filters.yearRange! }))
    if (preset.filters.seasonsRange) setSeriesFilters((f) => ({ ...f, seasonsRange: preset.filters.seasonsRange! }))
    if (preset.filters.communityRating) setSeriesFilters((f) => ({ ...f, communityRating: preset.filters.communityRating! }))
    if (preset.filters.rtScore) setSeriesFilters((f) => ({ ...f, rtScore: preset.filters.rtScore! }))
    if (preset.filters.metacritic) setSeriesFilters((f) => ({ ...f, metacritic: preset.filters.metacritic! }))
    if (preset.filters.contentRatings) setSeriesFilters((f) => ({ ...f, contentRatings: preset.filters.contentRatings! }))
    if (preset.filters.status) setSeriesFilters((f) => ({ ...f, status: preset.filters.status! }))
    if (preset.filters.genre) setSeriesGenre(preset.filters.genre)
    if (preset.filters.network) setNetwork(preset.filters.network)
  }, [])

  // Fetch movie filter metadata
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [genresRes, collectionsRes, contentRatingsRes, resolutionsRes, rangesRes] =
          await Promise.all([
            fetch('/api/movies/genres', { credentials: 'include' }),
            fetch('/api/movies/collections', { credentials: 'include' }),
            fetch('/api/movies/content-ratings', { credentials: 'include' }),
            fetch('/api/movies/resolutions', { credentials: 'include' }),
            fetch('/api/movies/filter-ranges', { credentials: 'include' }),
          ])
        if (genresRes.ok) {
          const data = await genresRes.json()
          setMovieGenres(data.genres)
        }
        if (collectionsRes.ok) {
          const data = await collectionsRes.json()
          setCollections(data.collections)
        }
        if (contentRatingsRes.ok) {
          const data = await contentRatingsRes.json()
          setMovieContentRatings(data.contentRatings)
        }
        if (resolutionsRes.ok) {
          const data = await resolutionsRes.json()
          setMovieResolutions(data.resolutions)
        }
        if (rangesRes.ok) {
          const data = await rangesRes.json()
          setMovieRanges(data)
          // Update default filters with actual ranges
          setMovieFilters((prev: MovieFilters) => ({
            ...prev,
            yearRange: [data.year.min, data.year.max],
            runtimeRange: [data.runtime?.min || 0, data.runtime?.max || 300],
          }))
        }
      } catch {
        // Ignore filter fetch errors
      }
    }
    fetchFilters()
  }, [])

  // Fetch series filter metadata
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [genresRes, networksRes, contentRatingsRes, rangesRes] = await Promise.all([
          fetch('/api/series/genres', { credentials: 'include' }),
          fetch('/api/series/networks', { credentials: 'include' }),
          fetch('/api/series/content-ratings', { credentials: 'include' }),
          fetch('/api/series/filter-ranges', { credentials: 'include' }),
        ])
        if (genresRes.ok) {
          const data = await genresRes.json()
          setSeriesGenres(data.genres)
        }
        if (networksRes.ok) {
          const data = await networksRes.json()
          setNetworks(data.networks)
        }
        if (contentRatingsRes.ok) {
          const data = await contentRatingsRes.json()
          setSeriesContentRatings(data.contentRatings)
        }
        if (rangesRes.ok) {
          const data = await rangesRes.json()
          setSeriesRanges(data)
          // Update default filters with actual ranges
          setSeriesFilters((prev: SeriesFilters) => ({
            ...prev,
            yearRange: [data.year.min, data.year.max],
            seasonsRange: [data.seasons?.min || 1, data.seasons?.max || 30],
          }))
        }
      } catch {
        // Ignore filter fetch errors
      }
    }
    fetchFilters()
  }, [])

  // Fetch movies
  const fetchMovies = useCallback(
    async (page: number, append = false) => {
      if (append) {
        setMoviesLoadingMore(true)
      } else {
        setMoviesLoading(true)
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          sortBy: movieSortBy,
          sortOrder: movieSortOrder,
        })
        if (movieSearch) params.set('search', movieSearch)
        if (movieGenre) params.set('genre', movieGenre)
        if (collection) params.set('collection', collection)

        // Apply filters
        if (movieFilters.yearRange[0] > movieRanges.year.min) {
          params.set('minYear', String(movieFilters.yearRange[0]))
        }
        if (movieFilters.yearRange[1] < movieRanges.year.max) {
          params.set('maxYear', String(movieFilters.yearRange[1]))
        }
        if (movieFilters.runtimeRange[0] > (movieRanges.runtime?.min || 0)) {
          params.set('minRuntime', String(movieFilters.runtimeRange[0]))
        }
        if (movieFilters.runtimeRange[1] < (movieRanges.runtime?.max || 300)) {
          params.set('maxRuntime', String(movieFilters.runtimeRange[1]))
        }
        if (movieFilters.communityRating[0] > 0) {
          params.set('minCommunityRating', String(movieFilters.communityRating[0]))
        }
        if (movieFilters.rtScore[0] > 0) {
          params.set('minRtScore', String(movieFilters.rtScore[0]))
        }
        if (movieFilters.metacritic[0] > 0) {
          params.set('minMetacritic', String(movieFilters.metacritic[0]))
        }
        movieFilters.contentRatings.forEach((r) => params.append('contentRating', r))
        movieFilters.resolutions.forEach((r) => params.append('resolution', r))

        const response = await fetch(`/api/movies?${params}`, { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          if (append) {
            setMovies((prev) => [...prev, ...data.movies])
          } else {
            setMovies(data.movies)
          }
          setMovieTotal(data.total)
          setMovieHasMore(
            data.movies.length === pageSize &&
              (append ? movies.length + data.movies.length : data.movies.length) < data.total
          )
          setMoviesError(null)
        } else {
          setMoviesError('Failed to load movies')
        }
      } catch {
        setMoviesError('Could not connect to server')
      } finally {
        setMoviesLoading(false)
        setMoviesLoadingMore(false)
      }
    },
    [
      movieSearch,
      movieGenre,
      collection,
      movieFilters,
      movieRanges,
      movieSortBy,
      movieSortOrder,
      movies.length,
    ]
  )

  // Fetch series
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
          pageSize: String(pageSize),
          sortBy: seriesSortBy,
          sortOrder: seriesSortOrder,
        })
        if (seriesSearch) params.set('search', seriesSearch)
        if (seriesGenre) params.set('genre', seriesGenre)
        if (network) params.set('network', network)

        // Apply filters
        if (seriesFilters.yearRange[0] > seriesRanges.year.min) {
          params.set('minYear', String(seriesFilters.yearRange[0]))
        }
        if (seriesFilters.yearRange[1] < seriesRanges.year.max) {
          params.set('maxYear', String(seriesFilters.yearRange[1]))
        }
        if (seriesFilters.seasonsRange[0] > (seriesRanges.seasons?.min || 1)) {
          params.set('minSeasons', String(seriesFilters.seasonsRange[0]))
        }
        if (seriesFilters.seasonsRange[1] < (seriesRanges.seasons?.max || 30)) {
          params.set('maxSeasons', String(seriesFilters.seasonsRange[1]))
        }
        if (seriesFilters.communityRating[0] > 0) {
          params.set('minCommunityRating', String(seriesFilters.communityRating[0]))
        }
        if (seriesFilters.rtScore[0] > 0) {
          params.set('minRtScore', String(seriesFilters.rtScore[0]))
        }
        if (seriesFilters.metacritic[0] > 0) {
          params.set('minMetacritic', String(seriesFilters.metacritic[0]))
        }
        seriesFilters.contentRatings.forEach((r) => params.append('contentRating', r))
        seriesFilters.status.forEach((s) => params.append('status', s))

        const response = await fetch(`/api/series?${params}`, { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          if (append) {
            setSeries((prev) => [...prev, ...data.series])
          } else {
            setSeries(data.series)
          }
          setSeriesTotal(data.total)
          setSeriesHasMore(
            data.series.length === pageSize &&
              (append ? series.length + data.series.length : data.series.length) < data.total
          )
          setSeriesError(null)
        } else {
          setSeriesError('Failed to load series')
        }
      } catch {
        setSeriesError('Could not connect to server')
      } finally {
        setSeriesLoading(false)
        setSeriesLoadingMore(false)
      }
    },
    [
      seriesSearch,
      seriesGenre,
      network,
      seriesFilters,
      seriesRanges,
      seriesSortBy,
      seriesSortOrder,
      series.length,
    ]
  )

  // Initial movie fetch and filter changes
  useEffect(() => {
    resetMovies()
    const debounce = setTimeout(() => fetchMovies(1, false), movieSearch ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [movieSearch, movieGenre, collection, movieFilters, movieSortBy, movieSortOrder])

  // Initial series fetch and filter changes
  useEffect(() => {
    resetSeries()
    const debounce = setTimeout(() => fetchSeries(1, false), seriesSearch ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [seriesSearch, seriesGenre, network, seriesFilters, seriesSortBy, seriesSortOrder])

  // Infinite scroll for movies
  useEffect(() => {
    if (movieObserverRef.current) {
      movieObserverRef.current.disconnect()
    }

    if (!movieHasMore || moviesLoading || moviesLoadingMore || tabIndex !== 0) return

    movieObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && movieHasMore && !moviesLoadingMore) {
          const nextPage = moviePage + 1
          setMoviePage(nextPage)
          fetchMovies(nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (movieLoadMoreRef.current) {
      movieObserverRef.current.observe(movieLoadMoreRef.current)
    }

    return () => {
      if (movieObserverRef.current) {
        movieObserverRef.current.disconnect()
      }
    }
  }, [movieHasMore, moviesLoading, moviesLoadingMore, tabIndex, moviePage, fetchMovies])

  // Infinite scroll for series
  useEffect(() => {
    if (seriesObserverRef.current) {
      seriesObserverRef.current.disconnect()
    }

    if (!seriesHasMore || seriesLoading || seriesLoadingMore || tabIndex !== 1) return

    seriesObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && seriesHasMore && !seriesLoadingMore) {
          const nextPage = seriesPage + 1
          setSeriesPage(nextPage)
          fetchSeries(nextPage, true)
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
  }, [seriesHasMore, seriesLoading, seriesLoadingMore, tabIndex, seriesPage, fetchSeries])

  // Get active filter chips for movies
  const getMovieActiveFilters = () => {
    const chips: { label: string; onDelete: () => void }[] = []

    if (movieGenre) {
      chips.push({ label: movieGenre, onDelete: () => setMovieGenre('') })
    }
    if (collection) {
      chips.push({ label: collection, onDelete: () => setCollection('') })
    }
    if (
      movieFilters.yearRange[0] > movieRanges.year.min ||
      movieFilters.yearRange[1] < movieRanges.year.max
    ) {
      chips.push({
        label: `${movieFilters.yearRange[0]}–${movieFilters.yearRange[1]}`,
        onDelete: () =>
          setMovieFilters((f: MovieFilters) => ({
            ...f,
            yearRange: [movieRanges.year.min, movieRanges.year.max],
          })),
      })
    }
    if (movieFilters.communityRating[0] > 0) {
      chips.push({
        label: `Rating ≥${movieFilters.communityRating[0]}`,
        onDelete: () => setMovieFilters((f: MovieFilters) => ({ ...f, communityRating: [0, 10] })),
      })
    }
    if (movieFilters.rtScore[0] > 0) {
      chips.push({
        label: `RT ≥${movieFilters.rtScore[0]}%`,
        onDelete: () => setMovieFilters((f: MovieFilters) => ({ ...f, rtScore: [0, 100] })),
      })
    }
    if (movieFilters.metacritic[0] > 0) {
      chips.push({
        label: `MC ≥${movieFilters.metacritic[0]}`,
        onDelete: () => setMovieFilters((f: MovieFilters) => ({ ...f, metacritic: [0, 100] })),
      })
    }
    if (
      movieFilters.runtimeRange[0] > (movieRanges.runtime?.min || 0) ||
      movieFilters.runtimeRange[1] < (movieRanges.runtime?.max || 300)
    ) {
      chips.push({
        label: `${movieFilters.runtimeRange[0]}–${movieFilters.runtimeRange[1]} min`,
        onDelete: () =>
          setMovieFilters((f: MovieFilters) => ({
            ...f,
            runtimeRange: [movieRanges.runtime?.min || 0, movieRanges.runtime?.max || 300],
          })),
      })
    }
    movieFilters.contentRatings.forEach((r: string) => {
      chips.push({
        label: r,
        onDelete: () =>
          setMovieFilters((f: MovieFilters) => ({
            ...f,
            contentRatings: f.contentRatings.filter((cr: string) => cr !== r),
          })),
      })
    })
    movieFilters.resolutions.forEach((r: string) => {
      chips.push({
        label: r,
        onDelete: () =>
          setMovieFilters((f: MovieFilters) => ({
            ...f,
            resolutions: f.resolutions.filter((res: string) => res !== r),
          })),
      })
    })

    return chips
  }

  // Get active filter chips for series
  const getSeriesActiveFilters = () => {
    const chips: { label: string; onDelete: () => void }[] = []

    if (seriesGenre) {
      chips.push({ label: seriesGenre, onDelete: () => setSeriesGenre('') })
    }
    if (network) {
      chips.push({ label: network, onDelete: () => setNetwork('') })
    }
    if (
      seriesFilters.yearRange[0] > seriesRanges.year.min ||
      seriesFilters.yearRange[1] < seriesRanges.year.max
    ) {
      chips.push({
        label: `${seriesFilters.yearRange[0]}–${seriesFilters.yearRange[1]}`,
        onDelete: () =>
          setSeriesFilters((f: SeriesFilters) => ({
            ...f,
            yearRange: [seriesRanges.year.min, seriesRanges.year.max],
          })),
      })
    }
    if (seriesFilters.communityRating[0] > 0) {
      chips.push({
        label: `Rating ≥${seriesFilters.communityRating[0]}`,
        onDelete: () => setSeriesFilters((f: SeriesFilters) => ({ ...f, communityRating: [0, 10] })),
      })
    }
    if (seriesFilters.rtScore[0] > 0) {
      chips.push({
        label: `RT ≥${seriesFilters.rtScore[0]}%`,
        onDelete: () => setSeriesFilters((f: SeriesFilters) => ({ ...f, rtScore: [0, 100] })),
      })
    }
    if (seriesFilters.metacritic[0] > 0) {
      chips.push({
        label: `MC ≥${seriesFilters.metacritic[0]}`,
        onDelete: () => setSeriesFilters((f: SeriesFilters) => ({ ...f, metacritic: [0, 100] })),
      })
    }
    if (
      seriesFilters.seasonsRange[0] > (seriesRanges.seasons?.min || 1) ||
      seriesFilters.seasonsRange[1] < (seriesRanges.seasons?.max || 30)
    ) {
      chips.push({
        label: `${seriesFilters.seasonsRange[0]}–${seriesFilters.seasonsRange[1]} seasons`,
        onDelete: () =>
          setSeriesFilters((f: SeriesFilters) => ({
            ...f,
            seasonsRange: [seriesRanges.seasons?.min || 1, seriesRanges.seasons?.max || 30],
          })),
      })
    }
    seriesFilters.contentRatings.forEach((r: string) => {
      chips.push({
        label: r,
        onDelete: () =>
          setSeriesFilters((f: SeriesFilters) => ({
            ...f,
            contentRatings: f.contentRatings.filter((cr: string) => cr !== r),
          })),
      })
    })
    seriesFilters.status.forEach((s: string) => {
      chips.push({
        label: s === 'Continuing' ? 'Airing' : s,
        onDelete: () =>
          setSeriesFilters((f: SeriesFilters) => ({
            ...f,
            status: f.status.filter((st: string) => st !== s),
          })),
      })
    })

    return chips
  }

  const renderSkeleton = () =>
    viewMode === 'grid' ? (
      <Grid container spacing={2}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
            <MoviePoster title="" loading responsive />
          </Grid>
        ))}
      </Grid>
    ) : (
      <Box display="flex" flexDirection="column" gap={2}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} display="flex" gap={2} bgcolor="background.paper" borderRadius={2} p={2}>
            <Skeleton variant="rectangular" width={100} height={150} sx={{ borderRadius: 1 }} />
            <Box flexGrow={1}>
              <Skeleton variant="text" width="60%" height={30} />
              <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1 }} />
              <Box display="flex" gap={0.5} mb={1}>
                <Skeleton variant="rectangular" width={60} height={22} sx={{ borderRadius: 1 }} />
                <Skeleton variant="rectangular" width={70} height={22} sx={{ borderRadius: 1 }} />
              </Box>
              <Skeleton variant="text" width="90%" />
              <Skeleton variant="text" width="80%" />
            </Box>
          </Box>
        ))}
      </Box>
    )

  const renderMoviesTab = () => {
    const activeFilters = getMovieActiveFilters()

    return (
      <>
        {/* Sticky Filter Controls */}
        <Box
          sx={{
            position: 'sticky',
            top: { xs: 56, sm: 64 },
            zIndex: 10,
            backgroundColor: 'background.default',
            py: 2,
            mx: -3,
            px: 3,
            mb: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
            <TextField
              placeholder="Search movies..."
              value={movieSearch}
              onChange={(e) => setMovieSearch(e.target.value)}
              size="small"
              sx={{ width: { xs: '100%', sm: 180 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ width: { xs: '100%', sm: 150 } }}>
              <InputLabel>Genre</InputLabel>
              <Select value={movieGenre} label="Genre" onChange={(e) => setMovieGenre(e.target.value)}>
                <MenuItem value="">All Genres</MenuItem>
                {movieGenres.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {collections.length > 0 && (
              <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
                <InputLabel>Franchise</InputLabel>
                <Select
                  value={collection}
                  label="Franchise"
                  onChange={(e) => setCollection(e.target.value)}
                >
                  <MenuItem value="">All Franchises</MenuItem>
                  {collections.map((c) => (
                    <MenuItem key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FilterPopper
              type="movies"
              filters={movieFilters}
              onChange={(f: MovieFilters | SeriesFilters) => setMovieFilters(f as MovieFilters)}
              contentRatings={movieContentRatings}
              resolutions={movieResolutions}
              ranges={movieRanges}
            />

            <SortPopper
              type="movies"
              sortBy={movieSortBy}
              sortOrder={movieSortOrder}
              onChange={handleMovieSortChange}
            />

            <FilterPresetManager
              type="movies"
              currentFilters={movieFilters}
              currentGenre={movieGenre}
              currentCollection={collection}
              presets={filterPresets}
              onLoadPreset={handleLoadMoviePreset}
              onSavePreset={handleSaveMoviePreset}
              onDeletePreset={handleDeletePreset}
              onRenamePreset={handleRenamePreset}
            />
          </Box>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <Box display="flex" gap={0.5} flexWrap="wrap" mt={1.5}>
              {activeFilters.map((chip, i) => (
                <Chip
                  key={i}
                  label={chip.label}
                  size="small"
                  onDelete={chip.onDelete}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          )}
        </Box>

        {moviesError && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {moviesError}
          </Alert>
        )}

        {moviesLoading ? (
          renderSkeleton()
        ) : movies.length === 0 ? (
          <Typography color="text.secondary">
            {movieSearch || movieGenre || collection || activeFilters.length > 0
              ? 'No movies match your filters.'
              : 'No movies found. Run the movie sync job to import your library.'}
          </Typography>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <Grid container spacing={2}>
                {movies.map((movie) => (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={movie.id}>
                    <MoviePoster
                      title={movie.title}
                      year={movie.year}
                      posterUrl={movie.poster_url}
                      rating={movie.community_rating}
                      genres={movie.genres}
                      overview={movie.overview}
                      userRating={getRating('movie', movie.id)}
                      onRate={(rating) => handleRateMovie(movie.id, rating)}
                      responsive
                      onClick={() => navigate(`/movies/${movie.id}`)}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box display="flex" flexDirection="column" gap={2}>
                {movies.map((movie) => (
                  <BrowseMovieListItem
                    key={movie.id}
                    movie={movie}
                    userRating={getRating('movie', movie.id)}
                    onRate={(rating) => handleRateMovie(movie.id, rating)}
                    onClick={() => navigate(`/movies/${movie.id}`)}
                  />
                ))}
              </Box>
            )}

            {/* Load more trigger */}
            <Box
              ref={movieLoadMoreRef}
              display="flex"
              justifyContent="center"
              alignItems="center"
              py={4}
            >
              {moviesLoadingMore && <CircularProgress size={32} />}
              {!movieHasMore && movies.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Showing all {movieTotal.toLocaleString()} movies
                </Typography>
              )}
            </Box>
          </>
        )}
      </>
    )
  }

  const renderSeriesTab = () => {
    const activeFilters = getSeriesActiveFilters()

    return (
      <>
        {/* Sticky Filter Controls */}
        <Box
          sx={{
            position: 'sticky',
            top: { xs: 56, sm: 64 },
            zIndex: 10,
            backgroundColor: 'background.default',
            py: 2,
            mx: -3,
            px: 3,
            mb: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
            <TextField
              placeholder="Search series..."
              value={seriesSearch}
              onChange={(e) => setSeriesSearch(e.target.value)}
              size="small"
              sx={{ width: { xs: '100%', sm: 180 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ width: { xs: '100%', sm: 150 } }}>
              <InputLabel>Genre</InputLabel>
              <Select
                value={seriesGenre}
                label="Genre"
                onChange={(e) => setSeriesGenre(e.target.value)}
              >
                <MenuItem value="">All Genres</MenuItem>
                {seriesGenres.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ width: { xs: '100%', sm: 150 } }}>
              <InputLabel>Network</InputLabel>
              <Select value={network} label="Network" onChange={(e) => setNetwork(e.target.value)}>
                <MenuItem value="">All Networks</MenuItem>
                {networks.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FilterPopper
              type="series"
              filters={seriesFilters}
              onChange={(f: MovieFilters | SeriesFilters) => setSeriesFilters(f as SeriesFilters)}
              contentRatings={seriesContentRatings}
              ranges={seriesRanges}
            />

            <SortPopper
              type="series"
              sortBy={seriesSortBy}
              sortOrder={seriesSortOrder}
              onChange={handleSeriesSortChange}
            />

            <FilterPresetManager
              type="series"
              currentFilters={seriesFilters}
              currentGenre={seriesGenre}
              currentNetwork={network}
              presets={filterPresets}
              onLoadPreset={handleLoadSeriesPreset}
              onSavePreset={handleSaveSeriesPreset}
              onDeletePreset={handleDeletePreset}
              onRenamePreset={handleRenamePreset}
            />
          </Box>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <Box display="flex" gap={0.5} flexWrap="wrap" mt={1.5}>
              {activeFilters.map((chip, i) => (
                <Chip
                  key={i}
                  label={chip.label}
                  size="small"
                  onDelete={chip.onDelete}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          )}
        </Box>

        {seriesError && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {seriesError}
          </Alert>
        )}

        {seriesLoading ? (
          renderSkeleton()
        ) : series.length === 0 ? (
          <Typography color="text.secondary">
            {seriesSearch || seriesGenre || network || activeFilters.length > 0
              ? 'No series match your filters.'
              : 'No series found. Run the series sync job to import your library.'}
          </Typography>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <Grid container spacing={2}>
                {series.map((show) => (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={show.id}>
                    <MoviePoster
                      title={show.title}
                      year={show.year}
                      posterUrl={show.poster_url}
                      rating={show.community_rating}
                      genres={show.genres}
                      overview={show.overview}
                      userRating={getRating('series', show.id)}
                      onRate={(rating) => handleRateSeries(show.id, rating)}
                      isWatching={isWatching(show.id)}
                      onWatchingToggle={() => toggleWatching(show.id)}
                      responsive
                      onClick={() => navigate(`/series/${show.id}`)}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box display="flex" flexDirection="column" gap={2}>
                {series.map((show) => (
                  <BrowseSeriesListItem
                    key={show.id}
                    series={show}
                    userRating={getRating('series', show.id)}
                    onRate={(rating) => handleRateSeries(show.id, rating)}
                    isWatching={isWatching(show.id)}
                    onWatchingToggle={() => toggleWatching(show.id)}
                    onClick={() => navigate(`/series/${show.id}`)}
                  />
                ))}
              </Box>
            )}

            {/* Load more trigger */}
            <Box
              ref={seriesLoadMoreRef}
              display="flex"
              justifyContent="center"
              alignItems="center"
              py={4}
            >
              {seriesLoadingMore && <CircularProgress size={32} />}
              {!seriesHasMore && series.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Showing all {seriesTotal.toLocaleString()} series
                </Typography>
              )}
            </Box>
          </>
        )}
      </>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        mb={3}
      >
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={{ xs: 0, sm: 1 }}>
            <VideoLibraryIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              Browse
            </Typography>
          </Box>
          {!isMobile && (
            <Typography variant="body1" color="text.secondary">
              Browse your synced media library •{' '}
              {tabIndex === 0
                ? movieTotal.toLocaleString()
                : seriesTotal.toLocaleString()}{' '}
              {tabIndex === 0 ? 'movies' : 'series'}
            </Typography>
          )}
        </Box>

        {/* Grid/List toggle always in upper right */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="grid">
            <GridViewIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list">
            <ViewListIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              textTransform: 'none',
              fontWeight: 500,
            },
          }}
        >
          <Tab
            icon={<MovieIcon />}
            iconPosition="start"
            label="Movies"
            sx={{
              color: tabIndex === 0 ? '#6366f1' : 'text.secondary',
              '&.Mui-selected': { color: '#6366f1' },
            }}
          />
          <Tab
            icon={<TvIcon />}
            iconPosition="start"
            label="Series"
            sx={{
              color: tabIndex === 1 ? '#ec4899' : 'text.secondary',
              '&.Mui-selected': { color: '#ec4899' },
            }}
          />
        </Tabs>
      </Box>

      {tabIndex === 0 ? renderMoviesTab() : renderSeriesTab()}
    </Box>
  )
}
