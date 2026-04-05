import { useState, useCallback } from 'react'
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useTranslation } from 'react-i18next'
import { TopPicksOutputConfig } from '@/components/TopPicksOutputConfig'
import type { SetupWizardContext, LibraryImageInfo } from '../types'
import { DEFAULT_LIBRARY_IMAGES } from '../constants'

interface TopPicksStepProps {
  wizard: SetupWizardContext
}

export function TopPicksStep({ wizard }: TopPicksStepProps) {
  const { t } = useTranslation()
  const { error, topPicks, setTopPicks, saving, goToStep, saveTopPicks } = wizard

  // Local state for Top Picks images - initialize with bundled defaults
  const [topPicksImages, setTopPicksImages] = useState<Record<string, LibraryImageInfo>>({
    'top-picks-movies': { url: DEFAULT_LIBRARY_IMAGES['top-picks-movies'], isDefault: true },
    'top-picks-series': { url: DEFAULT_LIBRARY_IMAGES['top-picks-series'], isDefault: true },
  })
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  const handleUploadImage = useCallback(
    async (libraryTypeId: string, file: File) => {
      setUploadingFor(libraryTypeId)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || t('setup.topPicksStep.errUpload'))
        }

        const data = await res.json()
        setTopPicksImages((prev) => ({
          ...prev,
          [libraryTypeId]: { url: data.url, isDefault: true },
        }))
      } finally {
        setUploadingFor(null)
      }
    },
    [t]
  )

  const handleDeleteImage = useCallback(
    async (libraryTypeId: string) => {
      setUploadingFor(libraryTypeId)
      try {
        const res = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, {
          method: 'DELETE',
          credentials: 'include',
        })

        if (!res.ok) {
          throw new Error(t('setup.topPicksStep.errDelete'))
        }

        // Revert to bundled default image
        setTopPicksImages((prev) => ({
          ...prev,
          [libraryTypeId]: { url: DEFAULT_LIBRARY_IMAGES[libraryTypeId], isDefault: true },
        }))
      } finally {
        setUploadingFor(null)
      }
    },
    [t]
  )

  const handleSaveAndContinue = async () => {
    await saveTopPicks()
  }

  const showSymlinkWarning = topPicks.isEnabled && (topPicks.moviesUseSymlinks || topPicks.seriesUseSymlinks)

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('setup.topPicksStep.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('setup.topPicksStep.body')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Enable Toggle Card */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TrendingUpIcon color={topPicks.isEnabled ? 'primary' : 'disabled'} />
            <Box>
              <Typography variant="subtitle1" fontWeight={500}>
                {t('setup.topPicksStep.enableTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('setup.topPicksStep.enableSubtitle')}
              </Typography>
            </Box>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={topPicks.isEnabled}
                onChange={(_, v) => setTopPicks((c) => ({ ...c, isEnabled: v }))}
                color="primary"
              />
            }
            label=""
          />
        </CardContent>
      </Card>

      {/* Info about advanced settings */}
      <Alert severity="info" sx={{ mb: 3, py: 0.5 }} icon={false}>
        <Typography variant="caption">
          <strong>{t('setup.topPicksStep.noteLabel')}</strong> {t('setup.topPicksStep.noteAdvanced')}
        </Typography>
      </Alert>

      {/* Output Configuration - Blurred when disabled */}
      <Box
        sx={{
          opacity: topPicks.isEnabled ? 1 : 0.5,
          filter: topPicks.isEnabled ? 'none' : 'blur(3px) grayscale(100%)',
          pointerEvents: topPicks.isEnabled ? 'auto' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 2 }}>
          {t('setup.topPicksStep.outputConfig')}
        </Typography>

        <TopPicksOutputConfig
          config={topPicks}
          onChange={(updates) => setTopPicks((c) => ({ ...c, ...updates }))}
          disabled={!topPicks.isEnabled}
          images={topPicksImages}
          onUploadImage={handleUploadImage}
          onDeleteImage={handleDeleteImage}
          uploadingFor={uploadingFor}
          showImages={true}
          showExplanation={true}
        />
      </Box>

      {/* Symlink Warning */}
      {showSymlinkWarning && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>{t('setup.topPicksStep.symlinkLabel')}</strong> {t('setup.topPicksStep.symlinkWarning')}
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('users')}>
          {t('setup.topPicksStep.back')}
        </Button>
        <Button variant="contained" onClick={handleSaveAndContinue} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : t('setup.topPicksStep.saveContinue')}
        </Button>
      </Box>
    </Box>
  )
}
