import React, { useEffect, useState, useCallback } from 'react'
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
  Pagination,
  Alert,
  Slider,
  Chip,
  Tabs,
  Tab,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'
import { useWatching } from '../hooks/useWatching'

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

export function BrowsePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  
  const initialTab = searchParams.get('tab') === 'series' ? 1 : 0
  const [tabIndex, setTabIndex] = useState(initialTab)
  
  // Movies state
  const [movies, setMovies] = useState<Movie[]>([])
  const [movieGenres, setMovieGenres] = useState<string[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [moviesLoading, setMoviesLoading] = useState(true)
  const [moviesError, setMoviesError] = useState<string | null>(null)
  const [movieSearch, setMovieSearch] = useState('')
  const [movieGenre, setMovieGenre] = useState('')
  const [collection, setCollection] = useState('')
  const [movieMinRtScore, setMovieMinRtScore] = useState<number>(0)
  const [moviePage, setMoviePage] = useState(1)
  const [movieTotalPages, setMovieTotalPages] = useState(1)
  
  // Series state
  const [series, setSeries] = useState<Series[]>([])
  const [seriesGenres, setSeriesGenres] = useState<string[]>([])
  const [networks, setNetworks] = useState<string[]>([])
  const [seriesLoading, setSeriesLoading] = useState(true)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  const [seriesSearch, setSeriesSearch] = useState('')
  const [seriesGenre, setSeriesGenre] = useState('')
  const [network, setNetwork] = useState('')
  const [seriesMinRtScore, setSeriesMinRtScore] = useState<number>(0)
  const [seriesPage, setSeriesPage] = useState(1)
  const [seriesTotalPages, setSeriesTotalPages] = useState(1)
  
  const pageSize = 24

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

  // Fetch movie filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [genresRes, collectionsRes] = await Promise.all([
          fetch('/api/movies/genres', { credentials: 'include' }),
          fetch('/api/movies/collections', { credentials: 'include' }),
        ])
        if (genresRes.ok) {
          const data = await genresRes.json()
          setMovieGenres(data.genres)
        }
        if (collectionsRes.ok) {
          const data = await collectionsRes.json()
          setCollections(data.collections)
        }
      } catch {
        // Ignore filter fetch errors
      }
    }
    fetchFilters()
  }, [])

  // Fetch series filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [genresRes, networksRes] = await Promise.all([
          fetch('/api/series/genres', { credentials: 'include' }),
          fetch('/api/series/networks', { credentials: 'include' }),
        ])
        if (genresRes.ok) {
          const data = await genresRes.json()
          setSeriesGenres(data.genres)
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

  // Fetch movies
  useEffect(() => {
    const fetchMovies = async () => {
      setMoviesLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(moviePage),
          pageSize: String(pageSize),
        })
        if (movieSearch) params.set('search', movieSearch)
        if (movieGenre) params.set('genre', movieGenre)
        if (collection) params.set('collection', collection)
        if (movieMinRtScore > 0) params.set('minRtScore', String(movieMinRtScore))

        const response = await fetch(`/api/movies?${params}`, { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setMovies(data.movies)
          setMovieTotalPages(Math.ceil(data.total / pageSize))
          setMoviesError(null)
        } else {
          setMoviesError('Failed to load movies')
        }
      } catch {
        setMoviesError('Could not connect to server')
      } finally {
        setMoviesLoading(false)
      }
    }

    const debounce = setTimeout(fetchMovies, movieSearch ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [moviePage, movieSearch, movieGenre, collection, movieMinRtScore])

  // Fetch series
  useEffect(() => {
    const fetchSeries = async () => {
      setSeriesLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(seriesPage),
          pageSize: String(pageSize),
        })
        if (seriesSearch) params.set('search', seriesSearch)
        if (seriesGenre) params.set('genre', seriesGenre)
        if (network) params.set('network', network)
        if (seriesMinRtScore > 0) params.set('minRtScore', String(seriesMinRtScore))

        const response = await fetch(`/api/series?${params}`, { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setSeries(data.series)
          setSeriesTotalPages(Math.ceil(data.total / pageSize))
          setSeriesError(null)
        } else {
          setSeriesError('Failed to load series')
        }
      } catch {
        setSeriesError('Could not connect to server')
      } finally {
        setSeriesLoading(false)
      }
    }

    const debounce = setTimeout(fetchSeries, seriesSearch ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [seriesPage, seriesSearch, seriesGenre, network, seriesMinRtScore])

  const renderMoviesTab = () => (
    <>
      {/* Movie Filters */}
      <Box display="flex" gap={2} mb={4} flexWrap="wrap" alignItems="center">
        <TextField
          placeholder="Search movies..."
          value={movieSearch}
          onChange={(e) => {
            setMovieSearch(e.target.value)
            setMoviePage(1)
          }}
          size="small"
          sx={{ width: { xs: '100%', sm: 250 } }}
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
            value={movieGenre}
            label="Genre"
            onChange={(e) => {
              setMovieGenre(e.target.value)
              setMoviePage(1)
            }}
          >
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
              onChange={(e) => {
                setCollection(e.target.value)
                setMoviePage(1)
              }}
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

        <Box sx={{ width: { xs: '100%', sm: 180 }, px: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Min RT Score: {movieMinRtScore > 0 ? `${movieMinRtScore}%` : 'Any'}
          </Typography>
          <Slider
            value={movieMinRtScore}
            onChange={(_, value) => {
              setMovieMinRtScore(value as number)
              setMoviePage(1)
            }}
            min={0}
            max={100}
            step={10}
            size="small"
            sx={{ mt: -0.5 }}
          />
        </Box>

        {(movieGenre || collection || movieMinRtScore > 0) && (
          <Box display="flex" gap={0.5} alignItems="center">
            {movieGenre && (
              <Chip
                label={movieGenre}
                size="small"
                onDelete={() => { setMovieGenre(''); setMoviePage(1) }}
              />
            )}
            {collection && (
              <Chip
                label={collection}
                size="small"
                onDelete={() => { setCollection(''); setMoviePage(1) }}
              />
            )}
            {movieMinRtScore > 0 && (
              <Chip
                label={`RT ${movieMinRtScore}%+`}
                size="small"
                onDelete={() => { setMovieMinRtScore(0); setMoviePage(1) }}
              />
            )}
          </Box>
        )}
      </Box>

      {moviesError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {moviesError}
        </Alert>
      )}

      {moviesLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
              <MoviePoster title="" loading responsive />
            </Grid>
          ))}
        </Grid>
      ) : movies.length === 0 ? (
        <Typography color="text.secondary">
          {movieSearch || movieGenre || collection || movieMinRtScore > 0
            ? 'No movies match your filters.'
            : 'No movies found. Run the movie sync job to import your library.'}
        </Typography>
      ) : (
        <>
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

          {movieTotalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={movieTotalPages}
                page={moviePage}
                onChange={(_, value) => setMoviePage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </>
  )

  const renderSeriesTab = () => (
    <>
      {/* Series Filters */}
      <Box display="flex" gap={2} mb={4} flexWrap="wrap" alignItems="center">
        <TextField
          placeholder="Search series..."
          value={seriesSearch}
          onChange={(e) => {
            setSeriesSearch(e.target.value)
            setSeriesPage(1)
          }}
          size="small"
          sx={{ width: { xs: '100%', sm: 250 } }}
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
            onChange={(e) => {
              setSeriesGenre(e.target.value)
              setSeriesPage(1)
            }}
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
          <Select
            value={network}
            label="Network"
            onChange={(e) => {
              setNetwork(e.target.value)
              setSeriesPage(1)
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

        <Box sx={{ width: { xs: '100%', sm: 180 }, px: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Min RT Score: {seriesMinRtScore > 0 ? `${seriesMinRtScore}%` : 'Any'}
          </Typography>
          <Slider
            value={seriesMinRtScore}
            onChange={(_, value) => {
              setSeriesMinRtScore(value as number)
              setSeriesPage(1)
            }}
            min={0}
            max={100}
            step={10}
            size="small"
            sx={{ mt: -0.5 }}
          />
        </Box>

        {(seriesGenre || network || seriesMinRtScore > 0) && (
          <Box display="flex" gap={0.5} alignItems="center">
            {seriesGenre && (
              <Chip
                label={seriesGenre}
                size="small"
                onDelete={() => { setSeriesGenre(''); setSeriesPage(1) }}
              />
            )}
            {network && (
              <Chip
                label={network}
                size="small"
                onDelete={() => { setNetwork(''); setSeriesPage(1) }}
              />
            )}
            {seriesMinRtScore > 0 && (
              <Chip
                label={`RT ${seriesMinRtScore}%+`}
                size="small"
                onDelete={() => { setSeriesMinRtScore(0); setSeriesPage(1) }}
              />
            )}
          </Box>
        )}
      </Box>

      {seriesError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {seriesError}
        </Alert>
      )}

      {seriesLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
              <MoviePoster title="" loading responsive />
            </Grid>
          ))}
        </Grid>
      ) : series.length === 0 ? (
        <Typography color="text.secondary">
          {seriesSearch || seriesGenre || network || seriesMinRtScore > 0
            ? 'No series match your filters.'
            : 'No series found. Run the series sync job to import your library.'}
        </Typography>
      ) : (
        <>
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

          {seriesTotalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={seriesTotalPages}
                page={seriesPage}
                onChange={(_, value) => setSeriesPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </>
  )

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <VideoLibraryIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>
            Browse
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Browse your synced media library
        </Typography>
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
