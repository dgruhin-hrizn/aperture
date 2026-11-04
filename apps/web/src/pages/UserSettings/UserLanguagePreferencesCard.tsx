import { useUserPreferences, saveUserPreferences } from '../../hooks/userPreferences'
import { apiJson } from '../../lib/api'
import { useRef } from 'react'
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
  const shared = useUserPreferences()
  const translate = useRef(t)
  translate.current = t
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

  const { uiLanguage, aiLanguage, effectiveUiLanguage, effectiveAiLanguage } = shared.data ?? {}
  useEffect(() => {
    setUiOverride(uiLanguage ?? '')
    setAiOverride(aiLanguage ?? '')
    setEffectiveUi(effectiveUiLanguage || 'en')
    setEffectiveAi(effectiveAiLanguage || 'en')
  }, [uiLanguage, aiLanguage, effectiveUiLanguage, effectiveAiLanguage, shared.userId])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void Promise.all([
      apiJson<{ locales: LocaleRow[] }>('/api/settings/locales', controller.signal),
      apiJson<{ defaultUiLanguage: string; defaultAiLanguage: string }>('/api/settings/language-defaults', controller.signal),
    ]).then(([locales, defaults]) => {
      if (controller.signal.aborted) return
      setLocales(locales.locales || []); setSystemUi(defaults.defaultUiLanguage || 'en'); setSystemAi(defaults.defaultAiLanguage || 'en')
    }).catch(() => { if (!controller.signal.aborted) setError(translate.current('language.loadLanguageSettingsFailed')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [shared.userId])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      if (!shared.userId) return
      const data = await saveUserPreferences(shared.userId, { uiLanguage: uiOverride || null, aiLanguage: aiOverride || null })
      setUiOverride(data.uiLanguage ?? ''); setAiOverride(data.aiLanguage ?? '')
      setEffectiveUi(data.effectiveUiLanguage || 'en'); setEffectiveAi(data.effectiveAiLanguage || 'en')
      await syncUiLanguageFromServer(shared.userId)
      setSuccess(i18n.t('language.saved'))
      setTimeout(() => setSuccess(null), 4000)
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
