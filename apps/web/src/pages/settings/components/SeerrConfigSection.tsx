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
  Stack,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SaveIcon from '@mui/icons-material/Save'
import SyncIcon from '@mui/icons-material/Sync'

interface SeerrConfig {
  configured: boolean
  enabled: boolean
  url: string
  hasApiKey: boolean
}

interface TestResult {
  success: boolean
  message?: string
  serverName?: string
}

export function SeerrConfigSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<SeerrConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  // Form state
  const [url, setUrl] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')
  const [enabled, setEnabled] = useState<boolean>(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/seerr/config', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setUrl(data.url || '')
        setEnabled(data.enabled || false)
        setApiKey('')
        setHasChanges(false)
      }
    } catch {
      setError(t('settingsSeerr.loadError'))
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
    setTestResult(null)

    try {
      const response = await fetch('/api/seerr/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: url || undefined,
          apiKey: apiKey || undefined,
          enabled,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess(t('settingsSeerr.saved'))
        setConfig(prev => prev ? { ...prev, configured: data.configured, enabled: data.enabled } : null)
        setApiKey('')
        setHasChanges(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const err = await response.json()
        setError(err.error || t('settingsSeerr.errSave'))
      }
    } catch {
      setError(t('settingsSeerr.errConnect'))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setError(null)

    try {
      const response = await fetch('/api/seerr/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: url || undefined,
          apiKey: apiKey || undefined,
        }),
      })

      const result = await response.json()
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: t('settingsSeerr.errConnect') })
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
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              bgcolor: '#ec4899',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            JS
          </Box>
          <Typography variant="h6" fontWeight={600}>
            {t('settingsSeerr.title')}
          </Typography>
          {config?.configured && config?.enabled && (
            <Chip
              icon={<CheckCircleIcon />}
              label={t('settingsSeerr.chipEnabled')}
              color="success"
              size="small"
            />
          )}
          {config?.configured && !config?.enabled && (
            <Chip
              label={t('settingsSeerr.chipDisabled')}
              color="warning"
              size="small"
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          {t('settingsSeerr.description')}{' '}
          <Link href="https://docs.jellyseerr.dev" target="_blank" rel="noopener">
            {t('settingsSeerr.learnMoreLink')}
          </Link>{' '}
          {t('settingsSeerr.learnMoreSuffix')}
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

        {testResult && (
          <Alert
            severity={testResult.success ? 'success' : 'error'}
            sx={{ mb: 2 }}
            onClose={() => setTestResult(null)}
          >
            {testResult.message}
            {testResult.serverName && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {t('settingsSeerr.connectedTo')}{' '}
                <strong>{testResult.serverName}</strong>
              </Typography>
            )}
          </Alert>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label={t('settingsSeerr.seerrUrl')}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder={t('settingsSeerr.urlPlaceholder')}
            helperText={t('settingsSeerr.urlHelper')}
          />

          <TextField
            label={t('settingsSeerr.apiKey')}
            type={showApiKey ? 'text' : 'password'}
            value={apiKey || (config?.hasApiKey ? '••••••••••••••••••••••••••••' : '')}
            onChange={(e) => {
              // If user starts typing over the masked value, clear it first
              const newValue = e.target.value.replace(/•/g, '')
              setApiKey(newValue)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder={t('settingsSeerr.apiKeyPlaceholder')}
            helperText={
              config?.hasApiKey && !apiKey
                ? t('settingsSeerr.helperSaved')
                : t('settingsSeerr.helperNewKey')
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
                disabled={!config?.configured && !url}
              />
            }
            label={
              <Typography variant="body2">
                {t('settingsSeerr.enableRequests')}
              </Typography>
            }
          />

          <Stack direction="row" spacing={1} mt={1}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="small"
            >
              {saving ? t('common.saving') : t('settingsSeerr.saveConfiguration')}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={testing ? <CircularProgress size={16} /> : <SyncIcon />}
              onClick={handleTest}
              disabled={testing || (!url && !config?.url)}
              size="small"
            >
              {testing ? t('settingsSeerr.testing') : t('settingsSeerr.testConnection')}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  )
}

