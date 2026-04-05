import React, { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material'
import LanguageIcon from '@mui/icons-material/Language'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n/config'
import { syncUiLanguageFromServer } from '@/i18n/syncUiLanguage'

type LocaleRow = { code: string; label: string }

/**
 * User overrides for UI and AI output language. Uses server defaults when cleared.
 */
export function UserLanguagePreferencesCard() {
  const { t } = useTranslation()
  const [locales, setLocales] = useState<LocaleRow[]>([])
  const [uiOverride, setUiOverride] = useState<string>('')
  const [aiOverride, setAiOverride] = useState<string>('')
  const [effectiveUi, setEffectiveUi] = useState<string>('en')
  const [effectiveAi, setEffectiveAi] = useState<string>('en')
  const [systemUi, setSystemUi] = useState<string>('en')
  const [systemAi, setSystemAi] = useState<string>('en')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [locRes, prefRes, defRes] = await Promise.all([
        fetch('/api/settings/locales', { credentials: 'include' }),
        fetch('/api/auth/me/preferences', { credentials: 'include' }),
        fetch('/api/settings/language-defaults', { credentials: 'include' }),
      ])
      if (locRes.ok) {
        const data = await locRes.json()
        setLocales(data.locales || [])
      }
      if (defRes.ok) {
        const data = await defRes.json()
        setSystemUi(data.defaultUiLanguage || 'en')
        setSystemAi(data.defaultAiLanguage || 'en')
      }
      if (prefRes.ok) {
        const data = await prefRes.json()
        setUiOverride(data.uiLanguage ?? '')
        setAiOverride(data.aiLanguage ?? '')
        setEffectiveUi(data.effectiveUiLanguage || 'en')
        setEffectiveAi(data.effectiveAiLanguage || 'en')
      } else {
        const err = await prefRes.json().catch(() => ({}))
        setError((err as { error?: string }).error || t('userSettings.errLoadUserSettings'))
      }
    } catch {
      setError(t('language.loadLanguageSettingsFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/auth/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          uiLanguage: uiOverride || null,
          aiLanguage: aiOverride || null,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setUiOverride(data.uiLanguage ?? '')
        setAiOverride(data.aiLanguage ?? '')
        setEffectiveUi(data.effectiveUiLanguage || 'en')
        setEffectiveAi(data.effectiveAiLanguage || 'en')
        await syncUiLanguageFromServer()
        setSuccess(i18n.t('language.saved'))
        setTimeout(() => setSuccess(null), 4000)
      } else {
        const err = await response.json().catch(() => ({}))
        setError((err as { error?: string }).error || t('userSettings.errSaveSettings'))
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
          <LanguageIcon color="primary" />
          <Typography variant="h6">{t('language.userTitle')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('language.userSubtitle')}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="user-ui-lang">{t('language.interface')}</InputLabel>
              <Select
                labelId="user-ui-lang"
                label={t('language.interface')}
                value={uiOverride === '' ? '' : uiOverride}
                onChange={(e) => setUiOverride(e.target.value === '' ? '' : String(e.target.value))}
                displayEmpty
              >
                <MenuItem value="">
                  <em>{t('language.serverDefaultUi', { lang: systemUi })}</em>
                </MenuItem>
                {locales.map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              {t('language.effectiveUi', { lang: effectiveUi })}
            </Typography>

            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="user-ai-lang">{t('language.aiSummaries')}</InputLabel>
              <Select
                labelId="user-ai-lang"
                label={t('language.aiSummaries')}
                value={aiOverride === '' ? '' : aiOverride}
                onChange={(e) => setAiOverride(e.target.value === '' ? '' : String(e.target.value))}
                displayEmpty
              >
                <MenuItem value="">
                  <em>{t('language.serverDefaultAi', { lang: systemAi })}</em>
                </MenuItem>
                {locales.map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              {t('language.effectiveAi', { lang: effectiveAi })}
            </Typography>

            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : undefined}
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            >
              {saving ? t('common.saving') : t('language.saveUser')}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
