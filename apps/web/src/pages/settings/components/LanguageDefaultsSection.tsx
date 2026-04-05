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

export function LanguageDefaultsSection() {
  const { t } = useTranslation()
  const [locales, setLocales] = useState<LocaleRow[]>([])
  const [defaultUi, setDefaultUi] = useState('en')
  const [defaultAi, setDefaultAi] = useState('en')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [locRes, defRes] = await Promise.all([
        fetch('/api/settings/locales', { credentials: 'include' }),
        fetch('/api/settings/language-defaults', { credentials: 'include' }),
      ])
      if (locRes.ok) {
        const data = await locRes.json()
        setLocales(data.locales || [])
      }
      if (defRes.ok) {
        const data = await defRes.json()
        setDefaultUi(data.defaultUiLanguage || 'en')
        setDefaultAi(data.defaultAiLanguage || 'en')
      } else {
        const err = await defRes.json().catch(() => ({}))
        setError((err as { error?: string }).error || t('language.loadDefaultsFailed'))
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
      const response = await fetch('/api/settings/language-defaults', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          defaultUiLanguage: defaultUi,
          defaultAiLanguage: defaultAi,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setDefaultUi(data.defaultUiLanguage || 'en')
        setDefaultAi(data.defaultAiLanguage || 'en')
        await syncUiLanguageFromServer()
        setSuccess(i18n.t('language.defaultsSaved'))
        setTimeout(() => setSuccess(null), 4000)
      } else {
        const err = await response.json().catch(() => ({}))
        setError((err as { error?: string }).error || t('language.saveDefaultsFailed'))
      }
    } catch {
      setError(t('language.connectionError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card sx={{ backgroundColor: 'background.default', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <LanguageIcon color="primary" />
          <Typography variant="h6">{t('language.defaultsTitle')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('language.defaultsSubtitle')}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="admin-default-ui-lang">{t('language.defaultUi')}</InputLabel>
              <Select
                labelId="admin-default-ui-lang"
                label={t('language.defaultUi')}
                value={defaultUi}
                onChange={(e) => setDefaultUi(e.target.value)}
              >
                {locales.map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="admin-default-ai-lang">{t('language.defaultAi')}</InputLabel>
              <Select
                labelId="admin-default-ai-lang"
                label={t('language.defaultAi')}
                value={defaultAi}
                onChange={(e) => setDefaultAi(e.target.value)}
              >
                {locales.map((l) => (
                  <MenuItem key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : undefined}
            >
              {saving ? t('common.saving') : t('language.saveDefaults')}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
