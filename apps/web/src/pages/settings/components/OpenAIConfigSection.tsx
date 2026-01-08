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
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'

interface OpenAIConfig {
  hasApiKey: boolean
  isConfigured: boolean
}

export function OpenAIConfigSection() {
  const [config, setConfig] = useState<OpenAIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  // Form state
  const [apiKey, setApiKey] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/openai', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setApiKey('')
        setHasChanges(false)
      }
    } catch {
      setError('Failed to load OpenAI configuration')
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
    setTestResult(null)

    try {
      const response = await fetch('/api/settings/openai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKey }),
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess('OpenAI API key saved!')
        setConfig({ hasApiKey: data.hasApiKey, isConfigured: data.isConfigured })
        setApiKey('')
        setHasChanges(false)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to save API key')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setError(null)

    try {
      const response = await fetch('/api/settings/openai/test', {
        method: 'POST',
        credentials: 'include',
      })

      const result = await response.json()
      setTestResult(result)
    } catch {
      setTestResult({ success: false, error: 'Could not connect to server' })
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
            component="img"
            src="/openai.svg"
            alt="OpenAI"
            sx={{ width: 28, height: 28, filter: 'brightness(0) invert(1)' }}
          />
          <Typography variant="h6" fontWeight={600}>
            OpenAI API
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
          Required for AI features: embeddings, recommendations, chat assistant, and taste profiles.{' '}
          <Link href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">
            Get your API key
          </Link>{' '}
          from OpenAI.
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
            {testResult.success
              ? 'Connection successful! OpenAI API is working.'
              : `Connection failed: ${testResult.error}`}
          </Alert>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="API Key"
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
            placeholder="sk-..."
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
            helperText={
              config?.hasApiKey && !apiKey
                ? 'API key is saved. Enter a new key to replace it.'
                : 'Your OpenAI API key starting with sk-'
            }
          />

          <Box display="flex" gap={1} mt={1}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges || !apiKey}
              size="small"
            >
              {saving ? 'Saving...' : 'Save API Key'}
            </Button>

            {config?.isConfigured && (
              <Button
                variant="outlined"
                startIcon={testing ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={handleTest}
                disabled={testing}
                size="small"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

