import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  TextField,
  Slider,
  Button,
  Alert,
  Grid,
  Chip,
  CircularProgress,
  Stack,
  InputAdornment,
  Checkbox,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import RestoreIcon from '@mui/icons-material/Restore'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import GroupIcon from '@mui/icons-material/Group'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FolderIcon from '@mui/icons-material/Folder'
import CollectionsIcon from '@mui/icons-material/Collections'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SettingsIcon from '@mui/icons-material/Settings'
import TuneIcon from '@mui/icons-material/Tune'
import OutputIcon from '@mui/icons-material/Output'

interface TopPicksConfig {
  isEnabled: boolean
  timeWindowDays: number
  moviesCount: number
  seriesCount: number
  uniqueViewersWeight: number
  playCountWeight: number
  completionWeight: number
  refreshCron: string
  lastRefreshedAt: string | null
  moviesLibraryName: string
  seriesLibraryName: string
  minUniqueViewers: number
  // Output format settings (separate for movies and series)
  moviesUseSymlinks: boolean
  seriesUseSymlinks: boolean
  // Movies output modes
  moviesLibraryEnabled: boolean
  moviesCollectionEnabled: boolean
  moviesPlaylistEnabled: boolean
  // Series output modes
  seriesLibraryEnabled: boolean
  seriesCollectionEnabled: boolean
  seriesPlaylistEnabled: boolean
  // Collection/Playlist names
  moviesCollectionName: string
  seriesCollectionName: string
}

export function TopPicksSection() {
  const [config, setConfig] = useState<TopPicksConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch config on mount
  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/top-picks')
      if (!response.ok) throw new Error('Failed to fetch config')
      const data = await response.json()
      setConfig(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/settings/top-picks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!response.ok) throw new Error('Failed to save config')
      setSuccess('Top Picks configuration saved!')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings/top-picks/reset', {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to reset config')
      const data = await response.json()
      setConfig(data)
      setSuccess('Configuration reset to defaults!')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleRefreshNow = async () => {
    try {
      const response = await fetch('/api/jobs/refresh-top-picks/run', {
        method: 'POST',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start job')
      }
      setSuccess('Top Picks refresh job started!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const updateConfig = (updates: Partial<TopPicksConfig>) => {
    if (!config) return
    setConfig({ ...config, ...updates })
    setHasChanges(true)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    )
  }

  if (!config) {
    return (
      <Alert severity="error">Failed to load Top Picks configuration</Alert>
    )
  }

  // Ensure weights sum to 1.0
  const totalWeight = config.uniqueViewersWeight + config.playCountWeight + config.completionWeight
  const weightsValid = Math.abs(totalWeight - 1.0) < 0.01

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Card */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUpIcon color="primary" /> Top Picks
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
                Create global "what's popular" libraries based on aggregated watch history from all users.
                Unlike personalized recommendations, Top Picks show the same content to everyone.
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={config.isEnabled}
                  onChange={(e) => updateConfig({ isEnabled: e.target.checked })}
                  color="primary"
                  size="medium"
                />
              }
              label={<Typography fontWeight={500}>{config.isEnabled ? 'Enabled' : 'Disabled'}</Typography>}
              labelPlacement="start"
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {config.lastRefreshedAt && (
            <Chip
              label={`Last refreshed: ${new Date(config.lastRefreshedAt).toLocaleString()}`}
              size="small"
              variant="outlined"
              sx={{ mt: 2 }}
            />
          )}
        </CardContent>
      </Card>

      {/* Section 1: What to Include */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SettingsIcon fontSize="small" color="primary" />
            Content Selection
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure which media to include in Top Picks and how much of it.
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Time Window"
                type="number"
                value={config.timeWindowDays}
                onChange={(e) => updateConfig({ timeWindowDays: parseInt(e.target.value) || 30 })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">days</InputAdornment>,
                }}
                size="small"
                helperText="How far back to look at watch history"
                disabled={!config.isEnabled}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Movies to Show"
                type="number"
                value={config.moviesCount}
                onChange={(e) => updateConfig({ moviesCount: parseInt(e.target.value) || 10 })}
                size="small"
                helperText="Number of top movies"
                disabled={!config.isEnabled}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Series to Show"
                type="number"
                value={config.seriesCount}
                onChange={(e) => updateConfig({ seriesCount: parseInt(e.target.value) || 10 })}
                size="small"
                helperText="Number of top series"
                disabled={!config.isEnabled}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Minimum Viewers"
                type="number"
                value={config.minUniqueViewers}
                onChange={(e) => updateConfig({ minUniqueViewers: parseInt(e.target.value) || 2 })}
                size="small"
                helperText="Required unique viewers to qualify"
                disabled={!config.isEnabled}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Section 2: Popularity Algorithm */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon fontSize="small" color="primary" />
                Popularity Algorithm
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Adjust how popularity is calculated. These weights determine which factors matter most.
              </Typography>
            </Box>
            {!weightsValid && (
              <Chip label="Weights must sum to 100%" size="small" color="error" />
            )}
          </Box>

          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ my: 2 }}>
            <Typography variant="body2">
              <strong>Unique Viewers</strong> = How many different people watched it (popularity breadth)<br />
              <strong>Play Count</strong> = Total number of plays across all users (engagement depth)<br />
              <strong>Completion Rate</strong> = How often people finish watching (quality signal)
            </Typography>
          </Alert>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <GroupIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>Unique Viewers</Typography>
                <Chip 
                  label={`${Math.round(config.uniqueViewersWeight * 100)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={config.uniqueViewersWeight * 100}
                onChange={(_, value) => updateConfig({ uniqueViewersWeight: (value as number) / 100 })}
                min={0}
                max={100}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <PlayArrowIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>Play Count</Typography>
                <Chip 
                  label={`${Math.round(config.playCountWeight * 100)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={config.playCountWeight * 100}
                onChange={(_, value) => updateConfig({ playCountWeight: (value as number) / 100 })}
                min={0}
                max={100}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircleIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500}>Completion Rate</Typography>
                <Chip 
                  label={`${Math.round(config.completionWeight * 100)}%`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Slider
                value={config.completionWeight * 100}
                onChange={(_, value) => updateConfig({ completionWeight: (value as number) / 100 })}
                min={0}
                max={100}
                disabled={!config.isEnabled}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}%`}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Section 3: Output Configuration */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <OutputIcon fontSize="small" color="primary" />
            Output Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose how Top Picks appear in your media server. You can enable multiple output types simultaneously.
          </Typography>

          {/* Output Type Explanations */}
          <Accordion defaultExpanded={false} sx={{ mb: 3, bgcolor: 'action.hover' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoOutlinedIcon fontSize="small" />
                What's the difference between Library, Collection, and Playlist?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <FolderIcon fontSize="small" color="primary" /> Library
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Appears as a separate library in your media server sidebar. Contains virtual copies (STRM files) of the media.
                      Best for dedicated browsing of Top Picks.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CollectionsIcon fontSize="small" color="primary" /> Collection (Box Set)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Groups your existing library items into a "box set" that appears when browsing.
                      Uses your original media files directly. Best for organization within existing libraries.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PlaylistPlayIcon fontSize="small" color="primary" /> Playlist
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Creates an ordered playlist in the Playlists section.
                      Uses your original media files directly. Best for sequential watching or shuffle play.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Movies Output Config */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MovieIcon color="primary" />
                Movies Output
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    Output Types (select one or more)
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesLibraryEnabled}
                          onChange={(e) => updateConfig({ moviesLibraryEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon fontSize="small" />
                          <Typography variant="body2">Library (sidebar)</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesCollectionEnabled}
                          onChange={(e) => updateConfig({ moviesCollectionEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CollectionsIcon fontSize="small" />
                          <Typography variant="body2">Collection (Box Set)</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesPlaylistEnabled}
                          onChange={(e) => updateConfig({ moviesPlaylistEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PlaylistPlayIcon fontSize="small" />
                          <Typography variant="body2">Playlist</Typography>
                        </Box>
                      }
                    />
                  </FormGroup>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        Names
                      </Typography>
                      {config.moviesLibraryEnabled && (
                        <TextField
                          fullWidth
                          label="Library Name"
                          value={config.moviesLibraryName}
                          onChange={(e) => updateConfig({ moviesLibraryName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                          sx={{ mb: 2 }}
                        />
                      )}
                      {(config.moviesCollectionEnabled || config.moviesPlaylistEnabled) && (
                        <TextField
                          fullWidth
                          label="Collection/Playlist Name"
                          value={config.moviesCollectionName}
                          onChange={(e) => updateConfig({ moviesCollectionName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                        />
                      )}
                    </Box>
                    
                    {config.moviesLibraryEnabled && (
                      <Box>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          Library File Type
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={config.moviesUseSymlinks}
                              onChange={(e) => updateConfig({ moviesUseSymlinks: e.target.checked })}
                              disabled={!config.isEnabled}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {config.moviesUseSymlinks ? 'Symlinks' : 'STRM Files'}
                            </Typography>
                          }
                        />
                      </Box>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Series Output Config */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TvIcon color="primary" />
                Series Output
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    Output Types (select one or more)
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesLibraryEnabled}
                          onChange={(e) => updateConfig({ seriesLibraryEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon fontSize="small" />
                          <Typography variant="body2">Library (sidebar)</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesCollectionEnabled}
                          onChange={(e) => updateConfig({ seriesCollectionEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CollectionsIcon fontSize="small" />
                          <Typography variant="body2">Collection (Box Set)</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesPlaylistEnabled}
                          onChange={(e) => updateConfig({ seriesPlaylistEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PlaylistPlayIcon fontSize="small" />
                          <Typography variant="body2">Playlist</Typography>
                        </Box>
                      }
                    />
                  </FormGroup>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        Names
                      </Typography>
                      {config.seriesLibraryEnabled && (
                        <TextField
                          fullWidth
                          label="Library Name"
                          value={config.seriesLibraryName}
                          onChange={(e) => updateConfig({ seriesLibraryName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                          sx={{ mb: 2 }}
                        />
                      )}
                      {(config.seriesCollectionEnabled || config.seriesPlaylistEnabled) && (
                        <TextField
                          fullWidth
                          label="Collection/Playlist Name"
                          value={config.seriesCollectionName}
                          onChange={(e) => updateConfig({ seriesCollectionName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                        />
                      )}
                    </Box>
                    
                    {config.seriesLibraryEnabled && (
                      <Box>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          Library File Type
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={config.seriesUseSymlinks}
                              onChange={(e) => updateConfig({ seriesUseSymlinks: e.target.checked })}
                              disabled={!config.isEnabled}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {config.seriesUseSymlinks ? 'Symlinks' : 'STRM Files'}
                            </Typography>
                          }
                        />
                      </Box>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Symlink Warning */}
          {(config.moviesUseSymlinks || config.seriesUseSymlinks) && (
            <Alert severity="warning" icon={<WarningAmberIcon />}>
              <Typography variant="body2">
                <strong>Symlinks</strong> require that Aperture can access your media files at the exact same paths that your media server uses.
                If paths differ between systems (e.g., Docker containers), use STRM files instead.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RestoreIcon />}
                onClick={handleReset}
                disabled={saving}
              >
                Reset to Defaults
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefreshNow}
                disabled={!config.isEnabled}
              >
                Refresh Now
              </Button>
            </Stack>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges || !weightsValid}
              size="large"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
