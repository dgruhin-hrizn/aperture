import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Skeleton,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Card,
  CardActionArea,
  CardContent,
  LinearProgress,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import RefreshIcon from '@mui/icons-material/Refresh'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import StarIcon from '@mui/icons-material/Star'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import CheckIcon from '@mui/icons-material/Check'
import { MoviePoster, RankBadge, getProxiedImageUrl, FALLBACK_POSTER_URL, HeartRating } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'
import { useUserRatings } from '@/hooks/useUserRatings'
import { useWatching } from '@/hooks/useWatching'
import { useViewMode } from '@/hooks/useViewMode'

interface MovieRecommendation {
  movie_id: string
  rank: number
  final_score: number
  similarity_score: number
  novelty_score: number
  rating_score: number
  diversity_score: number
  movie: {
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    overview: string | null
    community_rating: number | null
  }
}

interface SeriesRecommendation {
  series_id: string
  rank: number
  final_score: number
  similarity_score: number
  novelty_score: number
  rating_score: number
  diversity_score: number
  series: {
    id: string
    title: string
    year: number | null
    poster_url: string | null
    genres: string[]
    overview: string | null
    community_rating: number | null
  }
}

interface RunInfo {
  id: string
  created_at: string
  total_candidates: number
  selected_count: number
}

type MediaType = 'movies' | 'series'

export function MyRecommendationsPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { user } = useAuth()
  const { getRating, setRating } = useUserRatings()
  const { isWatching, toggleWatching } = useWatching()
  
  // Tab state
  const [mediaType, setMediaType] = useState<MediaType>('movies')

  const handleRate = useCallback(
    async (type: 'movie' | 'series', id: string, rating: number | null) => {
      try {
        await setRating(type, id, rating)
      } catch (err) {
        console.error('Failed to rate:', err)
      }
    },
    [setRating]
  )
  
  // Movie recommendations state
  const [movieRecommendations, setMovieRecommendations] = useState<MovieRecommendation[]>([])
  const [movieRunInfo, setMovieRunInfo] = useState<RunInfo | null>(null)
  const [movieLoading, setMovieLoading] = useState(true)
  const [movieError, setMovieError] = useState<string | null>(null)
  
  // Series recommendations state
  const [seriesRecommendations, setSeriesRecommendations] = useState<SeriesRecommendation[]>([])
  const [seriesRunInfo, setSeriesRunInfo] = useState<RunInfo | null>(null)
  const [seriesLoading, setSeriesLoading] = useState(true)
  const [seriesError, setSeriesError] = useState<string | null>(null)
  
  // Shared state
  const { viewMode, setViewMode } = useViewMode('recommendations')
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateMessage, setRegenerateMessage] = useState<string | null>(null)

  const fetchMovieRecommendations = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/recommendations/${user.id}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setMovieRecommendations(data.recommendations || [])
        setMovieRunInfo(data.run)
        setMovieError(null)
      } else {
        setMovieError('Failed to load movie recommendations')
      }
    } catch {
      setMovieError('Could not connect to server')
    } finally {
      setMovieLoading(false)
    }
  }

  const fetchSeriesRecommendations = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/recommendations/${user.id}/series`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSeriesRecommendations(data.recommendations || [])
        setSeriesRunInfo(data.run)
        setSeriesError(null)
      } else {
        setSeriesError('Failed to load series recommendations')
      }
    } catch {
      setSeriesError('Could not connect to server')
    } finally {
      setSeriesLoading(false)
    }
  }

  useEffect(() => {
    fetchMovieRecommendations()
    fetchSeriesRecommendations()
  }, [user])

  const handleRegenerate = async () => {
    if (!user || regenerating) return

    setRegenerating(true)
    setRegenerateMessage(null)

    const endpoint = mediaType === 'movies'
      ? `/api/recommendations/${user.id}/regenerate`
      : `/api/recommendations/${user.id}/series/regenerate`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        const label = mediaType === 'movies' ? 'movie' : 'series'
        setRegenerateMessage(`✓ Generated ${data.count} new ${label} recommendations!`)
        // Refresh the recommendations list
        if (mediaType === 'movies') {
          setMovieLoading(true)
          await fetchMovieRecommendations()
        } else {
          setSeriesLoading(true)
          await fetchSeriesRecommendations()
        }
      } else {
        const errorData = await response.json()
        setRegenerateMessage(`✗ ${errorData.error || 'Failed to regenerate'}`)
      }
    } catch {
      setRegenerateMessage('✗ Could not connect to server')
    } finally {
      setRegenerating(false)
    }
  }

  // Get current state based on tab
  const recommendations = mediaType === 'movies' ? movieRecommendations : seriesRecommendations
  const runInfo = mediaType === 'movies' ? movieRunInfo : seriesRunInfo
  const loading = mediaType === 'movies' ? movieLoading : seriesLoading
  const error = mediaType === 'movies' ? movieError : seriesError

  const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <Box mb={1}>
      <Box display="flex" justifyContent="space-between" mb={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" fontWeight={600}>
          {(value * 100).toFixed(0)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value * 100}
        sx={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'grey.800',
          '& .MuiLinearProgress-bar': {
            backgroundColor: color,
            borderRadius: 3,
          },
        }}
      />
    </Box>
  )

  // Helper function to get item properties based on media type
  const getItemProps = (rec: MovieRecommendation | SeriesRecommendation) => {
    if (mediaType === 'movies' && 'movie' in rec) {
      const movieRec = rec as MovieRecommendation
      return {
        id: movieRec.movie_id,
        item: movieRec.movie,
        navigateTo: `/movies/${movieRec.movie_id}`,
      }
    } else {
      const seriesRec = rec as SeriesRecommendation
      return {
        id: seriesRec.series_id,
        item: seriesRec.series,
        navigateTo: `/series/${seriesRec.series_id}`,
      }
    }
  }

  const LoadingSkeleton = () => (
    <Box>
      <Grid container spacing={2}>
        {[...Array(12)].map((_, i) => (
          <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
            <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '2/3', borderRadius: 1 }} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={{ xs: 0, sm: 1 }}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              My Recommendations
            </Typography>
          </Box>
          {!isMobile && (
            <Typography variant="body1" color="text.secondary">
              AI-powered picks personalized for your taste
            </Typography>
          )}
        </Box>

        {/* Grid/List toggle always in upper right */}
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

      {/* Action buttons row */}
      <Box display="flex" gap={1} mb={2}>
        {isMobile ? (
          <Tooltip title={regenerating ? 'Regenerating...' : 'Regenerate'}>
            <span>
              <IconButton
                onClick={handleRegenerate}
                disabled={regenerating}
                size="small"
                sx={{ border: 1, borderColor: 'divider' }}
              >
                {regenerating ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <Button
            variant="outlined"
            startIcon={regenerating ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRegenerate}
            disabled={regenerating}
            size="small"
          >
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Tabs
        value={mediaType}
        onChange={(_, v) => {
          setMediaType(v)
          setRegenerateMessage(null)
        }}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab
          value="movies"
          icon={<MovieIcon />}
          iconPosition="start"
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <span>Movies</span>
              {movieRecommendations.length > 0 && (
                <Chip
                  label={movieRecommendations.length}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 20,
                    bgcolor: '#6366f1',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
          }
          sx={{
            color: mediaType === 'movies' ? '#6366f1' : 'text.secondary',
            '&.Mui-selected': { color: '#6366f1' },
          }}
        />
        <Tab
          value="series"
          icon={<TvIcon />}
          iconPosition="start"
          label={
            <Box display="flex" alignItems="center" gap={1}>
              <span>TV Series</span>
              {seriesRecommendations.length > 0 && (
                <Chip
                  label={seriesRecommendations.length}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 20,
                    bgcolor: '#ec4899',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
          }
          sx={{
            color: mediaType === 'series' ? '#ec4899' : 'text.secondary',
            '&.Mui-selected': { color: '#ec4899' },
          }}
        />
      </Tabs>

      {/* Run Info */}
      {runInfo && runInfo.created_at && (
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Last updated: {new Date(runInfo.created_at).toLocaleString()}
          {runInfo.selected_count != null && runInfo.total_candidates != null && (
            <> • {runInfo.selected_count} picks from {runInfo.total_candidates.toLocaleString()} candidates</>
          )}
        </Typography>
      )}

      {/* Regenerate message */}
      {regenerateMessage && (
        <Alert 
          severity={regenerateMessage.startsWith('✓') ? 'success' : 'error'} 
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setRegenerateMessage(null)}
        >
          {regenerateMessage}
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading ? (
        <LoadingSkeleton />
      ) : recommendations.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No {mediaType === 'movies' ? 'movie' : 'series'} recommendations generated yet. Your personalized picks will appear here once an admin runs the recommendation job.
        </Alert>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {recommendations.map((rec, index) => {
            const { id, item, navigateTo } = getItemProps(rec)
            const type = mediaType === 'movies' ? 'movie' : 'series'
            return (
              <Grid item xs={6} sm={4} md={3} lg={2} key={id}>
                <Box position="relative">
                  <MoviePoster
                    title={item.title}
                    year={item.year}
                    posterUrl={item.poster_url}
                    genres={item.genres}
                    rating={item.community_rating}
                    overview={item.overview}
                    score={rec.final_score}
                    showScore
                    hideRating
                    userRating={getRating(type, id)}
                    onRate={(rating) => handleRate(type, id, rating)}
                    isWatching={type === 'series' ? isWatching(id) : undefined}
                    onWatchingToggle={type === 'series' ? () => toggleWatching(id) : undefined}
                    hideWatchingToggle={type !== 'series'}
                    responsive
                    onClick={() => navigate(navigateTo)}
                  />
                  <RankBadge rank={index + 1} size="medium" />
                </Box>
              </Grid>
            )
          })}
        </Grid>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {recommendations.map((rec, index) => {
            const { id, item, navigateTo } = getItemProps(rec)
            const type = mediaType === 'movies' ? 'movie' : 'series'
            const userRating = getRating(type, id)
            const watching = type === 'series' ? isWatching(id) : false

            const handleOpenTmdb = (e: React.MouseEvent) => {
              e.stopPropagation()
              const tmdbType = type === 'movie' ? 'movie' : 'tv'
              window.open(`https://www.themoviedb.org/${tmdbType}/${id}`, '_blank')
            }

            const handleWatchingClick = (e: React.MouseEvent) => {
              e.stopPropagation()
              toggleWatching(id)
            }

            const handleRatingClick = (e: React.MouseEvent) => {
              e.stopPropagation()
            }

            return (
              <Card
                key={id}
                sx={{
                  backgroundColor: 'background.paper',
                  borderRadius: 2,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: { xs: 'none', md: 'translateY(-2px)' },
                    boxShadow: { xs: 1, md: 4 },
                  },
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Main row: Poster + Content + Desktop Score Panel */}
                <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                  <CardActionArea
                    onClick={() => navigate(navigateTo)}
                    sx={{ display: 'flex', flexGrow: 1, alignItems: 'stretch' }}
                  >
                    {/* Poster with Rank Badge */}
                    <Box
                      sx={{
                        position: 'relative',
                        width: { xs: 100, sm: 110, md: 120 },
                        alignSelf: 'stretch',
                        flexShrink: 0,
                        overflow: 'hidden',
                        bgcolor: 'grey.900',
                      }}
                    >
                      <Box
                        component="img"
                        src={getProxiedImageUrl(item.poster_url)}
                        alt={item.title}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = FALLBACK_POSTER_URL
                        }}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <RankBadge rank={index + 1} size={isMobile ? 'medium' : 'large'} />
                    </Box>

                    {/* Info */}
                    <CardContent
                      sx={{
                        flexGrow: 1,
                        p: { xs: 1.5, md: 2 },
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        minWidth: 0,
                        '&:last-child': { pb: { xs: 1.5, md: 2 } },
                      }}
                    >
                      <Typography
                        variant={isMobile ? 'body1' : 'h6'}
                        fontWeight={600}
                        noWrap
                        sx={{ fontSize: { xs: '0.95rem', md: '1.25rem' } }}
                      >
                        {item.title}
                      </Typography>

                      <Box display="flex" alignItems="center" gap={{ xs: 0.75, md: 1 }} mb={{ xs: 0.5, md: 1 }} flexWrap="wrap">
                        {item.year && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <CalendarTodayIcon sx={{ fontSize: { xs: 12, md: 14 }, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                              {item.year}
                            </Typography>
                          </Box>
                        )}
                        {item.community_rating && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <StarIcon sx={{ fontSize: { xs: 12, md: 14 }, color: '#fbbf24' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                              {Number(item.community_rating).toFixed(1)}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {/* Genres */}
                      <Box display="flex" gap={0.5} flexWrap="wrap" mb={{ xs: 0.5, md: 1 }}>
                        {item.genres?.slice(0, isMobile ? 2 : 3).map((genre) => (
                          <Chip
                            key={genre}
                            label={genre}
                            size="small"
                            variant="outlined"
                            sx={{
                              fontSize: { xs: '0.65rem', md: '0.7rem' },
                              height: { xs: 18, md: 22 },
                              '& .MuiChip-label': { px: { xs: 0.75, md: 1 } },
                            }}
                          />
                        ))}
                      </Box>

                      {/* Overview */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: { xs: '0.75rem', md: '0.875rem' },
                        }}
                      >
                        {item.overview || 'No description available.'}
                      </Typography>

                      {/* Mobile: Inline actions */}
                      {isMobile && (
                        <Box display="flex" alignItems="center" gap={1} mt={1} onClick={handleRatingClick}>
                          <HeartRating
                            value={userRating}
                            onChange={(rating) => handleRate(type, id, rating)}
                            size="small"
                          />
                          {type === 'series' && (
                            <Tooltip title={watching ? 'Remove from watching' : 'Add to watching'}>
                              <IconButton
                                onClick={handleWatchingClick}
                                size="small"
                                sx={{
                                  p: 0.5,
                                  backgroundColor: watching
                                    ? alpha(theme.palette.success.main, 0.1)
                                    : alpha(theme.palette.primary.main, 0.1),
                                  '&:hover': {
                                    backgroundColor: watching
                                      ? alpha(theme.palette.success.main, 0.2)
                                      : alpha(theme.palette.primary.main, 0.2),
                                  },
                                }}
                              >
                                {watching ? <CheckIcon sx={{ fontSize: 16 }} /> : <AddToQueueIcon sx={{ fontSize: 16 }} />}
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="View on TMDb">
                            <IconButton
                              onClick={handleOpenTmdb}
                              size="small"
                              sx={{
                                p: 0.5,
                                backgroundColor: alpha(theme.palette.grey[500], 0.1),
                                '&:hover': { backgroundColor: alpha(theme.palette.grey[500], 0.2) },
                              }}
                            >
                              <OpenInNewIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </CardContent>
                  </CardActionArea>

                  {/* Desktop: Score Breakdown Panel */}
                  {!isMobile && (
                    <Box
                      sx={{
                        width: 200,
                        flexShrink: 0,
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderLeft: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600} mb={1}>
                        Match Score: {(rec.final_score * 100).toFixed(0)}%
                      </Typography>
                      <ScoreBar label="Similarity" value={rec.similarity_score} color="#6366f1" />
                      <ScoreBar label="Novelty" value={rec.novelty_score} color="#10b981" />
                      <ScoreBar label="Rating" value={rec.rating_score} color="#f59e0b" />
                    </Box>
                  )}
                </Box>

                {/* Mobile: Full-width Score Section */}
                {isMobile && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderTop: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                    }}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="caption" fontWeight={700} color="text.primary">
                        Match Score: {(rec.final_score * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                    <Box display="flex" gap={1.5}>
                      <Box flex={1}>
                        <Box display="flex" justifyContent="space-between" mb={0.25}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            Similarity
                          </Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
                            {(rec.similarity_score * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={rec.similarity_score * 100}
                          sx={{
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: 'grey.800',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#6366f1',
                              borderRadius: 2,
                            },
                          }}
                        />
                      </Box>
                      <Box flex={1}>
                        <Box display="flex" justifyContent="space-between" mb={0.25}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            Novelty
                          </Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
                            {(rec.novelty_score * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={rec.novelty_score * 100}
                          sx={{
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: 'grey.800',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#10b981',
                              borderRadius: 2,
                            },
                          }}
                        />
                      </Box>
                      <Box flex={1}>
                        <Box display="flex" justifyContent="space-between" mb={0.25}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            Rating
                          </Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
                            {(rec.rating_score * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={rec.rating_score * 100}
                          sx={{
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: 'grey.800',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#f59e0b',
                              borderRadius: 2,
                            },
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>
                )}
              </Card>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

