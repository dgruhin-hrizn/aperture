import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Chip,
  Button,
  Alert,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Pagination,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import FilterListIcon from '@mui/icons-material/FilterList'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'
import { useWatching } from '../hooks/useWatching'

interface SearchResult {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
  rt_critic_score: number | null
  collection_name: string | null
  network: string | null
  combined_score: number
}

interface FilterOptions {
  genres: { name: string; count: number }[]
  collections: { name: string; count: number }[]
  networks: { name: string; count: number }[]
  yearRange: { min: number; max: number }
}

export function SearchPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()

  // Search state
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const pageSize = 24

  // Filter state
  const [filters, setFilters] = useState<FilterOptions | null>(null)
  const [type, setType] = useState<'all' | 'movie' | 'series'>(
    (searchParams.get('type') as 'all' | 'movie' | 'series') || 'all'
  )
  const [genre, setGenre] = useState(searchParams.get('genre') || '')
  const [collection, setCollection] = useState(searchParams.get('collection') || '')
  const [network, setNetwork] = useState(searchParams.get('network') || '')
  const [yearRange, setYearRange] = useState<[number, number]>([1900, new Date().getFullYear()])
  const [minRtScore, setMinRtScore] = useState<number>(
    parseInt(searchParams.get('minRtScore') || '0', 10)
  )
  const [useSemantic, setUseSemantic] = useState(searchParams.get('semantic') === 'true')
  const [showFilters, setShowFilters] = useState(false)

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await fetch('/api/search/filters', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setFilters(data)
          if (data.yearRange) {
            setYearRange([data.yearRange.min, data.yearRange.max])
          }
        }
      } catch {
        // Ignore filter fetch errors
      }
    }
    fetchFilters()
  }, [])

  // Perform search
  const performSearch = useCallback(async () => {
    if (!query || query.trim().length < 2) {
      setResults([])
      setTotalResults(0)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        q: query,
        limit: String(pageSize),
      })

      if (type !== 'all') params.set('type', type)
      if (genre) params.set('genre', genre)
      if (collection) params.set('collection', collection)
      if (network) params.set('network', network)
      if (minRtScore > 0) params.set('minRtScore', String(minRtScore))
      if (useSemantic) params.set('semantic', 'true')
      if (filters?.yearRange) {
        if (yearRange[0] > filters.yearRange.min) params.set('yearMin', String(yearRange[0]))
        if (yearRange[1] < filters.yearRange.max) params.set('yearMax', String(yearRange[1]))
      }

      const response = await fetch(`/api/search?${params}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setResults(data.results)
        setTotalResults(data.total)
      } else {
        setError(t('search.errors.searchFailed'))
      }
    } catch {
      setError(t('search.errors.connect'))
    } finally {
      setLoading(false)
    }
  }, [query, type, genre, collection, network, minRtScore, useSemantic, yearRange, filters, t])

  // Debounced search
  useEffect(() => {
    const debounce = setTimeout(performSearch, query ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [performSearch])

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (type !== 'all') params.set('type', type)
    if (genre) params.set('genre', genre)
    if (collection) params.set('collection', collection)
    if (network) params.set('network', network)
    if (minRtScore > 0) params.set('minRtScore', String(minRtScore))
    if (useSemantic) params.set('semantic', 'true')
    setSearchParams(params, { replace: true })
  }, [query, type, genre, collection, network, minRtScore, useSemantic, setSearchParams])

  const handleRate = useCallback(
    async (itemId: string, itemType: 'movie' | 'series', rating: number | null) => {
      try {
        await setRating(itemType, itemId, rating)
      } catch (err) {
        console.error('Failed to rate:', err)
      }
    },
    [setRating]
  )

  const clearFilters = () => {
    setType('all')
    setGenre('')
    setCollection('')
    setNetwork('')
    setMinRtScore(0)
    setUseSemantic(false)
    if (filters?.yearRange) {
      setYearRange([filters.yearRange.min, filters.yearRange.max])
    }
  }

  const hasActiveFilters =
    type !== 'all' ||
    genre ||
    collection ||
    network ||
    minRtScore > 0 ||
    useSemantic ||
    (filters?.yearRange && (yearRange[0] > filters.yearRange.min || yearRange[1] < filters.yearRange.max))

  const filterPanelCount = useMemo(
    () =>
      [type !== 'all', genre, collection, network, minRtScore > 0, useSemantic].filter(Boolean)
        .length,
    [type, genre, collection, network, minRtScore, useSemantic]
  )

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        {t('search.title')}
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        {t('search.subtitle')}
      </Typography>

      {/* Search Input */}
      <Box mb={3}>
        <TextField
          fullWidth
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: loading && (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              fontSize: '1.1rem',
            },
          }}
        />
      </Box>

      {/* Filter Toggle */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
        <Button
          variant={showFilters ? 'contained' : 'outlined'}
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters(!showFilters)}
          size="small"
        >
          {hasActiveFilters
            ? t('search.filtersButtonWithCount', { count: filterPanelCount })
            : t('search.filtersButton')}
        </Button>

        <ToggleButtonGroup
          value={type}
          exclusive
          onChange={(_, value) => value && setType(value)}
          size="small"
        >
          <ToggleButton value="all">{t('search.typeAll')}</ToggleButton>
          <ToggleButton value="movie">
            <MovieIcon sx={{ mr: 0.5, fontSize: 18 }} /> {t('search.typeMovies')}
          </ToggleButton>
          <ToggleButton value="series">
            <TvIcon sx={{ mr: 0.5, fontSize: 18 }} /> {t('search.typeSeries')}
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          variant={useSemantic ? 'contained' : 'outlined'}
          color={useSemantic ? 'secondary' : 'inherit'}
          startIcon={<AutoAwesomeIcon />}
          onClick={() => setUseSemantic(!useSemantic)}
          size="small"
        >
          {t('search.aiSearch')}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="text"
            startIcon={<ClearAllIcon />}
            onClick={clearFilters}
            size="small"
          >
            {t('search.clearFilters')}
          </Button>
        )}
      </Box>

      {/* Expanded Filters */}
      {showFilters && filters && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('browse.labels.genre')}</InputLabel>
                <Select
                  value={genre}
                  label={t('browse.labels.genre')}
                  onChange={(e) => setGenre(e.target.value)}
                >
                  <MenuItem value="">{t('browse.labels.allGenres')}</MenuItem>
                  {filters.genres.map((g) => (
                    <MenuItem key={g.name} value={g.name}>
                      {g.name} ({g.count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('browse.labels.franchise')}</InputLabel>
                <Select
                  value={collection}
                  label={t('browse.labels.franchise')}
                  onChange={(e) => setCollection(e.target.value)}
                  disabled={type === 'series'}
                >
                  <MenuItem value="">{t('browse.labels.allFranchises')}</MenuItem>
                  {filters.collections.map((c) => (
                    <MenuItem key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('browse.labels.network')}</InputLabel>
                <Select
                  value={network}
                  label={t('browse.labels.network')}
                  onChange={(e) => setNetwork(e.target.value)}
                  disabled={type === 'movie'}
                >
                  <MenuItem value="">{t('browse.labels.allNetworks')}</MenuItem>
                  {filters.networks.map((n) => (
                    <MenuItem key={n.name} value={n.name}>
                      {n.name} ({n.count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                {t('search.minRtCaption', {
                  value: minRtScore > 0 ? `${minRtScore}%` : t('search.minRtAny'),
                })}
              </Typography>
              <Slider
                value={minRtScore}
                onChange={(_, value) => setMinRtScore(value as number)}
                min={0}
                max={100}
                step={10}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                {t('search.yearRangeCaption', { min: yearRange[0], max: yearRange[1] })}
              </Typography>
              <Slider
                value={yearRange}
                onChange={(_, value) => setYearRange(value as [number, number])}
                min={filters.yearRange.min}
                max={filters.yearRange.max}
                valueLabelDisplay="auto"
                size="small"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <Box display="flex" gap={1} mb={3} flexWrap="wrap">
          {genre && (
            <Chip
              label={t('search.chipGenre', { value: genre })}
              onDelete={() => setGenre('')}
              size="small"
            />
          )}
          {collection && (
            <Chip
              label={t('search.chipFranchise', { value: collection })}
              onDelete={() => setCollection('')}
              size="small"
            />
          )}
          {network && (
            <Chip
              label={t('search.chipNetwork', { value: network })}
              onDelete={() => setNetwork('')}
              size="small"
            />
          )}
          {minRtScore > 0 && (
            <Chip
              label={t('search.chipRt', { value: minRtScore })}
              onDelete={() => setMinRtScore(0)}
              size="small"
            />
          )}
          {useSemantic && (
            <Chip
              icon={<AutoAwesomeIcon />}
              label={t('search.aiSearch')}
              onDelete={() => setUseSemantic(false)}
              size="small"
              color="secondary"
            />
          )}
        </Box>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {!query && (
        <Box textAlign="center" py={8}>
          <SearchIcon sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {t('search.emptyTitle')}
          </Typography>
          <Typography variant="body2" color="text.disabled" mt={1}>
            {t('search.emptyHint')}
          </Typography>
        </Box>
      )}

      {query && !loading && results.length === 0 && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary">
            {t('search.noResults', { query })}
          </Typography>
          <Typography variant="body2" color="text.disabled" mt={1}>
            {t('search.noResultsHint')}
          </Typography>
        </Box>
      )}

      {results.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('search.foundResults', {
              count: totalResults,
              query,
            })}
            {useSemantic ? t('search.semanticSuffix') : ''}
          </Typography>

          <Grid container spacing={2}>
            {results.map((result) => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={`${result.type}-${result.id}`}>
                <MoviePoster
                  title={result.title}
                  year={result.year}
                  posterUrl={result.poster_url}
                  rating={result.community_rating}
                  genres={result.genres}
                  overview={result.overview}
                  userRating={getRating(result.type, result.id)}
                  onRate={(rating) => handleRate(result.id, result.type, rating)}
                  isWatching={result.type === 'series' ? isWatching(result.id) : undefined}
                  onWatchingToggle={result.type === 'series' ? () => toggleWatching(result.id) : undefined}
                  hideWatchingToggle={result.type !== 'series'}
                  responsive
                  onClick={() => navigate(`/${result.type === 'movie' ? 'movies' : 'series'}/${result.id}`)}
                />
              </Grid>
            ))}
          </Grid>

          {totalResults > pageSize && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={Math.ceil(totalResults / pageSize)}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  )
}


