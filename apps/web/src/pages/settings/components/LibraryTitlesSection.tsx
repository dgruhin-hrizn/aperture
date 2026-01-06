import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Divider,
  CircularProgress,
  Stack,
  Chip,
  Tooltip,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary'
import InfoIcon from '@mui/icons-material/Info'

interface MergeTag {
  tag: string
  description: string
}

interface LibraryTitleConfig {
  moviesTemplate: string
  seriesTemplate: string
  supportedMergeTags: MergeTag[]
}

export function LibraryTitlesSection() {
  const [config, setConfig] = useState<LibraryTitleConfig | null>(null)
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
      const response = await fetch('/api/settings/library-titles')
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
      const response = await fetch('/api/settings/library-titles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moviesTemplate: config.moviesTemplate,
          seriesTemplate: config.seriesTemplate,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save config')
      }
      setSuccess('Library title templates saved!')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<LibraryTitleConfig>) => {
    if (!config) return
    setConfig({ ...config, ...updates })
    setHasChanges(true)
  }

  const insertTag = (field: 'moviesTemplate' | 'seriesTemplate', tag: string) => {
    if (!config) return
    const currentValue = config[field]
    updateConfig({ [field]: currentValue + tag })
  }

  const previewTitle = (template: string, type: 'Movies' | 'TV Series') => {
    return template
      .replace(/\{\{username\}\}/gi, 'John')
      .replace(/\{\{type\}\}/gi, type)
      .replace(/\{\{count\}\}/gi, '20')
      .replace(/\{\{date\}\}/gi, new Date().toISOString().split('T')[0])
      .replace(/\s+-\s*$/g, '')
      .replace(/\s+\(\s*\)/g, '')
      .trim()
  }

  if (loading) {
    return (
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
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
          <Alert severity="error">Failed to load library title configuration</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <LocalLibraryIcon color="primary" />
          <Typography variant="h6">Library Title Templates</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Configure the default naming templates for AI recommendation libraries. 
          Users can override these with custom names in their personal settings.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Merge Tags Info */}
        <Card variant="outlined" sx={{ mb: 3, backgroundColor: 'action.hover' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <InfoIcon fontSize="small" color="info" />
              <Typography variant="subtitle2">Available Merge Tags</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Click on a tag to insert it into the template. Tags will be replaced with actual values when libraries are created.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {config.supportedMergeTags.map((tag) => (
                <Tooltip key={tag.tag} title={tag.description} arrow>
                  <Chip
                    label={tag.tag}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'primary.main', color: 'primary.contrastText' }
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Divider sx={{ my: 3 }} />

        {/* Movies Template */}
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            Movies Library Title Template
          </Typography>
          <TextField
            fullWidth
            value={config.moviesTemplate}
            onChange={(e) => updateConfig({ moviesTemplate: e.target.value })}
            placeholder="{{username}}'s AI Picks - Movies"
            size="small"
            sx={{ mb: 1 }}
          />
          <Stack direction="row" gap={0.5} flexWrap="wrap" mb={1}>
            {config.supportedMergeTags.map((tag) => (
              <Chip
                key={`movies-${tag.tag}`}
                label={tag.tag}
                size="small"
                onClick={() => insertTag('moviesTemplate', tag.tag)}
                sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'primary.main', color: 'primary.contrastText' }
                }}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Preview: <strong>{previewTitle(config.moviesTemplate, 'Movies')}</strong>
          </Typography>
        </Box>

        {/* Series Template */}
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            Series Library Title Template
          </Typography>
          <TextField
            fullWidth
            value={config.seriesTemplate}
            onChange={(e) => updateConfig({ seriesTemplate: e.target.value })}
            placeholder="{{username}}'s AI Picks - TV Series"
            size="small"
            sx={{ mb: 1 }}
          />
          <Stack direction="row" gap={0.5} flexWrap="wrap" mb={1}>
            {config.supportedMergeTags.map((tag) => (
              <Chip
                key={`series-${tag.tag}`}
                label={tag.tag}
                size="small"
                onClick={() => insertTag('seriesTemplate', tag.tag)}
                sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'primary.main', color: 'primary.contrastText' }
                }}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Preview: <strong>{previewTitle(config.seriesTemplate, 'TV Series')}</strong>
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Templates'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}


