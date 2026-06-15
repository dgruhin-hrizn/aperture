import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import { useTranslation } from 'react-i18next'

interface SimilarityPrefs {
  fullFranchiseMode: boolean
  hideWatched: boolean
}

export function SimilarityGraphPrefsCard() {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useState<SimilarityPrefs>({ fullFranchiseMode: false, hideWatched: true })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchPrefs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/user/similarity-prefs', { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as Partial<SimilarityPrefs>
        setPrefs({
          fullFranchiseMode: data.fullFranchiseMode ?? false,
          hideWatched: data.hideWatched ?? true,
        })
      }
    } catch {
      // Optional load failures may degrade gracefully
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPrefs()
  }, [fetchPrefs])

  const savePref = async (key: keyof SimilarityPrefs, value: boolean) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/settings/user/similarity-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      })
      if (response.ok) {
        setPrefs((prev) => ({ ...prev, [key]: value }))
        setSuccess(t('userSettings.preferenceSaved'))
        window.setTimeout(() => setSuccess(null), 3000)
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

  return (
    <Card sx={{ backgroundColor: 'background.default', borderRadius: 2, height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <HubOutlinedIcon color="primary" />
          <Typography variant="h6">{t('userSettings.similarityGraphPrefsTitle')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('userSettings.similarityGraphPrefsSubtitle')}
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
                  checked={prefs.hideWatched}
                  onChange={(e) => void savePref('hideWatched', e.target.checked)}
                  disabled={saving}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight="medium">
                    {t('userSettings.hideWatchedTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {prefs.hideWatched ? t('userSettings.hideWatchedOn') : t('userSettings.hideWatchedOff')}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', ml: 0, mb: 2 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={prefs.fullFranchiseMode}
                  onChange={(e) => void savePref('fullFranchiseMode', e.target.checked)}
                  disabled={saving}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" fontWeight="medium">
                    {t('userSettings.fullFranchiseTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {prefs.fullFranchiseMode
                      ? t('userSettings.fullFranchiseOn')
                      : t('userSettings.fullFranchiseOff')}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', ml: 0 }}
            />

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" color="text.secondary">
              {t('userSettings.similarityGraphFooter')}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}
