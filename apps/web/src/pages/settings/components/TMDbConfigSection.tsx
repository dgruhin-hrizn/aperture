import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Alert,
  Chip,
  CircularProgress,
  Link,
  Switch,
  FormControlLabel,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SaveIcon from '@mui/icons-material/Save'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'

interface TMDbConfig {
  hasApiKey: boolean
  enabled: boolean
  isConfigured: boolean
}

export function TMDbConfigSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<TMDbConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [apiKey, setApiKey] = useState<string>('')
  const [enabled, setEnabled] = useState(true)
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/tmdb', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setEnabled(data.enabled)
        setApiKey('')
        setHasChanges(false)
      }
    } catch {
      setError(t('settingsTmdb.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/settings/tmdb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          enabled,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess(t('settingsTmdb.saved'))
        setConfig({
          hasApiKey: data.hasApiKey,
          enabled: data.enabled,
          isConfigured: data.isConfigured,
        })
        setApiKey('')
        setHasChanges(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const err = await response.json()
        setError(err.error || t('settingsTmdb.errSave'))
      }
    } catch {
      setError(t('settingsTmdb.errConnect'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/settings/tmdb/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey || undefined,
        }),
      })

      const result = await response.json()
      if (result.success) {
        setSuccess(t('settingsTmdb.testSuccess'))
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || t('settingsTmdb.testFailed'))
      }
    } catch {
      setError(t('settingsTmdb.errConnect'))
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <MovieFilterIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            {t('settingsTmdb.title')}
          </Typography>
          {config?.isConfigured && (
            <Chip
              icon={<CheckCircleIcon />}
              label={t('settingsTmdb.configured')}
              color="success"
              size="small"
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('settingsTmdb.description')}{' '}
          <Link href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">
            {t('settingsTmdb.getApiKeyLink')}
          </Link>
          .
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

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label={t('settingsTmdb.apiKey')}
            type={showApiKey ? 'text' : 'password'}
            value={apiKey || (config?.hasApiKey ? '••••••••••••••••••••••••••••' : '')}
            onChange={(e) => {
              const newValue = e.target.value.replace(/•/g, '')
              setApiKey(newValue)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder={t('settingsTmdb.placeholder')}
            helperText={
              config?.hasApiKey && !apiKey
                ? t('settingsTmdb.helperSaved')
                : undefined
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowApiKey(!showApiKey)}
                    edge="end"
                    size="small"
                  >
                    {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => {
                  setEnabled(e.target.checked)
                  setHasChanges(true)
                }}
                disabled={!config?.hasApiKey && !apiKey}
              />
            }
            label={t('settingsTmdb.enableEnrichment')}
          />

          <Box display="flex" gap={1} mt={1}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="small"
            >
              {saving ? t('settingsTmdb.saving') : t('common.save')}
            </Button>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={testing || (!apiKey && !config?.hasApiKey)}
              size="small"
            >
              {testing ? t('settingsTmdb.testing') : t('settingsTmdb.testConnection')}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}


