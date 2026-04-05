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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import InfoIcon from '@mui/icons-material/Info'

interface AiExplanationConfig {
  enabled: boolean
  userOverrideAllowed: boolean
}

export function AiExplanationSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<AiExplanationConfig | null>(null)
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
      const response = await fetch('/api/settings/ai-explanation')
      if (!response.ok) throw new Error(t('settingsAiExplanation.fetchFailed'))
      const data = await response.json()
      setConfig(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsAiExplanation.unknownError'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/settings/ai-explanation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!response.ok) throw new Error(t('settingsAiExplanation.saveFailed'))
      setSuccess(t('settingsAiExplanation.saved'))
      setHasChanges(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsAiExplanation.unknownError'))
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (updates: Partial<AiExplanationConfig>) => {
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
          <Alert severity="error">{t('settingsAiExplanation.loadFailed')}</Alert>
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
              <AutoAwesomeIcon color="primary" /> {t('settingsAiExplanation.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settingsAiExplanation.subtitle')}
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

        {/* Global Enable/Disable */}
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
                  {t('settingsAiExplanation.includeTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('settingsAiExplanation.includeDesc')}
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0 }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* User Override Permission */}
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={config.userOverrideAllowed}
                onChange={(e) => updateConfig({ userOverrideAllowed: e.target.checked })}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {t('settingsAiExplanation.overrideTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('settingsAiExplanation.overrideDesc')}
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0 }}
          />
        </Box>

        {config.userOverrideAllowed && (
          <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{t('settingsAiExplanation.infoThreeTier')}</strong>{' '}
              {t('settingsAiExplanation.infoThreeTierBody')}
              <br />
              {t('settingsAiExplanation.infoGrantPath')}
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
            {saving ? t('settingsAiExplanation.saving') : t('settingsAiExplanation.saveChanges')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}



