import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  TextField,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import { useTranslation } from 'react-i18next'
import type { User } from '@/hooks/auth-context'

export function AiLibraryNamesCard({ user }: { user: User | null }) {
  const { t } = useTranslation()
  const [defaultLibraryPrefix, setDefaultLibraryPrefix] = useState('AI Picks - ')
  const [moviesLibraryName, setMoviesLibraryName] = useState('')
  const [seriesLibraryName, setSeriesLibraryName] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/settings/user', { credentials: 'include' })
      if (response.ok) {
        const data = (await response.json()) as {
          defaults?: { libraryNamePrefix?: string }
          settings?: { libraryName?: string; seriesLibraryName?: string }
        }
        setDefaultLibraryPrefix(data.defaults?.libraryNamePrefix || 'AI Picks - ')
        setMoviesLibraryName(data.settings?.libraryName || '')
        setSeriesLibraryName(data.settings?.seriesLibraryName || '')
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string }
        setError(err.error || t('userSettings.errLoadUserSettings'))
      }
    } catch {
      setError(t('userSettings.errConnectServer'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/settings/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          libraryName: moviesLibraryName.trim() || null,
          seriesLibraryName: seriesLibraryName.trim() || null,
        }),
      })
      if (response.ok) {
        setSuccess(t('userSettings.libraryNamesSaved'))
        window.setTimeout(() => setSuccess(null), 5000)
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string }
        setError(err.error || t('userSettings.errSaveSettings'))
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
          <TextFieldsIcon color="primary" />
          <Typography variant="h6">{t('userSettings.aiLibraryNamesTitle')}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('userSettings.aiLibraryNamesSubtitle')}
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
            <FormControl fullWidth sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('userSettings.moviesLibraryNameLabel')}
              </Typography>
              <TextField
                placeholder={`${defaultLibraryPrefix}${user?.displayName || user?.username || 'User'} - Movies`}
                value={moviesLibraryName}
                onChange={(e) => setMoviesLibraryName(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ maxLength: 100 }}
                helperText={
                  moviesLibraryName
                    ? t('userSettings.libraryHelperNamedMovies', { name: moviesLibraryName })
                    : t('userSettings.libraryHelperEmpty')
                }
              />
            </FormControl>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('userSettings.seriesLibraryNameLabel')}
              </Typography>
              <TextField
                placeholder={`${defaultLibraryPrefix}${user?.displayName || user?.username || 'User'} - TV Series`}
                value={seriesLibraryName}
                onChange={(e) => setSeriesLibraryName(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ maxLength: 100 }}
                helperText={
                  seriesLibraryName
                    ? t('userSettings.libraryHelperNamedSeries', { name: seriesLibraryName })
                    : t('userSettings.libraryHelperEmpty')
                }
              />
            </FormControl>

            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={() => void saveSettings()}
                disabled={saving}
                size="small"
              >
                {saving ? t('userSettings.saving') : t('common.save')}
              </Button>
              {(moviesLibraryName || seriesLibraryName) && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setMoviesLibraryName('')
                    setSeriesLibraryName('')
                  }}
                  disabled={saving}
                  size="small"
                >
                  {t('userSettings.resetToDefaults')}
                </Button>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" color="text.secondary">
              {t('userSettings.aiLibraryFooter')}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}
