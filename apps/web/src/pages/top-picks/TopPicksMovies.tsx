import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
} from '@mui/material'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import PeopleIcon from '@mui/icons-material/People'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { MoviePoster, RankBadge, getRankStyle, getRankTextColor } from '@aperture/ui'
import { useUserRatings } from '../../hooks/useUserRatings'

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

interface TopPicksConfig {
  timeWindowDays: number
  moviesCount: number
  minUniqueViewers: number
  lastRefreshedAt: string | null
}

export function TopPicksMoviesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const [movies, setMovies] = useState<PopularMovie[]>([])
  const [config, setConfig] = useState<TopPicksConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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
    const fetchTopMovies = async () => {
      try {
        const response = await fetch('/api/top-picks/movies', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setMovies(data.movies)
          setConfig(data.config)
          setError(null)
        } else {
          setError(t('topPicksPage.errorLoadMovies'))
        }
      } catch {
        setError(t('topPicksPage.errorConnect'))
      } finally {
        setLoading(false)
      }
    }

    fetchTopMovies()
  }, [t])

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 4 }} />
        <Grid container spacing={2}>
          {[...Array(10)].map((_, i) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
              <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '2/3', borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4} flexWrap="wrap" gap={2}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <WhatshotIcon sx={{ color: '#f97316', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              {t('topPicksPage.pageTitleMovies')}
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {t('topPicksPage.subtitleMovies')}
            {config && t('topPicksPage.inLastDays', { count: config.timeWindowDays })}
          </Typography>
          {config?.lastRefreshedAt && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              {t('topPicksPage.lastUpdated', {
                date: new Date(config.lastRefreshedAt).toLocaleDateString(),
              })}
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

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {movies.length === 0 && !error ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {t('topPicksPage.emptyMovies')}
        </Alert>
      ) : viewMode === 'grid' ? (
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
                  onRate={(rating) => handleRate(movie.movieId, rating)}
                  responsive
                  onClick={() => navigate(`/movies/${movie.movieId}`)}
                />
                <RankBadge rank={movie.rank} size="large" />
                {/* Viewers badge */}
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
      ) : (
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
                {/* Rank */}
                <RankBadge rank={movie.rank} size="xlarge" absolute={false} />

                {/* Poster */}
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

                {/* Info */}
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
                    {movie.overview || t('common.noDescription')}
                  </Typography>
                </Box>

                {/* Stats */}
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
                    label={t('topPicksPage.viewersCount', { count: movie.uniqueViewers })}
                    size="small"
                    sx={{ backgroundColor: 'rgba(99, 102, 241, 0.2)' }}
                  />
                  <Chip
                    icon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                    label={movie.playCount <= 10 ? t('topPicksPage.playsCount', { count: movie.playCount }) : t('topPicksPage.playsPlus')}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  )
}

