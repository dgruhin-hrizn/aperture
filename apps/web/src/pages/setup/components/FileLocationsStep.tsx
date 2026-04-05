import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Collapse,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'
import type { SetupWizardContext } from '../types'

interface FileLocationsStepProps {
  wizard: SetupWizardContext
}

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

export function FileLocationsStep({ wizard }: FileLocationsStepProps) {
  const { t } = useTranslation()
  const { goToStep, updateProgress } = wizard

  const [config, setConfig] = useState<OutputPathConfig>({
    mediaServerLibrariesPath: '/mnt/ApertureLibraries/',
    mediaServerPathPrefix: '/mnt/',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)

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
      }
    } catch (err) {
      console.error('Failed to load file locations config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleDetect = async () => {
    setDetecting(true)
    setError(null)
    setDetectionResult(null)

    try {
      const response = await fetch('/api/setup/detect-paths', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || data.error || t('setup.fileLocations.errDetect'))
      }

      const result: DetectionResult = await response.json()
      setDetectionResult(result)
      setConfig({
        mediaServerLibrariesPath: result.mediaServerLibrariesPath,
        mediaServerPathPrefix: result.mediaServerPathPrefix,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.fileLocations.errDetect'))
      setShowManualEntry(true)
    } finally {
      setDetecting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/setup/output-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || t('setup.fileLocations.errSave'))
      }

      setSuccess(true)
      await updateProgress({ completedStep: 'fileLocations' })
      goToStep('aiRecsLibraries')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.fileLocations.errSave'))
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    await updateProgress({ completedStep: 'fileLocations' })
    goToStep('aiRecsLibraries')
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('setup.fileLocations.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('setup.fileLocations.body')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          {t('setup.fileLocations.saved')}
        </Alert>
      )}

      {/* Auto-detect Section */}
      <Card variant="outlined" sx={{ mb: 3, bgcolor: 'action.hover' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AutoFixHighIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>
              {t('setup.fileLocations.autoDetectTitle')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('setup.fileLocations.autoDetectBody')}
          </Typography>

          <Button
            variant="contained"
            onClick={handleDetect}
            disabled={detecting}
            startIcon={detecting ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
          >
            {detecting ? t('setup.fileLocations.detecting') : t('setup.fileLocations.detectButton')}
          </Button>

          {/* Detection Result */}
          {detectionResult && (
            <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircleIcon />}>
              <Typography variant="body2" fontWeight={500}>
                {t('setup.fileLocations.pathsDetected')}
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 1, fontFamily: 'monospace' }}>
                {t('setup.fileLocations.mediaServerSees')} <code>{detectionResult.sampleMediaServerPath}</code>
                <br />
                {t('setup.fileLocations.apertureSees')} <code>{detectionResult.sampleAperturePath}</code>
                <br />
                <br />
                {t('setup.fileLocations.detectedPrefix')} <strong>{detectionResult.mediaServerPathPrefix}</strong>
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry Section - Collapsible */}
      <Box sx={{ mb: 3 }}>
        <Button
          size="small"
          color="inherit"
          onClick={() => setShowManualEntry(!showManualEntry)}
          endIcon={
            <ExpandMoreIcon sx={{ transform: showManualEntry ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          }
          sx={{ color: 'text.secondary', textTransform: 'none', mb: 1 }}
        >
          {showManualEntry ? t('setup.fileLocations.hideManual') : t('setup.fileLocations.orManual')}
        </Button>

        <Collapse in={showManualEntry || !!detectionResult}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Tip Card */}
            <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ py: 0.5 }}>
              <Typography variant="caption">
                <strong>{t('setup.fileLocations.howToFindTitle')}</strong> {t('setup.fileLocations.howToFindBody')}
              </Typography>
            </Alert>

            {/* Aperture Libraries Path */}
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <FolderIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2">{t('setup.fileLocations.apertureLibsPath')}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('setup.fileLocations.apertureLibsHelp')}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={config.mediaServerLibrariesPath}
                  onChange={(e) => setConfig((c) => ({ ...c, mediaServerLibrariesPath: e.target.value }))}
                  placeholder="/mnt/ApertureLibraries/"
                  helperText={t('setup.fileLocations.helperApertureLibs')}
                />
              </CardContent>
            </Card>

            {/* Media Files Path Prefix */}
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <FolderIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2">{t('setup.fileLocations.mediaPrefixTitle')}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('setup.fileLocations.mediaPrefixHelp')}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={config.mediaServerPathPrefix}
                  onChange={(e) => setConfig((c) => ({ ...c, mediaServerPathPrefix: e.target.value }))}
                  placeholder="/mnt/"
                  helperText={t('setup.fileLocations.symlinkHelper')}
                />
              </CardContent>
            </Card>
          </Box>
        </Collapse>
      </Box>

      {/* Current Configuration Summary */}
      {(detectionResult || showManualEntry) && (
        <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('setup.fileLocations.currentConfig')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {t('setup.fileLocations.librariesPathLine')} <strong>{config.mediaServerLibrariesPath}</strong>
              <br />
              {t('setup.fileLocations.mediaPrefixLine')} <strong>{config.mediaServerPathPrefix}</strong>
            </Typography>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('mediaLibraries')}>
          {t('setup.fileLocations.back')}
        </Button>
        <Button variant="text" onClick={handleSkip} disabled={saving}>
          {t('setup.fileLocations.skipDefaults')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : t('setup.fileLocations.saveContinue')}
        </Button>
      </Box>
    </Box>
  )
}
