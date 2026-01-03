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
  Divider,
  Grid,
  Chip,
  CircularProgress,
  Stack,
  InputAdornment,
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
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (!config) {
    return (
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Alert severity="error">Failed to load Top Picks configuration</Alert>
        </CardContent>
      </Card>
    )
  }

  // Ensure weights sum to 1.0
  const totalWeight = config.uniqueViewersWeight + config.playCountWeight + config.completionWeight
  const weightsValid = Math.abs(totalWeight - 1.0) < 0.01

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon color="primary" /> Top Picks Libraries
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create global libraries showing the most popular movies and series based on watch history from all users
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={config.isEnabled}
                onChange={(e) => updateConfig({ isEnabled: e.target.checked })}
                color="primary"
              />
            }
            label="Enable"
          />
        </Box>

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

        {config.lastRefreshedAt && (
          <Chip
            label={`Last refreshed: ${new Date(config.lastRefreshedAt).toLocaleString()}`}
            size="small"
            variant="outlined"
            sx={{ mb: 2 }}
          />
        )}

        <Divider sx={{ my: 2 }} />

        {/* Library Names */}
        <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
          Library Names
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Movies Library Name"
              value={config.moviesLibraryName}
              onChange={(e) => updateConfig({ moviesLibraryName: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MovieIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
              disabled={!config.isEnabled}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Series Library Name"
              value={config.seriesLibraryName}
              onChange={(e) => updateConfig({ seriesLibraryName: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <TvIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
              disabled={!config.isEnabled}
            />
          </Grid>
        </Grid>

        {/* Content Settings */}
        <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
          Content Settings
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
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
              helperText="Look back period"
              disabled={!config.isEnabled}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Movies Count"
              type="number"
              value={config.moviesCount}
              onChange={(e) => updateConfig({ moviesCount: parseInt(e.target.value) || 10 })}
              size="small"
              helperText="Top N movies"
              disabled={!config.isEnabled}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Series Count"
              type="number"
              value={config.seriesCount}
              onChange={(e) => updateConfig({ seriesCount: parseInt(e.target.value) || 10 })}
              size="small"
              helperText="Top N series"
              disabled={!config.isEnabled}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Min. Viewers"
              type="number"
              value={config.minUniqueViewers}
              onChange={(e) => updateConfig({ minUniqueViewers: parseInt(e.target.value) || 2 })}
              size="small"
              helperText="Minimum unique viewers"
              disabled={!config.isEnabled}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Popularity Weights */}
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          Popularity Weights
          {!weightsValid && (
            <Chip label="Must sum to 100%" size="small" color="error" variant="outlined" />
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Adjust how much each factor contributes to the popularity score. Weights must sum to 100%.
        </Typography>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <GroupIcon fontSize="small" color="primary" />
              <Typography variant="body2">Unique Viewers</Typography>
              <Typography variant="body2" color="primary" fontWeight="bold">
                {Math.round(config.uniqueViewersWeight * 100)}%
              </Typography>
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
              <Typography variant="body2">Play Count</Typography>
              <Typography variant="body2" color="primary" fontWeight="bold">
                {Math.round(config.playCountWeight * 100)}%
              </Typography>
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
              <Typography variant="body2">Completion Rate</Typography>
              <Typography variant="body2" color="primary" fontWeight="bold">
                {Math.round(config.completionWeight * 100)}%
              </Typography>
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

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
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
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !hasChanges || !weightsValid}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

