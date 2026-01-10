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
  CardContent,
  LinearProgress,
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import RefreshIcon from '@mui/icons-material/Refresh'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import { MoviePoster, RankBadge } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'
import { useUserRatings } from '@/hooks/useUserRatings'
import { useWatching } from '@/hooks/useWatching'

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateMessage, setRegenerateMessage] = useState<string | null>(null)
  const [includeWatched, setIncludeWatched] = useState(false)
  const [savingPreference, setSavingPreference] = useState(false)

  const fetchPreferences = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/recommendations/${user.id}/preferences`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setIncludeWatched(data.includeWatched)
      }
    } catch {
      // Ignore errors, use default
    }
  }

  const handleIncludeWatchedChange = async (checked: boolean) => {
    if (!user || savingPreference) return

    setSavingPreference(true)
    setIncludeWatched(checked)

    try {
      const response = await fetch(`/api/recommendations/${user.id}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ includeWatched: checked }),
      })

      if (response.ok) {
        const mediaLabel = mediaType === 'movies' ? 'movies' : 'series'
        setRegenerateMessage(
          `✓ Preference saved. ${checked ? `Recommendations will include watched ${mediaLabel}.` : `Recommendations will exclude watched ${mediaLabel}.`} Click Regenerate to apply.`
        )
      } else {
        setIncludeWatched(!checked) // Revert
        setRegenerateMessage('✗ Failed to save preference')
      }
    } catch {
      setIncludeWatched(!checked) // Revert
      setRegenerateMessage('✗ Could not save preference')
    } finally {
      setSavingPreference(false)
    }
  }

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
    fetchPreferences()
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
          <Grid item key={i}>
            <Skeleton variant="rectangular" width={154} height={231} sx={{ borderRadius: 1 }} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              My Recommendations
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            AI-powered picks personalized for your taste
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <Tooltip
            title={
              includeWatched
                ? `Recommendations may include ${mediaType === 'movies' ? 'movies' : 'series'} you've already watched`
                : `Recommendations will only show ${mediaType === 'movies' ? 'movies' : 'series'} you haven't watched`
            }
          >
            <FormControlLabel
              control={
                <Switch
                  checked={includeWatched}
                  onChange={(e) => handleIncludeWatchedChange(e.target.checked)}
                  disabled={savingPreference}
                  size="small"
                  icon={<VisibilityOffIcon fontSize="small" />}
                  checkedIcon={<VisibilityIcon fontSize="small" />}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  {includeWatched ? 'Including watched' : 'New only'}
                </Typography>
              }
              sx={{ mr: 1 }}
            />
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={regenerating ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRegenerate}
            disabled={regenerating}
            size="small"
          >
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </Button>

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
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
          }
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
                    bgcolor: 'secondary.main',
                    color: 'white',
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
          }
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
              <Grid item key={id}>
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
                    size="medium"
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
            return (
              <Card
                key={id}
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
                onClick={() => navigate(navigateTo)}
              >
                <CardContent sx={{ display: 'flex', gap: 3, p: 2 }}>
                  {/* Rank */}
                  <RankBadge rank={index + 1} size="xlarge" absolute={false} />

                  {/* Poster */}
                  <Box
                    component="img"
                    src={item.poster_url || undefined}
                    alt={item.title}
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
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      {item.year} • {item.genres?.slice(0, 3).join(', ')}
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
                      {item.overview || 'No description available.'}
                    </Typography>
                  </Box>

                  {/* Score Breakdown */}
                  <Box width={200} flexShrink={0}>
                    <Typography variant="subtitle2" fontWeight={600} mb={1}>
                      Match Score: {(rec.final_score * 100).toFixed(0)}%
                    </Typography>
                    <ScoreBar label="Similarity" value={rec.similarity_score} color="#6366f1" />
                    <ScoreBar label="Novelty" value={rec.novelty_score} color="#10b981" />
                    <ScoreBar label="Rating" value={rec.rating_score} color="#f59e0b" />
                  </Box>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

