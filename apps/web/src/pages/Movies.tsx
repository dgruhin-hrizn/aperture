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

export function MoviesPage() {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const [movies, setMovies] = useState<Movie[]>([])
  const [genres, setGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('')
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
    const fetchGenres = async () => {
      try {
        const response = await fetch('/api/movies/genres', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setGenres(data.genres)
        }
      } catch {
        // Ignore genre fetch errors
      }
    }
    fetchGenres()
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
  }, [page, search, genre])

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Movies
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Browse your synced movie library
      </Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={4} flexWrap="wrap">
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
          {search || genre
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

