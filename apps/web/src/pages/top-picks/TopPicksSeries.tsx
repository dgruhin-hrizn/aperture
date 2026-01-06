import React, { useEffect, useState, useCallback } from 'react'
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
import TvIcon from '@mui/icons-material/Tv'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import PeopleIcon from '@mui/icons-material/People'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../../hooks/useUserRatings'

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
  timeWindowDays: number
  seriesCount: number
  minUniqueViewers: number
  lastRefreshedAt: string | null
}

export function TopPicksSeriesPage() {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const [series, setSeries] = useState<PopularSeries[]>([])
  const [config, setConfig] = useState<TopPicksConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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
    const fetchTopSeries = async () => {
      try {
        const response = await fetch('/api/top-picks/series', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setSeries(data.series)
          setConfig(data.config)
          setError(null)
        } else {
          setError('Failed to load trending series')
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchTopSeries()
  }, [])

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700' // Gold
    if (rank === 2) return '#C0C0C0' // Silver
    if (rank === 3) return '#CD7F32' // Bronze
    return '#8b5cf6' // Secondary (purple for series)
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 4 }} />
        <Grid container spacing={2}>
          {[...Array(10)].map((_, i) => (
            <Grid item key={i}>
              <Skeleton variant="rectangular" width={154} height={231} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <TvIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              Top Series
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Most popular TV series on your server
            {config && ` in the last ${config.timeWindowDays} days`}
          </Typography>
          {config?.lastRefreshedAt && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              Last updated: {new Date(config.lastRefreshedAt).toLocaleDateString()}
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

      {series.length === 0 && !error ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No trending series yet. Top picks are calculated from watch history across all users.
          Make sure TV series watch history sync has run and multiple users have watched some episodes.
        </Alert>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {series.map((show) => (
            <Grid item key={show.seriesId}>
              <Box position="relative">
                <MoviePoster
                  title={show.title}
                  year={show.year}
                  posterUrl={show.posterUrl}
                  genres={show.genres}
                  rating={show.communityRating}
                  overview={show.overview}
                  userRating={getRating('series', show.seriesId)}
                  onRate={(rating) => handleRate(show.seriesId, rating)}
                  size="medium"
                  onClick={() => navigate(`/series/${show.seriesId}`)}
                />
                {/* Rank badge */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: getRankColor(show.rank),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: show.rank <= 3 ? '#000' : '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {show.rank}
                </Box>
                {/* Viewers badge */}
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
                {/* Network badge */}
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
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {series.map((show) => (
            <Card
              key={show.seriesId}
              sx={{
                backgroundColor: 'background.paper',
                borderRadius: 2,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardContent sx={{ display: 'flex', gap: 3, p: 2 }}>
                {/* Rank */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: getRankColor(show.rank),
                    color: show.rank <= 3 ? '#000' : '#fff',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  {show.rank}
                </Box>

                {/* Poster */}
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

                {/* Info */}
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
      )}
    </Box>
  )
}


