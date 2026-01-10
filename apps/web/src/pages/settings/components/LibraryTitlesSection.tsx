import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  Tooltip,
  Grid,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary'
import InfoIcon from '@mui/icons-material/Info'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import { ImageUpload } from '../../../components/ImageUpload'

interface MergeTag {
  tag: string
  description: string
}

interface LibraryTitleConfig {
  moviesTemplate: string
  seriesTemplate: string
  supportedMergeTags: MergeTag[]
}

interface LibraryImageInfo {
  url?: string
  isDefault?: boolean
}

// Default library cover images (bundled with the app)
const DEFAULT_LIBRARY_IMAGES: Record<string, string> = {
  'ai-recs-movies': '/AI_MOVIE_PICKS.png',
  'ai-recs-series': '/AI_SERIES_PICKS.png',
}

const RECOMMENDED_DIMENSIONS = {
  width: 1920,
  height: 1080,
}

export function LibraryTitlesSection() {
  const [config, setConfig] = useState<LibraryTitleConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Image state - initialize with bundled defaults
  const [images, setImages] = useState<Record<string, LibraryImageInfo>>({
    'ai-recs-movies': { url: DEFAULT_LIBRARY_IMAGES['ai-recs-movies'], isDefault: true },
    'ai-recs-series': { url: DEFAULT_LIBRARY_IMAGES['ai-recs-series'], isDefault: true },
  })
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()
    fetchImages()
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

  const fetchImages = useCallback(async () => {
    try {
      const libraryTypes = ['ai-recs-movies', 'ai-recs-series']
      const imagePromises = libraryTypes.map(async (id) => {
        try {
          const response = await fetch(`/api/images/library/${id}?imageType=Primary`, {
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            // If there's any uploaded image, use it (don't override with bundled defaults)
            if (data.url) {
              return { id, url: data.url, isDefault: false }
            }
          }
          // Only fall back to bundled default if no image exists at all
          return { id, url: DEFAULT_LIBRARY_IMAGES[id], isDefault: true }
        } catch {
          // Fall back to bundled default image on error
          return { id, url: DEFAULT_LIBRARY_IMAGES[id], isDefault: true }
        }
      })

      const results = await Promise.all(imagePromises)
      const imageMap: Record<string, LibraryImageInfo> = {}
      results.forEach((r) => {
        imageMap[r.id] = { url: r.url || undefined, isDefault: r.isDefault }
      })
      setImages(imageMap)
    } catch (err) {
      console.error('Failed to load library images', err)
    }
  }, [])

  const handleUpload = useCallback(async (libraryTypeId: string, file: File) => {
    setUploadingFor(libraryTypeId)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setImages((prev) => ({
        ...prev,
        [libraryTypeId]: { url: data.url, isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [])

  const handleDeleteImage = useCallback(async (libraryTypeId: string) => {
    setUploadingFor(libraryTypeId)
    setError(null)

    try {
      const response = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Delete failed')
      }

      // Revert to bundled default image
      setImages((prev) => ({
        ...prev,
        [libraryTypeId]: { url: DEFAULT_LIBRARY_IMAGES[libraryTypeId], isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [])

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

  const moviesImage = images['ai-recs-movies'] || {}
  const seriesImage = images['ai-recs-series'] || {}

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <LocalLibraryIcon color="primary" />
          <Typography variant="h6">AI Recommendations Libraries</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Configure naming templates and cover images for AI recommendation libraries. 
          Users can override names in their personal settings.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
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
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <InfoIcon fontSize="small" color="info" />
              <Typography variant="subtitle2">Available Merge Tags</Typography>
            </Box>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {config.supportedMergeTags.map((tag) => (
                <Tooltip key={tag.tag} title={tag.description} arrow>
                  <Chip
                    label={tag.tag}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Side-by-side Cards */}
        <Grid container spacing={3}>
          {/* Movies Card */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <MovieIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>Movies Library</Typography>
                  {moviesImage.url && (
                    <Chip size="small" label="Image Set" color="success" variant="outlined" sx={{ ml: 'auto' }} />
                  )}
                </Box>

                {/* Title Template */}
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Library Name Template
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Preview: <strong>{previewTitle(config.moviesTemplate, 'Movies')}</strong>
                </Typography>

                {/* Cover Image */}
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Library Cover Image
                </Typography>
                <ImageUpload
                  currentImageUrl={moviesImage.url}
                  isDefault={moviesImage.isDefault}
                  recommendedDimensions={RECOMMENDED_DIMENSIONS}
                  onUpload={(file) => handleUpload('ai-recs-movies', file)}
                  onDelete={moviesImage.url ? () => handleDeleteImage('ai-recs-movies') : undefined}
                  loading={uploadingFor === 'ai-recs-movies'}
                  height={180}
                  label="Drop image (16:9)"
                  showDelete={!!moviesImage.url}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Series Card */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <TvIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>Series Library</Typography>
                  {seriesImage.url && (
                    <Chip size="small" label="Image Set" color="success" variant="outlined" sx={{ ml: 'auto' }} />
                  )}
                </Box>

                {/* Title Template */}
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Library Name Template
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Preview: <strong>{previewTitle(config.seriesTemplate, 'TV Series')}</strong>
                </Typography>

                {/* Cover Image */}
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  Library Cover Image
                </Typography>
                <ImageUpload
                  currentImageUrl={seriesImage.url}
                  isDefault={seriesImage.isDefault}
                  recommendedDimensions={RECOMMENDED_DIMENSIONS}
                  onUpload={(file) => handleUpload('ai-recs-series', file)}
                  onDelete={seriesImage.url ? () => handleDeleteImage('ai-recs-series') : undefined}
                  loading={uploadingFor === 'ai-recs-series'}
                  height={180}
                  label="Drop image (16:9)"
                  showDelete={!!seriesImage.url}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box display="flex" justifyContent="flex-end" mt={3}>
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
