import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  CircularProgress,
  Chip,
  Divider,
  Tooltip,
  Slider,
  FormControl,
  FormHelperText,
  InputAdornment,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import MovieIcon from '@mui/icons-material/Movie'
import TuneIcon from '@mui/icons-material/Tune'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import WarningIcon from '@mui/icons-material/Warning'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import PsychologyIcon from '@mui/icons-material/Psychology'
import { useAuth } from '@/hooks/useAuth'

interface LibraryConfig {
  id: string
  providerLibraryId: string
  name: string
  collectionType: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface RecommendationConfig {
  maxCandidates: number
  selectedCount: number
  recentWatchLimit: number
  similarityWeight: number
  noveltyWeight: number
  ratingWeight: number
  diversityWeight: number
  updatedAt: string
}

interface PurgeStats {
  movies: number
  embeddings: number
  watchHistory: number
  recommendations: number
  userPreferences: number
}

interface UserSettings {
  userId: string
  libraryName: string | null
  createdAt: string
  updatedAt: string
}

interface EmbeddingModelInfo {
  id: string
  name: string
  description: string
  dimensions: number
  costPer1M: string
}

interface EmbeddingModelConfig {
  currentModel: string
  availableModels: EmbeddingModelInfo[]
  movieCount: number
  embeddingsByModel: Record<string, number>
}

const MAX_UNLIMITED = 999999999

export function SettingsPage() {
  const { user } = useAuth()
  const [libraries, setLibraries] = useState<LibraryConfig[]>([])
  const [loadingLibraries, setLoadingLibraries] = useState(false)
  const [syncingLibraries, setSyncingLibraries] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [updatingLibrary, setUpdatingLibrary] = useState<string | null>(null)

  // Recommendation config state
  const [recConfig, setRecConfig] = useState<RecommendationConfig | null>(null)
  const [loadingRecConfig, setLoadingRecConfig] = useState(false)
  const [savingRecConfig, setSavingRecConfig] = useState(false)
  const [recConfigError, setRecConfigError] = useState<string | null>(null)
  const [recConfigSuccess, setRecConfigSuccess] = useState<string | null>(null)
  const [recConfigDirty, setRecConfigDirty] = useState(false)

  // Purge state
  const [purgeStats, setPurgeStats] = useState<PurgeStats | null>(null)
  const [loadingPurgeStats, setLoadingPurgeStats] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null)
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)

  // User settings state
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [defaultLibraryPrefix, setDefaultLibraryPrefix] = useState<string>('AI Picks - ')
  const [loadingUserSettings, setLoadingUserSettings] = useState(false)
  const [savingUserSettings, setSavingUserSettings] = useState(false)
  const [userSettingsError, setUserSettingsError] = useState<string | null>(null)
  const [userSettingsSuccess, setUserSettingsSuccess] = useState<string | null>(null)
  const [libraryNameInput, setLibraryNameInput] = useState<string>('')

  // Embedding model state
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingModelConfig | null>(null)
  const [loadingEmbeddingModel, setLoadingEmbeddingModel] = useState(false)

  // Fetch configs on mount
  useEffect(() => {
    fetchLibraries()
    fetchUserSettings()
    if (user?.isAdmin) {
      fetchRecConfig()
      fetchPurgeStats()
      fetchEmbeddingModel()
    }
  }, [user?.isAdmin])

  const fetchEmbeddingModel = async () => {
    setLoadingEmbeddingModel(true)
    try {
      const response = await fetch('/api/settings/embedding-model', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setEmbeddingConfig(data)
      }
    } catch {
      // Silently fail - this is just status display
    } finally {
      setLoadingEmbeddingModel(false)
    }
  }

  const fetchPurgeStats = async () => {
    setLoadingPurgeStats(true)
    try {
      const response = await fetch('/api/admin/purge/stats', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setPurgeStats(data.stats)
      }
    } catch {
      // Silently fail - stats are optional
    } finally {
      setLoadingPurgeStats(false)
    }
  }

  const fetchUserSettings = async () => {
    setLoadingUserSettings(true)
    setUserSettingsError(null)
    try {
      const response = await fetch('/api/settings/user', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setUserSettings(data.settings)
        setDefaultLibraryPrefix(data.defaults?.libraryNamePrefix || 'AI Picks - ')
        setLibraryNameInput(data.settings.libraryName || '')
      } else {
        const err = await response.json()
        setUserSettingsError(err.error || 'Failed to load user settings')
      }
    } catch {
      setUserSettingsError('Could not connect to server')
    } finally {
      setLoadingUserSettings(false)
    }
  }

  const saveUserSettings = async () => {
    setSavingUserSettings(true)
    setUserSettingsError(null)
    setUserSettingsSuccess(null)
    try {
      const response = await fetch('/api/settings/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          libraryName: libraryNameInput.trim() || null,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setUserSettings(data.settings)
        setUserSettingsSuccess('Library name saved! It will be used for future library updates.')
        setTimeout(() => setUserSettingsSuccess(null), 5000)
      } else {
        const err = await response.json()
        setUserSettingsError(err.error || 'Failed to save settings')
      }
    } catch {
      setUserSettingsError('Could not connect to server')
    } finally {
      setSavingUserSettings(false)
    }
  }

  const executePurge = async () => {
    setPurging(true)
    setPurgeError(null)
    setPurgeSuccess(null)
    try {
      const response = await fetch('/api/admin/purge/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: true }),
      })
      if (response.ok) {
        const data = await response.json()
        setPurgeSuccess(`Purged: ${data.result.moviesDeleted} movies, ${data.result.embeddingsDeleted} embeddings, ${data.result.watchHistoryDeleted} watch history entries`)
        setShowPurgeConfirm(false)
        // Refresh stats
        fetchPurgeStats()
      } else {
        const err = await response.json()
        setPurgeError(err.error || 'Failed to purge database')
      }
    } catch {
      setPurgeError('Could not connect to server')
    } finally {
      setPurging(false)
    }
  }

  const fetchRecConfig = async () => {
    setLoadingRecConfig(true)
    setRecConfigError(null)
    try {
      const response = await fetch('/api/settings/recommendations', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setRecConfig(data.config)
        setRecConfigDirty(false)
      } else {
        const err = await response.json()
        setRecConfigError(err.error || 'Failed to load recommendation config')
      }
    } catch {
      setRecConfigError('Could not connect to server')
    } finally {
      setLoadingRecConfig(false)
    }
  }

  const saveRecConfig = async () => {
    if (!recConfig) return
    setSavingRecConfig(true)
    setRecConfigError(null)
    setRecConfigSuccess(null)
    try {
      const response = await fetch('/api/settings/recommendations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          maxCandidates: recConfig.maxCandidates,
          selectedCount: recConfig.selectedCount,
          recentWatchLimit: recConfig.recentWatchLimit,
          similarityWeight: recConfig.similarityWeight,
          noveltyWeight: recConfig.noveltyWeight,
          ratingWeight: recConfig.ratingWeight,
          diversityWeight: recConfig.diversityWeight,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setRecConfig(data.config)
        setRecConfigDirty(false)
        setRecConfigSuccess('Configuration saved! Changes apply to next recommendation run.')
        setTimeout(() => setRecConfigSuccess(null), 5000)
      } else {
        const err = await response.json()
        setRecConfigError(err.error || 'Failed to save configuration')
      }
    } catch {
      setRecConfigError('Could not connect to server')
    } finally {
      setSavingRecConfig(false)
    }
  }

  const resetRecConfig = async () => {
    setSavingRecConfig(true)
    setRecConfigError(null)
    setRecConfigSuccess(null)
    try {
      const response = await fetch('/api/settings/recommendations/reset', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setRecConfig(data.config)
        setRecConfigDirty(false)
        setRecConfigSuccess('Configuration reset to defaults!')
        setTimeout(() => setRecConfigSuccess(null), 5000)
      } else {
        const err = await response.json()
        setRecConfigError(err.error || 'Failed to reset configuration')
      }
    } catch {
      setRecConfigError('Could not connect to server')
    } finally {
      setSavingRecConfig(false)
    }
  }

  const updateRecConfigField = <K extends keyof RecommendationConfig>(
    field: K,
    value: RecommendationConfig[K]
  ) => {
    if (!recConfig) return
    setRecConfig({ ...recConfig, [field]: value })
    setRecConfigDirty(true)
  }

  const totalWeight =
    (recConfig?.similarityWeight || 0) +
    (recConfig?.noveltyWeight || 0) +
    (recConfig?.ratingWeight || 0) +
    (recConfig?.diversityWeight || 0)

  const fetchLibraries = async () => {
    setLoadingLibraries(true)
    setLibraryError(null)
    try {
      const response = await fetch('/api/settings/libraries', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setLibraries(data.libraries)
      } else {
        const err = await response.json()
        setLibraryError(err.error || 'Failed to load libraries')
      }
    } catch {
      setLibraryError('Could not connect to server')
    } finally {
      setLoadingLibraries(false)
    }
  }

  const syncLibrariesFromServer = async () => {
    setSyncingLibraries(true)
    setLibraryError(null)
    try {
      const response = await fetch('/api/settings/libraries/sync', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setLibraries(data.libraries)
      } else {
        const err = await response.json()
        setLibraryError(err.error || 'Failed to sync libraries')
      }
    } catch {
      setLibraryError('Could not connect to server')
    } finally {
      setSyncingLibraries(false)
    }
  }

  const toggleLibraryEnabled = async (providerLibraryId: string, isEnabled: boolean) => {
    setUpdatingLibrary(providerLibraryId)
    try {
      const response = await fetch(`/api/settings/libraries/${providerLibraryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled }),
      })
      if (response.ok) {
        setLibraries((prev) =>
          prev.map((lib) =>
            lib.providerLibraryId === providerLibraryId ? { ...lib, isEnabled } : lib
          )
        )
      }
    } catch {
      // Revert on error
      setLibraries((prev) =>
        prev.map((lib) =>
          lib.providerLibraryId === providerLibraryId ? { ...lib, isEnabled: !isEnabled } : lib
        )
      )
    } finally {
      setUpdatingLibrary(null)
    }
  }

  const enabledCount = libraries.filter((l) => l.isEnabled).length

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Configure Aperture
      </Typography>

      <Grid container spacing={3}>
        {/* Library Configuration - Full Width for prominence */}
        {user?.isAdmin && (
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography variant="h6">
                      Library Configuration
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Select which movie libraries to include when syncing movies
                    </Typography>
                  </Box>
                  <Box display="flex" gap={1}>
                    <Tooltip title="Refresh library list from media server">
                      <Button
                        variant="outlined"
                        startIcon={syncingLibraries ? <CircularProgress size={16} /> : <RefreshIcon />}
                        onClick={syncLibrariesFromServer}
                        disabled={syncingLibraries}
                        size="small"
                      >
                        {syncingLibraries ? 'Syncing...' : 'Sync from Media Server'}
                      </Button>
                    </Tooltip>
                  </Box>
                </Box>

                {libraryError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {libraryError}
                  </Alert>
                )}

                {loadingLibraries ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : libraries.length === 0 ? (
                  <Alert severity="info">
                    No libraries configured yet. Click "Sync from Media Server" to fetch your movie libraries.
                  </Alert>
                ) : (
                  <>
                    <Box mb={2}>
                      <Chip
                        label={`${enabledCount} of ${libraries.length} libraries enabled`}
                        color={enabledCount > 0 ? 'primary' : 'default'}
                        size="small"
                      />
                      {enabledCount === 0 && libraries.length > 0 && (
                        <Typography variant="caption" color="warning.main" sx={{ ml: 2 }}>
                          ⚠️ No libraries enabled - movie sync will be skipped
                        </Typography>
                      )}
                    </Box>

                    <List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
                      {libraries.map((lib, index) => (
                        <React.Fragment key={lib.id}>
                          {index > 0 && <Divider />}
                          <ListItem>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mr: 2,
                                color: lib.isEnabled ? 'primary.main' : 'text.secondary',
                              }}
                            >
                              <MovieIcon />
                            </Box>
                            <ListItemText
                              primary={
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Typography fontWeight={500}>{lib.name}</Typography>
                                  <Chip
                                    label={lib.collectionType}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                </Box>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  ID: {lib.providerLibraryId}
                                </Typography>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Switch
                                edge="end"
                                checked={lib.isEnabled}
                                onChange={(e) =>
                                  toggleLibraryEnabled(lib.providerLibraryId, e.target.checked)
                                }
                                disabled={updatingLibrary === lib.providerLibraryId}
                              />
                            </ListItemSecondaryAction>
                          </ListItem>
                        </React.Fragment>
                      ))}
                    </List>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                      Changes take effect on the next movie sync. Run the "Sync Movies" job after making changes.
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Recommendation Algorithm Configuration */}
        {user?.isAdmin && (
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TuneIcon color="primary" />
                    <Box>
                      <Typography variant="h6">Recommendation Algorithm</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Fine-tune how recommendations are generated for all users
                      </Typography>
                    </Box>
                  </Box>
                  <Box display="flex" gap={1}>
                    <Tooltip title="Reset all settings to defaults">
                      <Button
                        variant="outlined"
                        startIcon={<RestartAltIcon />}
                        onClick={resetRecConfig}
                        disabled={savingRecConfig || loadingRecConfig}
                        size="small"
                      >
                        Reset Defaults
                      </Button>
                    </Tooltip>
                    <Button
                      variant="contained"
                      startIcon={savingRecConfig ? <CircularProgress size={16} /> : <SaveIcon />}
                      onClick={saveRecConfig}
                      disabled={savingRecConfig || loadingRecConfig || !recConfigDirty}
                      size="small"
                    >
                      {savingRecConfig ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </Box>
                </Box>

                {recConfigError && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRecConfigError(null)}>
                    {recConfigError}
                  </Alert>
                )}

                {recConfigSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRecConfigSuccess(null)}>
                    {recConfigSuccess}
                  </Alert>
                )}

                {loadingRecConfig ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : recConfig ? (
                  <Grid container spacing={4}>
                    {/* Count Settings */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Candidate Selection
                      </Typography>

                      {/* Max Candidates */}
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          Max Candidates to Consider
                        </Typography>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Slider
                            value={recConfig.maxCandidates >= MAX_UNLIMITED ? 100 : Math.min(recConfig.maxCandidates / 1000, 100)}
                            onChange={(_, v) => {
                              const val = v as number
                              updateRecConfigField('maxCandidates', val >= 100 ? MAX_UNLIMITED : val * 1000)
                            }}
                            min={5}
                            max={100}
                            marks={[
                              { value: 5, label: '5K' },
                              { value: 25, label: '25K' },
                              { value: 50, label: '50K' },
                              { value: 100, label: '∞' },
                            ]}
                            sx={{ flex: 1 }}
                          />
                          <Chip
                            label={recConfig.maxCandidates >= MAX_UNLIMITED ? 'UNLIMITED' : `${(recConfig.maxCandidates / 1000).toFixed(0)}K`}
                            color={recConfig.maxCandidates >= MAX_UNLIMITED ? 'success' : 'default'}
                            size="small"
                            sx={{ minWidth: 90 }}
                          />
                        </Box>
                        <FormHelperText>
                          How many movies to evaluate. <strong>Lower:</strong> faster generation. <strong>Higher/Unlimited:</strong> more thorough, considers entire library.
                        </FormHelperText>
                      </FormControl>

                      {/* Selected Count */}
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          Recommendations Per User
                        </Typography>
                        <TextField
                          type="number"
                          value={recConfig.selectedCount}
                          onChange={(e) => updateRecConfigField('selectedCount', Math.max(1, parseInt(e.target.value) || 1))}
                          size="small"
                          InputProps={{
                            inputProps: { min: 1, max: 500 },
                            endAdornment: <InputAdornment position="end">movies</InputAdornment>,
                          }}
                        />
                        <FormHelperText>
                          Final number of recommendations shown per user (1-500).
                        </FormHelperText>
                      </FormControl>

                      {/* Recent Watch Limit */}
                      <FormControl fullWidth>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          Taste Profile Size
                        </Typography>
                        <TextField
                          type="number"
                          value={recConfig.recentWatchLimit}
                          onChange={(e) => updateRecConfigField('recentWatchLimit', Math.max(1, parseInt(e.target.value) || 1))}
                          size="small"
                          InputProps={{
                            inputProps: { min: 1, max: 500 },
                            endAdornment: <InputAdornment position="end">recent watches</InputAdornment>,
                          }}
                        />
                        <FormHelperText>
                          Number of recently watched movies used to build taste profile. <strong>Lower:</strong> focuses on very recent preferences. <strong>Higher:</strong> broader taste analysis.
                        </FormHelperText>
                      </FormControl>
                    </Grid>

                    {/* Weight Sliders */}
                    <Grid item xs={12} md={6}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          Scoring Weights
                        </Typography>
                        <Chip
                          label={`Total: ${(totalWeight * 100).toFixed(0)}%`}
                          color={Math.abs(totalWeight - 1) < 0.01 ? 'success' : 'warning'}
                          size="small"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                        Controls how different factors influence the final score. Ideally should sum to 100%.
                      </Typography>

                      {/* Similarity Weight */}
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={500}>
                            Taste Similarity
                          </Typography>
                          <Typography variant="body2" color="primary" fontWeight={600}>
                            {(recConfig.similarityWeight * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                        <Slider
                          value={recConfig.similarityWeight * 100}
                          onChange={(_, v) => updateRecConfigField('similarityWeight', (v as number) / 100)}
                          min={0}
                          max={100}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(v) => `${v}%`}
                        />
                        <FormHelperText>
                          How closely a movie matches user's taste profile. <strong>Low:</strong> more variety, less predictable. <strong>High:</strong> safer picks based on what they like.
                        </FormHelperText>
                      </FormControl>

                      {/* Novelty Weight */}
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={500}>
                            Genre Discovery
                          </Typography>
                          <Typography variant="body2" color="primary" fontWeight={600}>
                            {(recConfig.noveltyWeight * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                        <Slider
                          value={recConfig.noveltyWeight * 100}
                          onChange={(_, v) => updateRecConfigField('noveltyWeight', (v as number) / 100)}
                          min={0}
                          max={100}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(v) => `${v}%`}
                        />
                        <FormHelperText>
                          Rewards movies with some unfamiliar genres. <strong>Low:</strong> stick to known genres. <strong>High:</strong> encourage exploring new genres.
                        </FormHelperText>
                      </FormControl>

                      {/* Rating Weight */}
                      <FormControl fullWidth sx={{ mb: 3 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={500}>
                            Community Rating
                          </Typography>
                          <Typography variant="body2" color="primary" fontWeight={600}>
                            {(recConfig.ratingWeight * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                        <Slider
                          value={recConfig.ratingWeight * 100}
                          onChange={(_, v) => updateRecConfigField('ratingWeight', (v as number) / 100)}
                          min={0}
                          max={100}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(v) => `${v}%`}
                        />
                        <FormHelperText>
                          Favor highly-rated movies. <strong>Low:</strong> rating doesn't matter. <strong>High:</strong> prioritize critically acclaimed films.
                        </FormHelperText>
                      </FormControl>

                      {/* Diversity Weight */}
                      <FormControl fullWidth>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={500}>
                            Result Diversity
                          </Typography>
                          <Typography variant="body2" color="primary" fontWeight={600}>
                            {(recConfig.diversityWeight * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                        <Slider
                          value={recConfig.diversityWeight * 100}
                          onChange={(_, v) => updateRecConfigField('diversityWeight', (v as number) / 100)}
                          min={0}
                          max={100}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(v) => `${v}%`}
                        />
                        <FormHelperText>
                          Ensure variety in final recommendations. <strong>Low:</strong> may cluster similar movies. <strong>High:</strong> spreads across different genres.
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                  </Grid>
                ) : (
                  <Alert severity="warning">
                    Could not load recommendation configuration. Try refreshing the page.
                  </Alert>
                )}

                <Divider sx={{ my: 3 }} />
                <Typography variant="caption" color="text.secondary">
                  ⚡ Changes apply to the next recommendation generation. Run "Generate Recommendations" job after saving.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Media Server Configuration */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" mb={3}>
                Media Server
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                Media server configuration is managed via environment variables in <code>.env.local</code>.
                Restart the container after making changes.
              </Alert>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Required environment variables:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, color: 'text.secondary' }}>
                <li><code>MEDIA_SERVER_TYPE</code> - emby or jellyfin</li>
                <li><code>MEDIA_SERVER_BASE_URL</code> - Server URL (e.g., http://emby:8096)</li>
                <li><code>MEDIA_SERVER_API_KEY</code> - Admin API key</li>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* AI Embeddings Status */}
        {user?.isAdmin && (
          <Grid item xs={12} lg={6}>
            <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <PsychologyIcon color="primary" />
                  <Typography variant="h6">AI Embeddings</Typography>
                  <Chip label="text-embedding-3-large" size="small" color="success" />
                </Box>

                <Typography variant="body2" color="text.secondary" mb={3}>
                  Using OpenAI's best embedding model with 3,072 dimensions for highest quality 
                  recommendations. Captures nuanced similarities in director styles, themes, and tone.
                </Typography>

                {loadingEmbeddingModel ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : embeddingConfig ? (
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">Movies</Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {embeddingConfig.movieCount.toLocaleString()}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">Embeddings</Typography>
                        <Typography variant="h6" fontWeight={600}>
                          {Object.values(embeddingConfig.embeddingsByModel).reduce((a, b) => a + b, 0).toLocaleString()}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="body2" color="text.secondary">Est. Cost</Typography>
                        <Typography variant="h6" fontWeight={600} color="success.main">
                          {(() => {
                            const tokensPerMovie = 300
                            const totalTokens = embeddingConfig.movieCount * tokensPerMovie
                            const cost = (totalTokens / 1_000_000) * 0.13
                            return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`
                          })()}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                ) : (
                  <Alert severity="warning">
                    Could not load embedding status.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* STRM Configuration */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" mb={3}>
                STRM Libraries
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                STRM configuration is managed via environment variables in <code>.env.local</code>.
              </Alert>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Configuration options:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, color: 'text.secondary' }}>
                <li><code>AI_LIBRARY_NAME_PREFIX</code> - Library name prefix (default: "AI Picks - ")</li>
                <li><code>AI_LIBRARY_PATH_PREFIX</code> - Path prefix (default: /strm/aperture/)</li>
                <li><code>MEDIA_SERVER_STRM_ROOT</code> - STRM root directory (default: /strm)</li>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Database Management - Admin Only */}
        {user?.isAdmin && (
          <Grid item xs={12} lg={6}>
            <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'error.dark' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <DeleteForeverIcon color="error" />
                  <Typography variant="h6" color="error.main">
                    Database Management
                  </Typography>
                </Box>

                <Alert severity="warning" sx={{ mb: 3 }}>
                  <strong>Danger Zone!</strong> These actions are irreversible and will delete data.
                </Alert>

                {purgeError && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPurgeError(null)}>
                    {purgeError}
                  </Alert>
                )}

                {purgeSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPurgeSuccess(null)}>
                    {purgeSuccess}
                  </Alert>
                )}

                {/* Current Stats */}
                {loadingPurgeStats ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : purgeStats && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Current Database Contents:</Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Movies: <strong>{purgeStats.movies.toLocaleString()}</strong>
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Embeddings: <strong>{purgeStats.embeddings.toLocaleString()}</strong>
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Watch History: <strong>{purgeStats.watchHistory.toLocaleString()}</strong>
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Recommendations: <strong>{purgeStats.recommendations.toLocaleString()}</strong>
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {!showPurgeConfirm ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      Purge all movie data to start fresh. This will delete all movies, embeddings, 
                      watch history, recommendations, and taste profiles. Library configuration and 
                      users are preserved.
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteForeverIcon />}
                      onClick={() => setShowPurgeConfirm(true)}
                      disabled={purging}
                    >
                      Purge Movie Database
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ p: 2, bgcolor: 'error.dark', borderRadius: 1, color: 'error.contrastText' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <WarningIcon />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Confirm Purge
                      </Typography>
                    </Box>
                    <Typography variant="body2" mb={2}>
                      This will permanently delete:
                    </Typography>
                    <Box component="ul" sx={{ m: 0, mb: 2, pl: 2 }}>
                      <li>All {purgeStats?.movies.toLocaleString() || 0} movies</li>
                      <li>All {purgeStats?.embeddings.toLocaleString() || 0} AI embeddings</li>
                      <li>All {purgeStats?.watchHistory.toLocaleString() || 0} watch history entries</li>
                      <li>All recommendations and taste profiles</li>
                    </Box>
                    <Typography variant="body2" mb={2}>
                      After purging, you'll need to re-run: Sync Movies → Generate Embeddings → Sync Watch History → Generate Recommendations
                    </Typography>
                    <Box display="flex" gap={1}>
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={purging ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
                        onClick={executePurge}
                        disabled={purging}
                      >
                        {purging ? 'Purging...' : 'Yes, Purge Everything'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => setShowPurgeConfirm(false)}
                        disabled={purging}
                        sx={{ color: 'error.contrastText', borderColor: 'error.contrastText' }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Personal Preferences - Library Name */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <VideoLibraryIcon color="primary" />
                <Typography variant="h6">
                  Personal Preferences
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Customize your AI recommendations library name as it appears in your media server.
              </Typography>

              {userSettingsError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUserSettingsError(null)}>
                  {userSettingsError}
                </Alert>
              )}

              {userSettingsSuccess && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setUserSettingsSuccess(null)}>
                  {userSettingsSuccess}
                </Alert>
              )}

              {loadingUserSettings ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={500} gutterBottom>
                      Library Name
                    </Typography>
                    <TextField
                      placeholder={`${defaultLibraryPrefix}${user?.displayName || user?.username || 'User'}`}
                      value={libraryNameInput}
                      onChange={(e) => setLibraryNameInput(e.target.value)}
                      size="small"
                      fullWidth
                      inputProps={{ maxLength: 100 }}
                      helperText={
                        libraryNameInput
                          ? `Your library will be named: "${libraryNameInput}"`
                          : `Leave empty to use default: "${defaultLibraryPrefix}${user?.displayName || user?.username || 'User'}"`
                      }
                    />
                  </FormControl>

                  <Box display="flex" gap={1}>
                    <Button
                      variant="contained"
                      startIcon={savingUserSettings ? <CircularProgress size={16} /> : <SaveIcon />}
                      onClick={saveUserSettings}
                      disabled={savingUserSettings}
                      size="small"
                    >
                      {savingUserSettings ? 'Saving...' : 'Save'}
                    </Button>
                    {libraryNameInput && (
                      <Button
                        variant="outlined"
                        onClick={() => setLibraryNameInput('')}
                        disabled={savingUserSettings}
                        size="small"
                      >
                        Reset to Default
                      </Button>
                    )}
                  </Box>

                  <Divider sx={{ my: 3 }} />

                  <Typography variant="caption" color="text.secondary">
                    💡 Changes will apply the next time the "Update Permissions" job runs or when recommendations are regenerated.
                    If you already have a library with the old name, you may need to manually delete it from your media server.
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Profile */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" mb={3}>
                Your Profile
              </Typography>

              <TextField
                label="Username"
                value={user?.username || ''}
                fullWidth
                margin="normal"
                disabled
              />

              <TextField
                label="Display Name"
                value={user?.displayName || user?.username || ''}
                fullWidth
                margin="normal"
                disabled
              />

              <TextField
                label="Provider"
                value={user?.provider || ''}
                fullWidth
                margin="normal"
                disabled
              />

              <TextField
                label="Role"
                value={user?.isAdmin ? 'Administrator' : 'User'}
                fullWidth
                margin="normal"
                disabled
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
