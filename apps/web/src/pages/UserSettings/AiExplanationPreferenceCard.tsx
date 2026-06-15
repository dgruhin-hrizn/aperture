import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useTranslation } from 'react-i18next'

interface AiExplanationPreference {
  overrideAllowed: boolean
  userPreference: boolean | null
  effectiveValue: boolean
  globalEnabled: boolean
  canOverride: boolean
}

export function AiExplanationPreferenceCard() {
  const { t } = useTranslation()
  const [pref, setPref] = useState<AiExplanationPreference | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchPref = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/user/ai-explanation', { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as AiExplanationPreference
        setPref(data)
      }
    } catch {
      // Optional load failures may degrade gracefully
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPref()
  }, [fetchPref])

  const savePref = async (enabled: boolean | null) => {
    if (!pref) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/settings/user/ai-explanation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      })
      if (response.ok) {
        const data = (await response.json()) as {
          userPreference: boolean | null
          effectiveValue: boolean
          message: string
        }
        setPref({
          ...pref,
          userPreference: data.userPreference,
          effectiveValue: data.effectiveValue,
        })
        setSuccess(data.message)
        window.setTimeout(() => setSuccess(null), 5000)
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string }
        setError(err.error || t('userSettings.errSavePreference'))
      }
    } catch {
      setError(t('userSettings.errConnectServer'))
    } finally {
      setSaving(false)
    }
  }

  if (!pref?.canOverride) {
    return null
  }

  return (
    <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon color="primary" />
          {t('userSettings.aiExplanationTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('userSettings.aiExplanationSubtitle')}
        </Typography>

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

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={pref.userPreference ?? pref.globalEnabled}
                  onChange={(e) => void savePref(e.target.checked)}
                  disabled={saving}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight="medium">
                    {t('userSettings.aiExplanationIncludeTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('userSettings.aiExplanationIncludeBody')}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', ml: 0, mb: 2 }}
            />

            {pref.userPreference !== null && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => void savePref(null)}
                disabled={saving}
              >
                {t('userSettings.aiExplanationReset', {
                  state: pref.globalEnabled
                    ? t('userSettings.stateEnabled')
                    : t('userSettings.stateDisabled'),
                })}
              </Button>
            )}

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" color="text.secondary">
              {t('userSettings.aiExplanationFooter')}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}
