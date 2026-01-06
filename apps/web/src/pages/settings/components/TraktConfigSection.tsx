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

interface TraktConfig {
  configured: boolean
  clientId: string | null
  redirectUri: string | null
  hasClientSecret: boolean
}

export function TraktConfigSection() {
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
      setError('Failed to load Trakt configuration')
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
        setSuccess('Trakt configuration saved!')
        setConfig(prev => prev ? { ...prev, configured: data.configured } : null)
        setClientSecret('')
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
            src="https://trakt.tv/assets/logos/header@2x-913ef1f5f06e6bcbdf879e7eb8100a51d1fdea6605a0bb68e15ce3b0b21b0a50.png"
            alt="Trakt"
            sx={{ height: 24, filter: 'brightness(0) invert(1)' }}
          />
          <Typography variant="h6" fontWeight={600}>
            Trakt Integration
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
          Enable Trakt integration to let users sync their ratings.{' '}
          <Link href="https://trakt.tv/oauth/applications" target="_blank" rel="noopener">
            Register a Trakt app
          </Link>{' '}
          to get your Client ID and Secret.
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
            label="Client ID"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder="Enter your Trakt Client ID"
          />

          <TextField
            label="Client Secret"
            type={showClientSecret ? 'text' : 'password'}
            value={clientSecret}
            onChange={(e) => {
              setClientSecret(e.target.value)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            placeholder={config?.hasClientSecret ? '••••••••••••••••' : 'Enter your Trakt Client Secret'}
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
            label="Redirect URI"
            value={redirectUri}
            onChange={(e) => {
              setRedirectUri(e.target.value)
              setHasChanges(true)
            }}
            size="small"
            fullWidth
            helperText="Copy this URL to your Trakt app's Redirect URI field"
          />

          <Box display="flex" gap={1} mt={1}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              size="small"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

