import { useState, useEffect, useCallback } from 'react'
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
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'

interface MDBListConfig {
  configured: boolean
  enabled: boolean
  hasApiKey: boolean
  apiKeyPreview: string | null
  supporterTier: boolean
}

interface MDBListUserInfo {
  userId: number
  username: string
  patronStatus: string
  apiRequests: number
  apiRequestsCount: number
}

export function MDBListConfigSection() {
  const [config, setConfig] = useState<MDBListConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<MDBListUserInfo | null>(null)

  // Form state
  const [apiKey, setApiKey] = useState<string>('')
  const [enabled, setEnabled] = useState(true)
  const [supporterTier, setSupporterTier] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/mdblist/config', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setEnabled(data.enabled)
        setSupporterTier(data.supporterTier || false)
        setApiKey('')
        setHasChanges(false)
      }
    } catch {
      setError('Failed to load MDBList configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/mdblist/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          enabled,
          supporterTier,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess('MDBList configuration saved!')
        setConfig({
          configured: data.configured,
          enabled: data.enabled,
          hasApiKey: data.hasApiKey,
          apiKeyPreview: null,
          supporterTier: data.supporterTier || false,
        })
        setApiKey('')
        setHasChanges(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to save configuration')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    setSuccess(null)
    setTestResult(null)

    try {
      const response = await fetch('/api/mdblist/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey || undefined,
        }),
      })

      const result = await response.json()
      if (result.success) {
        setSuccess(`Connected as ${result.username}!`)
        setTestResult({
          userId: result.userId,
          username: result.username,
          patronStatus: result.patronStatus,
          apiRequests: result.apiRequests,
          apiRequestsCount: result.apiRequestsCount,
        })
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setError(result.error || 'Connection test failed')
      }
    } catch {
      setError('Could not connect to server')
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
          <FormatListBulletedIcon sx={{ fontSize: 28, color: '#3498db' }} />
          <Typography variant="h6" fontWeight={600}>
            MDBList Integration
          </Typography>
          {config?.configured && (
            <Chip
              icon={<CheckCircleIcon />}
              label="Configured"
              color="success"
              size="small"
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Enable MDBList integration for internet popularity rankings in Top Picks, plus Letterboxd ratings,
          streaming availability, and additional keywords for metadata enrichment.{' '}
          <Link href="https://mdblist.com/preferences/" target="_blank" rel="noopener">
            Get your API key
          </Link>{' '}
          (1,000 requests/day free, or higher limits for supporters).
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
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setTestResult(null)}>
            <Typography variant="body2">
              <strong>User:</strong> {testResult.username} • 
              <strong> Status:</strong> {testResult.patronStatus || 'Free'} • 
              <strong> API Requests:</strong> {testResult.apiRequestsCount.toLocaleString()}/{testResult.apiRequests.toLocaleString()}
            </Typography>
          </Alert>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="API Key"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey || (config?.hasApiKey ? '••••••••••••••••••••••••••••' : '')}
            onChange={(e) => {
              const newValue = e.target.value.replace(/•/g, '')
              setApiKey(newValue)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder="Enter your MDBList API key"
            helperText={
              config?.hasApiKey && !apiKey
                ? 'API key is saved. Enter a new one to replace it.'
                : undefined
            }
            slotProps={{
              input: {
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
              },
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
            label="Enable MDBList integration"
          />

          <FormControlLabel
            control={
              <Switch
                checked={supporterTier}
                onChange={(e) => {
                  setSupporterTier(e.target.checked)
                  setHasChanges(true)
                }}
                disabled={!config?.hasApiKey && !apiKey}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Supporter tier</Typography>
                <Typography variant="caption" color="text.secondary">
                  {supporterTier
                    ? 'Using faster rate limits for supporters'
                    : 'Enable if you are an MDBList supporter for faster enrichment'}
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
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={testing || (!apiKey && !config?.hasApiKey)}
              size="small"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

