import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Pagination,
  Skeleton,
  Alert,
  Slider,
  Chip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'
import { useWatching } from '../hooks/useWatching'

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

export function SeriesPage() {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  const [series, setSeries] = useState<Series[]>([])
  const [genres, setGenres] = useState<string[]>([])
  const [networks, setNetworks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('')
  const [network, setNetwork] = useState('')
  const [minRtScore, setMinRtScore] = useState<number>(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 24

  const handleRate = useCallback(
    async (seriesId: string, rating: number | null) => {
      try {
        await setRating('series', seriesId, rating)
      } catch (err) {
        console.error('Failed to rate series:', err)
      }
    },
    [setRating]
  )

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [genresRes, networksRes] = await Promise.all([
          fetch('/api/series/genres', { credentials: 'include' }),
          fetch('/api/series/networks', { credentials: 'include' }),
        ])
        if (genresRes.ok) {
          const data = await genresRes.json()
          setGenres(data.genres)
        }
        if (networksRes.ok) {
          const data = await networksRes.json()
          setNetworks(data.networks)
        }
      } catch {
        // Ignore filter fetch errors
      }
    }
    fetchFilters()
  }, [])

  useEffect(() => {
    const fetchSeries = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        })
        if (search) params.set('search', search)
        if (genre) params.set('genre', genre)
        if (network) params.set('network', network)
        if (minRtScore > 0) params.set('minRtScore', String(minRtScore))

        const response = await fetch(`/api/series?${params}`, { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setSeries(data.series)
          setTotalPages(Math.ceil(data.total / pageSize))
          setError(null)
        } else {
          setError('Failed to load series')
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(fetchSeries, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [page, search, genre, network, minRtScore])

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        TV Series
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Browse your synced TV series library
      </Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={4} flexWrap="wrap" alignItems="center">
        <TextField
          placeholder="Search series..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          size="small"
          sx={{ minWidth: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Genre</InputLabel>
          <Select
            value={genre}
            label="Genre"
            onChange={(e) => {
              setGenre(e.target.value)
              setPage(1)
            }}
          >
            <MenuItem value="">All Genres</MenuItem>
            {genres.map((g) => (
              <MenuItem key={g} value={g}>
                {g}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Network</InputLabel>
          <Select
            value={network}
            label="Network"
            onChange={(e) => {
              setNetwork(e.target.value)
              setPage(1)
            }}
          >
            <MenuItem value="">All Networks</MenuItem>
            {networks.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ minWidth: 180, px: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Min RT Score: {minRtScore > 0 ? `${minRtScore}%` : 'Any'}
          </Typography>
          <Slider
            value={minRtScore}
            onChange={(_, value) => {
              setMinRtScore(value as number)
              setPage(1)
            }}
            min={0}
            max={100}
            step={10}
            size="small"
            sx={{ mt: -0.5 }}
          />
        </Box>

        {/* Active filters display */}
        {(genre || network || minRtScore > 0) && (
          <Box display="flex" gap={0.5} alignItems="center">
            {genre && (
              <Chip
                label={genre}
                size="small"
                onDelete={() => { setGenre(''); setPage(1) }}
              />
            )}
            {network && (
              <Chip
                label={network}
                size="small"
                onDelete={() => { setNetwork(''); setPage(1) }}
              />
            )}
            {minRtScore > 0 && (
              <Chip
                label={`RT ${minRtScore}%+`}
                size="small"
                onDelete={() => { setMinRtScore(0); setPage(1) }}
              />
            )}
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Grid item key={i}>
              <MoviePoster title="" loading size="medium" />
            </Grid>
          ))}
        </Grid>
      ) : series.length === 0 ? (
        <Typography color="text.secondary">
          {search || genre || network || minRtScore > 0
            ? 'No series match your filters.'
            : 'No series found. Run the series sync job to import your library.'}
        </Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {series.map((show) => (
              <Grid item key={show.id}>
                <MoviePoster
                  title={show.title}
                  year={show.year}
                  posterUrl={show.poster_url}
                  rating={show.community_rating}
                  genres={show.genres}
                  overview={show.overview}
                  userRating={getRating('series', show.id)}
                  onRate={(rating) => handleRate(show.id, rating)}
                  isWatching={isWatching(show.id)}
                  onWatchingToggle={() => toggleWatching(show.id)}
                  size="medium"
                  onClick={() => navigate(`/series/${show.id}`)}
                />
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
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

