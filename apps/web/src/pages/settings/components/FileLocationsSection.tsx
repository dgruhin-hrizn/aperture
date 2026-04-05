import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import SaveIcon from '@mui/icons-material/Save'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface OutputPathConfig {
  mediaServerLibrariesPath: string
  mediaServerPathPrefix: string
}

interface DetectionResult {
  mediaServerPathPrefix: string
  mediaServerLibrariesPath: string
  sampleMediaServerPath: string
  sampleAperturePath: string
}

export function FileLocationsSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<OutputPathConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/setup/output-config', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig({
          mediaServerLibrariesPath: data.mediaServerLibrariesPath || '/mnt/ApertureLibraries/',
          mediaServerPathPrefix: data.mediaServerPathPrefix || '/mnt/',
        })
        setHasChanges(false)
      } else {
        setError(t('settingsFileLocations.loadError'))
      }
    } catch (err) {
      setError(t('settingsFileLocations.errConnect'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleDetect = async () => {
    setDetecting(true)
    setError(null)
    setSuccess(null)
    setDetectionResult(null)

    try {
      const response = await fetch('/api/setup/detect-paths', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || data.error || t('settingsFileLocations.detectFailed'))
      }

      const result: DetectionResult = await response.json()
      setDetectionResult(result)
      setConfig({
        mediaServerLibrariesPath: result.mediaServerLibrariesPath,
        mediaServerPathPrefix: result.mediaServerPathPrefix,
      })
      setHasChanges(true)
      setSuccess(t('settingsFileLocations.detectSuccess'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsFileLocations.detectFailed'))
    } finally {
      setDetecting(false)
    }
  }

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/setup/output-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        setSuccess(t('settingsFileLocations.saveSuccess'))
        setHasChanges(false)
        setDetectionResult(null)
      } else {
        const data = await response.json()
        setError(data.error || t('settingsFileLocations.saveFailed'))
      }
    } catch (err) {
      setError(t('settingsFileLocations.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<OutputPathConfig>) => {
    if (!config) return
    setConfig({ ...config, ...updates })
    setHasChanges(true)
  }

  if (loading) {
    return (
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Stack alignItems="center" py={4}>
            <CircularProgress size={32} />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" gap={1} mb={1}>
          <FolderIcon color="primary" />
          <Typography variant="h6">{t('settingsFileLocations.title')}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('settingsFileLocations.subtitle')}
        </Typography>

        <Stack spacing={3}>
          {/* Auto-detect Button */}
          <Box>
            <Button
              variant="outlined"
              onClick={handleDetect}
              disabled={detecting}
              startIcon={detecting ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
            >
              {detecting ? t('settingsFileLocations.detecting') : t('settingsFileLocations.detectPaths')}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {t('settingsFileLocations.detectCaption')}
            </Typography>
          </Box>

          {/* Detection Result */}
          {detectionResult && (
            <Alert severity="info" icon={<CheckCircleIcon />}>
              <Typography variant="body2" fontWeight={500}>
                {t('settingsFileLocations.detectedMapping')}
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                {t('settingsFileLocations.mediaServerSample')} <code>{detectionResult.sampleMediaServerPath}</code>
                <br />
                {t('settingsFileLocations.apertureSample')} <code>{detectionResult.sampleAperturePath}</code>
              </Typography>
            </Alert>
          )}

          {/* Aperture Libraries Path */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('settingsFileLocations.apertureLibrariesPath')}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={config?.mediaServerLibrariesPath || ''}
              onChange={(e) => updateConfig({ mediaServerLibrariesPath: e.target.value })}
              placeholder="/mnt/ApertureLibraries/"
              helperText={t('settingsFileLocations.apertureLibrariesHelper')}
            />
          </Box>

          {/* Media Server Path Prefix */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('settingsFileLocations.mediaServerPathPrefix')}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={config?.mediaServerPathPrefix || ''}
              onChange={(e) => updateConfig({ mediaServerPathPrefix: e.target.value })}
              placeholder="/mnt/"
              helperText={t('settingsFileLocations.mediaServerPathPrefixHelper')}
            />
          </Box>

          {/* Error/Success Messages */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Save Button */}
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {saving ? t('settingsFileLocations.saving') : t('settingsFileLocations.saveChanges')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
