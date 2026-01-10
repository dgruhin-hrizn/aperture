import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  InputAdornment,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import { useSetupStatus } from '@/hooks/useSetupStatus'

interface MediaServerType {
  id: string
  name: string
}

const steps = ['Welcome', 'Media Server', 'AI Features', 'Complete']

export function SetupPage() {
  const navigate = useNavigate()
  const { status, markComplete } = useSetupStatus()
  const [activeStep, setActiveStep] = useState(0)
  
  // Media Server state
  const [mediaServerTypes, setMediaServerTypes] = useState<MediaServerType[]>([])
  const [serverType, setServerType] = useState<string>('emby')
  const [serverUrl, setServerUrl] = useState('')
  const [serverApiKey, setServerApiKey] = useState('')
  const [serverName, setServerName] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  
  // OpenAI state
  const [openaiKey, setOpenaiKey] = useState('')
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  
  // UI state
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testSuccess, setTestSuccess] = useState(false)
  const [openaiTestSuccess, setOpenaiTestSuccess] = useState(false)

  // Redirect if setup is already complete
  useEffect(() => {
    if (status && !status.needsSetup) {
      navigate('/login')
    }
  }, [status, navigate])

  // Fetch media server types
  useEffect(() => {
    fetch('/api/setup/media-server-types')
      .then(res => res.json())
      .then(data => setMediaServerTypes(data.types || []))
      .catch(() => setMediaServerTypes([
        { id: 'emby', name: 'Emby' },
        { id: 'jellyfin', name: 'Jellyfin' }
      ]))
  }, [])

  const handleTestMediaServer = async () => {
    setTesting(true)
    setError('')
    setTestSuccess(false)

    try {
      const response = await fetch('/api/setup/media-server/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: serverType,
          baseUrl: serverUrl,
          apiKey: serverApiKey,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setTestSuccess(true)
        setServerName(data.serverName || '')
      } else {
        setError(data.error || 'Connection test failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSaveMediaServer = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/setup/media-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: serverType,
          baseUrl: serverUrl,
          apiKey: serverApiKey,
        }),
      })

      const data = await response.json()
      
      if (data.success || response.ok) {
        setActiveStep(2) // Move to OpenAI step
      } else {
        setError(data.error || 'Failed to save configuration')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleTestOpenAI = async () => {
    setTesting(true)
    setError('')
    setOpenaiTestSuccess(false)

    try {
      const response = await fetch('/api/setup/openai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openaiKey }),
      })

      const data = await response.json()
      
      if (data.success) {
        setOpenaiTestSuccess(true)
      } else {
        setError(data.error || 'API key validation failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API key validation failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSaveOpenAI = async () => {
    if (!openaiKey) {
      // Skip OpenAI configuration
      handleCompleteSetup()
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/setup/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: openaiKey }),
      })

      const data = await response.json()
      
      if (data.success || response.ok) {
        handleCompleteSetup()
      } else {
        setError(data.error || 'Failed to save API key')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteSetup = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json()
      
      if (data.success || response.ok) {
        markComplete()
        setActiveStep(3) // Move to complete step
      } else {
        setError(data.error || 'Failed to complete setup')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup')
    } finally {
      setSaving(false)
    }
  }

  const renderWelcomeStep = () => (
    <Box textAlign="center">
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 2,
        }}
      >
        Welcome to Aperture
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Aperture is an AI-powered recommendation engine for your media server.
        It learns your viewing habits and suggests movies and TV shows you'll love.
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Let's get you set up in just a few minutes.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={() => setActiveStep(1)}
        sx={{ mt: 2 }}
      >
        Get Started
      </Button>
    </Box>
  )

  const renderMediaServerStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Connect Your Media Server
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Aperture works with Emby and Jellyfin. Enter your server details below.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {testSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          Connected to {serverName || 'media server'}!
        </Alert>
      )}

      <FormControl fullWidth margin="normal">
        <InputLabel>Server Type</InputLabel>
        <Select
          value={serverType}
          label="Server Type"
          onChange={(e) => {
            setServerType(e.target.value)
            setTestSuccess(false)
          }}
        >
          {mediaServerTypes.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Server URL"
        placeholder="http://192.168.1.100:8096"
        value={serverUrl}
        onChange={(e) => {
          setServerUrl(e.target.value)
          setTestSuccess(false)
        }}
        margin="normal"
        helperText="Include the protocol (http/https) and port"
      />

      <TextField
        fullWidth
        label="API Key"
        type={showApiKey ? 'text' : 'password'}
        value={serverApiKey}
        onChange={(e) => {
          setServerApiKey(e.target.value)
          setTestSuccess(false)
        }}
        margin="normal"
        helperText={`Find this in your ${serverType === 'emby' ? 'Emby' : 'Jellyfin'} dashboard under API Keys`}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowApiKey(!showApiKey)} edge="end">
                {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          onClick={handleTestMediaServer}
          disabled={testing || !serverUrl || !serverApiKey}
        >
          {testing ? <CircularProgress size={20} /> : 'Test Connection'}
        </Button>
        <Button
          variant="contained"
          onClick={handleSaveMediaServer}
          disabled={saving || !testSuccess}
        >
          {saving ? <CircularProgress size={20} /> : 'Continue'}
        </Button>
      </Box>
    </Box>
  )

  const renderOpenAIStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        AI Features (Optional)
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Aperture uses OpenAI to generate personalized recommendations and explanations.
        You can skip this step and configure it later.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {openaiTestSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          OpenAI API key is valid!
        </Alert>
      )}

      <TextField
        fullWidth
        label="OpenAI API Key"
        type={showOpenaiKey ? 'text' : 'password'}
        value={openaiKey}
        onChange={(e) => {
          setOpenaiKey(e.target.value)
          setOpenaiTestSuccess(false)
        }}
        margin="normal"
        placeholder="sk-..."
        helperText="Get your API key from platform.openai.com"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowOpenaiKey(!showOpenaiKey)} edge="end">
                {showOpenaiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        {openaiKey && (
          <Button
            variant="outlined"
            onClick={handleTestOpenAI}
            disabled={testing || !openaiKey}
          >
            {testing ? <CircularProgress size={20} /> : 'Test Key'}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSaveOpenAI}
          disabled={saving || (!!openaiKey && !openaiTestSuccess)}
        >
          {saving ? (
            <CircularProgress size={20} />
          ) : openaiKey ? (
            'Save & Complete'
          ) : (
            'Skip & Complete'
          )}
        </Button>
      </Box>
    </Box>
  )

  const renderCompleteStep = () => (
    <Box textAlign="center">
      <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        Setup Complete!
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Aperture is ready to use. Sign in with your media server credentials to get started.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={() => navigate('/login')}
        sx={{ mt: 2 }}
      >
        Go to Login
      </Button>
    </Box>
  )

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderWelcomeStep()
      case 1:
        return renderMediaServerStep()
      case 2:
        return renderOpenAIStep()
      case 3:
        return renderCompleteStep()
      default:
        return null
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0f0f0f 100%)',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 600,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {activeStep < 3 && (
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          {renderStepContent()}
        </CardContent>
      </Card>
    </Box>
  )
}

