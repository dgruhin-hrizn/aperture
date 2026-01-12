import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  Skeleton,
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

interface FranchiseStats {
  totalFranchises: number
  completedFranchises: number
  totalMovies: number
  watchedMovies: number
}

type SortOption = 'name' | 'total' | 'progress' | 'unwatched'

const PAGE_SIZE = 20

export function FranchisesPage() {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const [franchises, setFranchises] = useState<Franchise[]>([])
  const [stats, setStats] = useState<FranchiseStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedFranchises, setExpandedFranchises] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('total')
  const [showCompleted, setShowCompleted] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const loaderRef = useRef<HTMLDivElement>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1)
    setFranchises([])
    setHasMore(true)
  }, [debouncedSearch, sortBy, showCompleted])

  // Fetch franchises
  const fetchFranchises = useCallback(async (pageNum: number, append: boolean = false) => {
    if (pageNum === 1) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        pageSize: PAGE_SIZE.toString(),
        sortBy,
        showCompleted: showCompleted.toString(),
      })
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }

      const response = await fetch(`/api/movies/franchises?${params}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setFranchises(prev => append ? [...prev, ...data.franchises] : data.franchises)
        setStats(data.stats)
        setTotal(data.total)
        setHasMore(pageNum * PAGE_SIZE < data.total)
        setError(null)
      } else {
        setError('Failed to load franchises')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [debouncedSearch, sortBy, showCompleted])

  // Initial fetch and refetch on filter change
  useEffect(() => {
    fetchFranchises(1, false)
  }, [fetchFranchises])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchFranchises(nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, page, fetchFranchises])

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

  const StatCard = ({ value, label, color }: { value: React.ReactNode; label: string; color?: string }) => (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="h4" color={color} fontWeight={700}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  )

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
          <StatCard
            value={stats ? stats.totalFranchises : <Skeleton width={40} sx={{ mx: 'auto' }} />}
            label="Franchises"
            color="primary"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            value={stats ? stats.completedFranchises : <Skeleton width={40} sx={{ mx: 'auto' }} />}
            label="Completed"
            color="success.main"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            value={stats ? stats.totalMovies : <Skeleton width={40} sx={{ mx: 'auto' }} />}
            label="Total Movies"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            value={stats ? `${stats.totalMovies > 0 ? Math.round((stats.watchedMovies / stats.totalMovies) * 100) : 0}%` : <Skeleton width={40} sx={{ mx: 'auto' }} />}
            label="Overall Progress"
          />
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

      {loading ? (
        <Box display="flex" flexDirection="column" gap={2}>
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent sx={{ pb: 1 }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box display="flex" gap={0.5}>
                    {[...Array(4)].map((_, j) => (
                      <Skeleton key={j} variant="rounded" width={40} height={60} />
                    ))}
                  </Box>
                  <Box flex={1}>
                    <Skeleton width="40%" height={32} />
                    <Skeleton width="30%" height={20} sx={{ mt: 0.5 }} />
                    <Skeleton height={6} sx={{ mt: 1, borderRadius: 3 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : franchises.length === 0 ? (
        <Box textAlign="center" py={8}>
          <MovieIcon sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {debouncedSearch ? 'No franchises match your search' : 'No franchises found'}
          </Typography>
          <Typography variant="body2" color="text.disabled" mt={1}>
            {!debouncedSearch && 'Run the metadata enrichment job to discover franchises in your library'}
          </Typography>
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {/* Results count */}
          <Typography variant="body2" color="text.secondary">
            Showing {franchises.length} of {total} franchises
          </Typography>

          {franchises.map((franchise) => (
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
                      <Grid item xs={4} sm={3} md={2} lg={1.5} key={movie.id}>
                        <Box position="relative">
                          <MoviePoster
                            title={movie.title}
                            year={movie.year}
                            posterUrl={movie.posterUrl}
                            rating={movie.rating}
                            userRating={getRating('movie', movie.id)}
                            onRate={(rating) => handleRate(movie.id, rating)}
                            responsive
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

          {/* Infinite scroll loader */}
          <Box ref={loaderRef} display="flex" justifyContent="center" py={2}>
            {loadingMore && <CircularProgress size={32} />}
            {!hasMore && franchises.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                All franchises loaded
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}


