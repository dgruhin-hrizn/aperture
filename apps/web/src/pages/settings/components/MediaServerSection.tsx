import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  IconButton,
  Stack,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningIcon from '@mui/icons-material/Warning'

interface MediaServerConfig {
  type: string | null
  baseUrl: string | null
  hasApiKey: boolean
  isConfigured: boolean
}

interface ServerType {
  id: string
  name: string
}

export function MediaServerSection() {
  const [config, setConfig] = useState<MediaServerConfig | null>(null)
  const [serverTypes, setServerTypes] = useState<ServerType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; serverName?: string; error?: string } | null>(null)

  // Form state
  const [serverType, setServerType] = useState<string>('')
  const [baseUrl, setBaseUrl] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Security settings
  const [allowPasswordlessLogin, setAllowPasswordlessLogin] = useState(false)
  const [savingSecuritySetting, setSavingSecuritySetting] = useState(false)
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null)

  const fetchSecuritySettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/media-server/security', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setAllowPasswordlessLogin(data.allowPasswordlessLogin)
      }
    } catch {
      // Default to false if we can't fetch
    }
  }, [])

  const handlePasswordlessToggle = async (enabled: boolean) => {
    setSavingSecuritySetting(true)
    setSecuritySuccess(null)
    try {
      const response = await fetch('/api/settings/media-server/security', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowPasswordlessLogin: enabled }),
      })
      if (response.ok) {
        setAllowPasswordlessLogin(enabled)
        setSecuritySuccess(enabled ? 'Passwordless login enabled' : 'Passwordless login disabled')
      }
    } catch {
      // Revert on error
    } finally {
      setSavingSecuritySetting(false)
    }
  }

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/media-server/config', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
        setServerTypes(data.serverTypes || [])
        setServerType(data.config.type || '')
        setBaseUrl(data.config.baseUrl || '')
        setApiKey('') // Never pre-fill API key for security
        setHasChanges(false)
      }
    } catch (err) {
      setError('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
    fetchSecuritySettings()
  }, [fetchConfig, fetchSecuritySettings])

  const handleTestConnection = async () => {
    if (!serverType || !baseUrl || (!apiKey && !config?.hasApiKey)) {
      setError('Please fill in all fields before testing')
      return
    }

    setTesting(true)
    setTestResult(null)
    setError(null)

    try {
      const response = await fetch('/api/settings/media-server/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: serverType,
          baseUrl,
          apiKey: apiKey || undefined,
          useSavedCredentials: !apiKey && config?.hasApiKey, // Use saved key if field is empty but key exists
        }),
      })

      const result = await response.json()
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, error: 'Failed to connect' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updates: { type?: string; baseUrl?: string; apiKey?: string } = {}
      
      if (serverType !== config?.type) updates.type = serverType
      if (baseUrl !== config?.baseUrl) updates.baseUrl = baseUrl
      if (apiKey) updates.apiKey = apiKey // Only send if changed

      const response = await fetch('/api/settings/media-server/config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        setSuccess('Configuration saved successfully')
        setApiKey('') // Clear API key field
        setHasChanges(false)
        await fetchConfig()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save configuration')
      }
    } catch (err) {
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: 'type' | 'baseUrl' | 'apiKey', value: string) => {
    setHasChanges(true)
    setTestResult(null)
    
    switch (field) {
      case 'type':
        setServerType(value)
        break
      case 'baseUrl':
        setBaseUrl(value)
        break
      case 'apiKey':
        setApiKey(value)
        break
    }
  }

  if (loading) {
    return (
      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Stack alignItems="center" py={4}>
            <CircularProgress size={32} />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Typography variant="h6">Media Server</Typography>
          {config?.isConfigured && (
            <Chip
              icon={<CheckCircleIcon />}
              label="Connected"
              color="success"
              size="small"
              variant="outlined"
            />
          )}
        </Stack>

        <Stack spacing={3}>
          {/* Server Type */}
          <FormControl fullWidth>
            <InputLabel>Server Type</InputLabel>
            <Select
              value={serverType}
              onChange={(e) => handleFieldChange('type', e.target.value)}
              label="Server Type"
            >
              {serverTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Base URL */}
          <TextField
            label="Server URL"
            value={baseUrl}
            onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
            placeholder="http://emby:8096 or http://jellyfin:8096"
            helperText="The base URL of your media server"
            fullWidth
          />

          {/* API Key */}
          <TextField
            label="API Key"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey || (config?.hasApiKey ? '••••••••••••••••••••••••' : '')}
            onChange={(e) => {
              // If user starts typing over the masked value, clear it first
              const newValue = e.target.value.replace(/•/g, '')
              handleFieldChange('apiKey', newValue)
            }}
            onFocus={() => {
              // Clear masked value when user focuses the field
              if (!apiKey && config?.hasApiKey) {
                // Don't clear - let user type to replace
              }
            }}
            placeholder="Enter API key"
            helperText={
              config?.hasApiKey && !apiKey
                ? 'API key is saved. Enter a new key to update it.'
                : 'Generate an API key in your media server admin settings'
            }
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {config?.hasApiKey && !apiKey && (
                    <Chip 
                      key="saved-chip"
                      label="Saved" 
                      size="small" 
                      color="success" 
                      variant="outlined"
                      sx={{ mr: 1, height: 24 }}
                    />
                  )}
                  <IconButton
                    key="visibility-toggle"
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

          {/* Test Result */}
          {testResult && (
            <Alert
              severity={testResult.success ? 'success' : 'error'}
              icon={testResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
            >
              {testResult.success ? (
                <>Connected to <strong>{testResult.serverName}</strong></>
              ) : (
                <>Connection failed: {testResult.error}</>
              )}
            </Alert>
          )}

          {/* Error/Success Messages */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testing || !serverType || !baseUrl}
              startIcon={testing ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              startIcon={saving ? <CircularProgress size={16} /> : null}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>

          {/* Help Text */}
          <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Your media server must be accessible from this container. For Docker deployments, 
              use the container name (e.g., <code>http://emby:8096</code>) or the host IP address.
            </Typography>
          </Box>

          {/* Security Settings */}
          <Divider />
          
          <Box>
            <Typography variant="subtitle1" fontWeight={500} gutterBottom>
              Security Settings
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={allowPasswordlessLogin}
                  onChange={(e) => handlePasswordlessToggle(e.target.checked)}
                  disabled={savingSecuritySetting}
                />
              }
              label="Allow passwordless login"
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 6, mt: -0.5, mb: 1 }}>
              Enable this if your media server users don't have passwords set
            </Typography>

            {allowPasswordlessLogin && (
              <Alert 
                severity="warning" 
                icon={<WarningIcon />}
                sx={{ mt: 1 }}
              >
                <Typography variant="body2" fontWeight={500}>
                  Security Warning
                </Typography>
                <Typography variant="body2">
                  Only enable this if your Aperture instance is on a private network with no internet exposure. 
                  If your server is accessible via reverse proxy or the internet, leave this disabled to prevent unauthorized access.
                </Typography>
              </Alert>
            )}

            {securitySuccess && (
              <Alert severity="success" sx={{ mt: 1 }} onClose={() => setSecuritySuccess(null)}>
                {securitySuccess}
              </Alert>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}
