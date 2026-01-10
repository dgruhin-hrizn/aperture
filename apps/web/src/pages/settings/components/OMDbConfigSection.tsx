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
import GradeIcon from '@mui/icons-material/Grade'

interface OMDbConfig {
  hasApiKey: boolean
  enabled: boolean
  isConfigured: boolean
}

export function OMDbConfigSection() {
  const [config, setConfig] = useState<OMDbConfig | null>(null)
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
      const response = await fetch('/api/settings/omdb', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setEnabled(data.enabled)
        setApiKey('')
        setHasChanges(false)
      }
    } catch {
      setError('Failed to load OMDb configuration')
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
      const response = await fetch('/api/settings/omdb', {
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
        setSuccess('OMDb configuration saved!')
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
        setSuccess('OMDb connection successful!')
        setTimeout(() => setSuccess(null), 3000)
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
          <GradeIcon sx={{ fontSize: 28, color: '#f5c518' }} />
          <Typography variant="h6" fontWeight={600}>
            OMDb Integration
          </Typography>
          {config?.isConfigured && (
            <Chip
              icon={<CheckCircleIcon />}
              label="Configured"
              color="success"
              size="small"
            />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Enable OMDb integration for Rotten Tomatoes scores, Metacritic ratings, and awards data.{' '}
          <Link href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener">
            Get a free API key
          </Link>{' '}
          (1,000 requests/day, or $1/mo for unlimited).
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
            placeholder="Enter your OMDb API key"
            helperText={
              config?.hasApiKey && !apiKey
                ? 'API key is saved. Enter a new one to replace it.'
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
            label="Enable OMDb enrichment"
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


