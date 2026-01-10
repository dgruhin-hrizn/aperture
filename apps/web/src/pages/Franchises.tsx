import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
  Avatar,
  AvatarGroup,
  Collapse,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import MovieIcon from '@mui/icons-material/Movie'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'

interface FranchiseMovie {
  id: string
  title: string
  year: number | null
  posterUrl: string | null
  rating: number | null
  rtScore: number | null
  watched: boolean
}

interface Franchise {
  name: string
  movies: FranchiseMovie[]
  totalMovies: number
  watchedMovies: number
  progress: number
}

type SortOption = 'name' | 'total' | 'progress' | 'unwatched'

export function FranchisesPage() {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const [franchises, setFranchises] = useState<Franchise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedFranchises, setExpandedFranchises] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('total')
  const [showCompleted, setShowCompleted] = useState(true)

  useEffect(() => {
    const fetchFranchises = async () => {
      try {
        const response = await fetch('/api/movies/franchises', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setFranchises(data.franchises)
          setError(null)
        } else {
          setError('Failed to load franchises')
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }
    fetchFranchises()
  }, [])

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

  const toggleExpanded = (name: string) => {
    setExpandedFranchises((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  // Filter and sort franchises
  const filteredFranchises = franchises
    .filter((f) => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      if (!showCompleted && f.progress === 100) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'total':
          return b.totalMovies - a.totalMovies
        case 'progress':
          return b.progress - a.progress
        case 'unwatched':
          return (b.totalMovies - b.watchedMovies) - (a.totalMovies - a.watchedMovies)
        default:
          return 0
      }
    })

  // Stats
  const totalFranchises = franchises.length
  const completedFranchises = franchises.filter((f) => f.progress === 100).length
  const totalMovies = franchises.reduce((sum, f) => sum + f.totalMovies, 0)
  const watchedMovies = franchises.reduce((sum, f) => sum + f.watchedMovies, 0)

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Franchise Tracker
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Track your progress through movie franchises and collections
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="primary" fontWeight={700}>
                {totalFranchises}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Franchises
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="success.main" fontWeight={700}>
                {completedFranchises}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700}>
                {totalMovies}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Movies
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700}>
                {totalMovies > 0 ? Math.round((watchedMovies / totalMovies) * 100) : 0}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Overall Progress
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Box display="flex" gap={2} mb={4} flexWrap="wrap" alignItems="center">
        <TextField
          placeholder="Search franchises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
          <InputLabel>Sort By</InputLabel>
          <Select
            value={sortBy}
            label="Sort By"
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <MenuItem value="total">Most Movies</MenuItem>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="progress">Progress</MenuItem>
            <MenuItem value="unwatched">Most Unwatched</MenuItem>
          </Select>
        </FormControl>

        <Chip
          icon={showCompleted ? <CheckCircleIcon /> : <VisibilityOffIcon />}
          label={showCompleted ? 'Showing Completed' : 'Hiding Completed'}
          onClick={() => setShowCompleted(!showCompleted)}
          color={showCompleted ? 'default' : 'primary'}
          variant={showCompleted ? 'outlined' : 'filled'}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {filteredFranchises.length === 0 ? (
        <Box textAlign="center" py={8}>
          <MovieIcon sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {search ? 'No franchises match your search' : 'No franchises found'}
          </Typography>
          <Typography variant="body2" color="text.disabled" mt={1}>
            {!search && 'Run the metadata enrichment job to discover franchises in your library'}
          </Typography>
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {filteredFranchises.map((franchise) => (
            <Card key={franchise.name}>
              <CardContent sx={{ pb: 1 }}>
                <Box
                  display="flex"
                  alignItems="center"
                  gap={2}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => toggleExpanded(franchise.name)}
                >
                  <AvatarGroup max={4} sx={{ flexShrink: 0 }}>
                    {franchise.movies.slice(0, 4).map((movie) => (
                      <Avatar
                        key={movie.id}
                        src={movie.posterUrl || undefined}
                        variant="rounded"
                        sx={{ width: 40, height: 60 }}
                      >
                        <MovieIcon />
                      </Avatar>
                    ))}
                  </AvatarGroup>

                  <Box flex={1} minWidth={0}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="h6" fontWeight={600} noWrap>
                        {franchise.name}
                      </Typography>
                      {franchise.progress === 100 && (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Complete"
                          color="success"
                          size="small"
                        />
                      )}
                    </Box>

                    <Box display="flex" alignItems="center" gap={2}>
                      <Typography variant="body2" color="text.secondary">
                        {franchise.watchedMovies} / {franchise.totalMovies} movies watched
                      </Typography>
                      <Chip
                        label={`${franchise.progress}%`}
                        size="small"
                        color={franchise.progress === 100 ? 'success' : franchise.progress > 50 ? 'primary' : 'default'}
                      />
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={franchise.progress}
                      sx={{
                        mt: 1,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'action.hover',
                      }}
                      color={franchise.progress === 100 ? 'success' : 'primary'}
                    />
                  </Box>

                  <IconButton>
                    {expandedFranchises.has(franchise.name) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
              </CardContent>

              <Collapse in={expandedFranchises.has(franchise.name)}>
                <CardContent sx={{ pt: 0 }}>
                  <Grid container spacing={2} mt={1}>
                    {franchise.movies.map((movie) => (
                      <Grid item key={movie.id}>
                        <Box position="relative">
                          <MoviePoster
                            title={movie.title}
                            year={movie.year}
                            posterUrl={movie.posterUrl}
                            rating={movie.rating}
                            userRating={getRating('movie', movie.id)}
                            onRate={(rating) => handleRate(movie.id, rating)}
                            size="small"
                            onClick={() => navigate(`/movies/${movie.id}`)}
                          />
                          {movie.watched && (
                            <Tooltip title="Watched">
                              <CheckCircleIcon
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  color: 'success.main',
                                  bgcolor: 'background.paper',
                                  borderRadius: '50%',
                                }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Collapse>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  )
}


