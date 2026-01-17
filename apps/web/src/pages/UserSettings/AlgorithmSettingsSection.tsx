import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Slider,
  Button,
  Divider,
  Grid,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Avatar,
  Fade,
} from '@mui/material'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import TuneIcon from '@mui/icons-material/Tune'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ThumbDownIcon from '@mui/icons-material/ThumbDown'
import CloseIcon from '@mui/icons-material/Close'
import { HeartRating } from '@aperture/ui'

interface AlgorithmWeights {
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
  recentWatchLimit: number
}

interface AlgorithmSettings {
  enabled: boolean
  movie?: Partial<AlgorithmWeights>
  series?: Partial<AlgorithmWeights>
}

interface Props {
  userId: string
}

interface DislikedItem {
  id: string
  title: string
  year: number | null
  posterUrl: string | null
  rating: number
}

const WEIGHT_LABELS: Record<keyof Omit<AlgorithmWeights, 'recentWatchLimit'>, { label: string; description: string }> = {
  similarityWeight: {
    label: 'Similarity',
    description: 'How much to prioritize content similar to what you\'ve enjoyed',
  },
  noveltyWeight: {
    label: 'Novelty',
    description: 'How much to prioritize exploring new genres and styles',
  },
  ratingWeight: {
    label: 'Community Rating',
    description: 'How much to favor highly-rated content',
  },
  diversityWeight: {
    label: 'Diversity',
    description: 'How much variety to include in recommendations',
  },
}

export function AlgorithmSettingsSection({ userId }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [settings, setSettings] = useState<AlgorithmSettings>({ enabled: false })
  const [defaults, setDefaults] = useState<{
    movie: AlgorithmWeights
    series: AlgorithmWeights
  } | null>(null)
  
  const [mediaType, setMediaType] = useState<'movie' | 'series'>('movie')
  
  // Local state for sliders
  const [localWeights, setLocalWeights] = useState<AlgorithmWeights | null>(null)
  
  // Debounce ref for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingWeightsRef = useRef<AlgorithmWeights | null>(null)
  
  // Include watched and dislike behavior state
  const [includeWatched, setIncludeWatched] = useState(false)
  const [dislikeBehavior, setDislikeBehavior] = useState<'exclude' | 'penalize'>('exclude')
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)
  
  // Disliked items state
  const [dislikedMovies, setDislikedMovies] = useState<DislikedItem[]>([])
  const [dislikedSeries, setDislikedSeries] = useState<DislikedItem[]>([])
  const [loadingDisliked, setLoadingDisliked] = useState(true)

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`/api/users/${userId}/algorithm-settings`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch settings')
      const data = await response.json()
      setSettings(data.settings)
      setDefaults(data.defaults)
      
      // Initialize local weights with current or default values
      const currentType = mediaType
      const current = data.settings[currentType] || {}
      const defaultWeights = data.defaults[currentType]
      setLocalWeights({
        similarityWeight: current.similarityWeight ?? defaultWeights.similarityWeight,
        noveltyWeight: current.noveltyWeight ?? defaultWeights.noveltyWeight,
        ratingWeight: current.ratingWeight ?? defaultWeights.ratingWeight,
        diversityWeight: current.diversityWeight ?? defaultWeights.diversityWeight,
        recentWatchLimit: current.recentWatchLimit ?? defaultWeights.recentWatchLimit,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }, [userId, mediaType])

  useEffect(() => {
    fetchSettings()
    fetchPreferences()
    fetchDislikedItems()
  }, [fetchSettings])

  const fetchPreferences = async () => {
    setLoadingPrefs(true)
    try {
      // Fetch include watched
      const watchedRes = await fetch('/api/settings/user/include-watched', { credentials: 'include' })
      if (watchedRes.ok) {
        const data = await watchedRes.json()
        setIncludeWatched(data.includeWatched ?? false)
      }
      
      // Fetch dislike behavior
      const dislikeRes = await fetch('/api/settings/user/dislike-behavior', { credentials: 'include' })
      if (dislikeRes.ok) {
        const data = await dislikeRes.json()
        setDislikeBehavior(data.dislikeBehavior ?? 'exclude')
      }
    } catch {
      // Silently fail - use defaults
    } finally {
      setLoadingPrefs(false)
    }
  }

  const fetchDislikedItems = async () => {
    setLoadingDisliked(true)
    try {
      const response = await fetch('/api/ratings/disliked', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setDislikedMovies(data.movies || [])
        setDislikedSeries(data.series || [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingDisliked(false)
    }
  }

  const saveIncludeWatched = async (value: boolean) => {
    setSavingPrefs(true)
    try {
      const response = await fetch('/api/settings/user/include-watched', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ includeWatched: value }),
      })
      if (response.ok) {
        setIncludeWatched(value)
        setSuccess('Include watched preference saved')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch {
      setError('Failed to save preference')
    } finally {
      setSavingPrefs(false)
    }
  }

  const saveDislikeBehavior = async (value: 'exclude' | 'penalize') => {
    setSavingPrefs(true)
    try {
      const response = await fetch('/api/settings/user/dislike-behavior', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dislikeBehavior: value }),
      })
      if (response.ok) {
        setDislikeBehavior(value)
        setSuccess('Dislike behavior preference saved')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch {
      setError('Failed to save preference')
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleRatingChange = async (
    itemId: string,
    newRating: number,
    type: 'movie' | 'series'
  ) => {
    try {
      const response = await fetch(`/api/ratings/${type}/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating: newRating }),
      })
      if (response.ok) {
        // Update local state
        if (type === 'movie') {
          setDislikedMovies((prev) =>
            newRating > 3
              ? prev.filter((m) => m.id !== itemId)
              : prev.map((m) => (m.id === itemId ? { ...m, rating: newRating } : m))
          )
        } else {
          setDislikedSeries((prev) =>
            newRating > 3
              ? prev.filter((s) => s.id !== itemId)
              : prev.map((s) => (s.id === itemId ? { ...s, rating: newRating } : s))
          )
        }
      }
    } catch {
      setError('Failed to update rating')
    }
  }

  const handleClearRating = async (itemId: string, type: 'movie' | 'series') => {
    try {
      const response = await fetch(`/api/ratings/${type}/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        // Remove from list with animation
        if (type === 'movie') {
          setDislikedMovies((prev) => prev.filter((m) => m.id !== itemId))
        } else {
          setDislikedSeries((prev) => prev.filter((s) => s.id !== itemId))
        }
      }
    } catch {
      setError('Failed to clear rating')
    }
  }

  // Update local weights when media type changes
  useEffect(() => {
    if (defaults) {
      const current = settings[mediaType] || {}
      const defaultWeights = defaults[mediaType]
      setLocalWeights({
        similarityWeight: current.similarityWeight ?? defaultWeights.similarityWeight,
        noveltyWeight: current.noveltyWeight ?? defaultWeights.noveltyWeight,
        ratingWeight: current.ratingWeight ?? defaultWeights.ratingWeight,
        diversityWeight: current.diversityWeight ?? defaultWeights.diversityWeight,
        recentWatchLimit: current.recentWatchLimit ?? defaultWeights.recentWatchLimit,
      })
    }
  }, [mediaType, defaults, settings])

  const handleToggleEnabled = async (enabled: boolean) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/users/${userId}/algorithm-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      })
      if (!response.ok) throw new Error('Failed to save settings')
      const data = await response.json()
      setSettings(data.settings)
      setSuccess(enabled ? 'Custom algorithm enabled' : 'Using default algorithm')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Debounced save function
  const saveWeightsDebounced = useCallback(async (weights: AlgorithmWeights) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/users/${userId}/algorithm-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: true,
          [mediaType]: weights,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }
      const data = await response.json()
      setSettings(data.settings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [userId, mediaType])

  const handleWeightChange = (key: keyof AlgorithmWeights, value: number) => {
    if (!localWeights) return
    
    const newWeights = { ...localWeights, [key]: value }
    setLocalWeights(newWeights)
    pendingWeightsRef.current = newWeights
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Set new debounced save (800ms delay)
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingWeightsRef.current) {
        saveWeightsDebounced(pendingWeightsRef.current)
      }
    }, 800)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const resetToDefaults = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/users/${userId}/algorithm-settings/reset`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to reset settings')
      await fetchSettings()
      setSuccess('Algorithm settings reset to defaults')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

  // Match colors from Watcher Identity page
  const accentColor = mediaType === 'movie' ? '#6366f1' : '#ec4899'

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Master Toggle */}
      <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <TuneIcon color="primary" />
            <Typography variant="h6">Custom Algorithm Weights</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Fine-tune how Aperture generates recommendations for you. When disabled, admin-configured defaults are used.
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
                disabled={saving}
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {settings.enabled ? 'Using Custom Weights' : 'Using Default Weights'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {settings.enabled
                    ? 'Your personalized algorithm settings are active'
                    : 'Recommendations use the system defaults'}
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0 }}
          />
        </CardContent>
      </Card>

      {/* Weight Sliders (only shown when enabled) */}
      {settings.enabled && localWeights && defaults && (
        <Card sx={{ backgroundColor: 'background.default', borderRadius: 2 }}>
          <CardContent>
            {/* Media Type Tabs */}
            <Tabs
              value={mediaType}
              onChange={(_, v) => setMediaType(v)}
              sx={{ 
                mb: 3,
                '& .MuiTabs-indicator': {
                  backgroundColor: accentColor,
                },
                '& .Mui-selected': {
                  color: `${accentColor} !important`,
                },
              }}
            >
              <Tab icon={<MovieIcon />} label="Movies" value="movie" iconPosition="start" />
              <Tab icon={<TvIcon />} label="TV Series" value="series" iconPosition="start" />
            </Tabs>

            {/* Weight Info */}
            <Box 
              sx={{ 
                mb: 3, 
                p: 2, 
                borderRadius: 1, 
                backgroundColor: accentColor,
                color: 'white',
              }}
            >
              <Typography variant="body2">
                💡 Set relative importance for each factor. Weights are automatically normalized.
              </Typography>
            </Box>

            {/* Weight Sliders */}
            <Grid container spacing={3}>
              {(Object.keys(WEIGHT_LABELS) as (keyof typeof WEIGHT_LABELS)[]).map((key) => {
                const defaultValue = defaults[mediaType][key]
                const currentValue = localWeights[key] as number
                return (
                  <Grid item xs={12} md={6} key={key}>
                    <Box>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <Typography variant="subtitle2">{WEIGHT_LABELS[key].label}</Typography>
                        <Tooltip title={WEIGHT_LABELS[key].description}>
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            <HelpOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: accentColor }}>
                            {(currentValue * 100).toFixed(0)}%
                          </Typography>
                          {Math.abs(currentValue - defaultValue) > 0.01 && (
                            <Typography variant="caption" color="text.secondary">
                              (default: {(defaultValue * 100).toFixed(0)}%)
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Slider
                        value={currentValue}
                        onChange={(_, v) => handleWeightChange(key, v as number)}
                        min={0}
                        max={1}
                        step={0.05}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `${(v * 100).toFixed(0)}%`}
                        sx={{
                          color: accentColor,
                          '& .MuiSlider-thumb': {
                            bgcolor: accentColor,
                          },
                          '& .MuiSlider-track': {
                            bgcolor: accentColor,
                          },
                          '& .MuiSlider-rail': {
                            bgcolor: 'action.disabled',
                          },
                        }}
                      />
                    </Box>
                  </Grid>
                )
              })}
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Recent Watch Limit */}
            <Box mb={3}>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Typography variant="subtitle2">Recent Watch History Limit</Typography>
                <Tooltip title="How many recently watched items to consider when building your taste profile">
                  <IconButton size="small" sx={{ p: 0.5 }}>
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ color: accentColor }}>
                    {localWeights.recentWatchLimit} items
                  </Typography>
                  {localWeights.recentWatchLimit !== defaults[mediaType].recentWatchLimit && (
                    <Typography variant="caption" color="text.secondary">
                      (default: {defaults[mediaType].recentWatchLimit})
                    </Typography>
                  )}
                </Box>
              </Box>
              <Slider
                value={localWeights.recentWatchLimit}
                onChange={(_, v) => handleWeightChange('recentWatchLimit', v as number)}
                min={10}
                max={200}
                step={10}
                valueLabelDisplay="auto"
                sx={{
                  color: accentColor,
                  '& .MuiSlider-thumb': {
                    bgcolor: accentColor,
                  },
                  '& .MuiSlider-track': {
                    bgcolor: accentColor,
                  },
                  '& .MuiSlider-rail': {
                    bgcolor: 'action.disabled',
                  },
                }}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Action Buttons */}
            <Box display="flex" gap={2} justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={1}>
                {saving && (
                  <>
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      Saving...
                    </Typography>
                  </>
                )}
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RestartAltIcon />}
                onClick={resetToDefaults}
                disabled={saving}
              >
                Reset to Defaults
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Changes are saved automatically and will take effect when your recommendations are next regenerated.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Include Watched Content */}
      <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <VisibilityIcon color="primary" />
            <Typography variant="h6">Include Watched Content</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Choose whether to include content you've already watched in your AI recommendations.
          </Typography>
          
          {loadingPrefs ? (
            <CircularProgress size={24} />
          ) : (
            <FormControlLabel
              control={
                <Switch
                  checked={includeWatched}
                  onChange={(e) => saveIncludeWatched(e.target.checked)}
                  disabled={savingPrefs}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight="medium">
                    {includeWatched ? 'Include Watched Content' : 'New Content Only'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {includeWatched 
                      ? 'Recommendations may include movies and series you\'ve already watched'
                      : 'Recommendations will only show content you haven\'t watched yet'}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', ml: 0 }}
            />
          )}
        </CardContent>
      </Card>

      {/* Disliked Content Handling */}
      <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <ThumbDownIcon color="primary" />
            <Typography variant="h6">Disliked Content Handling</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            How should content you've rated 1-3 hearts affect your recommendations?
          </Typography>
          
          {loadingPrefs ? (
            <CircularProgress size={24} />
          ) : (
            <FormControl component="fieldset">
              <RadioGroup
                value={dislikeBehavior}
                onChange={(e) => saveDislikeBehavior(e.target.value as 'exclude' | 'penalize')}
              >
                <FormControlLabel
                  value="exclude"
                  control={<Radio disabled={savingPrefs} />}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        Exclude Completely (Recommended)
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Content you dislike will never appear in recommendations
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mb: 1 }}
                />
                <FormControlLabel
                  value="penalize"
                  control={<Radio disabled={savingPrefs} />}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        Penalize But Allow
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        May still appear if strongly matching other preferences
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              </RadioGroup>
            </FormControl>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Disliked Items List */}
          <Typography variant="subtitle1" fontWeight="medium" mb={2}>
            Your Disliked Content ({dislikedMovies.length + dislikedSeries.length} items)
          </Typography>
          
          {loadingDisliked ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={24} />
            </Box>
          ) : dislikedMovies.length === 0 && dislikedSeries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No disliked content. Rate content with 1-3 hearts to add items here.
            </Typography>
          ) : (
            <Box 
              sx={{ 
                maxHeight: 300, 
                overflowY: 'auto', 
                border: 1, 
                borderColor: 'divider', 
                borderRadius: 1,
                p: 1,
              }}
            >
              {/* Movies */}
              {dislikedMovies.length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Movies ({dislikedMovies.length})
                  </Typography>
                  {dislikedMovies.map((item) => (
                    <Fade in key={item.id}>
                      <Box 
                        display="flex" 
                        alignItems="center" 
                        gap={2} 
                        py={1} 
                        px={1}
                        sx={{ 
                          borderBottom: 1, 
                          borderColor: 'divider',
                          '&:last-child': { borderBottom: 0 },
                        }}
                      >
                        <Avatar
                          src={item.posterUrl || undefined}
                          variant="rounded"
                          sx={{ width: 40, height: 56 }}
                        >
                          <MovieIcon />
                        </Avatar>
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight="medium" noWrap>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.year}
                          </Typography>
                        </Box>
                        <HeartRating
                          value={item.rating}
                          onChange={(newRating) => newRating && handleRatingChange(item.id, newRating, 'movie')}
                          size="small"
                        />
                        <IconButton 
                          size="small" 
                          onClick={() => handleClearRating(item.id, 'movie')}
                          title="Clear rating"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Fade>
                  ))}
                </>
              )}

              {/* Series */}
              {dislikedSeries.length > 0 && (
                <>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ display: 'block', mb: 1, mt: dislikedMovies.length > 0 ? 2 : 0 }}
                  >
                    TV Series ({dislikedSeries.length})
                  </Typography>
                  {dislikedSeries.map((item) => (
                    <Fade in key={item.id}>
                      <Box 
                        display="flex" 
                        alignItems="center" 
                        gap={2} 
                        py={1} 
                        px={1}
                        sx={{ 
                          borderBottom: 1, 
                          borderColor: 'divider',
                          '&:last-child': { borderBottom: 0 },
                        }}
                      >
                        <Avatar
                          src={item.posterUrl || undefined}
                          variant="rounded"
                          sx={{ width: 40, height: 56 }}
                        >
                          <TvIcon />
                        </Avatar>
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight="medium" noWrap>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.year}
                          </Typography>
                        </Box>
                        <HeartRating
                          value={item.rating}
                          onChange={(newRating) => newRating && handleRatingChange(item.id, newRating, 'series')}
                          size="small"
                        />
                        <IconButton 
                          size="small" 
                          onClick={() => handleClearRating(item.id, 'series')}
                          title="Clear rating"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Fade>
                  ))}
                </>
              )}
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Tip: Adjust hearts to change rating. Click ✕ to clear rating entirely (returns item to unrated pool).
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}

