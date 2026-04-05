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
import GradeIcon from '@mui/icons-material/Grade'

interface OMDbConfig {
  hasApiKey: boolean
  enabled: boolean
  isConfigured: boolean
  paidTier: boolean
}

export function OMDbConfigSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<OMDbConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [apiKey, setApiKey] = useState<string>('')
  const [enabled, setEnabled] = useState(true)
  const [paidTier, setPaidTier] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/omdb', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setEnabled(data.enabled)
        setPaidTier(data.paidTier || false)
        setApiKey('')
        setHasChanges(false)
      }
    } catch {
      setError(t('settingsOmdb.loadError'))
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
      const response = await fetch('/api/settings/omdb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          enabled,
          paidTier,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess(t('settingsOmdb.saved'))
        setConfig({
          hasApiKey: data.hasApiKey,
          enabled: data.enabled,
          isConfigured: data.isConfigured,
          paidTier: data.paidTier || false,
        })
        setApiKey('')
        setHasChanges(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const err = await response.json()
        setError(err.error || t('settingsOmdb.errSave'))
      }
    } catch {
      setError(t('settingsOmdb.errConnect'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/settings/omdb/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey || undefined,
        }),
      })

      const result = await response.json()
      if (result.success) {
        setSuccess(t('settingsOmdb.testSuccess'))
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || t('settingsOmdb.testFailed'))
      }
    } catch {
      setError(t('settingsOmdb.errConnect'))
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
          <GradeIcon sx={{ fontSize: 28, color: '#f5c518' }} />
          <Typography variant="h6" fontWeight={600}>
            {t('settingsOmdb.title')}
          </Typography>
          {config?.isConfigured && (
            <Chip
              icon={<CheckCircleIcon />}
              label={t('settingsOmdb.configured')}
              color="success"
              size="small"
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('settingsOmdb.description')}{' '}
          <Link href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">
            {t('settingsOmdb.getFreeKeyLink')}
          </Link>{' '}
          {t('settingsOmdb.descriptionSuffix')}
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
            label={t('settingsOmdb.apiKey')}
            type={showApiKey ? 'text' : 'password'}
            value={apiKey || (config?.hasApiKey ? '••••••••••••••••••••••••••••' : '')}
            onChange={(e) => {
              const newValue = e.target.value.replace(/•/g, '')
              setApiKey(newValue)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder={t('settingsOmdb.placeholder')}
            helperText={
              config?.hasApiKey && !apiKey
                ? t('settingsOmdb.helperSaved')
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
            label={t('settingsOmdb.enableEnrichment')}
          />

          <FormControlLabel
            control={
              <Switch
                checked={paidTier}
                onChange={(e) => {
                  setPaidTier(e.target.checked)
                  setHasChanges(true)
                }}
                disabled={!config?.hasApiKey && !apiKey}
              />
            }
            label={
              <Box>
                <Typography variant="body2">{t('settingsOmdb.paidTitle')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {paidTier
                    ? t('settingsOmdb.paidCaptionOn')
                    : t('settingsOmdb.paidCaptionOff')}
                </Typography>
              </Box>
            }
          />

          <Box display="flex" gap={1} mt={1}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="small"
            >
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={testing || (!apiKey && !config?.hasApiKey)}
              size="small"
            >
              {testing ? t('settingsOmdb.testing') : t('settingsOmdb.testConnection')}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}


