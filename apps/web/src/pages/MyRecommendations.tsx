import React, { useEffect, useState } from 'react'
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
} from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import RefreshIcon from '@mui/icons-material/Refresh'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { MoviePoster } from '@aperture/ui'
import { useAuth } from '@/hooks/useAuth'

interface Recommendation {
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

interface RecommendationsResponse {
  recommendations: Recommendation[]
  run?: {
    id: string
    created_at: string
    total_candidates: number
    selected_count: number
  }
}

export function MyRecommendationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [runInfo, setRunInfo] = useState<RecommendationsResponse['run'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
        setRegenerateMessage(
          `✓ Preference saved. ${checked ? 'Recommendations will include watched movies.' : 'Recommendations will exclude watched movies.'} Click Regenerate to apply.`
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

  const fetchRecommendations = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/recommendations/${user.id}`, { credentials: 'include' })
      if (response.ok) {
        const data: RecommendationsResponse = await response.json()
        setRecommendations(data.recommendations || [])
        setRunInfo(data.run)
        setError(null)
      } else {
        setError('Failed to load recommendations')
      }
    } catch (err) {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
    fetchPreferences()
  }, [user])

  const handleRegenerate = async () => {
    if (!user || regenerating) return

    setRegenerating(true)
    setRegenerateMessage(null)

    try {
      const response = await fetch(`/api/recommendations/${user.id}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setRegenerateMessage(`✓ Generated ${data.count} new recommendations!`)
        // Refresh the recommendations list
        setLoading(true)
        await fetchRecommendations()
      } else {
        const errorData = await response.json()
        setRegenerateMessage(`✗ ${errorData.error || 'Failed to regenerate'}`)
      }
    } catch (err) {
      setRegenerateMessage('✗ Could not connect to server')
    } finally {
      setRegenerating(false)
    }
  }

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

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 4 }} />
        <Grid container spacing={2}>
          {[...Array(12)].map((_, i) => (
            <Grid item key={i}>
              <Skeleton variant="rectangular" width={154} height={231} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          My Recommendations
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>
              My Recommendations
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            AI-powered movie picks personalized for your taste
          </Typography>
          {runInfo && runInfo.created_at && (
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Last updated: {new Date(runInfo.created_at).toLocaleString()}
              {runInfo.selected_count != null && runInfo.total_candidates != null && (
                <> • {runInfo.selected_count} picks from {runInfo.total_candidates.toLocaleString()} candidates</>
              )}
            </Typography>
          )}
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <Tooltip
            title={
              includeWatched
                ? 'Recommendations may include movies you\'ve already watched'
                : 'Recommendations will only show movies you haven\'t watched'
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

      {recommendations.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No recommendations generated yet. Your personalized picks will appear here once an admin runs the recommendation job.
        </Alert>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {recommendations.map((rec, index) => (
            <Grid item key={rec.movie_id}>
              <Box position="relative">
                <MoviePoster
                  title={rec.movie.title}
                  year={rec.movie.year}
                  posterUrl={rec.movie.poster_url}
                  genres={rec.movie.genres}
                  rating={rec.movie.community_rating}
                  overview={rec.movie.overview}
                  score={rec.final_score}
                  showScore
                  hideRating
                  size="medium"
                  onClick={() => navigate(`/movies/${rec.movie_id}`)}
                />
                <Chip
                  label={`#${index + 1}`}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    backgroundColor: 'primary.main',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {recommendations.map((rec, index) => (
            <Card
              key={rec.movie_id}
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
              onClick={() => navigate(`/movies/${rec.movie_id}`)}
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
                    backgroundColor: 'primary.main',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </Box>

                {/* Poster */}
                <Box
                  component="img"
                  src={rec.movie.poster_url || undefined}
                  alt={rec.movie.title}
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
                    {rec.movie.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {rec.movie.year} • {rec.movie.genres?.slice(0, 3).join(', ')}
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
                    {rec.movie.overview || 'No description available.'}
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
          ))}
        </Box>
      )}
    </Box>
  )
}

