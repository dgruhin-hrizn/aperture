import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Skeleton,
  Alert,
  Chip,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
} from '@mui/material'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import PeopleIcon from '@mui/icons-material/People'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { MoviePoster, RankBadge } from '@aperture/ui'
import { useUserRatings } from '../../hooks/useUserRatings'
import { useWatching } from '../../hooks/useWatching'

interface PopularMovie {
  movieId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  uniqueViewers: number
  playCount: number
  popularityScore: number
  rank: number
}

interface PopularSeries {
  seriesId: string
  title: string
  year: number | null
  posterUrl: string | null
  backdropUrl: string | null
  overview: string | null
  genres: string[]
  communityRating: number | null
  network: string | null
  uniqueViewers: number
  totalEpisodesWatched: number
  avgCompletionRate: number
  popularityScore: number
  rank: number
}

interface TopPicksConfig {
  moviesTimeWindowDays: number
  seriesTimeWindowDays: number
  moviesCount: number
  seriesCount: number
  moviesMinUniqueViewers: number
  seriesMinUniqueViewers: number
  lastRefreshedAt: string | null
}

export function TopPicksPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  
  const initialTab = searchParams.get('tab') === 'series' ? 1 : 0
  const [tabIndex, setTabIndex] = useState(initialTab)
  const [movies, setMovies] = useState<PopularMovie[]>([])
  const [series, setSeries] = useState<PopularSeries[]>([])
  const [moviesConfig, setMoviesConfig] = useState<TopPicksConfig | null>(null)
  const [seriesConfig, setSeriesConfig] = useState<TopPicksConfig | null>(null)
  const [moviesLoading, setMoviesLoading] = useState(true)
  const [seriesLoading, setSeriesLoading] = useState(true)
  const [moviesError, setMoviesError] = useState<string | null>(null)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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

  useEffect(() => {
    const fetchTopMovies = async () => {
      try {
        const response = await fetch('/api/top-picks/movies', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setMovies(data.movies)
          setMoviesConfig(data.config)
          setMoviesError(null)
        } else {
          setMoviesError('Failed to load trending movies')
        }
      } catch {
        setMoviesError('Could not connect to server')
      } finally {
        setMoviesLoading(false)
      }
    }

    const fetchTopSeries = async () => {
      try {
        const response = await fetch('/api/top-picks/series', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setSeries(data.series)
          setSeriesConfig(data.config)
          setSeriesError(null)
        } else {
          setSeriesError('Failed to load trending series')
        }
      } catch {
        setSeriesError('Could not connect to server')
      } finally {
        setSeriesLoading(false)
      }
    }

    fetchTopMovies()
    fetchTopSeries()
  }, [])

  const config = tabIndex === 0 ? moviesConfig : seriesConfig
  const loading = tabIndex === 0 ? moviesLoading : seriesLoading
  const error = tabIndex === 0 ? moviesError : seriesError

  const renderLoadingSkeleton = () => (
    <Grid container spacing={2}>
      {[...Array(10)].map((_, i) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
          <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '2/3', borderRadius: 1 }} />
        </Grid>
      ))}
    </Grid>
  )

  const renderMoviesGrid = () => (
    <Grid container spacing={2}>
      {movies.map((movie) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={movie.movieId}>
          <Box position="relative">
            <MoviePoster
              title={movie.title}
              year={movie.year}
              posterUrl={movie.posterUrl}
              genres={movie.genres}
              rating={movie.communityRating}
              overview={movie.overview}
              userRating={getRating('movie', movie.movieId)}
              onRate={(rating) => handleRateMovie(movie.movieId, rating)}
              responsive
              onClick={() => navigate(`/movies/${movie.movieId}`)}
            />
            <RankBadge rank={movie.rank} size="large" />
            <Chip
              icon={<PeopleIcon sx={{ fontSize: 14 }} />}
              label={movie.uniqueViewers}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.75)',
                color: 'white',
                fontSize: '0.7rem',
                height: 24,
                '& .MuiChip-icon': { color: 'white' },
              }}
            />
          </Box>
        </Grid>
      ))}
    </Grid>
  )

  const renderMoviesList = () => (
    <Box display="flex" flexDirection="column" gap={2}>
      {movies.map((movie) => (
        <Card
          key={movie.movieId}
          sx={{
            backgroundColor: 'background.paper',
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 4,
            },
          }}
          onClick={() => navigate(`/movies/${movie.movieId}`)}
        >
          <CardContent sx={{ display: 'flex', gap: 3, p: 2 }}>
            <RankBadge rank={movie.rank} size="xlarge" absolute={false} />
            <Box
              component="img"
              src={movie.posterUrl || undefined}
              alt={movie.title}
              sx={{
                width: 80,
                height: 120,
                objectFit: 'cover',
                borderRadius: 1,
                backgroundColor: 'grey.800',
                flexShrink: 0,
              }}
            />
            <Box flex={1} minWidth={0}>
              <Typography variant="h6" fontWeight={600} noWrap>
                {movie.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {movie.year} {movie.genres?.length > 0 && `• ${movie.genres.slice(0, 3).join(', ')}`}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {movie.overview || 'No description available.'}
              </Typography>
            </Box>
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="flex-end" 
              justifyContent="center"
              gap={1}
              flexShrink={0}
            >
              <Chip
                icon={<PeopleIcon sx={{ fontSize: 16 }} />}
                label={`${movie.uniqueViewers} viewers`}
                size="small"
                sx={{ backgroundColor: 'rgba(99, 102, 241, 0.2)' }}
              />
              <Chip
                icon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                label={movie.playCount <= 10 ? `${movie.playCount} plays` : '10+ plays'}
                size="small"
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  )

  const renderSeriesGrid = () => (
    <Grid container spacing={2}>
      {series.map((show) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={show.seriesId}>
          <Box position="relative">
            <MoviePoster
              title={show.title}
              year={show.year}
              posterUrl={show.posterUrl}
              genres={show.genres}
              rating={show.communityRating}
              overview={show.overview}
              userRating={getRating('series', show.seriesId)}
              onRate={(rating) => handleRateSeries(show.seriesId, rating)}
              responsive
              isWatching={isWatching(show.seriesId)}
              onWatchingToggle={() => toggleWatching(show.seriesId)}
              size="medium"
              onClick={() => navigate(`/series/${show.seriesId}`)}
            />
            <RankBadge rank={show.rank} size="large" />
            <Chip
              icon={<PeopleIcon sx={{ fontSize: 14 }} />}
              label={show.uniqueViewers}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.75)',
                color: 'white',
                fontSize: '0.7rem',
                height: 24,
                '& .MuiChip-icon': { color: 'white' },
              }}
            />
            {show.network && (
              <Chip
                label={show.network}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'rgba(139, 92, 246, 0.9)',
                  color: 'white',
                  fontSize: '0.65rem',
                  height: 20,
                  maxWidth: 80,
                  '& .MuiChip-label': { 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />
            )}
          </Box>
        </Grid>
      ))}
    </Grid>
  )

  const renderSeriesList = () => (
    <Box display="flex" flexDirection="column" gap={2}>
      {series.map((show) => (
        <Card
          key={show.seriesId}
          sx={{
            backgroundColor: 'background.paper',
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 4,
            },
          }}
          onClick={() => navigate(`/series/${show.seriesId}`)}
        >
          <CardContent sx={{ display: 'flex', gap: 3, p: 2 }}>
            <RankBadge rank={show.rank} size="xlarge" absolute={false} />
            <Box
              component="img"
              src={show.posterUrl || undefined}
              alt={show.title}
              sx={{
                width: 80,
                height: 120,
                objectFit: 'cover',
                borderRadius: 1,
                backgroundColor: 'grey.800',
                flexShrink: 0,
              }}
            />
            <Box flex={1} minWidth={0}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" fontWeight={600} noWrap>
                  {show.title}
                </Typography>
                {show.network && (
                  <Chip 
                    label={show.network} 
                    size="small" 
                    sx={{ 
                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                      fontSize: '0.7rem',
                      height: 22,
                    }} 
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {show.year} {show.genres?.length > 0 && `• ${show.genres.slice(0, 3).join(', ')}`}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {show.overview || 'No description available.'}
              </Typography>
            </Box>
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="flex-end" 
              justifyContent="center"
              gap={1}
              flexShrink={0}
            >
              <Chip
                icon={<PeopleIcon sx={{ fontSize: 16 }} />}
                label={`${show.uniqueViewers} viewers`}
                size="small"
                sx={{ backgroundColor: 'rgba(139, 92, 246, 0.2)' }}
              />
              <Chip
                icon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                label={`${show.totalEpisodesWatched} episodes`}
                size="small"
                variant="outlined"
              />
              {show.avgCompletionRate > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {Math.round(show.avgCompletionRate * 100)}% avg completion
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  )

  const renderContent = () => {
    if (loading) return renderLoadingSkeleton()

    if (error) {
      return (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )
    }

    if (tabIndex === 0) {
      if (movies.length === 0) {
        return (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No trending movies yet. Top picks are calculated from watch history across all users.
            Make sure watch history sync has run and multiple users have watched some content.
          </Alert>
        )
      }
      return viewMode === 'grid' ? renderMoviesGrid() : renderMoviesList()
    } else {
      if (series.length === 0) {
        return (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No trending series yet. Top picks are calculated from watch history across all users.
            Make sure TV series watch history sync has run and multiple users have watched some episodes.
          </Alert>
        )
      }
      return viewMode === 'grid' ? renderSeriesGrid() : renderSeriesList()
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <WhatshotIcon sx={{ color: '#f97316', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              Top Picks
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {config 
              ? `Ranked by popularity based on watch activity from all users over the last ${tabIndex === 0 ? config.moviesTimeWindowDays : config.seriesTimeWindowDays} days`
              : 'Ranked by popularity based on watch activity from all users'
            }
          </Typography>
          {config?.lastRefreshedAt && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              Last refreshed: {new Date(config.lastRefreshedAt).toLocaleDateString()}
            </Typography>
          )}
        </Box>
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

      {renderContent()}
    </Box>
  )
}
