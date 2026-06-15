import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { PAGE_SIZE, defaultMovieFilters } from '../constants'
import type {
  ActiveFilterChip,
  Collection,
  ContentRating,
  CountryOption,
  FilterRanges,
  Movie,
  Resolution,
} from '../types'
import type { MovieFilters, SortField, SortOrder } from '../components'
import { buildMovieActiveFilterChips } from '../utils/activeFilterChips'

interface UseBrowseMoviesOptions {
  tabIndex: number
  persistSortPreferences: (sortBy: SortField, sortOrder: SortOrder) => void
}

interface MoviesResponse {
  movies: Movie[]
  total: number
}

interface MovieMetadataResponse {
  genres?: string[]
  collections?: Collection[]
  contentRatings?: ContentRating[]
  resolutions?: Resolution[]
  countries?: CountryOption[]
}

interface MovieRangesResponse extends FilterRanges {
  runtime?: { min: number; max: number }
}

interface BrowseMoviesResult {
  movies: Movie[]
  movieGenres: string[]
  collections: Collection[]
  movieContentRatings: ContentRating[]
  movieResolutions: Resolution[]
  movieCountries: CountryOption[]
  movieRanges: MovieRangesResponse
  moviesLoading: boolean
  moviesLoadingMore: boolean
  moviesError: string | null
  movieSearch: Dispatch<SetStateAction<string>>
  movieGenre: Dispatch<SetStateAction<string>>
  collection: Dispatch<SetStateAction<string>>
  movieFilters: MovieFilters
  setMovieFilters: Dispatch<SetStateAction<MovieFilters>>
  movieSortBy: SortField
  setMovieSortBy: Dispatch<SetStateAction<SortField>>
  movieSortOrder: SortOrder
  setMovieSortOrder: Dispatch<SetStateAction<SortOrder>>
  movieTotal: number
  movieHasMore: boolean
  movieLoadMoreRef: RefObject<HTMLDivElement | null>
  activeFilters: ActiveFilterChip[]
  handleMovieSortChange: (sortBy: SortField, sortOrder: SortOrder) => void
}

export function useBrowseMovies({ tabIndex, persistSortPreferences }: UseBrowseMoviesOptions): BrowseMoviesResult {
  const { t } = useTranslation()
  const [movies, setMovies] = useState<Movie[]>([])
  const [movieGenres, setMovieGenres] = useState<string[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [movieContentRatings, setMovieContentRatings] = useState<ContentRating[]>([])
  const [movieResolutions, setMovieResolutions] = useState<Resolution[]>([])
  const [movieCountries, setMovieCountries] = useState<CountryOption[]>([])
  const [movieRanges, setMovieRanges] = useState<MovieRangesResponse>({
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
  const movieObserverRef = useRef<IntersectionObserver | null>(null)
  const movieLoadMoreRef = useRef<HTMLDivElement | null>(null)

  const resetMovies = useCallback(() => {
    setMovies([])
    setMoviePage(1)
    setMovieHasMore(true)
  }, [])

  const fetchMovies = useCallback(
    async (page: number, append = false) => {
      if (append) setMoviesLoadingMore(true)
      else setMoviesLoading(true)

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortBy: movieSortBy,
          sortOrder: movieSortOrder,
        })
        if (movieSearch) params.set('search', movieSearch)
        if (movieGenre) params.set('genre', movieGenre)
        if (collection) params.set('collection', collection)

        if (movieFilters.yearRange[0] > movieRanges.year.min) params.set('minYear', String(movieFilters.yearRange[0]))
        if (movieFilters.yearRange[1] < movieRanges.year.max) params.set('maxYear', String(movieFilters.yearRange[1]))
        if (movieFilters.runtimeRange[0] > (movieRanges.runtime?.min || 0)) params.set('minRuntime', String(movieFilters.runtimeRange[0]))
        if (movieFilters.runtimeRange[1] < (movieRanges.runtime?.max || 300)) params.set('maxRuntime', String(movieFilters.runtimeRange[1]))
        if (movieFilters.communityRating[0] > 0) params.set('minCommunityRating', String(movieFilters.communityRating[0]))
        if (movieFilters.rtScore[0] > 0) params.set('minRtScore', String(movieFilters.rtScore[0]))
        if (movieFilters.metacritic[0] > 0) params.set('minMetacritic', String(movieFilters.metacritic[0]))
        movieFilters.contentRatings.forEach((rating) => params.append('contentRating', rating))
        movieFilters.resolutions.forEach((resolution) => params.append('resolution', resolution))
        movieFilters.countries.forEach((country) => params.append('country', country))
        if (movieFilters.watchStatus !== 'any') params.set('watchStatus', movieFilters.watchStatus)
        if (movieFilters.minWatchers !== null && movieFilters.minWatchers > 0) params.set('minWatchers', String(movieFilters.minWatchers))
        if (movieFilters.maxWatchers !== null && movieFilters.maxWatchers >= 0) params.set('maxWatchers', String(movieFilters.maxWatchers))

        const response = await fetch(`/api/movies?${params}`, { credentials: 'include' })
        if (!response.ok) {
          setMoviesError(t('browse.errors.loadMovies'))
          return
        }

        const data = (await response.json()) as MoviesResponse
        if (append) setMovies((prev) => [...prev, ...data.movies])
        else setMovies(data.movies)
        setMovieTotal(data.total)
        setMovieHasMore(data.movies.length === PAGE_SIZE && (append ? movies.length + data.movies.length : data.movies.length) < data.total)
        setMoviesError(null)
      } catch {
        setMoviesError(t('browse.errors.connect'))
      } finally {
        setMoviesLoading(false)
        setMoviesLoadingMore(false)
      }
    },
    [collection, movieFilters, movieGenre, movieRanges, movieSearch, movieSortBy, movieSortOrder, movies.length, t]
  )

  const fetchMovieMetadata = useCallback(async () => {
    try {
      const [genresRes, collectionsRes, contentRatingsRes, resolutionsRes, countriesRes, rangesRes] = await Promise.all([
        fetch('/api/movies/genres', { credentials: 'include' }),
        fetch('/api/movies/collections', { credentials: 'include' }),
        fetch('/api/movies/content-ratings', { credentials: 'include' }),
        fetch('/api/movies/resolutions', { credentials: 'include' }),
        fetch('/api/movies/countries', { credentials: 'include' }),
        fetch('/api/movies/filter-ranges', { credentials: 'include' }),
      ])

      if (genresRes.ok) {
        const data = (await genresRes.json()) as { genres?: string[] }
        setMovieGenres(data.genres || [])
      }
      if (collectionsRes.ok) {
        const data = (await collectionsRes.json()) as MovieMetadataResponse
        setCollections(data.collections || [])
      }
      if (contentRatingsRes.ok) {
        const data = (await contentRatingsRes.json()) as MovieMetadataResponse
        setMovieContentRatings(data.contentRatings || [])
      }
      if (resolutionsRes.ok) {
        const data = (await resolutionsRes.json()) as MovieMetadataResponse
        setMovieResolutions(data.resolutions || [])
      }
      if (countriesRes.ok) {
        const data = (await countriesRes.json()) as MovieMetadataResponse
        setMovieCountries(data.countries || [])
      }
      if (rangesRes.ok) {
        const data = (await rangesRes.json()) as MovieRangesResponse
        setMovieRanges(data)
        setMovieFilters((prev) => ({
          ...prev,
          yearRange: [data.year.min, data.year.max],
          runtimeRange: [data.runtime?.min || 0, data.runtime?.max || 300],
        }))
      }
    } catch {
      // Ignore metadata errors.
    }
  }, [])

  useEffect(() => {
    void fetchMovieMetadata()
  }, [fetchMovieMetadata])

  useEffect(() => {
    resetMovies()
    const debounce = setTimeout(() => {
      void fetchMovies(1, false)
    }, movieSearch ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [collection, fetchMovies, movieFilters, movieGenre, movieSearch, movieSortBy, movieSortOrder, resetMovies])

  useEffect(() => {
    if (movieObserverRef.current) {
      movieObserverRef.current.disconnect()
    }

    if (!movieHasMore || moviesLoading || moviesLoadingMore || tabIndex !== 0) return

    movieObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && movieHasMore && !moviesLoadingMore) {
          const nextPage = moviePage + 1
          setMoviePage(nextPage)
          void fetchMovies(nextPage, true)
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
  }, [fetchMovies, movieHasMore, moviePage, moviesLoading, moviesLoadingMore, tabIndex])

  const activeFilters = useMemo(
    () =>
      buildMovieActiveFilterChips({
        movieGenre,
        collection,
        movieFilters,
        movieRanges,
        t,
        setMovieGenre,
        setCollection,
        setMovieFilters,
      }),
    [collection, movieFilters, movieGenre, movieRanges, t]
  )

  const handleMovieSortChange = useCallback(
    (sortBy: SortField, sortOrder: SortOrder) => {
      setMovieSortBy(sortBy)
      setMovieSortOrder(sortOrder)
      persistSortPreferences(sortBy, sortOrder)
    },
    [persistSortPreferences]
  )

  return {
    movies,
    movieGenres,
    collections,
    movieContentRatings,
    movieResolutions,
    movieCountries,
    movieRanges,
    moviesLoading,
    moviesLoadingMore,
    moviesError,
    movieSearch,
    setMovieSearch,
    movieGenre,
    setMovieGenre,
    collection,
    setCollection,
    movieFilters,
    setMovieFilters,
    movieSortBy,
    setMovieSortBy,
    movieSortOrder,
    setMovieSortOrder,
    movieTotal,
    movieHasMore,
    movieLoadMoreRef,
    activeFilters,
    handleMovieSortChange,
  }
}
