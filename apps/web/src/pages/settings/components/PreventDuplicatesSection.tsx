import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Divider,
  CircularProgress,
  Stack,
  Chip,
  Collapse,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ScienceIcon from '@mui/icons-material/Science'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove'

interface PreventDuplicatesConfig {
  enabled: boolean
}

export function PreventDuplicatesSection() {
  const [config, setConfig] = useState<PreventDuplicatesConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/prevent-duplicate-continue-watching')
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
      const response = await fetch('/api/settings/prevent-duplicate-continue-watching', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!response.ok) throw new Error('Failed to save config')
      setSuccess('Settings saved! Remember to rebuild your libraries for the change to take effect.')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<PreventDuplicatesConfig>) => {
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
          <Alert severity="error">Failed to load configuration</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlaylistRemoveIcon color="primary" /> 
              Prevent Duplicate Continue Watching
              <Chip 
                label="Experimental" 
                size="small" 
                icon={<ScienceIcon />}
                color="warning"
                sx={{ ml: 1 }}
              />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Prevents items from appearing twice in the "Continue Watching" row
            </Typography>
          </Box>
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

        <Divider sx={{ my: 2 }} />

        {/* Main Toggle */}
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={(e) => updateConfig({ enabled: e.target.checked })}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  Enable Duplicate Prevention
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Uses modified provider IDs so Emby/Jellyfin won't link Aperture items to originals
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0 }}
          />
        </Box>

        {/* Warning when enabled */}
        {config.enabled && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Important:</strong> After enabling or disabling this setting, you must rebuild your 
              AI recommendation libraries (Jobs → Rebuild Libraries) for the change to take effect.
            </Typography>
          </Alert>
        )}

        {/* Expand/Collapse for details */}
        <Button
          onClick={() => setShowDetails(!showDetails)}
          endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mb: 2, textTransform: 'none' }}
          size="small"
        >
          {showDetails ? 'Hide details' : 'How does this work?'}
        </Button>

        <Collapse in={showDetails}>
          <Card variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              The Problem
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              When you watch a movie from an Aperture recommendation library, both the original 
              and the Aperture copy can appear in "Continue Watching" because they share the same 
              IMDB/TMDB IDs. Emby/Jellyfin links them together.
            </Typography>

            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              The Workaround
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              This feature prefixes provider IDs with <code>aperture-</code> so they won't match 
              the originals. For example, <code>tt1234567</code> becomes <code>aperture-tt1234567</code>.
            </Typography>

            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              Watch History Attribution
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Since prefixed IDs break normal watch tracking, Aperture runs a sync job every 30 minutes 
              that detects plays on prefixed items, extracts the real ID, finds the original in your 
              library, and marks it as watched.
            </Typography>

            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              Trade-offs
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                Up to 30-minute delay before originals are marked as watched
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Requires library rebuild after toggling this setting
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                This is a workaround for a media server limitation, not a perfect solution
              </Typography>
            </Box>
          </Card>
        </Collapse>

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
