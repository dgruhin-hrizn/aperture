import React, { useState, useEffect, useCallback } from 'react'
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
  TextField,
  Slider,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import FilterListIcon from '@mui/icons-material/FilterList'

interface ContinueWatchingConfig {
  enabled: boolean
  useSymlinks: boolean
  libraryName: string
  pollIntervalSeconds: number
  excludedLibraryIds: string[]
  supportedMergeTags?: Array<{ tag: string; description: string }>
}

interface Library {
  id: string
  name: string
  collectionType: string
}

const POLL_INTERVAL_MARKS = [
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
  { value: 180, label: '3m' },
  { value: 300, label: '5m' },
]

export function ContinueWatchingSection() {
  const [config, setConfig] = useState<ContinueWatchingConfig | null>(null)
  const [libraries, setLibraries] = useState<Library[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchConfig()
    fetchLibraries()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/continue-watching', { credentials: 'include' })
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

  const fetchLibraries = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/libraries?excludeAperture=true', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setLibraries(data.libraries || [])
      }
    } catch {
      // Ignore library fetch errors
    }
  }, [])

  const handleSave = async () => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/settings/continue-watching', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: config.enabled,
          useSymlinks: config.useSymlinks,
          libraryName: config.libraryName,
          pollIntervalSeconds: config.pollIntervalSeconds,
          excludedLibraryIds: config.excludedLibraryIds,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save config')
      }
      setSuccess('Continue watching settings saved!')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<ContinueWatchingConfig>) => {
    if (!config) return
    setConfig({ ...config, ...updates })
    setHasChanges(true)
  }

  const toggleLibraryExclusion = (libraryId: string) => {
    if (!config) return
    const currentExcluded = config.excludedLibraryIds || []
    const isExcluded = currentExcluded.includes(libraryId)
    
    const newExcluded = isExcluded
      ? currentExcluded.filter(id => id !== libraryId)
      : [...currentExcluded, libraryId]
    
    updateConfig({ excludedLibraryIds: newExcluded })
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
          <Alert severity="error">Failed to load continue watching configuration</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayCircleOutlineIcon color="primary" /> Continue Watching
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create deduplicated "Continue Watching" libraries by polling Emby's Resume API
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

        <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            This feature solves the duplicate "Continue Watching" problem when the same movie exists in multiple libraries 
            (e.g., Movies and Movies 4K). Aperture will poll your media server and create a deduplicated library per user.
          </Typography>
        </Alert>

        <Divider sx={{ my: 2 }} />

        {/* Enable/Disable Toggle */}
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
                  Enable Continue Watching Libraries
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  When enabled, Aperture will create per-user "Continue Watching" libraries
                </Typography>
              </Box>
            }
          />
        </Box>

        {config.enabled && (
          <>
            <Divider sx={{ my: 2 }} />

            {/* Library Name Template */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 1 }}>
                Library Name Template
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={config.libraryName}
                onChange={(e) => updateConfig({ libraryName: e.target.value })}
                placeholder="{{username}}'s Continue Watching"
                helperText={
                  <Box component="span">
                    Supported merge tags:{' '}
                    {config.supportedMergeTags?.map((tag, i) => (
                      <React.Fragment key={tag.tag}>
                        <Chip 
                          label={tag.tag} 
                          size="small" 
                          sx={{ mr: 0.5, mb: 0.5, height: 20, fontSize: '0.7rem' }}
                        />
                        {i < (config.supportedMergeTags?.length || 0) - 1 && ' '}
                      </React.Fragment>
                    ))}
                  </Box>
                }
              />
            </Box>

            {/* Poll Interval */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 1 }}>
                Poll Interval: {config.pollIntervalSeconds}s
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                How often to check for changes in Continue Watching status
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={config.pollIntervalSeconds}
                  onChange={(_, value) => updateConfig({ pollIntervalSeconds: value as number })}
                  min={30}
                  max={300}
                  step={10}
                  marks={POLL_INTERVAL_MARKS}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}s`}
                />
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Output Format */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 1 }}>
                Output Format
              </Typography>
              <Card variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.useSymlinks}
                      onChange={(e) => updateConfig({ useSymlinks: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {config.useSymlinks ? <LinkIcon fontSize="small" /> : <FolderOpenIcon fontSize="small" />}
                      <Typography variant="body2">
                        {config.useSymlinks ? 'Symlinks' : 'STRM Files'}
                      </Typography>
                    </Box>
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {config.useSymlinks
                    ? 'Creates symlinks to original media files'
                    : 'Creates .strm files pointing to media paths'}
                </Typography>
              </Card>

              {config.useSymlinks && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Symlinks</strong> require that Aperture can access your media files at the exact same paths
                    that your media server uses. If you're running Aperture in Docker, ensure the volume mounts match.
                  </Typography>
                </Alert>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Excluded Libraries */}
            <Box sx={{ mb: 3 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <FilterListIcon fontSize="small" color="action" />
                <Typography variant="subtitle1" fontWeight="medium">
                  Excluded Libraries
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Items from excluded libraries won't appear in Continue Watching. Use this to avoid duplicates 
                (e.g., exclude "Movies 4K" if you prefer items from "Movies").
              </Typography>
              
              {libraries.length > 0 ? (
                <Card variant="outlined">
                  <List dense>
                    {libraries.map((library) => {
                      const isExcluded = config.excludedLibraryIds?.includes(library.id)
                      return (
                        <ListItem
                          key={library.id}
                          onClick={() => toggleLibraryExclusion(library.id)}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <Checkbox
                              edge="start"
                              checked={isExcluded}
                              tabIndex={-1}
                              disableRipple
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={library.name}
                            secondary={library.collectionType}
                            primaryTypographyProps={{
                              sx: { textDecoration: isExcluded ? 'line-through' : 'none', opacity: isExcluded ? 0.6 : 1 }
                            }}
                          />
                          {isExcluded && (
                            <Chip label="Excluded" size="small" color="warning" variant="outlined" />
                          )}
                        </ListItem>
                      )
                    })}
                  </List>
                </Card>
              ) : (
                <Alert severity="info">
                  No libraries available. Configure your media server to see libraries here.
                </Alert>
              )}
            </Box>
          </>
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
