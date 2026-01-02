import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  Skeleton,
  IconButton,
  Divider,
  Grid,
  Alert,
  LinearProgress,
  Tooltip,
  Collapse,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ExploreIcon from '@mui/icons-material/Explore'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useAuth } from '../hooks/useAuth'

interface Movie {
  id: string
  provider_item_id: string
  title: string
  original_title: string | null
  year: number | null
  genres: string[]
  overview: string | null
  community_rating: number | null
  runtime_minutes: number | null
  poster_url: string | null
  backdrop_url: string | null
}

interface SimilarMovie {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  similarity: number
}

interface RecommendationInsights {
  isRecommended: boolean
  isSelected?: boolean
  rank?: number
  message?: string
  scores?: {
    final: number
    similarity: number | null
    novelty: number | null
    rating: number | null
    diversity: number | null
  }
  scoreBreakdown?: Record<string, unknown>
  evidence?: Array<{
    id: string
    similar_movie_id: string
    similarity: number
    evidence_type: string
    similar_movie: {
      id: string
      title: string
      year: number | null
      poster_url: string | null
      genres: string[]
    }
  }>
  genreAnalysis?: {
    movieGenres: string[]
    matchingGenres: string[]
    newGenres: string[]
    userTopGenres: Array<{ genre: string; weight: number }>
  }
}

interface MediaServerInfo {
  baseUrl: string
  type: string
  serverId: string
  serverName: string
  webClientUrl: string
}

export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [movie, setMovie] = useState<Movie | null>(null)
  const [similar, setSimilar] = useState<SimilarMovie[]>([])
  const [insights, setInsights] = useState<RecommendationInsights | null>(null)
  const [insightsExpanded, setInsightsExpanded] = useState(true)
  const [mediaServer, setMediaServer] = useState<MediaServerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMovie = async () => {
      setLoading(true)
      try {
        // Fetch movie and media server info in parallel
        const [response, mediaServerResponse] = await Promise.all([
          fetch(`/api/movies/${id}`, { credentials: 'include' }),
          fetch('/api/settings/media-server', { credentials: 'include' }),
        ])

        // Process media server info
        if (mediaServerResponse.ok) {
          const mediaServerData = await mediaServerResponse.json()
          setMediaServer(mediaServerData)
        }

        if (response.ok) {
          const data = await response.json()
          setMovie(data)
          setError(null)

          // Fetch similar movies
          const similarResponse = await fetch(`/api/movies/${id}/similar?limit=6`, {
            credentials: 'include',
          })
          if (similarResponse.ok) {
            const similarData = await similarResponse.json()
            setSimilar(similarData.similar || [])
          }

          // Fetch recommendation insights if user is logged in
          if (user?.id) {
            const insightsResponse = await fetch(
              `/api/recommendations/${user.id}/movie/${id}/insights`,
              { credentials: 'include' }
            )
            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json()
              setInsights(insightsData)
            }
          }
        } else {
          setError('Movie not found')
        }
      } catch {
        setError('Could not connect to server')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchMovie()
    }
  }, [id, user?.id])

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const handlePlayOnEmby = () => {
    if (!mediaServer?.baseUrl || !movie?.provider_item_id) {
      return
    }

    // Open the item in the media server's web client
    // For Emby: /web/index.html#!/item?id=ITEM_ID&serverId=SERVER_ID
    // For Jellyfin: /web/index.html#!/details?id=ITEM_ID&serverId=SERVER_ID
    const serverIdParam = mediaServer.serverId ? `&serverId=${mediaServer.serverId}` : ''
    const itemPath = mediaServer.type === 'jellyfin'
      ? `#!/details?id=${movie.provider_item_id}${serverIdParam}`
      : `#!/item?id=${movie.provider_item_id}${serverIdParam}`

    window.open(`${mediaServer.baseUrl}/web/index.html${itemPath}`, '_blank')
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
        <Box sx={{ mt: 3, display: 'flex', gap: 3 }}>
          <Skeleton variant="rectangular" width={200} height={300} sx={{ borderRadius: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={50} />
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="100%" height={100} />
          </Box>
        </Box>
      </Box>
    )
  }

  if (error || !movie) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="error">{error || 'Movie not found'}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', pb: 4 }}>
      {/* Backdrop */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 300, md: 450 },
          mx: -3,
          mt: -3,
          mb: 3,
          overflow: 'hidden',
        }}
      >
        {movie.backdrop_url ? (
          <Box
            component="img"
            src={movie.backdrop_url}
            alt={movie.title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.6)',
            }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            }}
          />
        )}

        {/* Gradient overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60%',
            background: 'linear-gradient(to top, rgba(18,18,18,1) 0%, rgba(18,18,18,0) 100%)',
          }}
        />

        {/* Back button */}
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            bgcolor: 'rgba(0,0,0,0.5)',
            color: 'white',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' }, mt: -20, position: 'relative', zIndex: 1, px: 3 }}>
        {/* Poster */}
        <Box sx={{ flexShrink: 0 }}>
          <Paper
            elevation={8}
            sx={{
              width: { xs: 150, md: 220 },
              height: { xs: 225, md: 330 },
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'grey.900',
            }}
          >
            {movie.poster_url ? (
              <Box
                component="img"
                src={movie.poster_url}
                alt={movie.title}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.800',
                }}
              >
                <Typography variant="body2" color="text.secondary" textAlign="center" p={2}>
                  {movie.title}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>

        {/* Info */}
        <Box sx={{ flex: 1 }}>
          {/* Status badge */}
          <Chip
            label="Available"
            size="small"
            sx={{
              bgcolor: 'success.main',
              color: 'white',
              fontWeight: 600,
              mb: 1,
            }}
          />

          {/* Title */}
          <Typography variant="h3" fontWeight={700} sx={{ mb: 1 }}>
            {movie.title}
            {movie.year && (
              <Typography component="span" variant="h4" color="text.secondary" fontWeight={400} sx={{ ml: 1 }}>
                ({movie.year})
              </Typography>
            )}
          </Typography>

          {/* Meta row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            {movie.genres && movie.genres.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {movie.genres.join(' • ')}
              </Typography>
            )}
            {movie.runtime_minutes && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {formatRuntime(movie.runtime_minutes)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <IconButton
              sx={{
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <StarBorderIcon />
            </IconButton>
            <Button
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              onClick={handlePlayOnEmby}
              disabled={!mediaServer?.baseUrl}
              sx={{ borderRadius: 2 }}
            >
              {mediaServer?.type === 'jellyfin' ? 'Play on Jellyfin' : 'Play on Emby'}
            </Button>
          </Box>

          {/* Rating */}
          {movie.community_rating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StarIcon sx={{ color: 'warning.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  {Number(movie.community_rating).toFixed(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  / 10
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Overview section */}
      <Box sx={{ mt: 4, px: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Overview
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 800, lineHeight: 1.8 }}>
          {movie.overview || 'No overview available.'}
        </Typography>
      </Box>

      {/* AI Recommendation Insights */}
      {insights?.isRecommended && insights.isSelected && (
        <Box sx={{ mt: 4, px: 3 }}>
          <Paper
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => setInsightsExpanded(!insightsExpanded)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AutoAwesomeIcon sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Recommended For You
                    <Chip
                      label={`#${insights.rank}`}
                      size="small"
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        fontWeight: 700,
                        height: 22,
                      }}
                    />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round((insights.scores?.final || 0) * 100)}% match based on your viewing history
                  </Typography>
                </Box>
              </Box>
              <IconButton>
                {insightsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={insightsExpanded}>
              <Divider />
              <Box sx={{ p: 3 }}>
                {/* Score Breakdown */}
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  How We Calculated Your Match
                </Typography>
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  {/* Taste Similarity */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Tooltip title="How similar this movie is to movies you've enjoyed" arrow>
                      <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <TrendingUpIcon sx={{ color: 'info.main', fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600}>Taste Match</Typography>
                        </Box>
                        <Typography variant="h4" fontWeight={700} color="info.main">
                          {insights.scores?.similarity != null
                            ? `${Math.round(insights.scores.similarity * 100)}%`
                            : 'N/A'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(insights.scores?.similarity || 0) * 100}
                          sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: 'info.main' } }}
                        />
                      </Paper>
                    </Tooltip>
                  </Grid>

                  {/* Novelty Score */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Tooltip title="How different this is from what you usually watch - helps you discover new things" arrow>
                      <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ExploreIcon sx={{ color: 'success.main', fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600}>Discovery</Typography>
                        </Box>
                        <Typography variant="h4" fontWeight={700} color="success.main">
                          {insights.scores?.novelty != null
                            ? `${Math.round(insights.scores.novelty * 100)}%`
                            : 'N/A'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(insights.scores?.novelty || 0) * 100}
                          sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: 'success.main' } }}
                        />
                      </Paper>
                    </Tooltip>
                  </Grid>

                  {/* Rating Score */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Tooltip title="Community and critic rating quality" arrow>
                      <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ThumbUpIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600}>Quality</Typography>
                        </Box>
                        <Typography variant="h4" fontWeight={700} color="warning.main">
                          {insights.scores?.rating != null
                            ? `${Math.round(insights.scores.rating * 100)}%`
                            : 'N/A'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(insights.scores?.rating || 0) * 100}
                          sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: 'warning.main' } }}
                        />
                      </Paper>
                    </Tooltip>
                  </Grid>

                  {/* Diversity Score */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Tooltip title="How much variety this adds to your recommendations" arrow>
                      <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ShuffleIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600}>Variety</Typography>
                        </Box>
                        <Typography variant="h4" fontWeight={700} color="secondary.main">
                          {insights.scores?.diversity != null
                            ? `${Math.round(insights.scores.diversity * 100)}%`
                            : 'N/A'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(insights.scores?.diversity || 0) * 100}
                          sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: 'secondary.main' } }}
                        />
                      </Paper>
                    </Tooltip>
                  </Grid>
                </Grid>

                {/* Genre Analysis */}
                {insights.genreAnalysis && (
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Genre Analysis
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      {insights.genreAnalysis.matchingGenres.map((genre) => (
                        <Chip
                          key={genre}
                          label={genre}
                          size="small"
                          sx={{
                            bgcolor: 'success.main',
                            color: 'white',
                            fontWeight: 500,
                          }}
                          icon={<ThumbUpIcon sx={{ color: 'white !important', fontSize: 16 }} />}
                        />
                      ))}
                      {insights.genreAnalysis.newGenres.map((genre) => (
                        <Chip
                          key={genre}
                          label={genre}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: 'info.main', color: 'info.main' }}
                          icon={<ExploreIcon sx={{ color: 'info.main', fontSize: 16 }} />}
                        />
                      ))}
                    </Box>
                    {insights.genreAnalysis.matchingGenres.length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        <strong style={{ color: '#4caf50' }}>{insights.genreAnalysis.matchingGenres.length}</strong> genre{insights.genreAnalysis.matchingGenres.length !== 1 ? 's' : ''} you enjoy
                        {insights.genreAnalysis.newGenres.length > 0 && (
                          <> • <strong style={{ color: '#2196f3' }}>{insights.genreAnalysis.newGenres.length}</strong> new to explore</>
                        )}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Evidence - Movies that contributed to this recommendation */}
                {insights.evidence && insights.evidence.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Why We Think You'll Like This
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Based on your history with similar movies:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
                      {insights.evidence.map((ev) => (
                        <Paper
                          key={ev.id}
                          onClick={() => navigate(`/movies/${ev.similar_movie.id}`)}
                          sx={{
                            flexShrink: 0,
                            width: 120,
                            cursor: 'pointer',
                            borderRadius: 2,
                            overflow: 'hidden',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'scale(1.05)' },
                            bgcolor: 'background.default',
                          }}
                        >
                          <Box sx={{ height: 160, bgcolor: 'grey.800', position: 'relative' }}>
                            {ev.similar_movie.poster_url ? (
                              <Box
                                component="img"
                                src={ev.similar_movie.poster_url}
                                alt={ev.similar_movie.title}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Typography variant="caption" color="text.secondary" textAlign="center" p={1}>
                                  {ev.similar_movie.title}
                                </Typography>
                              </Box>
                            )}
                            {/* Similarity badge */}
                            <Chip
                              label={`${Math.round(ev.similarity * 100)}%`}
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: 'rgba(99, 102, 241, 0.9)',
                                color: 'white',
                              }}
                            />
                            {/* Evidence type badge */}
                            <Chip
                              label={ev.evidence_type === 'favorite' ? '❤️' : ev.evidence_type === 'recent' ? '🕐' : '✓'}
                              size="small"
                              sx={{
                                position: 'absolute',
                                bottom: 4,
                                left: 4,
                                height: 20,
                                minWidth: 20,
                                fontSize: '0.7rem',
                                bgcolor: 'rgba(0,0,0,0.7)',
                              }}
                            />
                          </Box>
                          <Box sx={{ p: 1 }}>
                            <Typography variant="caption" fontWeight={500} noWrap display="block">
                              {ev.similar_movie.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {ev.similar_movie.year || 'N/A'}
                            </Typography>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Paper>
        </Box>
      )}

      {/* Movie info card */}
      <Box sx={{ mt: 4, px: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            {/* Additional info could go here */}
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Movie Info
              </Typography>
              <Divider sx={{ my: 1 }} />
              
              {movie.community_rating && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography variant="body2" color="text.secondary">Rating</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                    <Typography variant="body2" fontWeight={500}>
                      {Number(movie.community_rating).toFixed(1)}
                    </Typography>
                  </Box>
                </Box>
              )}

              {movie.year && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography variant="body2" color="text.secondary">Release Year</Typography>
                  <Typography variant="body2" fontWeight={500}>{movie.year}</Typography>
                </Box>
              )}

              {movie.runtime_minutes && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography variant="body2" color="text.secondary">Runtime</Typography>
                  <Typography variant="body2" fontWeight={500}>{formatRuntime(movie.runtime_minutes)}</Typography>
                </Box>
              )}

              {movie.genres && movie.genres.length > 0 && (
                <Box sx={{ py: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Genres</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {movie.genres.map((genre) => (
                      <Chip key={genre} label={genre} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Similar Movies */}
      {similar.length > 0 && (
        <Box sx={{ mt: 4, px: 3 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Similar Movies
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
            {similar.map((sim) => (
              <Paper
                key={sim.id}
                onClick={() => navigate(`/movies/${sim.id}`)}
                sx={{
                  flexShrink: 0,
                  width: 140,
                  cursor: 'pointer',
                  borderRadius: 2,
                  overflow: 'hidden',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'scale(1.05)' },
                }}
              >
                <Box sx={{ height: 200, bgcolor: 'grey.800' }}>
                  {sim.poster_url ? (
                    <Box
                      component="img"
                      src={sim.poster_url}
                      alt={sim.title}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" textAlign="center" p={1}>
                        {sim.title}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ p: 1 }}>
                  <Typography variant="caption" fontWeight={500} noWrap>
                    {sim.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {sim.year || 'N/A'}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

