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
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ImageIcon from '@mui/icons-material/Image'
import { ImageUpload } from '../../../components/ImageUpload'
import { DEFAULT_LIBRARY_IMAGES } from '../../setup/constants'

interface WatchingLibraryConfig {
  enabled: boolean
  useSymlinks: boolean
}

interface LibraryImageInfo {
  url?: string
  isDefault?: boolean
}

const RECOMMENDED_DIMENSIONS = {
  width: 1920,
  height: 1080,
}

export function WatchingSection() {
  const [config, setConfig] = useState<WatchingLibraryConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Image state
  const [image, setImage] = useState<LibraryImageInfo>({
    url: DEFAULT_LIBRARY_IMAGES['watching'],
    isDefault: true,
  })
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    fetchConfig()
    fetchImage()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/watching', { credentials: 'include' })
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

  const fetchImage = useCallback(async () => {
    try {
      const response = await fetch('/api/images/library/watching?imageType=Primary', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          setImage({ url: data.url, isDefault: false })
          return
        }
      }
      // Fall back to bundled default
      setImage({ url: DEFAULT_LIBRARY_IMAGES['watching'], isDefault: true })
    } catch {
      // Fall back to bundled default on error
      setImage({ url: DEFAULT_LIBRARY_IMAGES['watching'], isDefault: true })
    }
  }, [])

  const handleSave = async () => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/settings/watching', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      })
      if (!response.ok) throw new Error('Failed to save config')
      setSuccess('Watching library settings saved!')
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<WatchingLibraryConfig>) => {
    if (!config) return
    setConfig({ ...config, ...updates })
    setHasChanges(true)
  }

  const handleUpload = useCallback(async (file: File) => {
    setUploadingImage(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/images/library/watching/default?imageType=Primary', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setImage({ url: data.url, isDefault: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setUploadingImage(false)
    }
  }, [])

  const handleDeleteImage = useCallback(async () => {
    setUploadingImage(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/images/library/watching/default?imageType=Primary', {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Delete failed')
      }

      // Revert to bundled default image
      setImage({ url: DEFAULT_LIBRARY_IMAGES['watching'], isDefault: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      throw err
    } finally {
      setUploadingImage(false)
    }
  }, [])

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
          <Alert severity="error">Failed to load watching library configuration</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddToQueueIcon color="primary" /> Shows You Watch
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Allow users to create personal libraries of series they're currently watching
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
                  Enable Watching Libraries
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  When enabled, users can add series to their personal "Shows You Watch" library
                </Typography>
              </Box>
            }
          />
        </Box>

        {config.enabled && (
          <>
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
                    ? 'Creates symlinks to original season folders (recommended for TV series)'
                    : 'Creates .strm files for each episode'}
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

            {/* Library Image */}
            <Box sx={{ mb: 3 }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <ImageIcon fontSize="small" color="action" />
                <Typography variant="subtitle1" fontWeight="medium">
                  Library Cover Image
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This image will be displayed in the media server for all users' watching libraries
              </Typography>
              <Box sx={{ maxWidth: 400 }}>
                <ImageUpload
                  currentImageUrl={image.url}
                  isDefault={image.isDefault}
                  recommendedDimensions={RECOMMENDED_DIMENSIONS}
                  onUpload={handleUpload}
                  onDelete={!image.isDefault ? handleDeleteImage : undefined}
                  loading={uploadingImage}
                  height={160}
                  label="Drop image (16:9)"
                  showDelete={!image.isDefault}
                />
              </Box>
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

