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
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SaveIcon from '@mui/icons-material/Save'

interface TraktConfig {
  configured: boolean
  clientId: string | null
  redirectUri: string | null
  hasClientSecret: boolean
}

export function TraktConfigSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<TraktConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [clientId, setClientId] = useState<string>('')
  const [clientSecret, setClientSecret] = useState<string>('')
  const [redirectUri, setRedirectUri] = useState<string>('')
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/trakt/config', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setClientId(data.clientId?.replace(/•/g, '') || '')
        setRedirectUri(data.redirectUri || window.location.origin + '/api/trakt/callback')
        setClientSecret('')
        setHasChanges(false)
      }
    } catch {
      setError(t('settingsTrakt.loadError'))
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
      const response = await fetch('/api/trakt/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId: clientId || undefined,
          clientSecret: clientSecret || undefined,
          redirectUri: redirectUri || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess(t('settingsTrakt.saved'))
        setConfig(prev => prev ? { ...prev, configured: data.configured } : null)
        setClientSecret('')
        setHasChanges(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const err = await response.json()
        setError(err.error || t('settingsTrakt.errSave'))
      }
    } catch {
      setError(t('settingsTrakt.errConnect'))
    } finally {
      setSaving(false)
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
          <Box
            component="img"
            src="/trakt.svg"
            alt={t('settingsTrakt.alt')}
            sx={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }}
          />
          <Typography variant="h6" fontWeight={600}>
            {t('settingsTrakt.title')}
          </Typography>
          {config?.configured && (
            <Chip
              icon={<CheckCircleIcon />}
              label={t('settingsTrakt.configured')}
              color="success"
              size="small"
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('settingsTrakt.description')}{' '}
          <Link href="https://trakt.tv/oauth/applications" target="_blank" rel="noopener">
            {t('settingsTrakt.registerLink')}
          </Link>
          {t('settingsTrakt.registerSuffix')}
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
            label={t('settingsTrakt.clientId')}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder={t('settingsTrakt.clientIdPlaceholder')}
          />

          <TextField
            label={t('settingsTrakt.clientSecret')}
            type={showClientSecret ? 'text' : 'password'}
            value={clientSecret || (config?.hasClientSecret ? '••••••••••••••••••••••••••••' : '')}
            onChange={(e) => {
              // If user starts typing over the masked value, clear it first
              const newValue = e.target.value.replace(/•/g, '')
              setClientSecret(newValue)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder={t('settingsTrakt.clientSecretPlaceholder')}
            helperText={
              config?.hasClientSecret && !clientSecret
                ? t('settingsTrakt.helperSecretSaved')
                : undefined
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    edge="end"
                    size="small"
                  >
                    {showClientSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label={t('settingsTrakt.redirectUri')}
            value={redirectUri}
            onChange={(e) => {
              setRedirectUri(e.target.value)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            helperText={t('settingsTrakt.redirectHelper')}
          />

          <Box display="flex" gap={1} mt={1}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="small"
            >
              {saving ? t('settingsTrakt.saving') : t('settingsTrakt.saveConfiguration')}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

