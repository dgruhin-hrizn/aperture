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
  Grid,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'

interface OutputFormatConfig {
  moviesUseSymlinks: boolean
  seriesUseSymlinks: boolean
}

export function OutputFormatSection() {
  const [config, setConfig] = useState<OutputFormatConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/ai-recs/output')
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
      const response = await fetch('/api/settings/ai-recs/output', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!response.ok) throw new Error('Failed to save config')
      setSuccess('Output format settings saved!')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<OutputFormatConfig>) => {
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
          <Alert severity="error">Failed to load output format configuration</Alert>
        </CardContent>
      </Card>
    )
  }

  const anyUseSymlinks = config.moviesUseSymlinks || config.seriesUseSymlinks

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderOpenIcon color="primary" /> AI Recommendations Output Format
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose how AI recommendation files are created for the media server
          </Typography>
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

        {/* Movies and Series Output Format */}
        <Grid container spacing={3}>
          {/* Movies Library */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MovieIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="medium">
                  Movies Library
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.moviesUseSymlinks}
                    onChange={(e) => updateConfig({ moviesUseSymlinks: e.target.checked })}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {config.moviesUseSymlinks ? <LinkIcon fontSize="small" /> : <FolderOpenIcon fontSize="small" />}
                    <Typography variant="body2">
                      {config.moviesUseSymlinks ? 'Symlinks' : 'STRM Files'}
                    </Typography>
                  </Box>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {config.moviesUseSymlinks 
                  ? 'Creates symbolic links to original movie files'
                  : 'Creates .strm files with paths or streaming URLs'
                }
              </Typography>
            </Card>
          </Grid>

          {/* Series Library */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TvIcon color="primary" />
                <Typography variant="subtitle1" fontWeight="medium">
                  Series Library
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.seriesUseSymlinks}
                    onChange={(e) => updateConfig({ seriesUseSymlinks: e.target.checked })}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {config.seriesUseSymlinks ? <LinkIcon fontSize="small" /> : <FolderOpenIcon fontSize="small" />}
                    <Typography variant="body2">
                      {config.seriesUseSymlinks ? 'Symlinks' : 'STRM Files'}
                    </Typography>
                  </Box>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {config.seriesUseSymlinks 
                  ? 'Creates symlinks to original season folders (recommended)'
                  : 'Creates .strm files for each episode'
                }
              </Typography>
              {!config.seriesUseSymlinks && (
                <Alert severity="info" sx={{ mt: 2, py: 0.5 }} icon={false}>
                  <Typography variant="caption">
                    Symlinks are recommended for TV series for better performance
                  </Typography>
                </Alert>
              )}
            </Card>
          </Grid>
        </Grid>

        {/* Explanation Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
          <Card variant="outlined" sx={{ p: 2, bgcolor: anyUseSymlinks ? 'action.selected' : 'transparent' }}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinkIcon fontSize="small" color={anyUseSymlinks ? 'primary' : 'inherit'} />
              Symlinks
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Creates symbolic links pointing to your original media files. Faster playback, same quality.
              <br />
              <strong>Requires:</strong> Both Aperture and your media server must access the same filesystem paths.
            </Typography>
          </Card>
          
          <Card variant="outlined" sx={{ p: 2, bgcolor: !anyUseSymlinks ? 'action.selected' : 'transparent' }}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderOpenIcon fontSize="small" color={!anyUseSymlinks ? 'primary' : 'inherit'} />
              STRM Files
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Creates .strm files containing paths or streaming URLs. Works in all network configurations.
              <br />
              <strong>Best for:</strong> Docker setups, different machines, or when paths differ between systems.
            </Typography>
          </Card>
        </Box>

        {anyUseSymlinks && (
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Important:</strong> Symlinks require that Aperture can access your media files at the exact same paths that your media server uses.
              If you're running Aperture in Docker, ensure the volume mounts match.
            </Typography>
          </Alert>
        )}

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
