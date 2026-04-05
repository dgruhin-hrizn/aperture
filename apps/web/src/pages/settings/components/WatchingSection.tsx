import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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

interface WatchingLibraryConfig {
  enabled: boolean
}

export function WatchingSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<WatchingLibraryConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    void fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/watching', { credentials: 'include' })
      if (!response.ok) throw new Error(t('settingsWatching.fetchFailed'))
      const data = (await response.json()) as WatchingLibraryConfig
      setConfig(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsWatching.unknownError'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/settings/watching', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: config.enabled }),
      })
      if (!response.ok) throw new Error(t('settingsWatching.saveFailed'))
      setSuccess(t('settingsWatching.saved'))
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsWatching.unknownError'))
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<WatchingLibraryConfig>) => {
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
          <Alert severity="error">{t('settingsWatching.loadFailed')}</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box mb={2}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddToQueueIcon color="primary" /> {t('settingsWatching.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settingsWatching.subtitle')}
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
                  {t('settingsWatching.enableTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('settingsWatching.enableCaption')}
                </Typography>
              </Box>
            }
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? t('settingsWatching.saving') : t('settingsWatching.saveChanges')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
