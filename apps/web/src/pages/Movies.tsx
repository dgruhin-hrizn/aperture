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

interface Movie {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
}

interface Collection {
  name: string
  count: number
}

export function MoviesPage() {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const [movies, setMovies] = useState<Movie[]>([])
  const [genres, setGenres] = useState<string[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('')
  const [collection, setCollection] = useState('')
  const [minRtScore, setMinRtScore] = useState<number>(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 24

  const handleRate = useCallback(
    async (movieId: string, rating: number | null) => {
      try {
        await setRating('movie', movieId, rating)
      } catch (err) {
        console.error('Failed to rate movie:', err)
      }
    },
    [setRating]
  )

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [genresRes, collectionsRes] = await Promise.all([
          fetch('/api/movies/genres', { credentials: 'include' }),
          fetch('/api/movies/collections', { credentials: 'include' }),
        ])
        if (genresRes.ok) {
          const data = await genresRes.json()
          setGenres(data.genres)
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

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        })
        if (search) params.set('search', search)
        if (genre) params.set('genre', genre)
        if (collection) params.set('collection', collection)
        if (minRtScore > 0) params.set('minRtScore', String(minRtScore))

        const response = await fetch(`/api/movies?${params}`, { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setMovies(data.movies)
          setTotalPages(Math.ceil(data.total / pageSize))
          setError(null)
        } else {
          setError('Failed to load movies')
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(fetchMovies, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [page, search, genre, collection, minRtScore])

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Movies
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Browse your synced movie library
      </Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={4} flexWrap="wrap" alignItems="center">
        <TextField
          placeholder="Search movies..."
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

        {collections.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Franchise</InputLabel>
            <Select
              value={collection}
              label="Franchise"
              onChange={(e) => {
                setCollection(e.target.value)
                setPage(1)
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
        {(genre || collection || minRtScore > 0) && (
          <Box display="flex" gap={0.5} alignItems="center">
            {genre && (
              <Chip
                label={genre}
                size="small"
                onDelete={() => { setGenre(''); setPage(1) }}
              />
            )}
            {collection && (
              <Chip
                label={collection}
                size="small"
                onDelete={() => { setCollection(''); setPage(1) }}
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
      ) : movies.length === 0 ? (
        <Typography color="text.secondary">
          {search || genre || collection || minRtScore > 0
            ? 'No movies match your filters.'
            : 'No movies found. Run the movie sync job to import your library.'}
        </Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {movies.map((movie) => (
              <Grid item key={movie.id}>
                <MoviePoster
                  title={movie.title}
                  year={movie.year}
                  posterUrl={movie.poster_url}
                  rating={movie.community_rating}
                  genres={movie.genres}
                  overview={movie.overview}
                  userRating={getRating('movie', movie.id)}
                  onRate={(rating) => handleRate(movie.id, rating)}
                  size="medium"
                  onClick={() => navigate(`/movies/${movie.id}`)}
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

