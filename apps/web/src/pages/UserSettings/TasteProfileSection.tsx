import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Chip,
  Grid,
  Tooltip,
  Alert,
} from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import RefreshIcon from '@mui/icons-material/Refresh'
import Markdown from 'react-markdown'
import { useAuth } from '@/hooks/useAuth'

interface TasteProfile {
  synopsis: string
  updatedAt: string
  stats: {
    totalWatched: number
    topGenres: string[]
    avgRating: number
    favoriteDecade: string | null
    recentFavorites: string[]
  }
}

interface SeriesTasteProfile {
  synopsis: string
  updatedAt: string
  stats: {
    totalSeriesStarted: number
    totalEpisodesWatched: number
    topGenres: string[]
    avgRating: number
    favoriteDecade: string | null
    favoriteNetworks: string[]
    recentFavorites: string[]
  }
}

export function TasteProfileSection() {
  const { user } = useAuth()
  const [movieTaste, setMovieTaste] = useState<TasteProfile | null>(null)
  const [seriesTaste, setSeriesTaste] = useState<SeriesTasteProfile | null>(null)
  const [loadingMovie, setLoadingMovie] = useState(true)
  const [loadingSeries, setLoadingSeries] = useState(true)
  const [regeneratingMovie, setRegeneratingMovie] = useState(false)
  const [regeneratingSeries, setRegeneratingSeries] = useState(false)
  const [movieSuccess, setMovieSuccess] = useState<string | null>(null)
  const [seriesSuccess, setSeriesSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      fetchMovieTaste()
      fetchSeriesTaste()
    }
  }, [user?.id])

  const fetchMovieTaste = async () => {
    setLoadingMovie(true)
    try {
      const response = await fetch(`/api/users/${user?.id}/taste-profile`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setMovieTaste(data)
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingMovie(false)
    }
  }

  const fetchSeriesTaste = async () => {
    setLoadingSeries(true)
    try {
      const response = await fetch(`/api/users/${user?.id}/series-taste-profile`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSeriesTaste(data)
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingSeries(false)
    }
  }

  const regenerateMovieTaste = async () => {
    setRegeneratingMovie(true)
    setMovieSuccess(null)
    try {
      const response = await fetch(`/api/users/${user?.id}/taste-profile/regenerate`, {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setMovieTaste(data)
        setMovieSuccess('Movie taste profile regenerated!')
        setTimeout(() => setMovieSuccess(null), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setRegeneratingMovie(false)
    }
  }

  const regenerateSeriesTaste = async () => {
    setRegeneratingSeries(true)
    setSeriesSuccess(null)
    try {
      const response = await fetch(`/api/users/${user?.id}/series-taste-profile/regenerate`, {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setSeriesTaste(data)
        setSeriesSuccess('TV taste profile regenerated!')
        setTimeout(() => setSeriesSuccess(null), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setRegeneratingSeries(false)
    }
  }

  const hasMovieHistory = (movieTaste?.stats?.totalWatched ?? 0) > 0
  const hasSeriesHistory = (seriesTaste?.stats?.totalSeriesStarted ?? 0) > 0

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Your AI-generated taste profiles are based on your watch history. They help personalize your recommendations.
      </Typography>

      <Grid container spacing={3}>
        {/* Movie Taste Profile */}
        <Grid item xs={12} lg={6}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MovieIcon sx={{ color: 'white', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Your Movie Taste
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      AI-powered film preferences
                    </Typography>
                  </Box>
                </Box>
                <Tooltip title="Regenerate movie taste profile">
                  <IconButton
                    onClick={regenerateMovieTaste}
                    disabled={regeneratingMovie || !hasMovieHistory}
                    size="small"
                    sx={{
                      bgcolor: 'action.hover',
                      '&:hover': { bgcolor: 'action.selected' },
                    }}
                  >
                    {regeneratingMovie ? (
                      <CircularProgress size={20} />
                    ) : (
                      <RefreshIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>

              {movieSuccess && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMovieSuccess(null)}>
                  {movieSuccess}
                </Alert>
              )}

              {loadingMovie ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress />
                </Box>
              ) : !hasMovieHistory ? (
                <Box
                  sx={{
                    py: 4,
                    textAlign: 'center',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Typography color="text.secondary">No movie watch history yet</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Start watching movies to generate your taste profile
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Synopsis */}
                  <Box
                    sx={{
                      mb: 3,
                      pl: 2,
                      borderLeft: '3px solid',
                      borderColor: 'primary.main',
                      '& p': {
                        margin: 0,
                        mb: 1.5,
                        lineHeight: 1.8,
                        color: 'text.primary',
                        '&:last-child': { mb: 0 },
                      },
                      '& strong': {
                        color: 'primary.main',
                        fontWeight: 600,
                      },
                    }}
                  >
                    <Markdown>{movieTaste?.synopsis || ''}</Markdown>
                  </Box>

                  {/* Top Genres */}
                  {movieTaste?.stats?.topGenres && movieTaste.stats.topGenres.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="text.secondary" mb={1}>
                        Your Top Genres
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {movieTaste.stats.topGenres.map((genre, index) => (
                          <Chip
                            key={genre}
                            label={genre}
                            size="small"
                            sx={{
                              bgcolor: index === 0 ? 'primary.main' : index === 1 ? 'secondary.main' : 'action.selected',
                              color: index < 2 ? 'white' : 'text.primary',
                              fontWeight: index < 2 ? 600 : 400,
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Stats */}
                  <Box
                    display="flex"
                    gap={3}
                    flexWrap="wrap"
                    sx={{
                      pt: 2,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {movieTaste?.stats?.favoriteDecade && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Favorite Era
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {movieTaste.stats.favoriteDecade}
                        </Typography>
                      </Box>
                    )}
                    {movieTaste?.stats?.avgRating && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Avg. Rating
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {movieTaste.stats.avgRating.toFixed(1)}/10
                        </Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Movies Watched
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {movieTaste?.stats?.totalWatched || 0}
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Series Taste Profile */}
        <Grid item xs={12} lg={6}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(244, 114, 182, 0.05) 100%)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TvIcon sx={{ color: 'white', fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Your TV Taste
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      AI-powered series preferences
                    </Typography>
                  </Box>
                </Box>
                <Tooltip title="Regenerate TV taste profile">
                  <IconButton
                    onClick={regenerateSeriesTaste}
                    disabled={regeneratingSeries || !hasSeriesHistory}
                    size="small"
                    sx={{
                      bgcolor: 'action.hover',
                      '&:hover': { bgcolor: 'action.selected' },
                    }}
                  >
                    {regeneratingSeries ? (
                      <CircularProgress size={20} />
                    ) : (
                      <RefreshIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>

              {seriesSuccess && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSeriesSuccess(null)}>
                  {seriesSuccess}
                </Alert>
              )}

              {loadingSeries ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress />
                </Box>
              ) : !hasSeriesHistory ? (
                <Box
                  sx={{
                    py: 4,
                    textAlign: 'center',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Typography color="text.secondary">No series watch history yet</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Start watching TV series to generate your taste profile
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Synopsis */}
                  <Box
                    sx={{
                      mb: 3,
                      pl: 2,
                      borderLeft: '3px solid',
                      borderColor: '#ec4899',
                      '& p': {
                        margin: 0,
                        mb: 1.5,
                        lineHeight: 1.8,
                        color: 'text.primary',
                        '&:last-child': { mb: 0 },
                      },
                      '& strong': {
                        color: '#ec4899',
                        fontWeight: 600,
                      },
                    }}
                  >
                    <Markdown>{seriesTaste?.synopsis || ''}</Markdown>
                  </Box>

                  {/* Top Genres */}
                  {seriesTaste?.stats?.topGenres && seriesTaste.stats.topGenres.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="text.secondary" mb={1}>
                        Your Top Genres
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {seriesTaste.stats.topGenres.map((genre, index) => (
                          <Chip
                            key={genre}
                            label={genre}
                            size="small"
                            sx={{
                              bgcolor: index === 0 ? '#ec4899' : index === 1 ? '#f472b6' : 'action.selected',
                              color: index < 2 ? 'white' : 'text.primary',
                              fontWeight: index < 2 ? 600 : 400,
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Favorite Networks */}
                  {seriesTaste?.stats?.favoriteNetworks && seriesTaste.stats.favoriteNetworks.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="text.secondary" mb={1}>
                        Favorite Networks
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {seriesTaste.stats.favoriteNetworks.map((network) => (
                          <Chip
                            key={network}
                            label={network}
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: '#ec4899', color: '#ec4899' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Stats */}
                  <Box
                    display="flex"
                    gap={3}
                    flexWrap="wrap"
                    sx={{
                      pt: 2,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {seriesTaste?.stats?.favoriteDecade && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Favorite Era
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {seriesTaste.stats.favoriteDecade}
                        </Typography>
                      </Box>
                    )}
                    {seriesTaste?.stats?.avgRating && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Avg. Rating
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {seriesTaste.stats.avgRating.toFixed(1)}/10
                        </Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Series / Episodes
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {seriesTaste?.stats?.totalSeriesStarted || 0} / {seriesTaste?.stats?.totalEpisodesWatched || 0}
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

